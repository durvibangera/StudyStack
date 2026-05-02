'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

/**
 * AnamVoiceAgent — Interactive AI avatar for student counselling.
 *
 * mode:
 *   - "onboarding"  →  KYC collection flow with transcript extraction.
 *   - "buddy"       →  Persistent memory buddy chat.
 *
 * onComplete is called when the session finishes.
 */
export default function AnamVoiceAgent({ onComplete, mode = 'onboarding', sessionMemory = null }) {
  const videoRef = useRef(null);
  const anamClientRef = useRef(null);
  const messagesRef = useRef([]);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const sessionIdRef = useRef(null);
  const hasExtractedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const modeRef = useRef(mode);
  const liveExtractIntervalRef = useRef(null);
  const liveLineCountRef = useRef(0);
  const liveExtractingRef = useRef(false);
  const cancelledRef = useRef(false);

  const [status, setStatus] = useState('loading'); // loading | connecting | connected | extracting | disconnected | error
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionContext, setSessionContext] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isPersonaSpeaking, setIsPersonaSpeaking] = useState(false);
  const [currentStreamText, setCurrentStreamText] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // Keep refs in sync
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ── Emit profile update event ──
  const emitProfileUpdate = useCallback((detail = {}) => {
    window.dispatchEvent(
      new CustomEvent('counselling-profile:updated', { detail })
    );
  }, []);

  // ── Live extraction loop ──
  const startLiveExtractionLoop = useCallback(() => {
    if (modeRef.current !== 'onboarding' || liveExtractIntervalRef.current) return;

    liveLineCountRef.current = 0;
    liveExtractingRef.current = false;

    liveExtractIntervalRef.current = window.setInterval(async () => {
      if (liveExtractingRef.current) return;
      liveExtractingRef.current = true;

      try {
        const currentMessages = messagesRef.current;
        if (currentMessages.length <= liveLineCountRef.current) {
          liveExtractingRef.current = false;
          return;
        }

        const transcript = currentMessages
          .map((m) => `${m.role === 'user' ? 'Student' : 'Agent'}: ${m.content}`)
          .join('\n');

        const res = await fetch('/api/voice-agent/live-extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript,
            sessionId: sessionIdRef.current,
            lastLineCount: liveLineCountRef.current,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (typeof data.lineCount === 'number') {
            liveLineCountRef.current = data.lineCount;
          }
          if (data.transcriptUpdated || data.changedFields?.length || data.newFields?.length) {
            emitProfileUpdate({
              source: 'live-extract',
              changedFields: data.changedFields || [],
              newFields: data.newFields || [],
              progress: data.counsellingProgress || null,
            });
          }
        }
      } catch {
        // Non-fatal
      } finally {
        liveExtractingRef.current = false;
      }
    }, 8_000);
  }, [emitProfileUpdate]);

  // ── Extract & save KYC from transcript ──
  const extractAndSaveKyc = useCallback(async () => {
    if (hasExtractedRef.current) return;
    hasExtractedRef.current = true;

    setStatus('extracting');
    try {
      const currentMessages = messagesRef.current;
      const transcript = currentMessages
        .map((m) => `${m.role === 'user' ? 'Student' : 'Agent'}: ${m.content}`)
        .join('\n');

      if (!transcript.trim()) {
        setStatus('disconnected');
        return;
      }

      const res = await fetch('/api/voice-agent/extract-kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          messages: currentMessages,
          sessionId: sessionIdRef.current,
        }),
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
      window.setTimeout(() => {
        if (!cancelledRef.current) onCompleteRef.current?.();
      }, 1500);
    } catch (err) {
      console.error('[AnamVoiceAgent] KYC extraction error:', err);
      toast.error('Could not extract profile. You can fill manually.');
      window.setTimeout(() => {
        if (!cancelledRef.current) onCompleteRef.current?.();
      }, 2000);
    } finally {
      if (!cancelledRef.current) setStatus('disconnected');
    }
  }, [emitProfileUpdate]);

  // ── Save conversation to MongoDB ──
  const saveConversation = useCallback(async (convMode) => {
    try {
      const currentMessages = messagesRef.current;
      await fetch('/api/voice-agent/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMessages,
          sessionId: sessionIdRef.current,
          mode: convMode,
        }),
      });
    } catch (err) {
      console.error('[AnamVoiceAgent] Failed to save conversation:', err);
    }
  }, []);

  // ── Upload recording ──
  const uploadRecording = useCallback(async () => {
    const chunks = recordedChunksRef.current;
    if (chunks.length === 0) return;

    try {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const formData = new FormData();
      formData.append('recording', blob, `session-${sessionIdRef.current || Date.now()}.webm`);
      formData.append('sessionId', sessionIdRef.current || '');

      await fetch('/api/voice-agent/recordings', {
        method: 'POST',
        body: formData,
      });
    } catch (err) {
      console.error('[AnamVoiceAgent] Recording upload failed:', err);
    }
  }, []);

  // ── Start recording the video stream ──
  const startRecording = useCallback((videoElement) => {
    try {
      const stream = videoElement.captureStream?.() || videoElement.mozCaptureStream?.();
      if (!stream) return;

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
      });

      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.start(1000); // chunk every 1s
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.warn('[AnamVoiceAgent] Could not start recording:', err);
    }
  }, []);

  // ── Stop recording ──
  const stopRecording = useCallback(() => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch { }
  }, []);

  // ── Main effect: create Anam session and connect ──
  useEffect(() => {
    let cancelled = false;
    let client = null;

    const init = async () => {
      try {
        setStatus('loading');

        // 1. Get session token from our server
        const tokenRes = await fetch('/api/voice-agent/anam-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!tokenRes.ok) {
          const err = await tokenRes.json().catch(() => ({}));
          throw new Error(err.error || `Session creation failed (${tokenRes.status})`);
        }

        const { sessionToken, sessionContext: ctx } = await tokenRes.json();
        if (cancelled) return;

        setSessionContext(ctx);
        setStatus('connecting');

        // 2. Import and create Anam client
        const { createClient, AnamEvent } = await import('@anam-ai/js-sdk');
        client = createClient(sessionToken, {
          voiceDetection: {
            endOfSpeechSensitivity: 0.5,
          },
        });
        anamClientRef.current = client;

        // 3. Set up event listeners
        client.addListener(AnamEvent.CONNECTION_ESTABLISHED, () => {
          if (cancelled) return;
          console.log('[AnamVoiceAgent] Connection established');
          setStatus('connected');
        });

        client.addListener(AnamEvent.SESSION_READY, (sessionId) => {
          if (cancelled) return;
          sessionIdRef.current = sessionId;
          console.log('[AnamVoiceAgent] Session ready:', sessionId);
          startLiveExtractionLoop();
        });

        client.addListener(AnamEvent.CONNECTION_CLOSED, (reason, details) => {
          if (cancelled) return;
          console.log('[AnamVoiceAgent] Connection closed:', reason, details);

          // Stop live extraction
          if (liveExtractIntervalRef.current) {
            window.clearInterval(liveExtractIntervalRef.current);
            liveExtractIntervalRef.current = null;
          }

          stopRecording();

          // Extract KYC if onboarding and we haven't already
          if (modeRef.current === 'onboarding' && !hasExtractedRef.current) {
            extractAndSaveKyc();
          } else if (modeRef.current !== 'onboarding') {
            saveConversation('buddy');
          }

          // Upload recording
          uploadRecording();
        });

        // Message history for chat display
        client.addListener(AnamEvent.MESSAGE_HISTORY_UPDATED, (messages) => {
          if (cancelled) return;
          console.log('[AnamVoiceAgent] MESSAGE_HISTORY_UPDATED:', messages);
          const formatted = messages.map((m) => ({
            id: m.id,
            role: m.role === 'persona' ? 'agent' : 'user',
            content: m.content?.replace(/<think>[\s\S]*?<\/think>/gi, '').trim() || '',
            interrupted: m.interrupted,
          }));
          messagesRef.current = formatted;
          setChatMessages([...formatted]);
        });

        // Real-time transcription for live display
        client.addListener(AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED, (event) => {
          if (cancelled) return;
          if (event.role === 'persona') {
            setIsPersonaSpeaking(!event.endOfSpeech);
            if (event.endOfSpeech) {
              setCurrentStreamText('');
            } else {
              setCurrentStreamText((prev) => prev + event.content);
            }
          }
        });

        // Speech detection indicators
        client.addListener(AnamEvent.USER_SPEECH_STARTED, () => {
          if (cancelled) return;
          setIsUserSpeaking(true);
        });

        client.addListener(AnamEvent.USER_SPEECH_ENDED, () => {
          if (cancelled) return;
          setIsUserSpeaking(false);
        });

        // Mic permission events
        client.addListener(AnamEvent.MIC_PERMISSION_DENIED, (error) => {
          if (cancelled) return;
          setStatus('error');
          setErrorMessage('Microphone access is required. Please allow microphone permissions and try again.');
        });

        // Server warnings
        client.addListener(AnamEvent.SERVER_WARNING, (message) => {
          console.warn('[AnamVoiceAgent] Server warning:', message);
        });

        // Tool call events for monitoring
        if (AnamEvent.TOOL_CALL_STARTED) {
          client.addListener(AnamEvent.TOOL_CALL_STARTED, (event) => {
            console.log('[AnamVoiceAgent] Tool started:', event.toolName, event.arguments);
          });
        }
        if (AnamEvent.TOOL_CALL_COMPLETED) {
          client.addListener(AnamEvent.TOOL_CALL_COMPLETED, (event) => {
            console.log('[AnamVoiceAgent] Tool completed:', event.toolName);
          });
        }

        // Register client tool handlers
        if (typeof client.registerToolCallHandler === 'function') {
          // KYC completion tool
          client.registerToolCallHandler('saveStudentProfile', {
            onStart: async () => {
              extractAndSaveKyc();
              return 'Profile is being extracted and saved. Thank you!';
            },
          });
        }

        // 4. Start streaming to video element
        if (videoRef.current) {
          await client.streamToVideoElement('anam-video-element');
          // Start recording once video is playing
          if (videoRef.current) {
            startRecording(videoRef.current);
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[AnamVoiceAgent] Init error:', err);
        setStatus('error');
        setErrorMessage(err.message || 'Failed to initialize the AI assistant.');
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      cancelled = true;
      cancelledRef.current = true;

      // Stop live extraction
      if (liveExtractIntervalRef.current) {
        window.clearInterval(liveExtractIntervalRef.current);
        liveExtractIntervalRef.current = null;
      }

      stopRecording();

      // Save data on unmount
      if (modeRef.current === 'onboarding' && !hasExtractedRef.current) {
        extractAndSaveKyc();
      } else if (modeRef.current !== 'onboarding') {
        saveConversation(modeRef.current);
      }

      uploadRecording();

      // Stop Anam streaming and completely close the connection
      if (anamClientRef.current) {
        try {
          anamClientRef.current.stopStreaming();
          if (typeof anamClientRef.current.stopConnection === 'function') {
            anamClientRef.current.stopConnection();
          }
        } catch { }
        anamClientRef.current = null;
      }
    };
  }, [retryCount, startLiveExtractionLoop, extractAndSaveKyc, saveConversation, uploadRecording, startRecording, stopRecording]);

  // ── Handle beforeunload ──
  useEffect(() => {
    const handleBeforeUnload = () => {
      const messages = messagesRef.current;
      if (messages.length > 0) {
        const transcript = messages
          .map((m) => `${m.role === 'user' ? 'Student' : 'Agent'}: ${m.content}`)
          .join('\n');

        navigator.sendBeacon(
          '/api/voice-agent/conversations',
          JSON.stringify({
            messages,
            sessionId: sessionIdRef.current,
            mode: modeRef.current,
            transcript,
          })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ── Retry handler ──
  const handleRetry = useCallback(() => {
    hasExtractedRef.current = false;
    messagesRef.current = [];
    setChatMessages([]);
    setStatus('loading');
    setErrorMessage('');
    setRetryCount((c) => c + 1);
  }, []);

  // ── Render: Loading state ──
  if (status === 'loading') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
          <p className="ivy-font text-base font-semibold text-foreground">Preparing your AI counsellor...</p>
          <p className="ivy-font text-sm text-muted-foreground">Setting up Aria's avatar and memory</p>
        </div>
      </div>
    );
  }

  // ── Render: Error state ──
  if (status === 'error') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
          <div className="h-14 w-14 rounded-full flex items-center justify-center bg-red-500/15">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
            </svg>
          </div>
          <p className="ivy-font text-base font-semibold text-foreground">Connection failed</p>
          <p className="ivy-font text-sm text-muted-foreground">{errorMessage}</p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={handleRetry}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              Retry
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

  // ── Render: Extracting state ──
  if (status === 'extracting') {
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

  // ── Render: Disconnected state ──
  if (status === 'disconnected') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
          <div className="h-14 w-14 rounded-full flex items-center justify-center bg-amber-500/15">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
            </svg>
          </div>
          <p className="ivy-font text-base font-semibold text-foreground">Conversation ended</p>
          <p className="ivy-font text-sm text-muted-foreground">
            Your progress has been saved. You can pick up right where you left off.
          </p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={handleRetry}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              Continue Conversation
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

  // ── Render: Main connected view (avatar + chat) ──
  return (
    <div className="flex h-full w-full flex-col lg:flex-row overflow-hidden">
      {/* Left: Avatar Video */}
      <div className="relative flex-1 flex items-center justify-center bg-black/5 dark:bg-black/30 min-h-[300px] lg:min-h-0">
        {/* Connecting overlay */}
        {status === 'connecting' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              <p className="text-sm font-medium text-white">Connecting to Aria...</p>
            </div>
          </div>
        )}

        {/* Video element */}
        <video
          id="anam-video-element"
          ref={videoRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
          style={{ maxHeight: '100%' }}
        />

        {/* Speaking indicator */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          {isUserSpeaking && (
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/90 px-3 py-1.5 text-white text-xs font-medium backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              Listening...
            </div>
          )}
          {isPersonaSpeaking && (
            <div className="flex items-center gap-2 rounded-full bg-violet-500/90 px-3 py-1.5 text-white text-xs font-medium backdrop-blur-sm ml-auto">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              Aria is speaking
            </div>
          )}
        </div>

        {/* Session info badge */}
        {sessionContext && (
          <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-white text-xs font-medium backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {sessionContext.isReturning ? `Welcome back, ${sessionContext.studentName}` : 'StudyStack AI Counselling'}
          </div>
        )}

        {/* End session button */}
        <button
          onClick={async () => {
            if (anamClientRef.current) {
              try { await anamClientRef.current.stopStreaming(); } catch { }
            }
            stopRecording();
            if (modeRef.current === 'onboarding' && !hasExtractedRef.current) {
              extractAndSaveKyc();
            } else {
              onCompleteRef.current?.();
            }
          }}
          className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full bg-red-500/80 px-3 py-1.5 text-white text-xs font-medium backdrop-blur-sm hover:bg-red-600/90 transition-colors cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          End Session
        </button>
      </div>

      {/* Right: Chat Transcript Panel */}
      <div className="w-full lg:w-[380px] flex flex-col border-l border-border/40 bg-background/95 backdrop-blur-sm">
        {/* Chat header */}
        <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground ivy-font">Live Transcript</p>
            <p className="text-xs text-muted-foreground ivy-font">
              {chatMessages.length} messages
              {sessionContext?.counsellingProgress && (
                <> · KYC {sessionContext.counsellingProgress.filledCount}/{sessionContext.counsellingProgress.totalCount}</>
              )}
            </p>
          </div>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          {chatMessages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground/60 ivy-font text-center">
                Conversation will appear here...
              </p>
            </div>
          ) : (
            chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ivy-font leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-emerald-500 text-white rounded-br-md'
                      : 'bg-muted/60 text-foreground rounded-bl-md border border-border/30'
                  } ${msg.interrupted ? 'opacity-60' : ''}`}
                >
                  {msg.content}
                  {msg.interrupted && (
                    <span className="block mt-1 text-xs opacity-70 italic">interrupted</span>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Live streaming text */}
          {currentStreamText && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm ivy-font leading-relaxed bg-muted/40 text-foreground/70 border border-border/20">
                {currentStreamText.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim()}
                <span className="inline-block w-1.5 h-4 bg-violet-500 rounded-full animate-pulse ml-0.5 align-middle" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
