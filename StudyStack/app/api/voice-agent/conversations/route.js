import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import ConversationMemory from '@/lib/models/ConversationMemory';
import { recalculateAndCacheUserScore } from '@/lib/lead-scoring';

// Save a conversation after it ends
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.text();
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { conversationId, sessionId, mode, messages: clientMessages, transcript: clientTranscript } = parsed;
    const convId = conversationId || sessionId || `anam-${Date.now()}`;

    let messages = [];
    let transcriptText = '';

    // Path 1: Client-provided messages (from Anam SDK MESSAGE_HISTORY_UPDATED)
    if (clientMessages && Array.isArray(clientMessages) && clientMessages.length > 0) {
      messages = clientMessages.map((m) => {
        const text = m.content || m.message || '';
        return {
          role: m.role === 'agent' || m.role === 'persona' ? 'agent' : m.role === 'tool' ? 'tool' : 'user',
          message: text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim(),
          timeInCallSecs: m.timeInCallSecs || 0,
        };
      });
      transcriptText = clientTranscript
        ? clientTranscript.replace(/<think>[\s\S]*?<\/think>/gi, '')
        : messages
            .filter((m) => m.role !== 'tool')
            .map((m) => `${m.role === 'user' ? 'Student' : 'Agent'}: ${m.message}`)
            .join('\n');
    }
    // Path 2: Legacy ElevenLabs path — fetch transcript from ElevenLabs API
    else if (conversationId && process.env.ELEVENLABS_API_KEY) {
      try {
        const elResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}`,
          { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } }
        );
        if (elResponse.ok) {
          const elData = await elResponse.json();
          messages = (elData.transcript || []).map((t) => ({
            role: t.role === 'agent' ? 'agent' : t.role === 'tool' ? 'tool' : 'user',
            message: t.message || '',
            timeInCallSecs: t.time_in_call_secs || 0,
          }));
          transcriptText = messages
            .filter((m) => m.role !== 'tool')
            .map((m) => `${m.role === 'user' ? 'Student' : 'Agent'}: ${m.message}`)
            .join('\n');
        }
      } catch (elErr) {
        console.warn('[conversations] ElevenLabs fallback failed:', elErr.message);
      }
    }

    if (messages.length === 0) {
      return NextResponse.json({ success: true, message: 'No messages to save' });
    }

    // Build a summary from the conversation using Gemini
    let summary = '';
    const extractedFacts = {};

    if (messages.length > 0 && transcriptText) {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const genAI = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
        });

        const result = await genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `You are a memory extraction engine for a student counselling AI buddy called StudyStack.
Analyze this conversation transcript and produce a JSON object with exactly two keys:
1. "summary": A concise 2-3 sentence summary of what was discussed, focusing on the student's needs, preferences, emotional state, and any decisions made.
2. "facts": An object of key-value pairs of important facts learned about the student (e.g. name, target country, budget, test scores, concerns, preferences, mood, goals, timeline). Only include facts that were explicitly mentioned.

Transcript:
${transcriptText}

Respond ONLY with valid JSON, no markdown.`,
        });

        const text = (result.text ?? '').trim();
        const geminiParsed = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
        summary = geminiParsed.summary || '';
        if (geminiParsed.facts && typeof geminiParsed.facts === 'object') {
          for (const [k, v] of Object.entries(geminiParsed.facts)) {
            if (typeof v === 'string' || typeof v === 'number') {
              extractedFacts[String(k)] = String(v);
            }
          }
        }
      } catch (err) {
        console.error('[conversations] Summary generation failed:', err.message);
        // Fallback: simple summary
        summary = `Conversation with ${messages.length} messages.`;
      }
    }

    await dbConnect();

    const doc = await ConversationMemory.findOneAndUpdate(
      { conversationId: convId },
      {
        userId: session.user.id,
        conversationId: convId,
        anamSessionId: sessionId || '',
        messages,
        summary,
        extractedFacts,
        callDurationSecs: 0,
        mode: mode || 'buddy',
        transcriptText,
      },
      { upsert: true, new: true }
    );

    // Recalculate and cache lead score
    await recalculateAndCacheUserScore(session.user.id).catch((err) =>
      console.error('[conversations] Recalculate score failed:', err.message)
    );

    return NextResponse.json({ success: true, id: doc._id });
  } catch (error) {
    console.error('[conversations] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get all conversations for the current user
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    const conversations = await ConversationMemory.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('conversationId anamSessionId summary extractedFacts callDurationSecs mode recordingUrl language createdAt')
      .lean();

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('[conversations] GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
