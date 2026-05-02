'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

const AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || 'agent_6301kncrnakkft1seqw159q12j6b';

/**
 * Build a comprehensive system prompt for the onboarding voice agent.
 * This overrides whatever is on the ElevenLabs dashboard so we have
 * full control over the agent's behavior, question flow, and language.
 */
function buildOnboardingSystemPrompt(memoryContext, studentName, resumePlan) {
  const name = studentName || 'the student';
  const isReturning = resumePlan?.returningStudent;
  const focusFields = resumePlan?.focusFields || [];
  const resumeBrief = resumePlan
    ? [resumePlan.firstTurnGuidance, resumePlan.instructionSummary].filter(Boolean).join('\n')
    : '';

  return `You are Aria, StudyStack's friendly AI study-abroad counsellor. Your PRIMARY job is to have a natural conversation to collect the student's profile information (KYC). You must ACTIVELY ASK QUESTIONS — do NOT just introduce yourself and wait.

## LANGUAGE RULES (CRITICAL)
- You MUST match the student's language. If they speak Hindi, reply in Hindi. If they speak Hinglish (mixed Hindi-English), reply in Hinglish. If they speak Marathi, reply in Marathi. If they speak English, reply in English.
- When the student switches language mid-conversation, switch with them immediately.
- Use natural conversational tone in whatever language they use.
- Example: If student says "Mujhe UK mein padhai karni hai", reply in Hindi/Hinglish like "Bahut accha! UK great choice hai. Aap konsa course karna chahte ho?"

## YOUR CONVERSATION FLOW
You need to collect these 13 fields through natural conversation. Ask about them ONE or TWO at a time, don't dump all questions at once:

1. **Student Name** — Start by asking their name warmly
2. **Phone Number** — Ask for their WhatsApp/contact number. Say something like "What's your WhatsApp number? You can say it digit by digit." If they give it, repeat it back to confirm.
3. **Email** — Ask for email address. Ask them to spell it out if unclear.
4. **Current Location** — Which city/state they're from
5. **Education Level** — 10th/12th/Diploma/Bachelors/Masters/PhD
6. **Field of Study** — Engineering/Business/Medicine/Arts/Science/Law/IT/Other
7. **Institution** — Current or last college/university name
8. **GPA/Percentage** — Their academic score range
9. **Target Countries** — Where they want to study (UK/Ireland/USA/Canada/Australia/Germany)
10. **Course Interest** — Undergraduate/Postgraduate/PhD/Foundation/Language Course
11. **English Test Status** — IELTS/TOEFL status and score if available
12. **Budget Range** — Their budget for studying abroad
13. **Application Timeline** — When they plan to apply (immediately/1 month/1-3 months/etc.)

## CONVERSATION STYLE
- Be warm, enthusiastic, and encouraging — like a helpful older sibling
- Use short, conversational responses (2-3 sentences max per turn)
- After they answer, briefly acknowledge/validate, then ask the NEXT question
- Use emoji occasionally but don't overdo it
- Give brief relevant tips or encouragement related to their answers
- Example flow: "Nice, Computer Science at Mumbai University — that's a strong foundation! 💪 Which countries are you thinking about for your masters?"

## RULES
- NEVER give a long monologue about yourself or StudyStack
- NEVER list all questions at once
- ALWAYS end your turn with a question (until all fields are collected)
- Keep each response SHORT and conversational
- If the student goes off-topic, gently steer back: "That's interesting! By the way, I still need to know about..."
- When all 13 fields are collected, summarize what you've gathered, thank them, and call the saveStudentProfile tool

${isReturning ? `## RETURNING STUDENT CONTEXT
This student has talked to you before. Here's what you know:
${resumeBrief}

DO NOT re-ask fields that are already captured. Only ask about the missing fields: ${focusFields.length > 0 ? focusFields.join(', ') : 'Check the context below'}.
` : ''}
## STUDENT CONTEXT & MEMORY
${memoryContext || 'This is a brand new student. No prior data. Start from scratch — ask their name first.'}`;
}

/**
 * mode:
 *   - "onboarding"  →  KYC collection flow. After the conversation ends the
 *                       transcript is sent to Gemini for structured extraction
 *                       and saved to the student's MongoDB profile automatically.
 *   - "buddy"       →  Persistent memory buddy that remembers everything.
 *
 * onComplete is called when the session finishes.
 */
