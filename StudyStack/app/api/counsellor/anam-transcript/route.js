import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'counsellor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const apiKey = process.env.ANAM_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Anam AI API key not configured' }, { status: 500 });
    }

    const base = 'https://api.anam.ai/v1';

    // 1. Fetch Session Details
    let sessionDetails = null;
    try {
      const detailsRes = await fetch(`${base}/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (detailsRes.ok) {
        sessionDetails = await detailsRes.json();
      } else {
        console.warn(`[anam-transcript] Failed to fetch session details: ${detailsRes.status}`);
      }
    } catch (err) {
      console.error('[anam-transcript] Error fetching session details:', err);
    }

    // 2. Fetch Transcript
    let transcriptData = null;
    try {
      const transcriptRes = await fetch(`${base}/sessions/${sessionId}/transcript`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (transcriptRes.ok) {
        const contentType = transcriptRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          transcriptData = await transcriptRes.json();
        } else {
          const text = await transcriptRes.text();
          transcriptData = { rawText: text };
        }
      } else {
        console.warn(`[anam-transcript] Failed to fetch transcript: ${transcriptRes.status}`);
      }
    } catch (err) {
      console.error('[anam-transcript] Error fetching transcript:', err);
    }

    // 2.5. Fetch Recording URL
    let recordingUrl = null;
    try {
      const recordingRes = await fetch(`${base}/sessions/${sessionId}/recording`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (recordingRes.ok) {
        const recordingData = await recordingRes.json();
        recordingUrl = recordingData.recordingUrl || null;
      } else {
        console.warn(`[anam-transcript] Failed to fetch recording URL: ${recordingRes.status}`);
      }
    } catch (err) {
      console.error('[anam-transcript] Error fetching recording URL:', err);
    }

    // 3. Format/Normalize Transcript to unified chat format
    let messages = [];

    if (transcriptData) {
      const rawMsgList = Array.isArray(transcriptData)
        ? transcriptData
        : Array.isArray(transcriptData.data)
          ? transcriptData.data
          : Array.isArray(transcriptData.transcript)
            ? transcriptData.transcript
            : Array.isArray(transcriptData.messages)
              ? transcriptData.messages
              : null;

      if (rawMsgList) {
        messages = rawMsgList.map((m) => {
          const roleRaw = (m.role || '').toLowerCase();
          const role = (roleRaw === 'persona' || roleRaw === 'agent' || roleRaw === 'assistant') ? 'agent' : 'user';
          const content = m.content || m.text || m.message || '';
          const cleanedContent = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          return {
            id: m.id || m.messageId,
            role,
            content: cleanedContent,
            timestamp: m.timestamp || m.createdAt || null,
          };
        });
      } else if (transcriptData.rawText) {
        const lines = transcriptData.rawText.split('\n').filter(Boolean);
        messages = lines.map((line, idx) => {
          const colonIdx = line.indexOf(':');
          if (colonIdx > -1) {
            const speaker = line.substring(0, colonIdx).trim().toLowerCase();
            const content = line.substring(colonIdx + 1).trim();
            const role = (speaker === 'agent' || speaker === 'persona' || speaker === 'aria' || speaker === 'assistant') ? 'agent' : 'user';
            return {
              id: `raw-${idx}`,
              role,
              content,
              timestamp: null
            };
          }
          return {
            id: `raw-${idx}`,
            role: 'unknown',
            content: line.trim(),
            timestamp: null
          };
        });
      }
    }

    return NextResponse.json({
      sessionId,
      session: sessionDetails,
      recordingUrl,
      transcript: messages,
    });
  } catch (error) {
    console.error('[counsellor/anam-transcript] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
