import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';

const POONAWALA_SCHEMES = {
  standard: {
    name: 'Standard Education Loan',
    minRate: 11.25,
    maxRate: 13.5,
    minAmount: 500000,
    maxAmount: 10000000,
    minTenure: 5,
    maxTenure: 15,
    processingFeeMin: 1,
    processingFeeMax: 2,
    minGPA: 6.0,
    collateralRequired: (amount) => amount > 2000000,
  },
  premium: {
    name: 'Premium Education Loan',
    minRate: 10.5,
    maxRate: 12,
    minAmount: 2000000,
    maxAmount: 10000000,
    minTenure: 5,
    maxTenure: 15,
    processingFeeMin: 0.5,
    processingFeeMax: 1.5,
    minGPA: 7.5,
    collateralRequired: true,
  },
  topup: {
    name: 'Top-Up Education Loan',
    minRate: 12,
    maxRate: 14,
    minAmount: 1000000,
    maxAmount: 5000000,
    minTenure: 3,
    maxTenure: 10,
    processingFeeMin: 1,
    processingFeeMax: 2,
    minGPA: 6.5,
    collateralRequired: true,
  },
};

function assessEligibility(currentLoan, studentProfile) {
  const reasons = [];
  const blockers = [];
  let eligibilityScore = 0;

  // Check 1: Loan fully disbursed and in repayment
  if (!currentLoan.repaymentStartDate) {
    blockers.push('Loan must be in repayment phase');
  } else {
    const monthsRepaying = Math.floor(
      (new Date() - new Date(currentLoan.repaymentStartDate)) / (1000 * 60 * 60 * 24 * 30)
    );
    if (monthsRepaying >= 3) {
      reasons.push(`Good repayment history: ${monthsRepaying} months of EMI paid`);
      eligibilityScore += 20;
    } else {
      blockers.push(`Minimum 3 months of repayment required. Current: ${monthsRepaying} months`);
    }
  }

  // Check 2: Outstanding balance in acceptable range
  if (currentLoan.outstandingBalance < 500000) {
    blockers.push('Outstanding balance must be at least ₹5L');
  } else if (currentLoan.outstandingBalance > 10000000) {
    reasons.push('Large loan amount eligible for premium schemes');
    eligibilityScore += 15;
  } else {
    reasons.push('Outstanding balance within acceptable range');
    eligibilityScore += 15;
  }

  // Check 3: Academic Profile
  if (studentProfile?.gpaPercentage) {
    const gpa = parseFloat(studentProfile.gpaPercentage);
    if (gpa >= 8.5) {
      reasons.push(`Strong academic profile: ${gpa}%`);
      eligibilityScore += 25;
    } else if (gpa >= 7.0) {
      reasons.push(`Good academic profile: ${gpa}%`);
      eligibilityScore += 15;
    } else if (gpa >= 6.0) {
      reasons.push(`Acceptable academic profile: ${gpa}%`);
      eligibilityScore += 10;
    } else {
      blockers.push(`GPA ${gpa}% below minimum threshold of 6.0%`);
    }
  }

  // Check 4: Target Country
  if (studentProfile?.targetCountries?.length > 0) {
    const premiumCountries = ['UK', 'USA', 'Canada', 'Australia'];
    const hasPreferredCountry = studentProfile.targetCountries.some((c) =>
      premiumCountries.some((pc) => c.toLowerCase().includes(pc.toLowerCase()))
    );
    if (hasPreferredCountry) {
      reasons.push(`Target country: ${studentProfile.targetCountries.join(', ')} (preferred)`);
      eligibilityScore += 15;
    } else {
      reasons.push(`Target country: ${studentProfile.targetCountries.join(', ')}`);
      eligibilityScore += 5;
    }
  }

  // Check 5: Course Type
  if (studentProfile?.fieldOfStudy) {
    const stemFields = ['Computer Science', 'Engineering', 'Data Science', 'AI', 'ML', 'IT'];
    const isStem = stemFields.some((field) =>
      studentProfile.fieldOfStudy.toLowerCase().includes(field.toLowerCase())
    );
    if (isStem) {
      reasons.push(`STEM field: ${studentProfile.fieldOfStudy} (preferred)`);
      eligibilityScore += 10;
    } else {
      reasons.push(`Field of study: ${studentProfile.fieldOfStudy}`);
      eligibilityScore += 5;
    }
  }

  // Determine eligible schemes
  const eligibleSchemes = [];
  const gpa = studentProfile?.gpaPercentage ? parseFloat(studentProfile.gpaPercentage) : 0;

  if (gpa >= POONAWALA_SCHEMES.premium.minGPA && currentLoan.outstandingBalance >= POONAWALA_SCHEMES.premium.minAmount) {
    eligibleSchemes.push('premium');
  }
  if (gpa >= POONAWALA_SCHEMES.standard.minGPA) {
    eligibleSchemes.push('standard');
  }
  if (gpa >= POONAWALA_SCHEMES.topup.minGPA && currentLoan.outstandingBalance >= POONAWALA_SCHEMES.topup.minAmount) {
    eligibleSchemes.push('topup');
  }

  const isEligible = blockers.length === 0 && eligibleSchemes.length > 0;

  return {
    isEligible,
    eligibilityScore: Math.min(100, eligibilityScore),
    reasons,
    blockers,
    eligibleSchemes,
  };
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentLoan } = await request.json();
    if (!currentLoan) {
      return NextResponse.json({ error: 'Current loan details required' }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findById(session.user.id).select('studentProfile');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const eligibility = assessEligibility(currentLoan, user.studentProfile);

    return NextResponse.json({
      eligibility,
      schemes: POONAWALA_SCHEMES,
    });
  } catch (err) {
    console.error('[loan/eligibility] Error:', err);
    return NextResponse.json(
      { error: 'Failed to assess eligibility', details: err.message },
      { status: 500 }
    );
  }
}
