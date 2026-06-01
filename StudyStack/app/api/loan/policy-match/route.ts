import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import LoanApplication from '@/lib/models/LoanApplication';
import LenderPolicy from '@/lib/models/LenderPolicy';
import type { IExtractedPolicies } from '@/lib/models/LenderPolicy';

/* ────────────────────────────────────────────────────────────────────────────
 *  POST /api/loan/policy-match
 *
 *  Evaluates a student's profile against ALL active lender policies.
 *  Produces transparent, rule-based eligibility results for each policy.
 *
 *  This SUPPLEMENTS the existing Exa-based search — it doesn't replace it.
 *  Results are stored in LoanApplication.policyMatchResults.
 * ──────────────────────────────────────────────────────────────────────────── */

interface StudentFinancialProfile {
  gpa: number | null;
  targetCountry: string;
  degreeType: string;
  courseType: string;
  familyIncome: number;
  coApplicantIncome: number;
  hasCoApplicant: boolean;
  collateralAvailable: boolean;
  loanAmountNeeded: number;
  university: string;
  workExperienceYears: number;
  age: number | null;
}

function evaluateAgainstPolicy(
  student: StudentFinancialProfile,
  policy: IExtractedPolicies,
  lenderName: string,
  productName: string,
  policyId: string
) {
  const reasons: { criterion: string; met: boolean; detail: string }[] = [];
  let score = 0;
  let maxScore = 0;

  // ── Country Support ──────────────────────────────────────────────
  if (policy.eligibility?.supportedCountries?.length > 0) {
    maxScore += 20;
    const supported = policy.eligibility.supportedCountries.map(c => c.toLowerCase());
    const studentCountry = student.targetCountry.toLowerCase();
    const met = supported.includes(studentCountry) || supported.includes('all');
    if (met) score += 20;
    reasons.push({
      criterion: 'Country Support',
      met,
      detail: met
        ? `${student.targetCountry} is supported by ${lenderName}`
        : `${student.targetCountry} is not in the supported list: ${policy.eligibility.supportedCountries.join(', ')}`,
    });
  }

  // ── Degree Type ──────────────────────────────────────────────────
  if (policy.eligibility?.supportedDegrees?.length > 0) {
    maxScore += 15;
    const supported = policy.eligibility.supportedDegrees.map(d => d.toLowerCase());
    const studentDegree = student.degreeType.toLowerCase();
    const met = supported.some(d => studentDegree.includes(d) || d.includes(studentDegree)) || supported.includes('all');
    if (met) score += 15;
    reasons.push({
      criterion: 'Degree Type',
      met,
      detail: met
        ? `${student.degreeType} is supported`
        : `${student.degreeType} not in: ${policy.eligibility.supportedDegrees.join(', ')}`,
    });
  }

  // ── GPA Requirement ──────────────────────────────────────────────
  if (policy.eligibility?.minGPA != null && policy.eligibility.minGPA > 0) {
    maxScore += 15;
    if (student.gpa != null) {
      const met = student.gpa >= policy.eligibility.minGPA;
      if (met) score += 15;
      reasons.push({
        criterion: 'Minimum GPA',
        met,
        detail: met
          ? `Your GPA (${student.gpa}) meets the requirement (${policy.eligibility.minGPA})`
          : `Your GPA (${student.gpa}) is below the requirement (${policy.eligibility.minGPA})`,
      });
    } else {
      reasons.push({
        criterion: 'Minimum GPA',
        met: false,
        detail: `GPA information not provided. Minimum required: ${policy.eligibility.minGPA}`,
      });
    }
  }

  // ── Co-Applicant Income ──────────────────────────────────────────
  if (policy.eligibility?.minCoApplicantIncomeINR != null && policy.eligibility.minCoApplicantIncomeINR > 0) {
    maxScore += 20;
    const income = student.coApplicantIncome || student.familyIncome;
    if (income > 0) {
      const met = income >= policy.eligibility.minCoApplicantIncomeINR;
      if (met) score += 20;
      const reqLakhs = (policy.eligibility.minCoApplicantIncomeINR / 100000).toFixed(1);
      const actualLakhs = (income / 100000).toFixed(1);
      reasons.push({
        criterion: 'Co-Applicant Income',
        met,
        detail: met
          ? `Income ₹${actualLakhs}L meets the minimum ₹${reqLakhs}L requirement`
          : `Income ₹${actualLakhs}L is below the minimum ₹${reqLakhs}L requirement`,
      });
    } else {
      reasons.push({
        criterion: 'Co-Applicant Income',
        met: false,
        detail: `Income information not provided. Minimum required: ₹${(policy.eligibility.minCoApplicantIncomeINR / 100000).toFixed(1)}L`,
      });
    }
  }

  // ── Co-Applicant Requirement ─────────────────────────────────────
  if (policy.eligibility?.requiresCoApplicant) {
    maxScore += 10;
    const met = student.hasCoApplicant;
    if (met) score += 10;
    reasons.push({
      criterion: 'Co-Applicant Required',
      met,
      detail: met
        ? 'Co-applicant is available as required'
        : 'This lender requires a co-applicant',
    });
  }

  // ── Collateral ───────────────────────────────────────────────────
  if (policy.financial?.collateralRequired) {
    maxScore += 15;
    const threshold = policy.financial.collateralThresholdINR || 0;
    if (threshold > 0 && student.loanAmountNeeded > threshold) {
      const met = student.collateralAvailable;
      if (met) score += 15;
      reasons.push({
        criterion: 'Collateral',
        met,
        detail: met
          ? `Collateral available. Required for loans above ₹${(threshold / 100000).toFixed(0)}L`
          : `Collateral required for loans above ₹${(threshold / 100000).toFixed(0)}L but not available`,
      });
    } else {
      const met = student.collateralAvailable;
      if (met) score += 15;
      reasons.push({
        criterion: 'Collateral',
        met,
        detail: met
          ? 'Collateral available as required by lender'
          : 'This lender requires collateral which is not available',
      });
    }
  } else {
    // No collateral required — bonus for student
    reasons.push({
      criterion: 'Collateral',
      met: true,
      detail: 'No collateral required — unsecured loan available',
    });
  }

  // ── Loan Amount ──────────────────────────────────────────────────
  if (policy.financial?.maxLoanAmountINR && policy.financial.maxLoanAmountINR > 0) {
    maxScore += 10;
    if (student.loanAmountNeeded > 0) {
      const met = student.loanAmountNeeded <= policy.financial.maxLoanAmountINR;
      if (met) score += 10;
      reasons.push({
        criterion: 'Loan Amount',
        met,
        detail: met
          ? `Requested ₹${(student.loanAmountNeeded / 100000).toFixed(0)}L is within the max ₹${(policy.financial.maxLoanAmountINR / 100000).toFixed(0)}L`
          : `Requested ₹${(student.loanAmountNeeded / 100000).toFixed(0)}L exceeds the max ₹${(policy.financial.maxLoanAmountINR / 100000).toFixed(0)}L`,
      });
    }
  }

  // ── University Approval ──────────────────────────────────────────
  if (policy.restrictions?.approvedUniversities?.length > 0) {
    maxScore += 10;
    if (student.university) {
      const approved = policy.restrictions.approvedUniversities.map(u => u.toLowerCase());
      const met = approved.some(u =>
        student.university.toLowerCase().includes(u) || u.includes(student.university.toLowerCase())
      );
      if (met) score += 10;
      reasons.push({
        criterion: 'University Approval',
        met,
        detail: met
          ? `${student.university} is in the approved university list`
          : `${student.university} may not be in the approved list. Check with lender.`,
      });
    } else {
      reasons.push({
        criterion: 'University Approval',
        met: false,
        detail: 'University information not provided. This lender has a restricted approved list.',
      });
    }
  }

  // ── Work Experience ──────────────────────────────────────────────
  if (policy.eligibility?.workExperienceRequired && policy.eligibility?.minWorkExperienceYears) {
    maxScore += 5;
    const met = student.workExperienceYears >= policy.eligibility.minWorkExperienceYears;
    if (met) score += 5;
    reasons.push({
      criterion: 'Work Experience',
      met,
      detail: met
        ? `${student.workExperienceYears} years meets the ${policy.eligibility.minWorkExperienceYears} year requirement`
        : `${student.workExperienceYears} years below the ${policy.eligibility.minWorkExperienceYears} year requirement`,
    });
  }

  // Calculate final score
  const matchScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 50;
  const eligible = matchScore >= 70;
  const partiallyEligible = matchScore >= 40 && matchScore < 70;

  const rateRange = policy.financial
    ? `${policy.financial.interestRateMin || '?'}% - ${policy.financial.interestRateMax || '?'}%`
    : 'N/A';

  return {
    policyId,
    lenderName,
    productName,
    eligible,
    partiallyEligible,
    matchScore,
    reasons,
    interestRateRange: rateRange,
    maxLoanAmountINR: policy.financial?.maxLoanAmountINR || 0,
    collateralRequired: policy.financial?.collateralRequired || false,
    specialFeatures: policy.specialFeatures || [],
  };
}

