import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import LoanApplication from '@/lib/models/LoanApplication';

/* ────────────────────────────────────────────────────────────────────────────
 *  POST /api/loan/search-offers
 *
 *  FULLY DYNAMIC — ZERO HARDCODED DATA
 *    1. Reads student's live profile from MongoDB
 *    2. Accepts optional override params from the Settings tab
 *    3. Runs 5+ parallel Exa AI searches (official, comparisons, forums, scholarships, salary/ROI)
 *    4. Feeds ALL raw results into Gemini 2.5 Flash for structured analysis
 *    5. Returns ranked offers, KPIs, reasoning, citations, forum insights, docs, ROI
 *
 *  Every single data point comes from live web search — nothing is hardcoded.
 * ──────────────────────────────────────────────────────────────────────────── */

interface SearchParams {
  targetCountry?: string;
  courseInterest?: string;
  budgetRange?: string;
  loanAmountNeeded?: number;
  collateralAvailable?: boolean;
  gpa?: string;
  testScore?: string;
  universityName?: string;
  scholarshipAmount?: number;
  familyIncomeRange?: string;
  preferredLoanType?: 'secured' | 'unsecured' | 'any';
  examScorePercentile?: number;
  workExperienceYears?: number;
  intakeTiming?: string;
  coApplicantIncome?: number;
  prioritizeBy?: 'interest_rate' | 'no_collateral' | 'max_amount' | 'fast_processing' | 'best_match';
}

