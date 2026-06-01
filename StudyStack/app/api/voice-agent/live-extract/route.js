import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import {
  buildCounsellingFactMap,
  buildCounsellingProgress,
  mergeCounsellingProfile,
  normalizeCounsellingProfilePatch,
} from '@/lib/counselling-profile';
import ConversationMemory from '@/lib/models/ConversationMemory';
import { recalculateAndCacheUserScore } from '@/lib/lead-scoring';

/**
 * POST /api/voice-agent/live-extract
 *
 * Called periodically (~20 s) DURING an active voice call to keep the
 * LiveKYCChecklist updated in real-time.
 *
 * Flow:
 *   1. Fetch current transcript from ElevenLabs (works for active conversations)
 *   2. Run a lightweight Gemini extraction to detect field values
 *   3. Merge newly detected fields into the user's studentProfile
 *   4. Does NOT set hasCompletedKYC — that's reserved for final extraction
 */

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

    const { conversationId, sessionId, lastLineCount, transcript: clientTranscript } = await request.json();

    const resolvedConversationId = conversationId || sessionId || `anam-${Date.now()}`;

    let transcript = '';
    let lineCount = 0;

    if (clientTranscript && typeof clientTranscript === 'string') {
      // Anam SDK client-side transcript
      transcript = clientTranscript;
      lineCount = transcript.split('\n').filter((l) => l.trim().length > 0).length;
    } else if (conversationId) {
      // Legacy ElevenLabs path
      try {
        const elResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}`,
          { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } }
        );
        if (elResponse.ok) {
          const elData = await elResponse.json();
          const rawTranscript = (elData.transcript || []).filter((t) => t.role !== 'tool');
          transcript = rawTranscript
            .map((t) => `${t.role === 'user' ? 'Student' : 'Agent'}: ${t.message || ''}`)
            .join('\n');
          lineCount = rawTranscript.length;
        }
      } catch (err) {
        // Fallback silently
      }
    }

    // Skip if transcript hasn't grown since last extraction
    if (!transcript || lineCount <= (lastLineCount || 0)) {
      return NextResponse.json({
        fields: [],
        lineCount: lineCount,
        skipped: true,
        conversationId: resolvedConversationId,
      });
    }

    if (!transcript.trim()) {
      return NextResponse.json({ fields: [], lineCount: 0, conversationId: resolvedConversationId });
    }

    // Strip <think> tags before extracting
    const cleanTranscript = transcript.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // 2. Lightweight Gemini extraction
    const { GoogleGenAI } = await import('@google/genai');
    const genAI = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const prompt = `You are extracting structured student facts from an ongoing overseas education counselling call.

  The transcript may be in English, Hindi, Hinglish (mixed Hindi-English), Marathi, Tamil, Kannada, Telugu, Bengali, Gujarati, Urdu, Punjabi, or Malayalam. Extract information regardless of the language used. Translate non-English values to English for the JSON output.

  Return VALID JSON matching this template exactly:
  ${EXTRACTION_TEMPLATE}

  Rules:
  - Extract ONLY facts the student has explicitly said so far.
  - Do not infer or guess missing answers.
  - Use null for fields that have not been provided yet.
  - targetCountries must be an array.
  - Keep values concise and human-readable.
  - englishTestStatus should combine exam status and score if both are known.
  - phoneNumber: Voice transcripts contain numbers as words. Convert ALL spoken numbers to digits (e.g. "nine eight seven six five four three two one zero" → "9876543210", "double nine" → "99", Hindi: "nau aath saat" → "987"). Output as pure digit string with optional +91 prefix. Remove spaces/dashes.
  - Do not output placeholder text like "unknown" or "not provided".

  Transcript:
  ${cleanTranscript}

  Respond ONLY with valid JSON.`;

    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const text = (result.text ?? '').trim();
    let extracted;
    try {
      extracted = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch {
      return NextResponse.json({ fields: [], lineCount, error: 'parse' });
    }

    const validFields = normalizeCounsellingProfilePatch(extracted);

    // 4. Merge into existing profile and persist the live conversation snapshot
    await dbConnect();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ fields: [], lineCount, conversationId: resolvedConversationId });
    }

    const existing = (user.studentProfile?.toObject ? user.studentProfile.toObject() : user.studentProfile) || {};
    const { mergedProfile, changedFields, newFields } = mergeCounsellingProfile(existing, validFields);

    if (changedFields.length > 0) {
      await User.findByIdAndUpdate(session.user.id, {
        $set: {
          studentProfile: mergedProfile,
          updatedAt: new Date(),
        },
      }, { runValidators: false });
    }

    // Save a snapshot of the live transcript
    try {
      const rawMessages = cleanTranscript.split('\n').map((line) => {
        const isStudent = line.startsWith('Student:');
        return {
          role: isStudent ? 'user' : 'agent',
          message: line.replace(/^(Student|Agent):\s*/, ''),
          timeInCallSecs: 0,
        };
      });

      const liveProfile = changedFields.length > 0 ? mergedProfile : existing;
      const counsellingProgress = buildCounsellingProgress(liveProfile);
      const extractedFacts = buildCounsellingFactMap(liveProfile);
      const summary = `Live counselling capture — ${counsellingProgress.filledCount}/${counsellingProgress.totalCount} fields recorded.`;

      await ConversationMemory.findOneAndUpdate(
        { conversationId: resolvedConversationId },
        {
          userId: session.user.id,
          conversationId: resolvedConversationId,
          anamSessionId: sessionId || '',
          messages: rawMessages,
          summary,
          extractedFacts,
          callDurationSecs: 0,
          mode: 'onboarding',
          transcriptText: cleanTranscript,
        },
        { upsert: true, new: true }
      );

      // Recalculate and cache lead score
      await recalculateAndCacheUserScore(session.user.id);
    } catch (memErr) {
      // non-fatal
      console.warn('[live-extract] ConversationMemory/scoring save failed:', memErr.message);
    }

    return NextResponse.json({
      fields: Object.keys(validFields),
      newFields,
      changedFields,
      lineCount,
      counsellingProgress: buildCounsellingProgress(changedFields.length > 0 ? mergedProfile : existing),
      transcriptUpdated: true,
      conversationId: resolvedConversationId,
    });
  } catch (error) {
    console.error('[live-extract] Error:', error);
    // Non-fatal — return empty fields so the interval continues
    return NextResponse.json({ fields: [], lineCount: 0 });
  }
}
