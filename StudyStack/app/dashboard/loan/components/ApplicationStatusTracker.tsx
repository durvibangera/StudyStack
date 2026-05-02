'use client';

import { useState, useEffect } from 'react';

const STEPS = [
  { key: 'not_started', label: 'Not Started', message: 'Select a lender above and start uploading your documents to begin.' },
  { key: 'docs_pending', label: 'Docs Pending', message: 'You have documents left to upload. Complete your checklist to submit.' },
  { key: 'submitted', label: 'Submitted', message: 'Your application has been submitted. Typical review time is 5–10 business days.' },
  { key: 'under_review', label: 'Under Review', message: 'Your application is being reviewed by the lender. We\'ll notify you of any updates.' },
  { key: 'approved', label: 'Approved', message: 'Congratulations! Your loan has been approved. Disbursement will follow shortly.' },
  { key: 'disbursed', label: 'Disbursed', message: 'Funds have been disbursed. Focus on your studies — you\'ve got this! 🎓' },
];

export default function ApplicationStatusTracker() {
  const [status, setStatus] = useState('not_started');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch('/api/loan/application-status');
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.applicationStatus || 'not_started');
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, []);

  const currentIdx = STEPS.findIndex(s => s.key === status);
  const currentStep = STEPS[currentIdx] || STEPS[0];

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/80 p-8 backdrop-blur-sm">
        <div className="h-20 animate-pulse rounded-xl bg-muted/20" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card/80 p-8 backdrop-blur-sm">
      <h3 className="ivy-font mb-6 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Application Status</h3>

      {/* Horizontal stepper */}
      <div className="mb-6 flex items-center justify-between">
        {STEPS.map((step, i) => {
          const isCompleted = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <div key={step.key} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isCompleted ? 'bg-emerald-500 text-white' :
                  isCurrent ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/50' :
                  'bg-muted/30 text-muted-foreground'
                }`}>
                  {isCompleted ? '✓' : i + 1}
                </div>
                <span className={`ivy-font mt-1.5 text-center text-[9px] font-bold leading-tight ${
                  isCurrent ? 'text-emerald-400' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mx-1 h-0.5 flex-1 rounded transition-colors ${
                  i < currentIdx ? 'bg-emerald-500' : 'bg-muted/30'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Current step message */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-3">
        <p className="ivy-font text-sm text-muted-foreground">{currentStep.message}</p>
      </div>
    </div>
  );
}
