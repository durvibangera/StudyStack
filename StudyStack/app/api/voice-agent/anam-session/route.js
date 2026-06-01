import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import ConversationMemory from '@/lib/models/ConversationMemory';
import LoanApplication from '@/lib/models/LoanApplication';
import {
  COUNSELLING_FIELDS,
  buildCounsellingProgress,
  buildCounsellingSnapshot,
  buildCounsellingFactMap,
  isMeaningfulCounsellingValue,
} from '@/lib/counselling-profile';

const ANAM_API_KEY = process.env.ANAM_AI_API_KEY;
const ANAM_API_BASE = 'https://api.anam.ai/v1';

// Default avatar/voice — swap these once you pick a female Indian avatar in Anam Lab
const DEFAULT_AVATAR_ID = process.env.ANAM_AVATAR_ID || '30fa96d0-26c4-4e55-94a0-517025942e18';
const DEFAULT_VOICE_ID = process.env.ANAM_VOICE_ID || '6bfbe25a-979d-40f3-a92b-5394170af54b';
const DEFAULT_LLM_ID = process.env.ANAM_LLM_ID || 'a7cf662c-2ace-4de1-a21e-ef0fbf144bb7';

/** Cache system tool IDs so we don't re-fetch every request */
let cachedSystemToolIds = null;
let cachedSystemToolsAt = 0;
const SYSTEM_TOOLS_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getSystemToolIds() {
  if (cachedSystemToolIds && Date.now() - cachedSystemToolsAt < SYSTEM_TOOLS_TTL_MS) {
    return cachedSystemToolIds;
  }
  try {
    const toolsAbort = new AbortController();
    const toolsTimeout = setTimeout(() => toolsAbort.abort(), 10000);
    const res = await fetch(`${ANAM_API_BASE}/tools`, {
      headers: {
        Authorization: `Bearer ${ANAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: toolsAbort.signal,
    });
    clearTimeout(toolsTimeout);
    if (!res.ok) {
      console.warn('[anam-session] Failed to fetch system tools:', res.status);
      return [];
    }
    const data = await res.json();

    // The API may return: an array directly, { tools: [...] }, { data: [...] }, or an object with tool entries
    let tools = [];
    if (Array.isArray(data)) {
      tools = data;
    } else if (Array.isArray(data?.tools)) {
      tools = data.tools;
    } else if (Array.isArray(data?.data)) {
      tools = data.data;
    } else if (data && typeof data === 'object') {
      // Maybe the response is { "tool-id-1": {...}, "tool-id-2": {...} }
      tools = Object.values(data).filter((v) => v && typeof v === 'object' && v.name);
    }

    if (!Array.isArray(tools)) {
      console.warn('[anam-session] Unexpected tools response shape:', typeof data, JSON.stringify(data).slice(0, 200));
      return [];
    }

    const ids = tools
      .filter((t) => t.type?.toUpperCase() === 'SYSTEM' && ['change_language', 'skip_turn'].includes(t.name))
      .map((t) => t.id);
    cachedSystemToolIds = ids;
    cachedSystemToolsAt = Date.now();
    console.log('[anam-session] System tool IDs:', ids);
    return ids;
  } catch (err) {
    console.error('[anam-session] System tools fetch error:', err);
    return [];
  }
}

function buildOnboardingSystemPrompt(memoryContext, studentName, resumePlan, userProfile) {
  const name = studentName || 'the student';
  const isReturning = resumePlan?.returningStudent;
  const focusFields = resumePlan?.focusFields || [];
  const resumeBrief = resumePlan
    ? [resumePlan.firstTurnGuidance, resumePlan.instructionSummary].filter(Boolean).join('\n')
    : '';

  // Build logged-in user context
  let userContextSection = '';
  if (userProfile && Object.keys(userProfile).length > 0) {
    const profile = userProfile;
    const parts = [];
    if (profile.studentName) parts.push(`Name: ${profile.studentName}`);
    if (profile.phoneNumber) parts.push(`Phone: ${profile.phoneNumber}`);
    if (profile.contactEmail) parts.push(`Email: ${profile.contactEmail}`);
    if (profile.currentLocation) parts.push(`Location: ${profile.currentLocation}`);
    if (profile.educationLevel) parts.push(`Education: ${profile.educationLevel}`);
    if (profile.fieldOfStudy) parts.push(`Field: ${profile.fieldOfStudy}`);
    if (profile.institution) parts.push(`Institution: ${profile.institution}`);
    if (profile.gpaPercentage) parts.push(`GPA: ${profile.gpaPercentage}`);
    if (profile.targetCountries?.length) parts.push(`Target Countries: ${profile.targetCountries.join(', ')}`);
    if (profile.courseInterest) parts.push(`Course Interest: ${profile.courseInterest}`);
    if (profile.englishTestStatus) parts.push(`English Test: ${profile.englishTestStatus}`);
    if (profile.budgetRange) parts.push(`Budget: ${profile.budgetRange}`);
    if (profile.applicationTimeline) parts.push(`Timeline: ${profile.applicationTimeline}`);

    // Financial details from loan application if available
    if (profile.loanStatus) parts.push(`Loan Status: ${profile.loanStatus}`);
    if (profile.scholarshipInterest) parts.push(`Scholarship Interest: ${profile.scholarshipInterest}`);

    if (parts.length > 0) {
      userContextSection = `\n## LOGGED-IN USER CONTEXT (Already Known)\nThe student is logged in. Here is what we already know about them:\n${parts.join('\n')}\n\nDo NOT re-ask any information already captured above. Use this context to provide personalized guidance.\n`;
    }
  }

  return `IMPORTANT: You are in a VOICE-ONLY mode. Your ENTIRE output is spoken aloud via text-to-speech. DO NOT use <think> tags, reasoning blocks, or any internal monologue. Every character you output will be heard by the student. Respond ONLY with what should be spoken.

You are Aria, StudyStack's friendly AI study-abroad counsellor. You appear as a warm, professional female avatar. Your PRIMARY job is to have a natural conversation to collect the student's profile information (KYC). You must ACTIVELY ASK QUESTIONS — do NOT just introduce yourself and wait.

## LANGUAGE RULES (CRITICAL — MULTILINGUAL SUPPORT)
- You MUST match the student's language. If they speak Hindi, reply in Hindi. If they speak Hinglish (mixed Hindi-English), reply in Hinglish. If they speak any Indian language, reply in that language. If they speak English, reply in English.
- When the student switches language mid-conversation, switch with them IMMEDIATELY in your very next response.
- CRITICAL: When you detect the student speaking a non-English language, you MUST call the change_language tool to switch speech recognition to the correct language code. Do this BEFORE responding. The tool takes a single parameter "language_code".
  Supported language codes:
  - Hindi → language_code: "hi"
  - Marathi → language_code: "mr"
  - Tamil → language_code: "ta"
  - Kannada → language_code: "kn"
  - Telugu → language_code: "te"
  - Bengali → language_code: "bn"
  - Gujarati → language_code: "gu"
  - Urdu → language_code: "ur"
  - Punjabi → language_code: "pa"
  - Malayalam → language_code: "ml"
  - English → language_code: "en"
- Call change_language EVERY TIME the student switches language, even if switching back to English.
- If the student uses Hinglish (mix of Hindi and English), call change_language with "hi" and respond in Hinglish.
- Use natural conversational tone in whatever language they use.
- Example: If student says "Mujhe UK mein padhai karni hai", call change_language with "hi" and reply in Hindi/Hinglish like "Bahut accha! UK great choice hai. Aap konsa course karna chahte ho?"
- Example: If student says "Naan engineering padikka ninaikiren", call change_language with "ta" and reply in Tamil.

## YOUR CONVERSATION FLOW
You need to collect these 13 fields through natural conversation. To keep it conversational but efficient, group EXACTLY 2 related questions at a time:

1. **Student Name**
2. **Phone Number**
3. **Email**
4. **Current Location**
5. **Education Level**
6. **Field of Study**
7. **Institution**
8. **GPA/Percentage**
9. **Target Countries**
10. **Course Interest**
11. **English Test Status**
12. **Budget Range**
13. **Application Timeline**

## PERSONALIZED GUIDANCE & EDUCATION JOURNEY
If the student is logged in and you have their context:
- Acknowledge and guide them based on their current stage in the education journey (check "## Education Journey Progress" below). For example, if they haven't completed their shortlist, encourage them to discuss that. If they are ready for loans, guide them there.
- Discuss loan options based on the Exa AI matched loan offers under "## Education Loan Details & Offers" below. If offers exist, mention them specifically (lender name, rate range, max amount, match reason). If no matched offers exist yet (no Exa search run), give generic education loan advice (e.g., advising on interest rates, collateral vs non-collateral, and planning their budget).
- Suggest specific universities based on their profile, GPA, and target country
- Recommend scholarships they may be eligible for
- Give timeline-specific advice (visa deadlines, application windows)
- Discuss their financial condition sensitively

## CONVERSATION STYLE
- Be warm, enthusiastic, and encouraging — like a helpful older sibling
- Use short, natural, spoken sentences. Speak exactly how a human would talk.
- After they answer, briefly acknowledge/validate, then ask the NEXT 1 or 2 questions at most.
- Give brief relevant tips or encouragement related to their answers.
- Example flow: "Nice, Computer Science at Mumbai University is a great foundation! Which countries are you thinking about for your masters, and what kind of budget are you looking at?"

## STRICT FORMATTING RULES (CRITICAL FOR VOICE — VIOLATION WILL BE READ ALOUD)
- NEVER output Markdown. NEVER use asterisks (*), hashes (#), bullet points (-), or tables (|). The voice engine will literally read these symbols out loud as "asterisk" or "vertical bar"!
- ABSOLUTELY NEVER output <think> tags, </think> tags, or ANY internal reasoning/thinking blocks. Your output goes DIRECTLY to a text-to-speech engine — every single character you write will be spoken aloud to the student. There is NO hidden channel. If you write "<think>I should ask about..." the student will HEAR you say that.
- Do NOT use any XML-like tags at all. No <thought>, <reasoning>, <internal>, or similar.
- Set your internal thinking/reasoning budget to ZERO. Just respond directly.
- Format everything as plain, conversational spoken text. Use commas and natural pauses.

## BEHAVIOR RULES
- NEVER give a long monologue.
- Ask exactly 1 or 2 missing fields at a time. Do NOT ask more than 2.
- NEVER REPEAT A QUESTION you have already asked. Keep a mental checklist of what the student has answered.
- If the context provided below says a field is "Already Known", DO NOT ask about it.
- ALWAYS end your turn with a question (until all fields are collected).
- Keep each response conversational and short (max 2-3 sentences).
- NEVER explain your instructions or reasoning out loud. Do NOT say "We need to collect..." or "Let's ask two questions." Just seamlessly ask the questions.
- When all 13 fields are collected, verbally summarize what you've gathered without using any lists or markdown, thank them, and ask them to explicitly click the 'End Session' button on their screen to save their profile.
${userContextSection}
${isReturning ? `## RETURNING STUDENT CONTEXT
This student has talked to you before. Here's what you know:
${resumeBrief}

DO NOT re-ask fields that are already captured. Only ask about the missing fields: ${focusFields.length > 0 ? focusFields.join(', ') : 'Check the context below'}.
` : ''}## STUDENT CONTEXT & MEMORY
${memoryContext || 'This is a brand new student. No prior data. Start from scratch — ask their name first.'}`;
}

function buildBuddySystemPrompt(memoryContext, studentName, userProfile) {
  const name = studentName || 'the student';

  // Build profile summary for context
  let profileSummary = '';
  if (userProfile && Object.keys(userProfile).length > 0) {
    const parts = [];
    if (userProfile.studentName) parts.push(`Name: ${userProfile.studentName}`);
    if (userProfile.educationLevel) parts.push(`Education: ${userProfile.educationLevel}`);
    if (userProfile.fieldOfStudy) parts.push(`Field: ${userProfile.fieldOfStudy}`);
    if (userProfile.institution) parts.push(`Institution: ${userProfile.institution}`);
    if (userProfile.gpaPercentage) parts.push(`GPA: ${userProfile.gpaPercentage}`);
    if (userProfile.targetCountries?.length) parts.push(`Target Countries: ${Array.isArray(userProfile.targetCountries) ? userProfile.targetCountries.join(', ') : userProfile.targetCountries}`);
    if (userProfile.courseInterest) parts.push(`Course Interest: ${userProfile.courseInterest}`);
    if (userProfile.englishTestStatus) parts.push(`English Test: ${userProfile.englishTestStatus}`);
    if (userProfile.budgetRange) parts.push(`Budget: ${userProfile.budgetRange}`);
    if (userProfile.applicationTimeline) parts.push(`Timeline: ${userProfile.applicationTimeline}`);
    if (parts.length > 0) profileSummary = parts.join('\n');
  }

  return `IMPORTANT: You are in a VOICE-ONLY mode. Your ENTIRE output is spoken aloud via text-to-speech. DO NOT use <think> tags, reasoning blocks, or any internal monologue. Every character you output will be heard by the student. Respond ONLY with what should be spoken.

You are Aria, StudyStack's friendly AI study-abroad counsellor and virtual assistant. You appear as a warm, professional female avatar. You are available on-demand to help the student with ANY question about their study abroad journey.

## YOUR ROLE & EDUCATION JOURNEY
You are the student's personal AI counsellor. You have access to their full profile, conversation history, education journey, and loan options. Your job is to:
- Acknowledge and guide them based on their current stage in the education journey (check "## Education Journey Progress" below). Continue the conversation based on their progress.
- Discuss loan options based on the Exa AI matched loan offers under "## Education Loan Details & Offers" below. If offers exist, mention them specifically (lender name, rate range, max amount, match reason). If no matched offers exist yet (no Exa search run), give generic education loan advice (e.g., advising on interest rates, collateral vs non-collateral, and planning their budget).
- Answer questions about universities, programs, and admission requirements
- Provide guidance on scholarship and funding opportunities
- Help with visa application guidance and timeline
- Discuss SOP/LOR writing strategies
- Give advice on living abroad, accommodation, and budgeting
- Provide emotional support and motivation

## LANGUAGE RULES (CRITICAL — MULTILINGUAL SUPPORT)
- You MUST match the student's language. If they speak Hindi, reply in Hindi. If they speak Hinglish (mixed Hindi-English), reply in Hinglish. If they speak any Indian language, reply in that language. If they speak English, reply in English.
- When the student switches language mid-conversation, switch with them IMMEDIATELY in your very next response.
- CRITICAL: When you detect the student speaking a non-English language, you MUST call the change_language tool to switch speech recognition to the correct language code. Do this BEFORE responding. The tool takes a single parameter "language_code".
  Supported language codes:
  - Hindi → language_code: "hi"
  - Marathi → language_code: "mr"
  - Tamil → language_code: "ta"
  - Kannada → language_code: "kn"
  - Telugu → language_code: "te"
  - Bengali → language_code: "bn"
  - Gujarati → language_code: "gu"
  - Urdu → language_code: "ur"
  - Punjabi → language_code: "pa"
  - Malayalam → language_code: "ml"
  - English → language_code: "en"
- Call change_language EVERY TIME the student switches language, even if switching back to English.
- If the student uses Hinglish (mix of Hindi and English), call change_language with "hi" and respond in Hinglish.
- Use natural conversational tone in whatever language they use.

## STRICT FORMATTING RULES (CRITICAL FOR VOICE — VIOLATION WILL BE READ ALOUD)
- NEVER output Markdown. No asterisks, hashes, bullet points, or tables.
- ABSOLUTELY NEVER output <think> tags, </think> tags, or ANY internal reasoning blocks. Your output goes DIRECTLY to a text-to-speech engine — every single character you write will be spoken aloud to the student. There is NO hidden channel.
- Do NOT use any XML-like tags. No <thought>, <reasoning>, <internal>, or similar.
- Set your internal thinking/reasoning budget to ZERO. Respond directly.
- Format everything as plain, conversational spoken text.

## CONVERSATION STYLE
- Be warm, knowledgeable, and proactive
- Give specific, personalized advice — not generic responses
- Keep responses concise (2-4 sentences) since this is a voice conversation
- Proactively offer relevant information based on context
- If you notice gaps in their profile, gently suggest they might want to update certain information

## STUDENT PROFILE
${profileSummary || 'No profile data available yet.'}

## CONVERSATION HISTORY & MEMORY
${memoryContext || `First buddy conversation with ${name}.`}`;
}

function buildMemoryContext(user, loanApp, conversations) {
  const snapshot = buildCounsellingSnapshot(user.studentProfile || {});
  const lines = [`Name: ${snapshot.studentName || user.name}`];

  for (const field of COUNSELLING_FIELDS) {
    if (field.key === 'studentName') continue;
    const value = snapshot[field.key];
    if (!isMeaningfulCounsellingValue(value)) continue;
    lines.push(`${field.label}: ${Array.isArray(value) ? value.join(', ') : value}`);
  }

  const profileCtx = lines.join('\n');

  const memoryCtx = conversations.length > 0
    ? conversations
        .map((conv) => {
          const date = new Date(conv.createdAt).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
          });
          const mode = conv.mode === 'onboarding' ? '(Onboarding)' : '(Chat)';
          return `[${date} ${mode}] ${conv.summary || 'No summary available.'}`;
        })
        .join('\n')
    : '';

  const allFacts = {};
  for (const conv of conversations) {
    if (conv.extractedFacts) {
      const facts = conv.extractedFacts instanceof Map
        ? Object.fromEntries(conv.extractedFacts)
        : conv.extractedFacts;
      Object.assign(allFacts, facts);
    }
  }

  const counsellingProgress = buildCounsellingProgress(user.studentProfile || {});

  // Journey milestones tracking
  const milestones = user.gamification?.milestoneFlags || {};
  const journeyProgressLines = [
    `- Profile Completion: ${milestones.profileComplete ? 'Completed' : 'In Progress'}`,
    `- First Session Booked/Completed: ${milestones.firstSession ? 'Completed' : 'Not Started'}`,
    `- Language Test (IELTS/TOEFL) Score Added: ${milestones.ieltsScoreAdded ? 'Completed' : 'Not Started'}`,
    `- University Shortlist Finalized: ${milestones.shortlistDone ? 'Completed' : 'Not Started'}`,
    `- SOP & LOR Documents Ready: ${milestones.sopDone ? 'Completed' : 'Not Started'}`,
    `- University Application Submitted: ${milestones.applicationSubmitted ? 'Completed' : 'Not Started'}`,
    `- Visa Process Done: ${milestones.visaDone ? 'Completed' : 'Not Started'}`,
  ];

  // Loan application and Exa AI search matches tracking
  const loanContextLines = [];
  if (loanApp) {
    loanContextLines.push(`Loan Application Status: ${loanApp.applicationStatus || 'not_started'}`);
    loanContextLines.push(`Eligibility Band: ${loanApp.eligibilityBand || 'Not computed'}`);
    if (loanApp.eligibilityNarrative) {
      loanContextLines.push(`Eligibility Narrative: ${loanApp.eligibilityNarrative}`);
    }
    
    const offers = loanApp.matchedOffers || [];
    if (offers.length > 0) {
      loanContextLines.push(`Matched Loan Offers from Exa AI Search:`);
      offers.forEach((offer, index) => {
        loanContextLines.push(`  ${index + 1}. Lender: ${offer.lender}`);
        loanContextLines.push(`     Interest Rate: ${offer.interestRateMin}% - ${offer.interestRateMax}%`);
        loanContextLines.push(`     Max Loan Amount: INR ${offer.maxLoanAmountINR.toLocaleString('en-IN')}`);
        loanContextLines.push(`     Collateral Required: ${offer.collateralRequired ? 'Yes' : 'No'}`);
        if (offer.matchReason) {
          loanContextLines.push(`     Match Reason: ${offer.matchReason}`);
        }
      });
    } else {
      loanContextLines.push('No Exa AI matched loan offers found yet.');
    }
  } else {
    loanContextLines.push('No loan application exists yet.');
  }

  const sections = [
    '## Student Profile',
    profileCtx || 'No profile completed yet.',
    '',
    '## KYC Status',
    counsellingProgress.isComplete
      ? 'KYC is COMPLETE. Do not re-ask questions already answered.'
      : counsellingProgress.filledCount > 0
        ? `KYC is PARTIAL. Missing fields: ${counsellingProgress.missingLabels.join(', ')}.`
        : 'KYC has NOT started yet. Begin collecting information from scratch.',
    '',
    '## Education Journey Progress',
    journeyProgressLines.join('\n'),
    '',
    '## Education Loan Details & Offers',
    loanContextLines.join('\n'),
    '',
    '## Conversation History',
    memoryCtx || 'This is the first conversation with this student.',
    '',
    '## Known Facts',
    Object.keys(allFacts).length > 0
      ? Object.entries(allFacts).map(([key, value]) => `- ${key}: ${value}`).join('\n')
      : 'No facts extracted yet.',
    '',
  ];

  if (user.dashboardAnalysis && user.dashboardAnalysis.analysis) {
    sections.push('## AI DASHBOARD ANALYSIS & RECOMMENDATIONS (CRITICAL FOR ADVICE)');
    sections.push('Use the following customized insights to give SPECIFIC advice. DO NOT give generic advice if specific data is available below:');
    sections.push(JSON.stringify(user.dashboardAnalysis.analysis, null, 2));
    sections.push('');
  }

  return {
    fullContext: sections.join('\n'),
    counsellingProgress,
    allFacts,
  };
}

