'use client';

import { useState, useEffect } from 'react';
import { formatINR } from '@/lib/loan/loanUtils';

interface ScoreBreakdown {
  academic: number;
  testScore: number;
  countryRisk: number;
  programTier: number;
  familyIncome: number;
  coApplicant: number;
}

interface EligibilityData {
  eligibilityScore: number;
  eligibilityBand: 'High' | 'Medium' | 'Low' | 'Not Eligible';
  eligibilityNarrative: string;
  scoreBreakdown: ScoreBreakdown;
}

const BAND_COLORS: Record<string, string> = {
  High: 'text-emerald-400',
  Medium: 'text-amber-400',
  Low: 'text-orange-400',
  'Not Eligible': 'text-red-400',
};

const BAND_RING: Record<string, string> = {
  High: 'stroke-emerald-500',
  Medium: 'stroke-amber-500',
  Low: 'stroke-orange-500',
  'Not Eligible': 'stroke-red-500',
};

const BREAKDOWN_LABELS: { key: keyof ScoreBreakdown; label: string; max: number }[] = [
  { key: 'academic', label: 'Academic', max: 25 },
  { key: 'testScore', label: 'Test Score', max: 20 },
  { key: 'countryRisk', label: 'Country Risk', max: 15 },
  { key: 'programTier', label: 'Program Tier', max: 15 },
  { key: 'familyIncome', label: 'Family Income', max: 15 },
  { key: 'coApplicant', label: 'Co-Applicant', max: 10 },
];

export default function EligibilityCard() {
  const [data, setData] = useState<EligibilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchEligibility() {
      try {
        const res = await fetch('/api/loan/eligibility', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        setData(await res.json());
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchEligibility();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/80 p-8 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <div className="h-28 w-28 animate-pulse rounded-full bg-muted/40" />
          <div className="flex-1 space-y-3">
            <div className="h-5 w-48 animate-pulse rounded bg-muted/40" />
            <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted/40" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/80 p-8 backdrop-blur-sm">
        <h3 className="ivy-font text-lg font-bold text-foreground">Loan Eligibility</h3>
        <p className="mt-2 text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const circumference = 2 * Math.PI * 44;
  const offset = circumference * (1 - data.eligibilityScore / 100);

  return (
    <div className="rounded-2xl border border-border/40 bg-card/80 p-8 backdrop-blur-sm">
      <h3 className="ivy-font mb-6 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Loan Eligibility Score</h3>

      <div className="flex flex-col items-center gap-6 sm:flex-row">
        {/* Score Ring */}
        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="7" className="text-muted/20" />
            <circle cx="50" cy="50" r="44" fill="none" strokeWidth="7" strokeLinecap="round"
              className={BAND_RING[data.eligibilityBand]}
              strokeDasharray={circumference} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
          </svg>
          <div className="text-center">
            <span className="ivy-font text-3xl font-black text-foreground">{data.eligibilityScore}</span>
            <span className="ivy-font block text-xs text-muted-foreground">/ 100</span>
          </div>
        </div>

        {/* Narrative */}
        <div className="flex-1 min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className={`ivy-font text-sm font-extrabold ${BAND_COLORS[data.eligibilityBand]}`}>{data.eligibilityBand} Eligibility</span>
          </div>
          <p className="ivy-font text-sm leading-relaxed text-muted-foreground">{data.eligibilityNarrative}</p>
        </div>
      </div>

      {/* Collapsible Breakdown */}
      <button type="button" onClick={() => setExpanded(!expanded)}
        className="ivy-font mt-5 flex w-full items-center gap-1 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground">
        <span>{expanded ? '▾' : '▸'}</span> Score Breakdown
      </button>

      {expanded && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {BREAKDOWN_LABELS.map(({ key, label, max }) => (
            <div key={key} className="rounded-xl border border-border/30 bg-muted/20 px-3 py-2.5">
              <p className="ivy-font text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
              <div className="mt-1.5 flex items-end gap-1">
                <span className="ivy-font text-lg font-black text-foreground">{data.scoreBreakdown[key]}</span>
                <span className="ivy-font mb-0.5 text-xs text-muted-foreground">/ {max}</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                  style={{ width: `${(data.scoreBreakdown[key] / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