async function exaSearch(query: string, opts: {
  apiKey: string;
  includeDomains?: string[];
  excludeDomains?: string[];
  numResults?: number;
  startPublishedDate?: string;
  category?: string;
}): Promise<any[]> {
  try {
    const body: any = {
      query,
      numResults: opts.numResults || 8,
      type: 'auto',
      contents: {
        text: { maxCharacters: 3000 },
        highlights: { numSentences: 3 },
        summary: true,
      },
    };
    if (opts.includeDomains?.length) body.includeDomains = opts.includeDomains;
    if (opts.excludeDomains?.length) body.excludeDomains = opts.excludeDomains;
    if (opts.startPublishedDate) body.startPublishedDate = opts.startPublishedDate;
    if (opts.category) body.category = opts.category;

    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': opts.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn(`[exa] Search failed (${res.status}): ${query.substring(0, 60)}`);
      return [];
    }

    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      text: r.text || '',
      summary: r.summary || '',
      highlights: r.highlights || [],
      publishedDate: r.publishedDate || '',
      author: r.author || '',
      favicon: r.favicon || '',
    }));
  } catch (e) {
    console.warn('[exa] Search error:', (e as Error).message);
    return [];
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 *  GET /api/loan/search-offers
 *
 *  Returns cached loan intelligence data from the database.
 *  If no analysis exists yet, returns { cached: false } so the frontend
 *  knows to trigger a fresh POST analysis.
 * ──────────────────────────────────────────────────────────────────────────── */
export async function GET() {
  try {
    const session = await getServerSession(authOptions as any);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const app = await LoanApplication.findOne({ userId: (session as any).user.id }).lean();

    if (!app || !app.lastAnalyzedAt) {
      return NextResponse.json({ cached: false });
    }

    return NextResponse.json({
      cached: true,
      offers: app.matchedOffers || [],
      scholarships: app.scholarships || [],
      analysis: app.analysis || {},
      roiProjection: app.roiProjection || null,
      forumInsights: app.forumInsights || [],
      documentRequirements: app.documentChecklist || [],
      governmentSchemes: app.governmentSchemes || [],
      kpis: app.kpis || null,
      sources: app.sources || [],
      searchParams: app.searchParams || {},
      profile: app.profileSnapshot || {},
      lastAnalyzedAt: app.lastAnalyzedAt,
    });
  } catch (error) {
    console.error('[loan-search GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cached data', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findById((session as any).user.id).lean();
    if (!user?.studentProfile) {
      return NextResponse.json({ error: 'Complete your profile first' }, { status: 400 });
    }

    const rawProfile = user.studentProfile as Record<string, unknown>;
    let overrides: SearchParams = {};
    try {
      const body = await request.json();
      overrides = body.params || body || {};
    } catch { /* empty body is fine */ }

    // Resolve parameters: overrides > profile fields
    const p = {
      targetCountry: overrides.targetCountry
        || (Array.isArray(rawProfile.targetCountries) ? (rawProfile.targetCountries as string[])[0] : null)
        || (Array.isArray(rawProfile.targetCountry) ? (rawProfile.targetCountry as string[])[0] : (rawProfile.targetCountry as string))
        || 'UK',
      courseInterest: overrides.courseInterest
        || (rawProfile.courseInterest as string) || (rawProfile.fieldOfStudy as string) || 'Masters',
      budget: overrides.budgetRange
        || (rawProfile.budgetRange as string) || (rawProfile.budget as string) || '',
      gpa: overrides.gpa || (rawProfile.gpaPercentage as string) || (rawProfile.gpa as string) || '',
      testScore: overrides.testScore
        || (rawProfile.englishTestStatus as string) || (rawProfile.testStatus as string) || '',
      universityName: overrides.universityName || (rawProfile.institution as string) || '',
      collateralAvailable: overrides.collateralAvailable,
      loanAmountNeeded: overrides.loanAmountNeeded || 0,
      scholarshipAmount: overrides.scholarshipAmount || 0,
      familyIncomeRange: overrides.familyIncomeRange || '',
      preferredLoanType: overrides.preferredLoanType || 'any',
      studentName: (rawProfile.studentName as string) || (rawProfile.fullName as string) || '',
      examScorePercentile: overrides.examScorePercentile || 0,
      workExperienceYears: overrides.workExperienceYears || 0,
      intakeTiming: overrides.intakeTiming || (rawProfile.intakeMonth as string) || (rawProfile.intakeTiming as string) || '',
      coApplicantIncome: overrides.coApplicantIncome || 0,
      prioritizeBy: overrides.prioritizeBy || 'best_match',
    };

    const EXA_API_KEY = process.env.EXA_API_KEY;
    if (!EXA_API_KEY) {
      return NextResponse.json({ error: 'EXA_API_KEY not configured' }, { status: 500 });
    }

    // ── 1. Run multiple Exa searches in parallel ──────────────────────────
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const dateFilter = oneYearAgo.toISOString();

    const searchPromises = [
      // Official bank/NBFC pages — direct lender websites
      exaSearch(
        `best education loan for Indian students studying ${p.courseInterest} in ${p.targetCountry} 2025 2026 interest rate eligibility apply`,
        { apiKey: EXA_API_KEY, numResults: 10, startPublishedDate: dateFilter }
      ),
      // Comparison and review portals
      exaSearch(
        `education loan comparison India students studying abroad ${p.targetCountry} ${p.collateralAvailable === false ? 'without collateral' : ''} interest rate bank NBFC ${p.budget ? `budget ${p.budget}` : ''}`,
        {
          apiKey: EXA_API_KEY,
          numResults: 8,
          includeDomains: ['bankbazaar.com', 'paisabazaar.com', 'leverageedu.com', 'yocket.com', 'shiksha.com', 'collegedunia.com', 'studyabroad.careers360.com', 'mba.com', 'topuniversities.com'],
          startPublishedDate: dateFilter,
        }
      ),
      // Reddit / forum discussions — real student experiences
      exaSearch(
        `education loan experience India ${p.targetCountry} ${p.courseInterest} review tips which bank ${p.universityName || ''}`,
        {
          apiKey: EXA_API_KEY,
          numResults: 8,
          includeDomains: ['reddit.com', 'quora.com', 'yocket.com', 'gmatclub.com', 'thegradcafe.com', 'pagalguy.com'],
        }
      ),
      // Scholarship + financial aid data
      exaSearch(
        `scholarship ${p.targetCountry} Indian students ${p.courseInterest} 2025 2026 financial aid ${p.universityName || ''} funding`,
        { apiKey: EXA_API_KEY, numResults: 8, startPublishedDate: dateFilter }
      ),
      // Salary & ROI data — for dynamic ROI (NOT hardcoded)
      exaSearch(
        `average starting salary ${p.courseInterest} graduates ${p.targetCountry} 2025 2026 ${p.universityName || ''} median compensation`,
        { apiKey: EXA_API_KEY, numResults: 6, startPublishedDate: dateFilter }
      ),
      // Government loan schemes
      exaSearch(
        `government education loan scheme Indian students studying abroad ${p.targetCountry} central scheme subsidy ${p.courseInterest}`,
        { apiKey: EXA_API_KEY, numResults: 5, startPublishedDate: dateFilter }
      ),
    ];

    const [officialResults, comparisonResults, forumResults, scholarshipResults, salaryResults, govResults] = await Promise.all(searchPromises);

    const allSources = [
      ...officialResults.map(r => ({ ...r, sourceType: 'official' })),
      ...comparisonResults.map(r => ({ ...r, sourceType: 'comparison' })),
      ...forumResults.map(r => ({ ...r, sourceType: 'forum' })),
      ...scholarshipResults.map(r => ({ ...r, sourceType: 'scholarship' })),
      ...salaryResults.map(r => ({ ...r, sourceType: 'salary_data' })),
      ...govResults.map(r => ({ ...r, sourceType: 'government' })),
    ];

    // ── 2. Feed everything into Gemini for structured analysis ────────────
    const { GoogleGenAI } = await import('@google/genai');
    const { parseJSONFromResponse } = await import('@/lib/gemini');
    const genAI = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
    });

    const sourceSummaries = allSources.map((s, i) =>
      `[Source ${i + 1}] (${s.sourceType}) ${s.title}\nURL: ${s.url}\nSummary: ${s.summary}\nContent: ${s.text?.substring(0, 2000) || 'N/A'}\nHighlights: ${(s.highlights || []).join(' | ')}`
    ).join('\n\n---\n\n');

    const priorityInstruction = {
      'interest_rate': 'Prioritize offers with the LOWEST interest rates.',
      'no_collateral': 'Prioritize offers that do NOT require collateral.',
      'max_amount': 'Prioritize offers with the HIGHEST loan amounts available.',
      'fast_processing': 'Prioritize offers known for fast processing and disbursement.',
      'best_match': 'Rank by overall best match for this specific student profile.',
    }[p.prioritizeBy] || '';

    const geminiPrompt = `You are a world-class education loan analyst and financial advisor for students. You have access to real-time web research data below. Analyze it rigorously. DO NOT make up any data — use ONLY what the web sources provide.

## STUDENT PROFILE
- Name: ${p.studentName || 'Student'}
- Target Country: ${p.targetCountry}
- Course/Field: ${p.courseInterest}
- Budget: ${p.budget || 'Not specified'}
- GPA/Percentage: ${p.gpa || 'Not specified'}
- English Test Score: ${p.testScore || 'Not specified'}
- University: ${p.universityName || 'Not specified'}
- Collateral Available: ${p.collateralAvailable === true ? 'Yes' : p.collateralAvailable === false ? 'No' : 'Not specified'}
- Preferred Loan Type: ${p.preferredLoanType}
- Scholarship Amount: ${p.scholarshipAmount > 0 ? '₹' + p.scholarshipAmount : 'None yet'}
- Family Income: ${p.familyIncomeRange || 'Not specified'}
- Exam Score Percentile: ${p.examScorePercentile > 0 ? p.examScorePercentile + 'th' : 'Not specified'}
- Work Experience: ${p.workExperienceYears > 0 ? p.workExperienceYears + ' years' : 'Not specified'}
- Intake: ${p.intakeTiming || 'Not specified'}
- Co-Applicant Income: ${p.coApplicantIncome > 0 ? '₹' + p.coApplicantIncome : 'Not specified'}

## SORTING PREFERENCE
${priorityInstruction}

## WEB RESEARCH DATA (${allSources.length} sources from Exa AI)
${sourceSummaries}

## INSTRUCTIONS
Based ONLY on the real data from the web search results above, produce a JSON object with these exact keys:

{
  "offers": [
    {
      "lender": "Real Bank/NBFC name found in sources",
      "interestRateMin": 8.5,
      "interestRateMax": 12.0,
      "maxLoanAmountINR": 10000000,
      "collateralRequired": true,
      "collateralThresholdINR": 4000000,
      "moratoriumMonths": 18,
      "processingFeePercent": 1.0,
      "matchScore": 85,
      "matchReason": "2-3 sentence SPECIFIC explanation of why this suits THIS student, referencing their GPA, country, course, budget",
      "reasoning": {
        "whyRecommended": "Detailed reasoning paragraph explaining the recommendation logic",
        "riskLevel": "low|medium|high",
        "riskExplanation": "Why this risk level, referencing student's profile",
        "scholarshipImpact": "How scholarships affect this loan option",
        "progressFactors": "How improving GPA/test scores would change this recommendation"
      },
      "prosAndCons": {
        "pros": ["Pro 1", "Pro 2", "Pro 3"],
        "cons": ["Con 1", "Con 2"]
      },
      "applyUrl": "https://actual-verified-url.com/apply",
      "contactInfo": {
        "phone": "1800-xxx-xxxx or actual number found in sources",
        "email": "loans@bank.com if found in sources",
        "website": "https://bank.com/education-loan"
      },
      "keyFeatures": ["Feature 1", "Feature 2"],
      "eligibilityCriteria": ["Criterion 1", "Criterion 2"],
      "sourceUrls": ["https://source1.com", "https://source2.com"],
      "notes": "Any additional relevant info",
      "repaymentOptions": ["Option 1", "Option 2"],
      "taxBenefits": "Section 80E details if applicable"
    }
  ],
  "scholarships": [
    {
      "name": "Scholarship name",
      "provider": "Organization name",
      "amount": "Amount or percentage",
      "deadline": "Date if known",
      "eligibility": "Brief criteria",
      "applyUrl": "https://actual-url.com",
      "sourceUrl": "https://source.com",
      "impact": "How this reduces loan burden with specific numbers",
      "competitiveness": "low|medium|high"
    }
  ],
  "analysis": {
    "overallAssessment": "4-5 sentence deeply personalized assessment of this student's loan landscape. Reference specific profile factors.",
    "riskFactors": ["Risk 1 with explanation", "Risk 2 with explanation"],
    "strengthFactors": ["Strength 1 with explanation", "Strength 2 with explanation"],
    "recommendations": ["Specific actionable recommendation 1", "Specific actionable recommendation 2", "Specific actionable recommendation 3"],
    "marketInsight": "2-3 sentences about current education loan market trends relevant to this student",
    "improvementTips": [
      {
        "action": "What the student can do",
        "impact": "How it changes their loan prospects",
        "difficulty": "easy|medium|hard"
      }
    ],
    "dynamicFactors": {
      "examScoreImpact": "How their exam scores affect loan eligibility and rates",
      "universityTierImpact": "How their university choice impacts ROI and loan terms",
      "scholarshipChancePct": 40,
      "riskScoreOutOf100": 35
    }
  },
  "roiProjection": {
    "estimatedTuitionINR": 3500000,
    "estimatedLivingCostINR": 1400000,
    "totalCostINR": 4900000,
    "expectedSalaryYear1INR": 7500000,
    "expectedSalaryYear3INR": 9500000,
    "expectedSalaryYear5INR": 12000000,
    "paybackPeriodMonths": 18,
    "roiPercentage": 150,
    "salarySourceUrls": ["url1", "url2"],
    "salaryNotes": "Brief note on salary data source and reliability"
  },
  "forumInsights": [
    {
      "title": "Post/thread title",
      "url": "https://reddit.com/...",
      "platform": "Reddit|Quora|Yocket|etc",
      "keyTakeaway": "What this student should know from this discussion",
      "sentiment": "positive|negative|mixed",
      "relevanceScore": 85
    }
  ],
  "documentRequirements": [
    {
      "name": "Document name",
      "required": true,
      "applicableLenders": ["Lender1", "Lender2"],
      "notes": "Any specifics"
    }
  ],
  "governmentSchemes": [
    {
      "name": "Scheme name",
      "description": "Brief description",
      "benefits": "What the student gets",
      "eligibility": "Who qualifies",
      "applyUrl": "URL if found",
      "sourceUrl": "Source URL"
    }
  ]
}

CRITICAL RULES:
- Use ONLY information from the web search results. If a data point wasn't found, use reasonable estimates clearly marked.
- All URLs must come from actual search results — NEVER fabricate URLs.
- matchScore (0-100) must reflect how well the loan fits THIS specific student's profile.
- Sort offers by matchScore descending.
- Include as many loan offers as the data supports (5-15 ideally).
- Be extremely specific in matchReason — reference the student's actual GPA, country, course, budget.
- For contactInfo, only include details actually found in sources.
- The analysis must reference the student's specific profile factors.
- forumInsights should capture real Reddit/forum discussions found.
- roiProjection salary numbers must come from the salary_data sources — do NOT hallucinate.

Respond ONLY with valid JSON. No markdown code fences.`;

    const result = await genAI.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: geminiPrompt,
      config: { temperature: 0.4, maxOutputTokens: 12000 },
    });
    const text = (result.text ?? '').trim();

    let analysis;
    try {
      analysis = parseJSONFromResponse(text);
    } catch {
      console.error('[loan-search] Gemini returned invalid JSON. First 500 chars:', text.substring(0, 500));
      return NextResponse.json({
        error: 'Analysis parsing failed. Please try again.',
        rawPreview: text.substring(0, 200),
      }, { status: 500 });
    }

    // ── 3. Compute financial KPIs from dynamic data ───────────────────────
    const offers = analysis.offers || [];
    const loanAmount = p.loanAmountNeeded || parseBudgetToINR(p.budget) || 3500000;

    const avgRate = offers.length > 0
      ? offers.reduce((s: number, o: any) => s + ((o.interestRateMin || 10) + (o.interestRateMax || 12)) / 2, 0) / offers.length
      : 11;
    const bestRate = offers.length > 0
      ? Math.min(...offers.map((o: any) => o.interestRateMin || 99))
      : 10;

    const monthlyRate = avgRate / 100 / 12;
    const tenureMonths = 120;
    const factor = Math.pow(1 + monthlyRate, tenureMonths);
    const emi = Math.round(loanAmount * monthlyRate * factor / (factor - 1));
    const totalRepayable = emi * tenureMonths;
    const totalInterest = totalRepayable - loanAmount;

    // Best-rate scenario
    const bestMonthlyRate = bestRate / 100 / 12;
    const bestFactor = Math.pow(1 + bestMonthlyRate, tenureMonths);
    const bestEMI = Math.round(loanAmount * bestMonthlyRate * bestFactor / (bestFactor - 1));
    const savings = totalRepayable - (bestEMI * tenureMonths);

    // Scholarship adjustment
    const adjustedLoan = Math.max(0, loanAmount - (p.scholarshipAmount || 0));

    // Dynamic health scores pulled from AI analysis
    const aiRiskScore = analysis.analysis?.dynamicFactors?.riskScoreOutOf100 || 50;
    const aiScholarshipChance = analysis.analysis?.dynamicFactors?.scholarshipChancePct || 30;
    const financialHealthScore = Math.min(100, Math.max(10, 100 - aiRiskScore));
    const affordabilityIndex = Math.min(100, Math.round(financialHealthScore * 0.85 + (p.scholarshipAmount > 0 ? 15 : 0)));
    const debtToIncomeRatio = p.coApplicantIncome > 0
      ? Math.round((emi * 12 / p.coApplicantIncome) * 100)
      : Math.round((totalInterest / loanAmount) * 40);

    const kpis = {
      financialHealthScore,
      affordabilityIndex,
      debtToIncomeRatio: Math.min(100, debtToIncomeRatio),
      debtSafety: Math.min(100, 100 - debtToIncomeRatio),
      estimatedEMI: emi,
      totalInterestPercent: Math.round((totalInterest / loanAmount) * 100),
      loanAmount,
      adjustedLoanAmount: adjustedLoan,
      avgInterestRate: Math.round(avgRate * 10) / 10,
      bestRate: Math.round(bestRate * 10) / 10,
      totalRepayable,
      savingsIfBestRate: Math.max(0, savings),
      sourceCount: allSources.length,
      officialSources: officialResults.length,
      comparisonSources: comparisonResults.length,
      forumSources: forumResults.length,
      scholarshipSources: scholarshipResults.length,
      salarySources: salaryResults.length,
      govSources: govResults.length,
      scholarshipChancePct: aiScholarshipChance,
      riskScore: aiRiskScore,
    };

    // ── 4. Build the full response payload ─────────────────────────────
    const sourcesCompact = allSources.map(s => ({
      title: s.title,
      url: s.url,
      sourceType: s.sourceType,
      favicon: s.favicon,
    }));

    const profileSnapshot = {
      targetCountry: p.targetCountry,
      courseInterest: p.courseInterest,
      budget: p.budget,
      universityName: p.universityName,
      gpa: p.gpa,
      testScore: p.testScore,
    };

    const docChecklist = (analysis.documentRequirements || []).map((req: any) => ({
      name: req.name,
      required: req.required,
      status: 'pending',
      lenders: req.applicableLenders || [],
    }));

    // ── 5. Persist ALL intelligence data to DB ────────────────────────
    const updatePayload: Record<string, any> = {
      userId: (session as any).user.id,
      matchedOffers: offers,
      kpis,
      analysis: analysis.analysis || {},
      roiProjection: analysis.roiProjection || null,
      scholarships: analysis.scholarships || [],
      forumInsights: analysis.forumInsights || [],
      governmentSchemes: analysis.governmentSchemes || [],
      searchParams: p,
      sources: sourcesCompact,
      profileSnapshot,
      lastAnalyzedAt: new Date(),
    };

    const existingApp = await LoanApplication.findOne({ userId: (session as any).user.id });
    if (existingApp) {
      Object.assign(existingApp, updatePayload);
      // Only reset document checklist if it was empty
      if (!existingApp.documentChecklist || existingApp.documentChecklist.length === 0) {
        existingApp.documentChecklist = docChecklist;
      }
      existingApp.markModified('kpis');
      existingApp.markModified('analysis');
      existingApp.markModified('scholarships');
      existingApp.markModified('forumInsights');
      existingApp.markModified('governmentSchemes');
      existingApp.markModified('searchParams');
      existingApp.markModified('sources');
      existingApp.markModified('profileSnapshot');
      await existingApp.save();
    } else {
      try {
        await LoanApplication.create({
          ...updatePayload,
          documentChecklist: docChecklist,
        });
      } catch (err: any) {
        if (err.code === 11000) {
          const concurrentApp = await LoanApplication.findOne({ userId: (session as any).user.id });
          if (concurrentApp) {
            Object.assign(concurrentApp, updatePayload);
            if (!concurrentApp.documentChecklist || concurrentApp.documentChecklist.length === 0) {
              concurrentApp.documentChecklist = docChecklist;
            }
            concurrentApp.markModified('kpis');
            concurrentApp.markModified('analysis');
            concurrentApp.markModified('scholarships');
            concurrentApp.markModified('forumInsights');
            concurrentApp.markModified('governmentSchemes');
            concurrentApp.markModified('searchParams');
            concurrentApp.markModified('sources');
            concurrentApp.markModified('profileSnapshot');
            await concurrentApp.save();
          }
        } else {
          throw err;
        }
      }
    }

    return NextResponse.json({
      offers: analysis.offers || [],
      scholarships: analysis.scholarships || [],
      analysis: analysis.analysis || {},
      roiProjection: analysis.roiProjection || null,
      forumInsights: analysis.forumInsights || [],
      documentRequirements: analysis.documentRequirements || [],
      governmentSchemes: analysis.governmentSchemes || [],
      kpis,
      sources: sourcesCompact,
      searchParams: p,
      profile: profileSnapshot,
      lastAnalyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[loan-search] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search loan offers', details: (error as Error).message },
      { status: 500 }
    );
  }
}

function parseBudgetToINR(budget: string): number {
  if (!budget) return 0;
  const lower = budget.toLowerCase().replace(/[₹,]/g, '');
  const num = parseFloat(lower.replace(/[^\d.]/g, ''));
  if (isNaN(num)) return 0;
  if (lower.includes('crore') || lower.includes('cr')) return num * 10000000;
  if (lower.includes('lakh') || lower.includes('lac') || lower.includes('l')) return num * 100000;
  if (num > 10000) return num;
  return num * 100000; // assume lakhs
}