function buildResumePlan(studentName, counsellingProgress, allFacts) {
  const totalCount = counsellingProgress.totalCount || COUNSELLING_FIELDS.length;
  const filledCount = counsellingProgress.filledCount || 0;
  const completionEstimate = Math.round((filledCount / Math.max(totalCount, 1)) * 100);
  const focusFields = counsellingProgress.missingFields.slice(0, 4);
  const returningStudent = filledCount > 0;

  const FIELD_LABELS = Object.fromEntries(
    COUNSELLING_FIELDS.map((f) => [f.key, f.label])
  );

  const resumeMode = !returningStudent
    ? 'fresh'
    : focusFields.length <= 2 || completionEstimate >= 80
      ? 'fast-finish'
      : 'resume-focused';

  const knownFactsSummary = Object.keys(allFacts).length > 0
    ? `Already captured: ${Object.entries(allFacts)
        .map(([k, v]) => `${FIELD_LABELS[k] || k}: ${v}`)
        .join('; ')}.`
    : 'No reliable facts stored yet.';

  const firstTurnGuidance = resumeMode === 'fresh'
    ? 'Start with the normal onboarding opening and begin from scratch.'
    : resumeMode === 'fast-finish'
      ? `Returning student. Skip intro. Directly ask remaining: ${focusFields.map((f) => FIELD_LABELS[f] || f).join(', ') || 'none'}.`
      : `Returning student. Continue with missing fields: ${focusFields.map((f) => FIELD_LABELS[f] || f).join(', ') || 'none'}.`;

  return {
    studentName,
    resumeMode,
    shouldSkipOpeningSequence: resumeMode !== 'fresh',
    focusFields,
    completionEstimate,
    firstTurnGuidance,
    instructionSummary: knownFactsSummary,
    returningStudent,
  };
}

