import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import ConversationMemory from '@/lib/models/ConversationMemory';
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
    const res = await fetch(`${ANAM_API_BASE}/tools`, {
      headers: {
        Authorization: `Bearer ${ANAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
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
      .filter((t) => t.type === 'system' && ['change_language', 'skip_turn'].includes(t.name))
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

  return `You are Aria, StudyStack's friendly AI study-abroad counsellor. You appear as a warm, professional female avatar. Your PRIMARY job is to have a natural conversation to collect the student's profile information (KYC). You must ACTIVELY ASK QUESTIONS — do NOT just introduce yourself and wait.

## LANGUAGE RULES (CRITICAL)
- You MUST match the student's language. If they speak Hindi, reply in Hindi. If they speak Hinglish (mixed Hindi-English), reply in Hinglish. If they speak Marathi, reply in Marathi. If they speak English, reply in English.
- When the student switches language mid-conversation, switch with them immediately.
- IMPORTANT: When you detect the student speaking a non-English language, use the change_language tool to switch the speech recognition to the correct language code:
  - Hindi → language_code: "hi"
  - Marathi → language_code: "mr"
  - Tamil → language_code: "ta"
  - Kannada → language_code: "kn"
  - English → language_code: "en"
  - Urdu → language_code: "ur"
- Use natural conversational tone in whatever language they use.
- Example: If student says "Mujhe UK mein padhai karni hai", call change_language with "hi" and reply in Hindi/Hinglish like "Bahut accha! UK great choice hai. Aap konsa course karna chahte ho?"

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

## PERSONALIZED GUIDANCE
If the student is logged in and you have their context, provide relevant recommendations:
- Suggest specific universities based on their profile, GPA, and target country
- Recommend scholarships they may be eligible for
- Advise on loan options based on their budget range
- Give timeline-specific advice (visa deadlines, application windows)
- Discuss their financial condition sensitively and suggest options

## CONVERSATION STYLE
- Be warm, enthusiastic, and encouraging — like a helpful older sibling
- Use short, natural, spoken sentences. Speak exactly how a human would talk.
- After they answer, briefly acknowledge/validate, then ask the NEXT 1 or 2 questions at most.
- Give brief relevant tips or encouragement related to their answers.
- Example flow: "Nice, Computer Science at Mumbai University is a great foundation! Which countries are you thinking about for your masters, and what kind of budget are you looking at?"

## STRICT FORMATTING RULES (CRITICAL FOR VOICE)
- NEVER output Markdown. NEVER use asterisks (*), hashes (#), bullet points (-), or tables (|). The voice engine will literally read these symbols out loud as "asterisk" or "vertical bar"!
- NEVER output <think> tags or internal reasoning blocks.
- Format everything as plain, conversational text. Use commas and natural pauses.

## BEHAVIOR RULES
- NEVER give a long monologue.
- Ask exactly 1 or 2 missing fields at a time. Do NOT ask more than 2.
- NEVER REPEAT A QUESTION you have already asked. Keep a mental checklist of what the student has answered.
- If the context provided below says a field is "Already Known", DO NOT ask about it.
- ALWAYS end your turn with a question (until all fields are collected).
- Keep each response conversational and short (max 2-3 sentences).
- When all 13 fields are collected, verbally summarize what you've gathered without using any lists or markdown, thank them, and ask them to explicitly click the 'End Session' button on their screen to save their profile.
${userContextSection}
${isReturning ? `## RETURNING STUDENT CONTEXT
This student has talked to you before. Here's what you know:
${resumeBrief}

DO NOT re-ask fields that are already captured. Only ask about the missing fields: ${focusFields.length > 0 ? focusFields.join(', ') : 'Check the context below'}.
` : ''}## STUDENT CONTEXT & MEMORY
${memoryContext || 'This is a brand new student. No prior data. Start from scratch — ask their name first.'}`;
}

function buildMemoryContext(user, conversations) {
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
    '## Conversation History',
    memoryCtx || 'This is the first conversation with this student.',
    '',
    '## Known Facts',
    Object.keys(allFacts).length > 0
      ? Object.entries(allFacts).map(([key, value]) => `- ${key}: ${value}`).join('\n')
      : 'No facts extracted yet.',
  ];

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

    // Build context
    const { fullContext, counsellingProgress, allFacts } = buildMemoryContext(user, conversations);
    const snapshot = buildCounsellingSnapshot(user.studentProfile || {});
    const studentName = snapshot.studentName || user.name;
    const resumePlan = buildResumePlan(studentName, counsellingProgress, allFacts);

    // Build the system prompt with full student context
    const systemPrompt = buildOnboardingSystemPrompt(
      fullContext,
      studentName,
      resumePlan,
      snapshot
    );

    // Fetch system tool IDs (change_language, skip_turn)
    const systemToolIds = await getSystemToolIds();

    // Build the first spoken message
    let firstMessage = `Hey there! I'm Aria from StudyStack — I'll be helping you plan your study abroad journey today. This will be super quick and fun! So let's start — what's your name?`;
    if (resumePlan.returningStudent) {
      const focusLabels = (resumePlan.focusFields || []).slice(0, 3).join(', ');
      firstMessage = resumePlan.resumeMode === 'fast-finish'
        ? `Welcome back, ${studentName}! We're almost done — I just need a couple more details${focusLabels ? ` like ${focusLabels}` : ''}. Let's wrap this up quickly.`
        : `Hey ${studentName}, good to have you back! I still have everything from last time. Let me pick up where we left off${focusLabels ? ` — I still need ${focusLabels}` : ''}.`;
    }

    // Build persona config for session token
    const personaConfig = {
      name: 'Aria - StudyStack Counsellor',
      avatarId: DEFAULT_AVATAR_ID,
      voiceId: DEFAULT_VOICE_ID,
      llmId: DEFAULT_LLM_ID,
      systemPrompt,
      greeting: firstMessage,
      // Attach system tools for multilingual support
      ...(systemToolIds.length > 0 ? { toolIds: systemToolIds } : {}),
    };

    // Create session token from Anam API
    const tokenRes = await fetch(`${ANAM_API_BASE}/auth/session-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANAM_API_KEY}`,
      },
      body: JSON.stringify({ personaConfig }),
    });

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
