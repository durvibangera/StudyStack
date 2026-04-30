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

function StudentDetailModal({ student, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!student) return;
    setLoading(true);
    fetch(`/api/students/${student._id}`)
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [student]);

  if (!student) return null;

  const cls = CLASSIFICATION_STYLES[student.classification] || CLASSIFICATION_STYLES.cold;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {student.image ? (
              <img src={student.image} alt={student.name} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-lg font-bold">
                {(student.name || "?")[0].toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{student.name}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{student.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <ScoreRing score={student.score} size={48} />
              <div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cls.bg} ${cls.text} ${cls.border}`}>
                  {cls.label}
                </span>
                <p className="text-[10px] text-gray-400 mt-0.5">{cls.action}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
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
                Lead Score: {student.score}/100
              </h3>
              <div className="w-full h-2.5 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${student.score}%`,
                    backgroundColor: student.score >= 70 ? '#ef4444' : student.score >= 40 ? '#f59e0b' : '#3b82f6',
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
            </div>

            {/* Counselling Sessions */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Sessions ({detail.sessions?.length || 0})
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
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">No sessions recorded yet</p>
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
      />
    </>
  );
}
