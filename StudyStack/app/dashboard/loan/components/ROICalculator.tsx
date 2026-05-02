'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { formatINR } from '@/lib/loan/loanUtils';

interface ROIProjection {
  estimatedTuitionINR: number;
  estimatedLivingCostINR: number;
  totalCostINR: number;
  expectedSalaryYear1INR: number;
  paybackPeriodMonths: number;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function ROICalculator() {
  const [roi, setRoi] = useState<ROIProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loanAmount, setLoanAmount] = useState(3500000);
  const debouncedAmount = useDebounce(loanAmount, 400);
  const initialLoad = useRef(true);

  const fetchROI = useCallback(async (principalINR?: number) => {
    try {
      setLoading(true);
      const body = principalINR ? { principalINR } : {};
      const res = await fetch('/api/loan/roi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRoi(data.roiProjection);
      if (initialLoad.current && data.roiProjection) {
        setLoanAmount(data.roiProjection.estimatedTuitionINR);
        initialLoad.current = false;
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchROI(); }, [fetchROI]);

  useEffect(() => {
    if (!initialLoad.current) fetchROI(debouncedAmount);
  }, [debouncedAmount, fetchROI]);

  const year1 = roi?.expectedSalaryYear1INR ?? 0;
  const year3 = Math.round(year1 * 1.25);
  const year5 = Math.round(year1 * 1.55);
  const maxEarnings = year5 || 1;

  if (error && !roi) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/80 p-8 backdrop-blur-sm">
        <h3 className="ivy-font text-lg font-bold text-foreground">ROI Calculator</h3>
        <p className="mt-2 text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card/80 p-8 backdrop-blur-sm">
      <h3 className="ivy-font mb-5 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Return on Investment</h3>

      {loading && !roi ? (
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded-xl bg-muted/30" />
          <div className="h-32 animate-pulse rounded-xl bg-muted/30" />
        </div>
      ) : roi ? (
        <>
          {/* Stats */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            {[
              { label: 'Total Cost', value: formatINR(roi.totalCostINR), color: 'text-rose-400' },
              { label: 'Year-1 Salary', value: formatINR(roi.expectedSalaryYear1INR), color: 'text-emerald-400' },
              { label: 'Payback', value: `${roi.paybackPeriodMonths} mo`, color: 'text-sky-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-border/30 bg-muted/20 p-3 text-center">
                <p className="ivy-font text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className={`ivy-font mt-1 text-lg font-black ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Earnings comparison */}
          <div className="mb-5 space-y-2">
            <p className="ivy-font text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cost vs Earnings Projection</p>
            {[
              { label: 'Total Cost', value: roi.totalCostINR, color: 'bg-rose-500' },
              { label: 'Year 1', value: year1, color: 'bg-emerald-500' },
              { label: 'Year 3', value: year3, color: 'bg-sky-500' },
              { label: 'Year 5', value: year5, color: 'bg-violet-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="ivy-font w-16 text-xs font-semibold text-muted-foreground">{label}</span>
                <div className="flex-1">
                  <div className="h-4 w-full overflow-hidden rounded-full bg-muted/20">
                    <div className={`h-full rounded-full ${color} transition-all duration-700`}
                      style={{ width: `${Math.min(100, (value / maxEarnings) * 100)}%` }} />
                  </div>
                </div>
                <span className="ivy-font w-16 text-right text-xs font-bold text-foreground">{formatINR(value)}</span>
              </div>
            ))}
          </div>

          {/* Loan amount input */}
          <div>
            <label className="ivy-font block text-xs font-bold text-muted-foreground">Loan Amount (₹)</label>
            <input type="number" value={loanAmount}
              onChange={(e) => setLoanAmount(Number(e.target.value) || 0)}
              className="ivy-font mt-1.5 w-full rounded-xl border border-border/40 bg-muted/20 px-4 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-emerald-500/50"
              min={100000} max={20000000} step={100000} />
          </div>
        </>
      ) : null}
    </div>
  );
}
