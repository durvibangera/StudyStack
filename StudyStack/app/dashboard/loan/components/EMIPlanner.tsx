'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatINR } from '@/lib/loan/loanUtils';

interface EMIScenario {
  label: string;
  principalINR: number;
  tenureMonths: number;
  interestRatePercent: number;
  monthlyEMI: number;
  totalRepayableINR: number;
  totalInterestINR: number;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const TABS = ['Standard', 'Interest-Only', 'Moratorium'] as const;

export default function EMIPlanner() {
  const [principal, setPrincipal] = useState(3500000);
  const [rate, setRate] = useState(11.5);
  const [tenure, setTenure] = useState(120);
  const [scenarios, setScenarios] = useState<EMIScenario[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);

  const debouncedPrincipal = useDebounce(principal, 400);
  const debouncedRate = useDebounce(rate, 400);
  const debouncedTenure = useDebounce(tenure, 400);

  const fetchEMI = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/loan/emi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ principalINR: debouncedPrincipal, interestRatePercent: debouncedRate, tenureMonths: debouncedTenure }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setScenarios(data.scenarios || []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [debouncedPrincipal, debouncedRate, debouncedTenure]);

  useEffect(() => { fetchEMI(); }, [fetchEMI]);

  const current = scenarios[activeTab];

  return (
    <div className="rounded-2xl border border-border/40 bg-card/80 p-8 backdrop-blur-sm">
      <h3 className="ivy-font mb-5 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">EMI Planner</h3>

      {/* Inputs */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="ivy-font block text-xs font-bold text-muted-foreground">Loan Amount (₹)</label>
          <input type="number" value={principal} onChange={(e) => setPrincipal(Number(e.target.value) || 0)}
            className="ivy-font mt-1 w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-emerald-500/50"
            min={100000} max={20000000} step={100000} />
        </div>
        <div>
          <label className="ivy-font block text-xs font-bold text-muted-foreground">Interest Rate (%)</label>
          <input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)}
            className="ivy-font mt-1 w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-emerald-500/50"
            min={5} max={20} step={0.1} />
        </div>
        <div>
          <label className="ivy-font block text-xs font-bold text-muted-foreground">Tenure (months)</label>
          <input type="range" value={tenure} onChange={(e) => setTenure(Number(e.target.value))}
            className="mt-3 w-full accent-emerald-500" min={12} max={180} step={6} />
          <p className="ivy-font mt-1 text-center text-xs font-bold text-foreground">{tenure} months</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl bg-muted/20 p-1">
        {TABS.map((tab, i) => (
          <button key={tab} type="button" onClick={() => setActiveTab(i)}
            className={`ivy-font flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${
              activeTab === i ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      ) : current ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/30 bg-muted/20 p-4 text-center">
            <p className="ivy-font text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Monthly EMI</p>
            <p className="ivy-font mt-1 text-xl font-black text-emerald-400">{formatINR(current.monthlyEMI)}</p>
          </div>
          <div className="rounded-xl border border-border/30 bg-muted/20 p-4 text-center">
            <p className="ivy-font text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Repayable</p>
            <p className="ivy-font mt-1 text-xl font-black text-foreground">{formatINR(current.totalRepayableINR)}</p>
          </div>
          <div className="rounded-xl border border-border/30 bg-muted/20 p-4 text-center">
            <p className="ivy-font text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Interest</p>
            <p className="ivy-font mt-1 text-xl font-black text-amber-400">
              {formatINR(current.totalInterestINR)}
              <span className="ml-1 text-xs font-semibold text-muted-foreground">
                ({principal > 0 ? ((current.totalInterestINR / principal) * 100).toFixed(0) : 0}%)
              </span>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