export async function POST(request: Request) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const user = await User.findById(session.user.id).lean();
    if (!user?.studentProfile) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }

    // Accept optional overrides from request body
    let overrides: any = {};
    try {
      overrides = await request.json();
    } catch { /* empty body is fine */ }

    const rawProfile = user.studentProfile as Record<string, unknown>;

    // Build student financial profile
    const parseIncome = (val: any): number => {
      if (typeof val === 'number') return val;
      if (typeof val !== 'string') return 0;
      const lower = val.toLowerCase().replace(/[₹,]/g, '');
      const num = parseFloat(lower.replace(/[^\d.]/g, ''));
      if (isNaN(num)) return 0;
      if (lower.includes('crore') || lower.includes('cr')) return num * 10000000;
      if (lower.includes('lakh') || lower.includes('lac') || lower.includes('l')) return num * 100000;
      if (lower.includes('lpa')) return num * 100000;
      if (num > 10000) return num;
      return num * 100000;
    };

    const student: StudentFinancialProfile = {
      gpa: parseFloat(String(overrides.gpa || rawProfile.gpaPercentage || rawProfile.gpa || '')) || null,
      targetCountry: overrides.targetCountry
        || (Array.isArray(rawProfile.targetCountries) ? (rawProfile.targetCountries as string[])[0] : null)
        || (Array.isArray(rawProfile.targetCountry) ? (rawProfile.targetCountry as string[])[0] : rawProfile.targetCountry as string)
        || 'UK',
      degreeType: overrides.degreeType || (rawProfile.courseInterest as string) || (rawProfile.fieldOfStudy as string) || 'Masters',
      courseType: overrides.courseType || 'Full-time',
      familyIncome: parseIncome(overrides.familyIncome || rawProfile.familyIncome || rawProfile.budgetRange || 0),
      coApplicantIncome: parseIncome(overrides.coApplicantIncome || rawProfile.coApplicantIncome || 0),
      hasCoApplicant: overrides.hasCoApplicant ?? (rawProfile.hasCoApplicant as boolean) ?? true,
      collateralAvailable: overrides.collateralAvailable ?? (rawProfile.collateralAvailable as boolean) ?? false,
      loanAmountNeeded: parseIncome(overrides.loanAmountNeeded || rawProfile.budgetRange || 3500000),
      university: overrides.university || (rawProfile.institution as string) || '',
      workExperienceYears: Number(overrides.workExperienceYears || rawProfile.workExperience || 0),
      age: overrides.age || null,
    };

    // Fetch all active policies
    const activePolicies = await LenderPolicy.find({ status: 'active' }).lean();

    if (activePolicies.length === 0) {
      return NextResponse.json({
        matches: [],
        message: 'No active lender policies found. Ask your counsellor to upload and activate lender policies.',
        studentProfile: student,
      });
    }

    // Evaluate student against each policy
    const matches = activePolicies.map((policy: any) =>
      evaluateAgainstPolicy(
        student,
        policy.extractedPolicies,
        policy.lenderName,
        policy.productName,
        String(policy._id)
      )
    );

    // Sort by matchScore descending
    matches.sort((a, b) => b.matchScore - a.matchScore);

    // Save to LoanApplication
    const existingApp = await LoanApplication.findOne({ userId: session.user.id });
    if (existingApp) {
      existingApp.policyMatchResults = matches;
      existingApp.markModified('policyMatchResults');
      await existingApp.save();
    } else {
      try {
        await LoanApplication.create({
          userId: session.user.id,
          policyMatchResults: matches,
        });
      } catch (err: any) {
        if (err.code === 11000) {
          await LoanApplication.updateOne(
            { userId: session.user.id },
            { $set: { policyMatchResults: matches } }
          );
        } else {
          throw err;
        }
      }
    }

    return NextResponse.json({
      matches,
      studentProfile: student,
      activePoliciesCount: activePolicies.length,
    });
  } catch (error) {
    console.error('[policy-match] Error:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate policy matches', details: (error as Error).message },
      { status: 500 }
    );
  }
}
