import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import ConversationMemory from '@/lib/models/ConversationMemory';
import { recalculateAndCacheUserScore } from '@/lib/lead-scoring';
import {
  buildCounsellingFactMap,
  buildCounsellingProgress,
  mergeCounsellingProfile,
  normalizeCounsellingProfilePatch,
} from '@/lib/counselling-profile';

const EXTRACTION_TEMPLATE = `{
  "studentName": null,
  "phoneNumber": null,
  "contactEmail": null,
  "currentLocation": null,
  "educationLevel": null,
  "fieldOfStudy": null,
  "institution": null,
  "gpaPercentage": null,
  "targetCountries": [],
  "courseInterest": null,
  "englishTestStatus": null,
  "budgetRange": null,
  "applicationTimeline": null
}`;

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Accept transcript from client-side Anam SDK (or legacy ElevenLabs conversationId)
    let transcript = '';
    let rawMessages = [];
    const sessionId = body.sessionId || `anam-${Date.now()}`;

    if (body.transcript && typeof body.transcript === 'string') {
      // Pre-formatted transcript string from client
      transcript = body.transcript.replace(/<think>[\s\S]*?<\/think>/gi, '');
    } else if (body.messages && Array.isArray(body.messages)) {
      // Message array from Anam SDK MESSAGE_HISTORY_UPDATED
      rawMessages = body.messages.map((m) => {
        const text = m.content || m.message || '';
        return {
          role: m.role === 'agent' || m.role === 'persona' ? 'agent' : m.role === 'tool' ? 'tool' : 'user',
          message: text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim(),
          timeInCallSecs: m.timeInCallSecs || 0,
        };
      });
      transcript = rawMessages
        .filter((m) => m.role !== 'tool')
        .map((m) => `${m.role === 'user' ? 'Student' : 'Agent'}: ${m.message}`)
        .join('\n');
    } else if (body.conversationId) {
      // Legacy ElevenLabs path — try to fetch transcript from ElevenLabs API
      try {
        const elResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(body.conversationId)}`,
          { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } }
        );
        if (elResponse.ok) {
          const elData = await elResponse.json();
          rawMessages = (elData.transcript || []).map((t) => ({
            role: t.role === 'agent' ? 'agent' : t.role === 'tool' ? 'tool' : 'user',
            message: t.message || '',
            timeInCallSecs: t.time_in_call_secs || 0,
          }));
          transcript = rawMessages
            .filter((m) => m.role !== 'tool')
            .map((m) => `${m.role === 'user' ? 'Student' : 'Agent'}: ${m.message}`)
            .join('\n');
        }
      } catch (elErr) {
        console.warn('[extract-kyc] ElevenLabs fallback failed:', elErr.message);
      }
    }

    if (!transcript.trim()) {
      return NextResponse.json({ success: true, partial: true, message: 'Conversation saved (no data to extract)' });
    }

    // 2. Use Gemini to extract structured counselling data
    const { GoogleGenAI } = await import('@google/genai');
    const genAI = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const prompt = `You are a precise extraction engine for an overseas education counselling call.

The transcript may be in English, Hindi, Hinglish (mixed Hindi-English), Marathi, Tamil, Kannada, Telugu, Bengali, Gujarati, Urdu, Punjabi, or Malayalam. Extract information regardless of the language used. Translate non-English values to English for the JSON output.

Extract ONLY the student facts that were explicitly stated by the student in the transcript.
Do not infer, guess, or copy the agent's suggestions as if they were the student's answers.
If the student has not actually provided a value yet, leave it null.

Return VALID JSON matching this template exactly:
${EXTRACTION_TEMPLATE}

Rules:
- Keep strings concise and human-readable.
- Use the student's wording when possible, but lightly normalize obvious formatting.
- targetCountries must be an array of country names mentioned by the student.
- phoneNumber must contain the phone number only if the student explicitly said it. CRITICAL: Voice transcripts often contain numbers as individual words. You MUST convert ALL spoken/word numbers to digits before outputting. Examples:
  • "nine eight seven six five four three two one zero" → "9876543210"
  • "double nine eight eight five zero" → "9988850"
  • "triple eight" → "888"
  • "nine eight seven six five, four three two one zero" → "9876543210"
  • "plus ninety one nine eight seven six five four three two one zero" → "+919876543210"
  • Hindi: "nau aath saat chhe paanch chaar teen do ek shunya" → "9876543210"
  Always output as a pure digit string with optional leading +91. Remove any spaces, dashes, or other separators.
- contactEmail must contain the email only if the student explicitly said it.
- englishTestStatus should combine status and score if both are known, for example: "IELTS taken, overall 7.0" or "PTE preparing".
- applicationTimeline should capture when the student plans to apply, for example: "next 2 months" or "Fall 2026".
- budgetRange should capture the spoken budget naturally, for example: "20-25 lakhs".
- Do not output placeholder strings like "unknown" or "not provided". Use null instead.

Transcript:
${transcript}

Respond ONLY with valid JSON.`;

    let result;
    try {
      result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
    } catch (apiErr) {
      console.error('[extract-kyc] Gemini API error:', apiErr.message || apiErr);
      return NextResponse.json({ error: 'Gemini API failed: ' + (apiErr.message || 'Unknown error') }, { status: 500 });
    }

    const text = (result?.text ?? '').trim();
    if (!text) {
      console.error('[extract-kyc] Gemini returned empty response, result:', result);
      return NextResponse.json({ error: 'Gemini returned empty response' }, { status: 500 });
    }

    let extracted;
    try {
      extracted = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch (parseErr) {
      console.error('[extract-kyc] Gemini returned invalid JSON:', text.substring(0, 500));
      return NextResponse.json({ error: 'Failed to parse extracted profile: ' + parseErr.message }, { status: 500 });
    }

    const profilePatch = normalizeCounsellingProfilePatch(extracted);
    const extractedCount = Object.keys(profilePatch).length;

    // 4. Save to MongoDB
    await dbConnect();

    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const existingProfile = (user.studentProfile?.toObject ? user.studentProfile.toObject() : user.studentProfile) || {};
    const { mergedProfile } = mergeCounsellingProfile(existingProfile, profilePatch);
    const counsellingProgress = buildCounsellingProgress(mergedProfile);
    const isComplete = user.hasCompletedKYC || counsellingProgress.isComplete;

    await User.findByIdAndUpdate(
      session.user.id,
      {
        studentProfile: mergedProfile,
        hasCompletedKYC: isComplete,
        updatedAt: new Date(),
      },
      { new: true, runValidators: false }
    );

    // Save transcript to ConversationMemory so future sessions have context.
    try {
      if (rawMessages.length === 0 && transcript) {
        // Build rawMessages from transcript string
        rawMessages = transcript.split('\n').map((line) => {
          const isStudent = line.startsWith('Student:');
          return {
            role: isStudent ? 'user' : 'agent',
            message: line.replace(/^(Student|Agent):\s*/, ''),
            timeInCallSecs: 0,
          };
        });
      }

      const kycFacts = buildCounsellingFactMap(mergedProfile);

      const profileLine = Object.entries(kycFacts)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ');

      const summary = `Counselling onboarding — ${
        counsellingProgress.isComplete ? 'all required counselling fields were collected' : 'partial counselling profile collected'
      }. ${profileLine}`.trim();

      await ConversationMemory.findOneAndUpdate(
        { conversationId: sessionId },
        {
          userId: session.user.id,
          conversationId: sessionId,
          anamSessionId: body.sessionId || '',
          messages: rawMessages,
          summary,
          extractedFacts: kycFacts,
          callDurationSecs: 0,
          mode: 'onboarding',
          transcriptText: transcript,
        },
        { upsert: true, new: true }
      );

      // Recalculate and cache lead score
      await recalculateAndCacheUserScore(session.user.id);
    } catch (memErr) {
      // Non-fatal: KYC data is already saved; memory save failure is acceptable.
      console.warn('[extract-kyc] ConversationMemory/scoring save failed:', memErr.message);
    }

    return NextResponse.json({
      success: true,
      partial: !counsellingProgress.isComplete,
      message: counsellingProgress.isComplete
        ? 'Profile extracted and saved from the voice conversation'
        : 'Partial profile saved — continue the conversation to complete the remaining fields',
      profile: mergedProfile,
      extractedFields: extractedCount,
      counsellingProgress,
    });
  } catch (error) {
    console.error('[extract-kyc] Error:', error);
    return NextResponse.json(
      { error: 'Failed to extract and save profile' },
      { status: 500 }
    );
  }
}
