'use client';

import { useState, useEffect } from 'react';
import { formatINR } from '@/lib/loan/loanUtils';

interface LoanOffer {
  lender: string;
  interestRateMin: number;
  interestRateMax: number;
  maxLoanAmountINR: number;
  collateralRequired: boolean;
  moratoriumMonths: number;
  processingFeePercent: number;
  matchScore: number;
  matchReason: string;
  applyUrl: string;
}

export default function MatchedOffers() {
  const [offers, setOffers] = useState<LoanOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOffers() {
      try {
        const res = await fetch('/api/loan/offers');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setOffers(data.offers || []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchOffers();
  }, []);

  const handleApply = async (offer: LoanOffer) => {
    try {
      await fetch('/api/loan/application-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedLender: offer.lender, applicationStatus: 'docs_pending' }),
      });
    } catch { /* non-blocking */ }
    window.open(offer.applyUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="ivy-font text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Matched Loan Offers</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-52 animate-pulse rounded-2xl border border-border/40 bg-muted/20" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h3 className="ivy-font text-lg font-bold text-foreground">Matched Loan Offers</h3>
        <p className="mt-2 text-sm text-red-400">{error}</p>
      </div>
    );
  }

  const highestScore = Math.max(...offers.map(o => o.matchScore));

  return (
    <div>
      <h3 className="ivy-font mb-5 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Matched Loan Offers</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {offers.map((offer) => (
          <div key={offer.lender}
            className={`group rounded-2xl border bg-card/80 p-6 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${
              offer.matchScore === highestScore ? 'border-emerald-500/50 shadow-emerald-500/10' : 'border-border/40'
            }`}>
            <div className="mb-3 flex items-start justify-between">
              <h4 className="ivy-font text-lg font-extrabold text-foreground">{offer.lender}</h4>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                offer.matchScore >= 80 ? 'bg-emerald-500/15 text-emerald-400' :
                offer.matchScore >= 60 ? 'bg-amber-500/15 text-amber-400' : 'bg-muted/30 text-muted-foreground'
              }`}>
                Match: {offer.matchScore}
              </span>
            </div>

            <div className="space-y-1.5 text-sm text-muted-foreground">
              <p><span className="font-semibold text-foreground">{offer.interestRateMin}% – {offer.interestRateMax}%</span> p.a.</p>
              <p>Max Loan: <span className="font-semibold text-foreground">{formatINR(offer.maxLoanAmountINR)}</span></p>
              <p>Collateral: {offer.collateralRequired
                ? <span className="font-semibold text-amber-400">✓ Required</span>
                : <span className="font-semibold text-emerald-400">✗ Not Required</span>}
              </p>
              <p>Moratorium: <span className="font-semibold text-foreground">{offer.moratoriumMonths} months</span></p>
            </div>

            <p className="mt-3 text-xs italic text-muted-foreground">{offer.matchReason}</p>

            <button type="button" onClick={() => handleApply(offer)}
              className="ivy-font mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500/15 px-4 py-2.5 text-sm font-bold text-emerald-400 transition-colors hover:bg-emerald-500/25">
              Apply Now →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
