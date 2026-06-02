import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import LoanApplication from '@/lib/models/LoanApplication';
import LenderPolicy from '@/lib/models/LenderPolicy';

/* ────────────────────────────────────────────────────────────────────────────
 *  POST /api/loan/chat
 *
 *  Conversational loan assistant powered by Gemini.
 *  Understands uploaded lender policies, student profile, and existing
 *  loan application data to provide personalized financing guidance.
 *
 *  Features:
 *  - Progressive profile building (asks follow-up questions)
 *  - Policy-aware answers
 *  - Eligibility evaluation mid-conversation
 *  - Financial planning assistance
 *  - Document guidance
 * ──────────────────────────────────────────────────────────────────────────── */

export async function POST(request: Request) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const body = await request.json();
    const { message, conversationHistory = [] } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // ── 1. Gather full context ──────────────────────────────────────
    const [user, loanApp, activePolicies] = await Promise.all([
      User.findById(session.user.id).lean(),
      LoanApplication.findOne({ userId: session.user.id }).lean(),
      LenderPolicy.find({ status: 'active' }).select('-rawExtractedText').lean(),
    ]);

    const profile = (user?.studentProfile || {}) as Record<string, unknown>;
    const profileSummary = Object.entries(profile)
      .filter(([_, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0))
      .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('\n');

    // Build policy context
    const policyContext = activePolicies.length > 0
      ? activePolicies.map((p: any, i: number) => {
          const pol = p.extractedPolicies;
          return `### Lender Policy ${i + 1}: ${p.lenderName} — ${p.productName}
- Interest Rate: ${pol?.financial?.interestRateMin || '?'}% - ${pol?.financial?.interestRateMax || '?'}%
- Max Loan: ₹${pol?.financial?.maxLoanAmountINR ? (pol.financial.maxLoanAmountINR / 100000).toFixed(0) + 'L' : 'N/A'}
- Collateral: ${pol?.financial?.collateralRequired ? `Required (above ₹${pol?.financial?.collateralThresholdINR ? (pol.financial.collateralThresholdINR / 100000).toFixed(0) + 'L' : 'threshold'})` : 'Not required'}
- Supported Countries: ${pol?.eligibility?.supportedCountries?.join(', ') || 'All'}
- Supported Degrees: ${pol?.eligibility?.supportedDegrees?.join(', ') || 'All'}
- Min GPA: ${pol?.eligibility?.minGPA || 'None'}
- Min Co-Applicant Income: ${pol?.eligibility?.minCoApplicantIncomeINR ? '₹' + (pol.eligibility.minCoApplicantIncomeINR / 100000).toFixed(1) + 'L' : 'None'}
- Moratorium: ${pol?.repayment?.moratoriumMonths || 0} months
- Tenure: ${pol?.repayment?.minTenureMonths || '?'} - ${pol?.repayment?.maxTenureMonths || '?'} months
- Documents: ${pol?.documents?.map((d: any) => d.name).join(', ') || 'Standard set'}
- Special Features: ${pol?.specialFeatures?.join(', ') || 'None noted'}`;
        }).join('\n\n')
      : 'No lender policies have been uploaded yet. Provide general education loan guidance.';

    // ── Detail all Analyses Context ──

    // 1. Overview & Offers
    const offersContext = loanApp?.matchedOffers && loanApp.matchedOffers.length > 0
      ? loanApp.matchedOffers.map((o: any) => 
          `- **${o.lender}**: Match Score ${o.matchScore}%, Interest: ${o.interestRateMin}%-${o.interestRateMax}%, Max Amount: ₹${(o.maxLoanAmountINR / 100000).toFixed(0)}L, Collateral Required: ${o.collateralRequired ? 'Yes' : 'No'}, Moratorium: ${o.moratoriumMonths || 0} mos. Match Reason: ${o.matchReason}`
        ).join('\n')
      : 'No AI-ranked loan offers generated yet.';

    const policyMatchesContext = loanApp?.policyMatchResults && loanApp.policyMatchResults.length > 0
      ? loanApp.policyMatchResults.map((pm: any) => {
          const status = pm.eligible ? 'Eligible' : pm.partiallyEligible ? 'Partially Eligible' : 'Not Eligible';
          const reasons = pm.reasons.map((r: any) => `  - [${r.met ? '✓' : '✗'}] ${r.detail}`).join('\n');
          return `- **${pm.lenderName} (${pm.productName})**: Match Score ${pm.matchScore}%, Status: ${status}\n  - Rate: ${pm.interestRateRange}, Max: ₹${(pm.maxLoanAmountINR / 100000).toFixed(0)}L, Collateral Required: ${pm.collateralRequired ? 'Yes' : 'No'}\n${reasons}`;
        }).join('\n')
      : 'No policy matches evaluated yet.';

    const kpisContext = loanApp?.kpis ? `
- Financial Health Score: ${loanApp.kpis.financialHealthScore || 0}/100
- Affordability Index: ${loanApp.kpis.affordabilityIndex || 0}/100
- Debt Safety Score: ${loanApp.kpis.debtSafety || 0}/100
- Debt-to-Income Ratio: ${loanApp.kpis.debtToIncomeRatio || 0}%
- Estimated Monthly EMI: ₹${loanApp.kpis.estimatedEMI ? Math.round(loanApp.kpis.estimatedEMI).toLocaleString('en-IN') : '0'}
- Best Interest Rate: ${loanApp.kpis.bestRate || 0}%
- Total Interest: ${loanApp.kpis.totalInterestPercent || 0}% of principal
- Loan Amount Configured: ₹${loanApp.kpis.loanAmount ? (loanApp.kpis.loanAmount / 100000).toFixed(0) + 'L' : '0L'}
` : 'No financial KPIs calculated yet.';

    // 2. AI Analytics & ROI
    const roi = loanApp?.roiProjection;
    const roiContext = roi ? `
- Tuition Cost: ₹${(roi.estimatedTuitionINR / 100000).toFixed(2)}L
- Living Cost: ₹${(roi.estimatedLivingCostINR / 100000).toFixed(2)}L
- Total Education Cost: ₹${(roi.totalCostINR / 100000).toFixed(2)}L
- Expected Salaries: 
  - Year 1: ₹${(roi.expectedSalaryYear1INR / 100000).toFixed(2)}L/yr (Source: ${roi.salaryNotes || 'Exa AI estimates'})
  - Year 3: ₹${roi.expectedSalaryYear3INR ? (roi.expectedSalaryYear3INR / 100000).toFixed(2) + 'L/yr' : 'N/A'}
  - Year 5: ₹${roi.expectedSalaryYear5INR ? (roi.expectedSalaryYear5INR / 100000).toFixed(2) + 'L/yr' : 'N/A'}
- Payback Period: ${roi.paybackPeriodMonths || 0} months
- Estimated ROI: ${roi.roiPercentage ? roi.roiPercentage.toFixed(1) + '%' : 'N/A'}
` : 'No ROI projection available.';

    const forumContext = loanApp?.forumInsights && loanApp.forumInsights.length > 0
      ? loanApp.forumInsights.map((fi: any) => 
          `- [${fi.platform || 'Forum'}] ${fi.title}: ${fi.keyTakeaway} (Sentiment: ${fi.sentiment || 'Neutral'})`
        ).join('\n')
      : 'No community forum insights available.';

    // 3. Documents
    const docChecklistContext = loanApp?.documentChecklist && loanApp.documentChecklist.length > 0
      ? loanApp.documentChecklist.map((d: any) => 
          `- **${d.name}**: Status = ${d.status.toUpperCase()} (Required: ${d.required ? 'Yes' : 'No'}, Relevant Lenders: ${d.lenders?.join(', ') || 'All'})`
        ).join('\n')
      : 'No document checklist generated yet.';

    // 4. Settings & Overrides
    const settingsContext = loanApp?.searchParams ? Object.entries(loanApp.searchParams)
      .filter(([_, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0))
      .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('\n')
      : 'No specific settings/overrides configured.';

    // Build conversation history for context
    const historyText = conversationHistory
      .slice(-10) // Last 10 messages for context
      .map((msg: any) => `${msg.role === 'user' ? 'Student' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    // ── 2. Build Gemini prompt ──────────────────────────────────────
    const systemPrompt = `You are Aria, an intelligent and empathetic AI education financing assistant at StudyStack. You help students discover, evaluate, and apply for education loans.

## YOUR CAPABILITIES
1. **Profile Building & Brainstorming**: Naturally ask questions and help the student brainstorm the best financing strategy (secured vs unsecured, co-applicant strategy, repayment terms).
2. **Tab & Analysis Awareness**: You have the complete context of the user's dashboard analyses:
   - **Overview & Offers**: Financial health KPIs, AI-ranked offers, and policy-based evaluations.
   - **AI Analytics & ROI**: Tuition/living cost breakdown, expected salaries, payback period, and community insights.
   - **Offer Comparison**: Detailed comparison parameters (rates, collateral, moratoriums, pros & cons).
   - **Documents Checklist**: Checklist of documents and their validation status.
   - **Settings & Overrides**: The inputs/overrides currently configured by the student.
3. **Personalized Recommendations (Prioritize Counsellor Uploads)**: Recommend the best financing options. IMPORTANT: You MUST prioritize and rank the counsellor-uploaded lender policies (found in section "OFFICIAL COUNSELLOR-UPLOADED LENDER POLICIES (HIGH PRIORITY)") higher than the general web-scraped AI-ranked offers. Curate your recommendations so that eligible/partially-eligible counsellor-uploaded policies are presented first as the premium, official options.
4. **Optimization Tips**: Explain how changing settings (e.g. adding collateral, choosing a different country, or increasing co-applicant income) might unlock better interest rates or eligible policies.

## LIVE ANALYSIS & DASHBOARD CONTEXT

### 1. SETTINGS & INPUTS (Settings & Overrides)
${settingsContext}

### 2. STUDENT DEFAULT PROFILE
${profileSummary || 'Profile is incomplete.'}

### 3. FINANCIAL HEALTH & KPIS (Overview & Offers)
${kpisContext}

### 4. OFFICIAL COUNSELLOR-UPLOADED LENDER POLICIES (HIGH PRIORITY)
${policyMatchesContext}

### 5. GENERAL AI-RANKED LOAN OFFERS
${offersContext}

### 6. RETURN ON INVESTMENT & SALARY PROJECTIONS (AI Analytics & ROI)
${roiContext}

### 7. COMMUNITY FORUM DISCUSSION (AI Analytics & ROI)
${forumContext}

### 8. DOCUMENT CHECKLIST STATUS (Documents)
${docChecklistContext}

### 9. SYSTEM-WIDE OFFICIAL LENDER POLICY REFERENCE RULES (HIGH PRIORITY)
${policyContext}

## RESPONSE RULES
- Be warm, professional, and encouraging. Students are often anxious about financing.
- ALWAYS rank and recommend the counsellor-uploaded lender policies (from the "OFFICIAL COUNSELLOR-UPLOADED LENDER POLICIES" section) higher and suggest them first to the student. State clearly that these policies are official programs uploaded directly by their counsellor.
- Refer to the live analysis details above to answer. Don't make up loan rates or salary numbers.
- If the student's profile is incomplete, ask ONE follow-up question at a time.
- Use ₹ for Indian currency. Format large amounts as lakhs/crores.
- Address questions like "What are my best options?", "Am I eligible for X lender?", "What documents do I need to submit next?", or "Is this course worth the ROI?" using the exact figures from their dashboard.
- For EMI brainstorming, use the values configured in the settings or explain how changing tenure/rate changes the EMI.
- Keep responses concise but highly informative. Use bullet points and formatting.
- If no analysis is available yet, suggest the student trigger one on the dashboard.

## SPECIAL ACTIONS
If your response naturally leads to one of these actions, include it in a JSON block at the END of your response (after all text):
<!--ACTIONS[{"type":"checkEligibility","label":"Check My Eligibility"},{"type":"showDocChecklist","label":"View Document Checklist"},{"type":"calculateEMI","label":"Calculate EMI"},{"type":"viewOffers","label":"See Loan Offers"}]ACTIONS-->

Only include actions that are genuinely relevant to the conversation context.`;

    const fullPrompt = `${systemPrompt}

## CONVERSATION HISTORY
${historyText || 'This is the start of the conversation.'}

## STUDENT'S NEW MESSAGE
${message}

Respond as Aria:`;

    // ── 3. Generate response ────────────────────────────────────────
    const { GoogleGenAI } = await import('@google/genai');
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: { temperature: 0.7, maxOutputTokens: 2000 },
    });

    let responseText = (result.text ?? '').trim();

    // Parse out actions if present
    let actions: any[] = [];
    const actionsMatch = responseText.match(/<!--ACTIONS(\[[\s\S]*?\])ACTIONS-->/);
    if (actionsMatch) {
      try {
        actions = JSON.parse(actionsMatch[1]);
        responseText = responseText.replace(/<!--ACTIONS\[[\s\S]*?\]ACTIONS-->/, '').trim();
      } catch { /* ignore parsing errors */ }
    }

    // ── 4. Save to chat history ─────────────────────────────────────
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    const assistantMessage = {
      role: 'assistant',
      content: responseText,
      timestamp: new Date(),
      actions: actions.length > 0 ? actions : undefined,
    };

    if (loanApp) {
      await LoanApplication.findOneAndUpdate(
        { userId: session.user.id },
        {
          $push: {
            chatHistory: { $each: [userMessage, assistantMessage] },
          },
        }
      );
    } else {
      try {
        await LoanApplication.create({
          userId: session.user.id,
          chatHistory: [userMessage, assistantMessage],
        });
      } catch (err: any) {
        if (err.code === 11000) {
          await LoanApplication.findOneAndUpdate(
            { userId: session.user.id },
            {
              $push: {
                chatHistory: { $each: [userMessage, assistantMessage] },
              },
            }
          );
        } else {
          throw err;
        }
      }
    }

    return NextResponse.json({
      response: responseText,
      actions,
    });
  } catch (error) {
    console.error('[loan-chat] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 *  GET /api/loan/chat — Retrieve chat history
 * ──────────────────────────────────────────────────────────────────────────── */

export async function GET() {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const loanApp = await LoanApplication.findOne({ userId: session.user.id })
      .select('chatHistory')
      .lean();

    return NextResponse.json({
      history: (loanApp as any)?.chatHistory || [],
    });
  } catch (error) {
    console.error('[loan-chat GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat history', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 *  DELETE /api/loan/chat — Clear chat history
 * ──────────────────────────────────────────────────────────────────────────── */

export async function DELETE() {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    await LoanApplication.findOneAndUpdate(
      { userId: session.user.id },
      { $set: { chatHistory: [] } }
    );

    return NextResponse.json({ success: true, message: 'Chat history cleared' });
  } catch (error) {
    console.error('[loan-chat DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to clear chat history', details: (error as Error).message },
      { status: 500 }
    );
  }
}
