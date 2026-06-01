"use client";

import { useCallback, useEffect, useState } from "react";

const CLASSIFICATION_STYLES = {
  hot: {
    bg: "bg-red-100 dark:bg-red-500/20",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-300 dark:border-red-500/30",
    dot: "bg-red-500",
    label: "HOT",
    action: "Immediate callback needed",
  },
  warm: {
    bg: "bg-amber-100 dark:bg-amber-500/20",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-500/30",
    dot: "bg-amber-500",
    label: "WARM",
    action: "Follow-up within 24 hours",
  },
  cold: {
    bg: "bg-sky-100 dark:bg-sky-500/20",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-300 dark:border-sky-500/30",
    dot: "bg-sky-500",
    label: "COLD",
    action: "Nurture campaign",
  },
};

function ScoreRing({ score, size = 40 }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 70 ? "#ef4444" : score >= 40 ? "#f59e0b" : "#3b82f6";

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        className="text-gray-200 dark:text-white/10"
        strokeWidth={3}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-500"
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-[10px] font-bold fill-gray-700 dark:fill-gray-200"
      >
        {score}
      </text>
    </svg>
  );
}

function StudentCard({ student, onClick }) {
  const cls = CLASSIFICATION_STYLES[student.classification] || CLASSIFICATION_STYLES.cold;

  return (
    <button
      onClick={() => onClick(student)}
      className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/4 hover:shadow-lg hover:border-gray-300 dark:hover:border-white/20 transition-all duration-200 group"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          {student.image ? (
            <img
              src={student.image}
              alt={student.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
              {(student.name || "?")[0].toUpperCase()}
            </div>
          )}
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${cls.dot}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {student.name}
            </h4>
            <ScoreRing score={student.score} />
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {student.email}
          </p>

          {/* Tags row */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {/* Classification badge */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cls.bg} ${cls.text} ${cls.border}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cls.dot}`} />
              {cls.label}
            </span>

            {/* Countries */}
            {student.targetCountries?.slice(0, 2).map((c) => (
              <span
                key={c}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-gray-400"
              >
                {c}
              </span>
            ))}

            {/* Profile completion */}
            {!student.profileProgress.complete && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400">
                {student.profileProgress.filled}/{student.profileProgress.total} KYC
              </span>
            )}
          </div>

          {/* Bottom row */}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400 dark:text-gray-500">
            {student.sessionCount > 0 && (
              <span>🎙 {student.sessionCount} session{student.sessionCount > 1 ? 's' : ''}</span>
            )}
            {student.bookingCount > 0 && (
              <span>📅 {student.bookingCount} booking{student.bookingCount > 1 ? 's' : ''}</span>
            )}
            {student.phone && <span>📞 {student.phone}</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

function StudentDetailModal({ student, onClose, onDeleteSuccess }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  // New Voice Transcript Viewer States
  const [activeVoiceSession, setActiveVoiceSession] = useState(null);
  const [voiceSessionTranscript, setVoiceSessionTranscript] = useState(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [errorTranscript, setErrorTranscript] = useState(null);
  const [audioDuration, setAudioDuration] = useState(null);

  // Editing states
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const handleViewTranscript = useCallback((session) => {
    setActiveVoiceSession(session);
    setLoadingTranscript(true);
    setErrorTranscript(null);
    setVoiceSessionTranscript(null);
    setAudioDuration(null);

    fetch(`/api/counsellor/anam-transcript?sessionId=${session.conversationId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load transcript");
        return r.json();
      })
      .then((data) => {
        setVoiceSessionTranscript(data);
      })
      .catch((err) => {
        setErrorTranscript(err.message);
      })
      .finally(() => {
        setLoadingTranscript(false);
      });
  }, []);

  useEffect(() => {
    if (!student) return;
    setLoading(true);
    setActiveVoiceSession(null);
    setVoiceSessionTranscript(null);
    setErrorTranscript(null);
    setAudioDuration(null);
    setIsEditing(false);
    fetch(`/api/students/${student._id}`)
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [student]);

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this student? This will delete their account, sessions, bookings, and all related pipeline cards. This action CANNOT be undone.")) return;
    try {
      const res = await fetch(`/api/students/${student._id}`, { method: "DELETE" });
      if (res.ok) {
        onClose();
        if (onDeleteSuccess) onDeleteSuccess();
        window.dispatchEvent(new CustomEvent("refreshCounsellorData"));
      } else {
        alert("Failed to delete student");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting student");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let targetCountries = editForm.targetCountries;
      if (typeof targetCountries === 'string') {
        targetCountries = targetCountries.split(',').map(s => s.trim()).filter(Boolean);
      }
      
      const payload = {
        ...editForm,
        targetCountries,
      };

      const res = await fetch(`/api/students/${student._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsEditing(false);
        const updated = await fetch(`/api/students/${student._id}`).then((r) => r.json());
        setDetail(updated);
        if (onDeleteSuccess) onDeleteSuccess();
        window.dispatchEvent(new CustomEvent("refreshCounsellorData"));
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to update profile");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  if (!student) return null;

  const cls = CLASSIFICATION_STYLES[student.classification] || CLASSIFICATION_STYLES.cold;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 dark:bg-black/60 backdrop-blur-xs p-4 transition-all duration-300" onClick={onClose}>
      <div
        className="bg-white/98 dark:bg-slate-900/98 backdrop-blur-md border border-slate-200/50 dark:border-white/5 shadow-2xl rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto custom-dashboard-scrollbar relative transition-all duration-300 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-white/5 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {activeVoiceSession ? (
              <button
                onClick={() => setActiveVoiceSession(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors mr-1 flex items-center text-slate-500 dark:text-slate-400 gap-1.5 text-xs font-bold"
              >
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            ) : student.image ? (
              <img src={student.image} alt={student.name} className="w-12 h-12 rounded-full object-cover border border-slate-100 dark:border-white/10" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-lg font-bold shadow-sm shadow-emerald-500/10">
                {(student.name || "?")[0].toUpperCase()}
              </div>
            )}
            <div className="truncate">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                {activeVoiceSession ? "Voice Session Transcript" : (detail?.name || student.name)}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                {activeVoiceSession
                  ? `With ${student.name} • ${new Date(activeVoiceSession.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                  : (detail?.email || student.email)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!activeVoiceSession && detail && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (isEditing) {
                      handleSave();
                    } else {
                      const initialForm = {
                        name: detail.name || "",
                        email: detail.email || "",
                      };
                      detail.profileFields?.forEach((f) => {
                        initialForm[f.key] = f.value ?? "";
                      });
                      setEditForm(initialForm);
                      setIsEditing(true);
                    }
                  }}
                  disabled={saving}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all duration-200 flex items-center gap-1.5 ${
                    isEditing
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {isEditing ? (saving ? "Saving..." : "Save") : "Edit Profile"}
                </button>
                {isEditing && (
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-all duration-200"
                  >
                    Cancel
                  </button>
                )}
                {!isEditing && (
                  <button
                    onClick={handleDelete}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-600 transition-colors"
                    title="Delete Student Permanently"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            {!activeVoiceSession && !isEditing && (
              <div className="flex items-center gap-2 border-l border-slate-100 dark:border-white/5 pl-3">
                <ScoreRing score={student.score} size={48} />
                <div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cls.bg} ${cls.text} ${cls.border}`}>
                    {cls.label}
                  </span>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">{cls.action}</p>
                </div>
              </div>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {activeVoiceSession ? (
          <div className="p-6 space-y-6">
            {loadingTranscript ? (
              <div className="space-y-4 py-12 flex flex-col items-center justify-center">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-center text-xs text-slate-500 dark:text-slate-400 font-medium">Fetching session details & transcript...</p>
              </div>
            ) : errorTranscript ? (
              <div className="p-4 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 text-center py-8">
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">Error loading transcript: {errorTranscript}</p>
                <button
                  onClick={() => handleViewTranscript(activeVoiceSession)}
                  className="mt-3 px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-500/20 dark:hover:bg-red-500/30 text-red-700 dark:text-red-300 text-xs font-semibold rounded-lg transition-colors"
                >
                  Retry Fetch
                </button>
              </div>
            ) : voiceSessionTranscript ? (
              <>
                {/* Session Meta */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/60 shadow-xs">
                    <span className="text-slate-400 dark:text-slate-500 block text-[9px] uppercase tracking-wider font-bold mb-0.5">Mode</span>
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 capitalize">{activeVoiceSession.mode}</span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/60 shadow-xs">
                    <span className="text-slate-400 dark:text-slate-500 block text-[9px] uppercase tracking-wider font-bold mb-0.5">Language</span>
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase">{activeVoiceSession.language}</span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/60 shadow-xs">
                    <span className="text-slate-400 dark:text-slate-500 block text-[9px] uppercase tracking-wider font-bold mb-0.5">Duration</span>
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      {audioDuration !== null ? (
                        `${Math.floor(audioDuration / 60)}m ${Math.round(audioDuration % 60)}s`
                      ) : activeVoiceSession.callDurationSecs > 0 ? (
                        `${Math.floor(activeVoiceSession.callDurationSecs / 60)}m ${Math.round(activeVoiceSession.callDurationSecs % 60)}s`
                      ) : (
                        "Loading..."
                      )}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/60 shadow-xs">
                    <span className="text-slate-400 dark:text-slate-500 block text-[9px] uppercase tracking-wider font-bold mb-0.5">Messages</span>
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{activeVoiceSession.messagesCount} sent</span>
                  </div>
                </div>

                {/* Summary */}
                {activeVoiceSession.summary && (
                  <div className="p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/40">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center gap-1.5 tracking-wide">
                      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Voice Agent Summary
                    </h4>
                    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 font-medium">{activeVoiceSession.summary}</p>
                  </div>
                )}

                {/* Recording URL / Audio Player */}
                {voiceSessionTranscript.recordingUrl && (
                  <div className="p-4 rounded-xl border border-emerald-100 dark:border-emerald-500/10 bg-emerald-50/30 dark:bg-emerald-950/10 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3 self-start sm:self-center">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Call Recording</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Play or download the conversation audio</p>
                      </div>
                    </div>
                    <audio
                      src={voiceSessionTranscript.recordingUrl}
                      controls
                      className="w-full sm:max-w-xs h-8 accent-emerald-600"
                      onLoadedMetadata={(e) => {
                        if (e.target.duration && !isNaN(e.target.duration)) {
                          setAudioDuration(e.target.duration);
                        }
                      }}
                    />
                  </div>
                )}

                {/* Bubble Transcript List */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-white/5 pb-2 flex items-center gap-1.5 tracking-wide">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Conversation Transcript
                  </h4>
                  <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-1.5 custom-dashboard-scrollbar">
                    {voiceSessionTranscript.transcript?.length > 0 ? (
                      voiceSessionTranscript.transcript.map((msg, index) => {
                        const isAgent = msg.role === 'agent';
                        return (
                          <div
                            key={msg.id || index}
                            className={`flex ${isAgent ? 'justify-start' : 'justify-end'} items-end gap-2.5`}
                          >
                            {isAgent && (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-md mb-1">
                                AI
                              </div>
                            )}
                            <div className={`flex flex-col max-w-[75%] ${isAgent ? 'items-start' : 'items-end'}`}>
                              <div
                                className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                                  isAgent
                                    ? 'bg-slate-100 dark:bg-white/8 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-200/40 dark:border-white/5'
                                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-none shadow-sm'
                                }`}
                              >
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                              </div>
                              {msg.timestamp && (
                                <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 px-1 tracking-wide">
                                  {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                              )}
                            </div>
                            {!isAgent && (
                              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/15 flex items-center justify-center text-slate-700 dark:text-slate-300 text-[10px] font-semibold shrink-0 mb-1 border border-slate-300/30 dark:border-white/10">
                                {(student.name || "?")[0].toUpperCase()}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-8">No transcript messages found.</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-center text-xs text-slate-500">Failed to load transcript data.</p>
            )}
          </div>
        ) : loading ? (
          <div className="p-6 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 rounded bg-gray-200 dark:bg-white/10 animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
            ))}
          </div>
        ) : detail ? (
          <div className="p-6 space-y-6">
            {/* Score Breakdown */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Lead Score: {detail.score || student.score}/100
              </h3>
              <div className="w-full h-2.5 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${detail.score || student.score}%`,
                    backgroundColor: (detail.score || student.score) >= 70 ? '#ef4444' : (detail.score || student.score) >= 40 ? '#f59e0b' : '#3b82f6',
                  }}
                />
              </div>
            </div>

            {/* Profile Fields */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Student Profile ({detail.profileProgress.filled}/{detail.profileProgress.total})
              </h3>
              {isEditing ? (
                <div className="grid grid-cols-2 gap-3 bg-slate-50/50 dark:bg-white/2 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                  {/* Name */}
                  <div className="col-span-2">
                    <label className="text-gray-500 dark:text-gray-400 block text-[10px] uppercase tracking-wider font-semibold mb-1">Full Name</label>
                    <input
                      type="text"
                      value={editForm.name || ""}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-slate-800/80 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  {/* Email */}
                  <div className="col-span-2">
                    <label className="text-gray-500 dark:text-gray-400 block text-[10px] uppercase tracking-wider font-semibold mb-1">Email Address</label>
                    <input
                      type="email"
                      value={editForm.email || ""}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-slate-800/80 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  {/* Map Profile Fields */}
                  {detail.profileFields?.map((f) => {
                    const isSelect = f.key === "applicationTimeline";
                    const isArray = f.key === "targetCountries";
                    return (
                      <div key={f.key} className={f.key === "courseInterest" || f.key === "institution" ? "col-span-2" : "col-span-1"}>
                        <label className="text-gray-500 dark:text-gray-400 block text-[10px] uppercase tracking-wider font-semibold mb-1">
                          {f.label} {isArray && "(comma separated)"}
                        </label>
                        {isSelect ? (
                          <select
                            value={editForm[f.key] || ""}
                            onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })}
                            className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-slate-800/80 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          >
                            <option value="">Select Timeline</option>
                            <option value="Immediately">Immediately</option>
                            <option value="Within 1 Month">Within 1 Month</option>
                            <option value="1-3 Months">1-3 Months</option>
                            <option value="3-6 Months">3-6 Months</option>
                            <option value="6+ Months">6+ Months</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={isArray && Array.isArray(editForm[f.key]) ? editForm[f.key].join(", ") : (editForm[f.key] || "")}
                            onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })}
                            className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-slate-800/80 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder={f.key === "gpaPercentage" ? "e.g., 9.7 GPA or 78%" : f.key === "budgetRange" ? "e.g., 20-25 lakhs" : ""}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {detail.profileFields?.map((f) => (
                    <div
                      key={f.key}
                      className={`p-2.5 rounded-lg border text-xs ${
                        f.filled
                          ? "border-green-200 dark:border-green-700/30 bg-green-50 dark:bg-green-900/10"
                          : "border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/3"
                      }`}
                    >
                      <span className="text-gray-500 dark:text-gray-400 block text-[10px] uppercase tracking-wider font-medium">{f.label}</span>
                      <span className={`font-medium ${f.filled ? "text-gray-800 dark:text-gray-200" : "text-gray-400 dark:text-gray-600 italic"}`}>
                        {f.value ? (Array.isArray(f.value) ? f.value.join(", ") : String(f.value)) : "Not provided"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Counselling Sessions */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Counsellor Sessions ({detail.sessions?.length || 0})
              </h3>
              {detail.sessions?.length > 0 ? (
                <div className="space-y-2">
                  {detail.sessions.map((s) => (
                    <div key={s._id} className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{s.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                          s.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : s.status === 'active' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                        }`}>
                          {s.status}
                        </span>
                      </div>
                      {s.summary && <p className="text-[11px] text-gray-600 dark:text-gray-400 line-clamp-2">{s.summary}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                        <span>{new Date(s.startedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span>{s.messageCount} messages</span>
                      </div>
                      {s.followUpQuestions?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {s.followUpQuestions.slice(0, 3).map((q, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                              {q.length > 40 ? q.slice(0, 40) + '…' : q}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">No counsellor sessions recorded yet</p>
              )}
            </div>

            {/* Voice Agent Sessions */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Voice Agent Sessions ({detail.voiceSessions?.length || 0})
              </h3>
              {detail.voiceSessions?.length > 0 ? (
                <div className="space-y-3">
                  {detail.voiceSessions.map((v) => (
                    <button
                      key={v.conversationId}
                      onClick={() => handleViewTranscript(v)}
                      className="w-full text-left p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/2 hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5 hover:border-emerald-500/30 dark:hover:border-emerald-500/20 transition-all duration-300 group flex items-start justify-between gap-4 shadow-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize tracking-wide">
                            Voice Agent Session ({v.mode})
                          </span>
                          <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                            {v.language}
                          </span>
                        </div>
                        {v.summary && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mb-2 line-clamp-2">
                            {v.summary}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-[10px] text-slate-400 dark:text-slate-500">
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {new Date(v.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {v.messagesCount} message{v.messagesCount !== 1 ? 's' : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {Math.round(v.callDurationSecs)}s
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center self-center text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform duration-300">
                        <span className="text-xs font-semibold mr-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">View Transcript</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">No voice sessions recorded yet</p>
              )}
            </div>

            {/* Bookings */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Bookings ({detail.bookings?.length || 0})
              </h3>
              {detail.bookings?.length > 0 ? (
                <div className="space-y-2">
                  {detail.bookings.map((b) => (
                    <div key={b._id} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/3">
                      <div>
                        <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                          {new Date(b.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}
                        </span>
                        {b.notes && <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{b.notes}</p>}
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        b.status === 'confirmed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : b.status === 'completed' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : b.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                      }`}>
                        {b.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">No bookings yet</p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-gray-500">Failed to load student details</div>
        )}
      </div>
    </div>
  );
}



export default function StudentLeadsSection() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | hot | warm | cold
  const [selectedStudent, setSelectedStudent] = useState(null);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch("/api/students/scored", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[StudentLeadsSection] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const filtered = filter === "all"
    ? students
    : students.filter((s) => s.classification === filter);

  const counts = {
    all: students.length,
    hot: students.filter((s) => s.classification === "hot").length,
    warm: students.filter((s) => s.classification === "warm").length,
    cold: students.filter((s) => s.classification === "cold").length,
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 bg-gray-200 dark:bg-white/10 rounded" />
                <div className="h-2 w-32 bg-gray-200 dark:bg-white/10 rounded" />
                <div className="h-4 w-16 bg-gray-200 dark:bg-white/10 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const filterButtons = [
    { id: "all", label: "All Students" },
    { id: "hot", label: "🔥 Hot", color: "text-red-600 dark:text-red-400" },
    { id: "warm", label: "🟡 Warm", color: "text-amber-600 dark:text-amber-400" },
    { id: "cold", label: "❄️ Cold", color: "text-sky-600 dark:text-sky-400" },
  ];

  return (
    <>
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {filterButtons.map((btn) => (
          <button
            key={btn.id}
            onClick={() => setFilter(btn.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === btn.id
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md"
                : "bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/12"
            } ${btn.color || ""}`}
          >
            {btn.label} ({counts[btn.id]})
          </button>
        ))}
      </div>

      {/* Student grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filter === "all" ? "No students with completed KYC yet." : `No ${filter} leads found.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((student) => (
            <StudentCard
              key={student._id}
              student={student}
              onClick={setSelectedStudent}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      <StudentDetailModal
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
        onDeleteSuccess={fetchStudents}
      />
    </>
  );
}
