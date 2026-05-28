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
          return `### Lender ${i + 1}: ${p.lenderName} — ${p.productName}
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

    // Existing loan app context
    const loanAppContext = loanApp ? `
## EXISTING LOAN APPLICATION DATA
- Eligibility Score: ${(loanApp as any).eligibilityScore || 'Not computed'}
- Eligibility Band: ${(loanApp as any).eligibilityBand || 'Not computed'}
- Matched Offers: ${((loanApp as any).matchedOffers || []).length} offers found
- Top Offer: ${((loanApp as any).matchedOffers || [])[0]?.lender || 'None'}
- Application Status: ${(loanApp as any).applicationStatus || 'not_started'}
- Policy Matches: ${((loanApp as any).policyMatchResults || []).length} policy matches
${((loanApp as any).policyMatchResults || []).map((m: any) => `  - ${m.lenderName}: ${m.matchScore}% match (${m.eligible ? 'Eligible' : m.partiallyEligible ? 'Partial' : 'Not Eligible'})`).join('\n')}
- Documents Pending: ${((loanApp as any).documentChecklist || []).filter((d: any) => d.status === 'pending').length}
` : 'No loan application exists yet.';

    // Build conversation history for context
    const historyText = conversationHistory
      .slice(-10) // Last 10 messages for context
      .map((msg: any) => `${msg.role === 'user' ? 'Student' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    // ── 2. Build Gemini prompt ──────────────────────────────────────
    const systemPrompt = `You are Aria, an intelligent and empathetic AI education financing assistant at StudyStack. You help students discover, evaluate, and apply for education loans.

## YOUR CAPABILITIES
1. **Profile Building**: Naturally ask follow-up questions to understand the student's financial and academic profile. Don't interrogate — be conversational.
2. **Eligibility Evaluation**: Based on the lender policies below, tell students which loans they qualify for and why.
3. **Personalized Recommendations**: Recommend the best financing options with clear reasoning.
4. **Financial Planning**: Help with EMI calculations, repayment planning, and affordability assessment.
5. **Document Guidance**: Tell students exactly what documents they need based on their chosen lender.
6. **Policy Answers**: Answer specific questions about lender rules using the policies below.

## STUDENT PROFILE
${profileSummary || 'Profile is incomplete. Ask the student for basic information.'}

## AVAILABLE LENDER POLICIES
${policyContext}

${loanAppContext}

## RESPONSE RULES
- Be warm, professional, and encouraging. Students are often anxious about financing.
- Reference specific lender policies when answering. Don't make up rules.
- If the student's profile is incomplete, ask ONE follow-up question at a time.
- Use ₹ for Indian currency. Format large amounts as lakhs/crores.
- When evaluating eligibility, be transparent about which criteria are met and which aren't.
- If multiple loans are suitable, compare them briefly highlighting trade-offs.
- For EMI calculations: use the formula EMI = P × r × (1+r)^n / ((1+r)^n - 1) where r = monthly rate.
- Keep responses concise but informative. Use bullet points and formatting.
- NEVER fabricate lender information. If a policy doesn't cover something, say so.
- If no policies are uploaded, provide general education loan guidance and suggest the student ask their counsellor to upload lender policies.

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
      await LoanApplication.create({
        userId: session.user.id,
        chatHistory: [userMessage, assistantMessage],
      });
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