export default function ElevenLabsVoiceAgent({ onComplete, mode = 'onboarding', sessionMemory = null }) {
  const widgetContainerRef = useRef(null);
  const conversationIdRef = useRef(null);
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [disconnectReason, setDisconnectReason] = useState(''); // 'quota' | 'guardrail' | ''
  const [reconnecting, setReconnecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const lastConversationIdRef = useRef(null); // track last cid for cleanup
  const memoryContextRef = useRef('');
  const studentNameRef = useRef('');
  const hasExtractedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const modeRef = useRef(mode);
  const resumePlanRef = useRef(null);
  const liveExtractIntervalRef = useRef(null);
  const liveLineCountRef = useRef(0);
  const liveExtractingRef = useRef(false);

  // Keep refs in sync without triggering effect re-runs
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Fetch persistent memory before mounting the widget
  useEffect(() => {
    let cancelled = false;

    if (sessionMemory) {
      memoryContextRef.current = sessionMemory.context || '';
      studentNameRef.current = sessionMemory.studentName || '';
      resumePlanRef.current = sessionMemory.resumePlan || null;
      setMemoryLoaded(true);
      return () => { cancelled = true; };
    }

    (async () => {
      try {
        const res = await fetch('/api/voice-agent/memory');
        if (res.ok) {
          const data = await res.json();
          memoryContextRef.current = data.context || '';
          studentNameRef.current = data.studentName || '';
          resumePlanRef.current = data.resumePlan || null;
        }
      } catch (err) {
        console.error('[ElevenLabs] Failed to load memory:', err);
      }
      if (!cancelled) setMemoryLoaded(true);
    })();

    return () => { cancelled = true; };
  }, [sessionMemory]);

  // Mount the widget once memory is loaded (or on retry)
  useEffect(() => {
    if (!memoryLoaded) return;
    setDisconnected(false);

    let widget = null;
    let script = document.querySelector('script[data-elevenlabs-convai-widget]');
    let ownsScript = false;
    const timeoutIds = [];

    const fireExpandEvent = () => {
      document.dispatchEvent(
        new CustomEvent('elevenlabs-agent:expand', {
          detail: { action: 'expand' },
          bubbles: true,
          composed: true,
        })
      );
    };

    const scheduleAutoExpand = () => {
      timeoutIds.push(window.setTimeout(fireExpandEvent, 300));
      timeoutIds.push(window.setTimeout(fireExpandEvent, 800));
    };

    const emitProfileUpdate = (detail = {}) => {
      window.dispatchEvent(
        new CustomEvent('counselling-profile:updated', {
          detail,
        })
      );
    };

    const startLiveExtractionLoop = () => {
      if (modeRef.current !== 'onboarding' || liveExtractIntervalRef.current) {
        return;
      }

      liveLineCountRef.current = 0;
      liveExtractingRef.current = false;

      liveExtractIntervalRef.current = window.setInterval(async () => {
        if (liveExtractingRef.current) return;
        liveExtractingRef.current = true;

        try {
          const res = await fetch('/api/voice-agent/live-extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationId: conversationIdRef.current,
              lastLineCount: liveLineCountRef.current,
            }),
          });

          if (res.ok) {
            const data = await res.json();

            if (data.conversationId) {
              conversationIdRef.current = data.conversationId;
            }

            if (typeof data.lineCount === 'number') {
              liveLineCountRef.current = data.lineCount;
            }

            if (data.transcriptUpdated || data.changedFields?.length || data.newFields?.length) {
              emitProfileUpdate({
                source: 'live-extract',
                changedFields: data.changedFields || [],
                newFields: data.newFields || [],
                progress: data.counsellingProgress || null,
                conversationId: data.conversationId || conversationIdRef.current,
              });
            }
          }
        } catch {
          // Non-fatal — just skip this cycle
        } finally {
          liveExtractingRef.current = false;
        }
      }, 6_000);
    };

    // ── Extract KYC from transcript via Gemini (onboarding mode) ──
    const extractAndSaveKyc = async (overrideCid) => {
      if (hasExtractedRef.current) return;
      hasExtractedRef.current = true;

      const cid = overrideCid || conversationIdRef.current;

      setExtracting(true);
      try {
        // Extract structured KYC from the transcript via Gemini.
        // The extract-kyc route also saves ConversationMemory in the same
        // ElevenLabs API call, so no separate /conversations call is needed.
        const res = await fetch('/api/voice-agent/extract-kyc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: cid }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Extraction failed');

        emitProfileUpdate({
          source: 'extract-kyc',
          final: true,
          progress: data.counsellingProgress || null,
          extractedFields: data.extractedFields || 0,
        });

        if (data.partial) {
          toast.success('Progress saved! Continue next time to complete your profile.');
        } else {
          toast.success('Profile extracted and saved!');
        }
        window.setTimeout(() => onCompleteRef.current?.(), 1500);
      } catch (err) {
        console.error('[ElevenLabs] KYC extraction error:', err);
        toast.error('Could not extract profile. You can fill manually.');
        window.setTimeout(() => onCompleteRef.current?.(), 2000);
      } finally {
        setExtracting(false);
      }
    };

    // ── Client tool: signal conversation complete (onboarding) ──
    const finishOnboarding = async () => {
      extractAndSaveKyc();
      return 'Thank you! I am now extracting your profile from our conversation. This will just take a moment.';
    };

    // ── Client tool: end buddy chat ──
    const endBuddyChat = async () => {
      await saveConversation('buddy');
      toast.success('Chat saved! See you next time 👋');
      window.setTimeout(() => onCompleteRef.current?.(), 1000);
      return 'Conversation saved. Say goodbye warmly.';
    };

    // ── Save conversation to MongoDB ──
    const saveConversation = async (convMode) => {
      const cid = conversationIdRef.current;
      try {
        if (cid) {
          await fetch('/api/voice-agent/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId: cid, mode: convMode }),
          });
        } else {
          await fetch('/api/voice-agent/conversations/sync-latest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: convMode }),
          });
        }
      } catch (err) {
        console.error('[ElevenLabs] Failed to save conversation:', err);
      }
    };

    // ── Handle call event: inject memory + tools ──
    const handleCall = (event) => {
      const config = event.detail.config;

      if (modeRef.current === 'onboarding') {
        config.clientTools = { saveStudentProfile: finishOnboarding };
      } else {
        config.clientTools = { endConversation: endBuddyChat };
      }

      // Inject persistent memory via dynamic variables
      const memoryCtx = memoryContextRef.current;
      const studentName = studentNameRef.current;
      const resumePlan = resumePlanRef.current;
      const isReturning = resumePlan?.returningStudent;
      const resumeBrief = resumePlan
        ? [resumePlan.firstTurnGuidance, resumePlan.instructionSummary].filter(Boolean).join('\n')
        : '';

      if (memoryCtx || studentName || resumePlan) {
        config.dynamicVariables = {
          ...(config.dynamicVariables || {}),
          student_name: studentName,
          student_memory: memoryCtx,
          returning_student: isReturning ? 'true' : 'false',
          resume_mode: resumePlan?.resumeMode || 'fresh',
          resume_focus_fields: resumePlan?.focusFields?.join(', ') || '',
          resume_brief: resumeBrief,
          skip_opening_sequence: resumePlan?.shouldSkipOpeningSequence ? 'true' : 'false',
          completion_estimate: String(resumePlan?.completionEstimate ?? ''),
        };
      }

      // Build a comprehensive system prompt override so the agent knows
      // exactly what to do — ask KYC questions, support Hindi, etc.
      const systemPrompt = buildOnboardingSystemPrompt(memoryCtx, studentName, resumePlan);
      
      // Pass the first spoken message as a dynamic variable instead of an override
      let firstMsg = `Hey there! I'm Aria from StudyStack — I'll be helping you plan your study abroad journey today. This will be super quick and fun! So let's start — what's your name?`;

      if (isReturning && resumePlan) {
        const focusLabels = (resumePlan.focusFields || []).slice(0, 3).join(', ');
        const name = studentName || 'there';
        firstMsg =
          resumePlan.resumeMode === 'fast-finish'
            ? `Welcome back, ${name}! We're almost done — I just need a couple more details${focusLabels ? ` like ${focusLabels}` : ''}. Let's wrap this up quickly.`
            : `Hey ${name}, good to have you back! I still have everything from last time. Let me pick up where we left off${focusLabels ? ` — I still need ${focusLabels}` : ''}.`;
      }

      // Safely assign all our dynamic variables in one block
      config.dynamicVariables = {
        ...(config.dynamicVariables || {}),
        dynamic_system_prompt: systemPrompt,
        dynamic_first_message: firstMsg
      };
    };

    // ── Handle conversation ID from metadata ──
    const handleMessage = (event) => {
      if (event.detail?.conversationId) {
        conversationIdRef.current = event.detail.conversationId;
      }

      startLiveExtractionLoop();
    };

    // ── Handle disconnect (guardrail, quota, network error, user ended call) ──
    const handleDisconnect = (event) => {
      const cid = conversationIdRef.current;

      // Stop live extraction interval immediately
      if (liveExtractIntervalRef.current) {
        window.clearInterval(liveExtractIntervalRef.current);
        liveExtractIntervalRef.current = null;
      }

      // Classify the error type from ElevenLabs event detail
      const detail = event?.detail || {};
      const reason = (detail.reason || detail.message || '').toLowerCase();
      const isQuota = /quota|limit|exceed|credit|billing/i.test(reason);
      const isGuardrail = /guardrail/i.test(reason);

      if (isQuota) {
        // Quota = concurrent slot still held. Store the cid so we can DELETE it on retry.
        lastConversationIdRef.current = cid || null;
        conversationIdRef.current = null;
        setDisconnectReason('quota');
        setDisconnected(true);
        return;
      }

      if (!cid) {
        // No conversation ID from widget — still attempt extraction;
        // the backend can resolve the latest conversation from ElevenLabs API.
        if (modeRef.current === 'onboarding' && !hasExtractedRef.current) {
          window.setTimeout(() => extractAndSaveKyc(null), 2000);
        }
        setDisconnectReason('');
        setDisconnected(true);
        return;
      }

      // For buddy mode, save the conversation to memory.
      // Onboarding mode is fully handled by extractAndSaveKyc (which calls
      // extract-kyc — that route now fetches the transcript once and saves
      // both the KYC profile AND ConversationMemory in a single EL API call).
      if (modeRef.current !== 'onboarding') {
        saveConversation('buddy');
      }

      // For onboarding: attempt to extract whatever was collected.
      // IMPORTANT: capture cid NOW because conversationIdRef is cleared below.
      if (modeRef.current === 'onboarding' && !hasExtractedRef.current) {
        const cidForExtract = cid;
        window.setTimeout(() => extractAndSaveKyc(cidForExtract), 2000);
      }

      if (isGuardrail) {
        toast.error('The conversation was interrupted. Your progress has been saved — you can continue.', { duration: 5000 });
      }

      // Show the disconnected UI with retry option
      hasExtractedRef.current = false; // allow re-extraction on retry
      lastConversationIdRef.current = cid;
      conversationIdRef.current = null;
      setDisconnectReason(isGuardrail ? 'guardrail' : '');
      setDisconnected(true);
    };

    widget = document.createElement('elevenlabs-convai');
    widget.setAttribute('agent-id', AGENT_ID);
    widget.setAttribute('default-expanded', 'true');
    widget.setAttribute('always-expanded', 'true');
    widget.addEventListener('elevenlabs-convai:call', handleCall);
    widget.addEventListener('elevenlabs-convai:conversation', handleMessage);
    widget.addEventListener('elevenlabs-convai:error', handleDisconnect);
    widget.addEventListener('elevenlabs-convai:disconnect', handleDisconnect);

    if (widgetContainerRef.current) {
      widgetContainerRef.current.appendChild(widget);
    }

    if (!script) {
      script = document.createElement('script');
      script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
      script.async = true;
      script.type = 'text/javascript';
      script.dataset.elevenlabsConvaiWidget = 'true';
      document.body.appendChild(script);
      ownsScript = true;
    }

    scheduleAutoExpand();

    // When conversation ends (user navigates away), save it
    const handleBeforeUnload = () => {
      const cid = conversationIdRef.current;
      const endpoint = cid
        ? '/api/voice-agent/conversations'
        : '/api/voice-agent/conversations/sync-latest';
      const payload = cid
        ? JSON.stringify({ conversationId: cid, mode: modeRef.current })
        : JSON.stringify({ mode: modeRef.current });
      navigator.sendBeacon(endpoint, payload);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      timeoutIds.forEach((id) => window.clearTimeout(id));

      // Stop live extraction interval
      if (liveExtractIntervalRef.current) {
        window.clearInterval(liveExtractIntervalRef.current);
        liveExtractIntervalRef.current = null;
      }

      // On unmount: save conversation, and extract KYC if onboarding
      const unmountCid = conversationIdRef.current || lastConversationIdRef.current;
      if (modeRef.current === 'onboarding' && !hasExtractedRef.current) {
        extractAndSaveKyc(unmountCid);
      } else if (unmountCid && modeRef.current !== 'onboarding') {
        saveConversation(modeRef.current);
      }

      if (widget) {
        widget.removeEventListener('elevenlabs-convai:call', handleCall);
        widget.removeEventListener('elevenlabs-convai:conversation', handleMessage);
        widget.removeEventListener('elevenlabs-convai:error', handleDisconnect);
        widget.removeEventListener('elevenlabs-convai:disconnect', handleDisconnect);
        // Explicitly disconnect via widget API if available (frees WS on EL side)
        try { widget.endSession?.(); } catch { }
        widget.remove();
      }

      if (ownsScript && script) {
        script.remove();
      }
    };
  }, [memoryLoaded, retryCount]);

  // ── Reconnecting delay UI ──
  if (reconnecting) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
          <p className="ivy-font text-base font-semibold text-foreground">Reconnecting...</p>
          <p className="ivy-font text-sm text-muted-foreground">Freeing the previous session, just a moment.</p>
        </div>
      </div>
    );
  }

  // ── Disconnected UI ──
  if (disconnected) {
    const isQuotaError = disconnectReason === 'quota';

    const handleRetry = async () => {
      setReconnecting(true);
      setDisconnected(false);
      // Terminate previous session on ElevenLabs so the concurrent slot is freed
      const prevCid = lastConversationIdRef.current;
      if (prevCid) {
        try {
          const endRes = await fetch('/api/voice-agent/end-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId: prevCid }),
          });
          const endData = await endRes.json();
          if (!endRes.ok || endData.warning) {
            console.warn('[ElevenLabs] End-session returned warning:', endData.warning);
          }
        } catch (err) {
          console.warn('[ElevenLabs] End-session failed, will still retry:', err);
        }
        lastConversationIdRef.current = null;
      }
      // Reset extraction flag so a new session can extract fresh data
      hasExtractedRef.current = false;
      // Wait 4 s for ElevenLabs server to release the slot before opening a new WS
      await new Promise((r) => window.setTimeout(r, 4000));
      setReconnecting(false);
      setRetryCount((c) => c + 1);
    };

    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
          <div className={`h-14 w-14 rounded-full flex items-center justify-center ${isQuotaError ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 ${isQuotaError ? 'text-red-500' : 'text-amber-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
            </svg>
          </div>
          <p className="ivy-font text-base font-semibold text-foreground">
            {isQuotaError ? 'Session limit reached' : 'Conversation interrupted'}
          </p>
          <p className="ivy-font text-sm text-muted-foreground">
            {isQuotaError
              ? 'ElevenLabs is holding a previous session open. Click below to close it and try again — this usually resolves itself.'
              : 'Don\'t worry — your progress has been saved. You can pick up right where you left off.'}
          </p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={handleRetry}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              {isQuotaError ? 'Close & Retry' : 'Continue Conversation'}
            </button>
            <button
              onClick={() => onCompleteRef.current?.()}
              className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (extracting) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
          <p className="ivy-font text-base font-medium text-foreground">
            Extracting your profile from the conversation...
          </p>
          <p className="ivy-font text-sm text-muted-foreground">
            This takes a few seconds
          </p>
        </div>
      </div>
    );
  }

  if (!memoryLoaded) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="ivy-font text-sm text-muted-foreground">Preparing your session...</p>
        </div>
      </div>
    );
  }

  return <div ref={widgetContainerRef} className="h-full w-full" />;
}