export async function POST(request) {
  try {
    if (!ANAM_API_KEY) {
      return NextResponse.json({ error: 'Anam AI API key not configured' }, { status: 500 });
    }

    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body (mode + optional resumeContext)
    let requestMode = 'onboarding';
    let clientResumeContext = null;
    try {
      const body = await request.json();
      if (body?.mode === 'buddy') requestMode = 'buddy';
      if (body?.resumeContext) clientResumeContext = body.resumeContext;
    } catch {
      // No body or invalid JSON — use defaults
    }

    await dbConnect();

    const user = await User.findById(session.user.id).lean();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get past conversations for memory
    const conversations = await ConversationMemory.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();

    // Fetch loan application to check for Exa AI matched offers
    const loanApp = await LoanApplication.findOne({ userId: session.user.id }).lean();

    // Build context
    const { fullContext, counsellingProgress, allFacts } = buildMemoryContext(user, loanApp, conversations);
    const snapshot = buildCounsellingSnapshot(user.studentProfile || {});
    const studentName = snapshot.studentName || user.name;
    const resumePlan = buildResumePlan(studentName, counsellingProgress, allFacts);

    // Build the system prompt based on mode
    let systemPrompt;
    let firstMessage;

    if (requestMode === 'buddy') {
      // Buddy mode: general counsellor with full profile knowledge
      systemPrompt = buildBuddySystemPrompt(fullContext, studentName, snapshot);
      firstMessage = `Hey ${studentName || 'there'}! I'm Aria, your StudyStack counsellor. I have your full profile, so feel free to ask me anything about your applications, universities, scholarships, loans, visa process, or anything else on your mind!`;
    } else {
      // Onboarding mode: KYC collection
      systemPrompt = buildOnboardingSystemPrompt(
        fullContext,
        studentName,
        resumePlan,
        snapshot
      );
      firstMessage = `Hey there! I'm Aria from StudyStack — I'll be helping you plan your study abroad journey today. This will be super quick and fun! So let's start — what's your name?`;
      if (resumePlan.returningStudent) {
        const focusLabels = (resumePlan.focusFields || []).slice(0, 3).join(', ');
        firstMessage = resumePlan.resumeMode === 'fast-finish'
          ? `Welcome back, ${studentName}! We're almost done — I just need a couple more details${focusLabels ? ` like ${focusLabels}` : ''}. Let's wrap this up quickly.`
          : `Hey ${studentName}, good to have you back! I still have everything from last time. Let me pick up where we left off${focusLabels ? ` — I still need ${focusLabels}` : ''}.`;
      }
    }

    // Fetch system tool IDs (change_language, skip_turn)
    const systemToolIds = await getSystemToolIds();

    // Build persona config for session token
    const personaConfig = {
      name: 'Aria - StudyStack Counsellor',
      avatarId: DEFAULT_AVATAR_ID,
      voiceId: DEFAULT_VOICE_ID,
      llmId: DEFAULT_LLM_ID,
      systemPrompt,
      greeting: firstMessage,
      // Disable thinking/reasoning output from the LLM
      disableThinker: true,
      thinkingBudgetTokens: 0,
      // Attach system tools for multilingual support (change_language, skip_turn)
      ...(systemToolIds.length > 0 ? { toolIds: systemToolIds } : {}),
    };

    // Create session token from Anam API (with 15s timeout)
    const tokenAbort = new AbortController();
    const tokenTimeout = setTimeout(() => tokenAbort.abort(), 15000);

    const tokenRes = await fetch(`${ANAM_API_BASE}/auth/session-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANAM_API_KEY}`,
      },
      body: JSON.stringify({ personaConfig }),
      signal: tokenAbort.signal,
    });

    clearTimeout(tokenTimeout);

    if (!tokenRes.ok) {
      const errorData = await tokenRes.json().catch(() => ({}));
      console.error('[anam-session] Token creation failed:', tokenRes.status, errorData);
      return NextResponse.json(
        { error: 'Failed to create Anam session', details: errorData },
        { status: tokenRes.status }
      );
    }

    const { sessionToken } = await tokenRes.json();

    return NextResponse.json({
      sessionToken,
      sessionContext: {
        studentName,
        resumePlan,
        counsellingProgress,
        isReturning: resumePlan.returningStudent,
        conversationCount: conversations.length,
      },
    });
  } catch (error) {
    console.error('[anam-session] Error:', error);
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Anam AI service timed out. Please try again in a moment.' },
        { status: 504 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
