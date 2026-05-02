'use client';

import { useState, useEffect } from 'react';
import { formatINR } from '@/lib/loan/loanUtils';
import EMIPlanner from './components/EMIPlanner';
import DocumentChecklist from './components/DocumentChecklist';
import ApplicationStatusTracker from './components/ApplicationStatusTracker';
import LoanSettings from './components/LoanSettings';
import OfferComparison from './components/OfferComparison';
import AnalyticsTab from './components/AnalyticsTab';

/* ── Speedometer Gauge ──────────────────────────────────────────────────────── */
function SpeedometerGauge({ value, max = 100, label, sublabel, size = 160 }: {
  value: number; max?: number; label: string; sublabel?: string; size?: number;
}) {
  const pct = Math.min(value / max, 1);
  const radius = size / 2 - 16;
  const startAngle = 135;
  const endAngle = 405;
  const sweep = (endAngle - startAngle) * pct;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (circumference * (endAngle - startAngle)) / 360;
  const arcFilled = arcLength * pct;
  const arcEmpty = arcLength - arcFilled;

  // Color based on value
  const color = value >= 75 ? '#10b981' : value >= 50 ? '#f59e0b' : value >= 25 ? '#f97316' : '#ef4444';
  const bgColor = 'rgba(255,255,255,0.06)';

  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.7} viewBox={`0 0 ${size} ${size * 0.75}`}>
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none" stroke={bgColor} strokeWidth={12}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(${startAngle} ${cx} ${cy})`}
        />
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none" stroke={color} strokeWidth={12}
          strokeDasharray={`${arcFilled} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(${startAngle} ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 1.2s ease-out, stroke 0.5s ease' }}
        />
        <text x={cx} y={cy - 4} textAnchor="middle" className="ivy-font" fill="currentColor" fontSize={size / 4.5} fontWeight="900">
          {value}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" className="ivy-font" fill="currentColor" opacity="0.5" fontSize={10} fontWeight="600">
          / {max}
        </text>
      </svg>
      <p className="ivy-font text-xs font-bold text-foreground mt-1">{label}</p>
      {sublabel && <p className="ivy-font text-[10px] text-muted-foreground">{sublabel}</p>}
    </div>
  );
}

/* ── KPI Card ───────────────────────────────────────────────────────────────── */
function KPICard({ label, value, subtext, color }: { label: string; value: string; subtext?: string; color: string }) {
  return (
    <div className="rounded-xl border border-border/30 bg-muted/10 p-4">
      <p className="ivy-font text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`ivy-font mt-1.5 text-2xl font-black ${color}`}>{value}</p>
      {subtext && <p className="ivy-font mt-0.5 text-[10px] text-muted-foreground">{subtext}</p>}
    </div>
  );
}

export default function LoanPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'comparison' | 'settings'>('dashboard');

  const fetchLoanData = async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/loan/search-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const d = await res.json();
      setData(d);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoanData();
  }, []);

  const offers = data?.offers || [];
  const kpis = data?.kpis;
  const profileContext = data?.profile;
  const analysis = data?.analysis;
  const highestScore = offers.length > 0 ? Math.max(...offers.map((o: any) => o.matchScore)) : 0;

  return (
    <div className="min-h-screen w-full pb-20">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="ivy-font text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              Loan Intelligence
            </h1>
            <p className="ivy-font mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              A dynamic, living system powered by Exa AI & Gemini. Evaluates your profile, predicts ROI, and finds the best loan offers in real-time.
            </p>
            {profileContext && (
              <div className="mt-4 flex flex-wrap gap-2">
                {profileContext.targetCountry && (
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-500">
                    🌍 {profileContext.targetCountry}
                  </span>
                )}
                {profileContext.courseInterest && (
                  <span className="rounded-full bg-sky-500/10 border border-sky-500/30 px-3 py-1 text-xs font-bold text-sky-500">
                    📚 {profileContext.courseInterest}
                  </span>
                )}
                {kpis?.sourceCount > 0 && (
                  <span className="rounded-full bg-violet-500/10 border border-violet-500/30 px-3 py-1 text-xs font-bold text-violet-500">
                    🤖 {kpis.sourceCount} Sources Analyzed
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto border-b border-border/40 pb-2">
          {[
            { id: 'dashboard', label: 'Overview & Offers' },
            { id: 'analytics', label: 'AI Analytics & ROI' },
            { id: 'comparison', label: 'Offer Comparison' },
            { id: 'settings', label: 'Settings & Overrides' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`whitespace-nowrap px-4 py-2 text-sm font-bold rounded-t-lg transition-colors border-b-2 ${
                activeTab === tab.id 
                  ? 'border-emerald-500 text-emerald-500 bg-emerald-500/5' 
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="rounded-2xl border border-border/40 bg-card/80 p-12 backdrop-blur-sm flex flex-col items-center justify-center text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent mb-4" />
            <h3 className="text-lg font-bold text-foreground">Analyzing your profile...</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">Exa AI is scanning official sites, forums, and salary databases to build your personalized loan strategy.</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/5 p-8">
            <h3 className="text-lg font-bold text-rose-500">Analysis Failed</h3>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <button onClick={() => fetchLoanData()} className="mt-4 rounded-lg bg-rose-500/20 px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/30">
              Try Again
            </button>
          </div>
        )}

        {/* Content Tabs */}
        {!loading && !error && data && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                {/* Speedometers & KPIs */}
                {kpis && (
                  <div className="rounded-2xl border border-border/40 bg-card/80 p-8 backdrop-blur-sm shadow-sm">
                    <h3 className="ivy-font mb-6 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                      Financial Health Dashboard
                    </h3>
                    <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 mb-8">
                      <SpeedometerGauge
                        value={kpis.financialHealthScore}
                        label="Financial Health"
                        sublabel={kpis.financialHealthScore >= 75 ? 'Strong' : kpis.financialHealthScore >= 50 ? 'Moderate' : 'Needs Attention'}
                        size={170}
                      />
                      <SpeedometerGauge
                        value={kpis.affordabilityIndex}
                        label="Affordability"
                        sublabel={kpis.affordabilityIndex >= 75 ? 'Comfortable' : kpis.affordabilityIndex >= 50 ? 'Manageable' : 'Stretched'}
                        size={170}
                      />
                      <SpeedometerGauge
                        value={kpis.debtSafety}
                        label="Debt Safety"
                        sublabel={`${kpis.debtToIncomeRatio}% debt-to-income`}
                        size={170}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <KPICard label="Estimated EMI" value={formatINR(kpis.estimatedEMI)} subtext="per month" color="text-emerald-500" />
                      <KPICard label="Best Rate" value={`${kpis.bestRate}%`} subtext={`avg ${kpis.avgInterestRate}%`} color="text-sky-500" />
                      <KPICard label="Total Interest" value={`${kpis.totalInterestPercent}%`} subtext={`of ₹${(kpis.loanAmount / 100000).toFixed(0)}L principal`} color="text-amber-500" />
                      <KPICard label="Data Sources" value={kpis.sourceCount.toString()} subtext="Exa AI web search" color="text-violet-500" />
                    </div>
                  </div>
                )}

                {/* Offers Grid */}
                <div>
                  <h3 className="ivy-font mb-5 text-sm font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center justify-between">
                    <span>AI-Ranked Loan Offers</span>
                    <span className="text-xs text-muted-foreground font-medium bg-muted/20 px-3 py-1 rounded-full border border-border/30">
                      Based on {data.searchParams?.prioritizeBy?.replace('_', ' ') || 'best match'}
                    </span>
                  </h3>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {offers.map((offer: any) => (
                      <div key={offer.lender} className={`flex flex-col rounded-2xl border bg-card/80 p-6 backdrop-blur-sm transition-all duration-300 hover:shadow-lg ${
                        offer.matchScore === highestScore ? 'border-emerald-500/50 shadow-emerald-500/5 scale-[1.01]' : 'border-border/40 hover:border-emerald-500/30'
                      }`}>
                        {offer.matchScore === highestScore && (
                          <div className="mb-4">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-500">
                              <span>⭐</span> Top Recommendation
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-start justify-between mb-4">
                          <h4 className="text-xl font-black text-foreground tracking-tight">{offer.lender}</h4>
                          <div className="flex flex-col items-end">
                            <span className={`text-lg font-black ${offer.matchScore >= 80 ? 'text-emerald-500' : offer.matchScore >= 60 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                              {offer.matchScore}%
                            </span>
                            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Match</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4 bg-muted/10 p-3 rounded-xl border border-border/20">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Interest Rate</p>
                            <p className="text-sm font-semibold">{offer.interestRateMin}% - {offer.interestRateMax}%</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Max Amount</p>
                            <p className="text-sm font-semibold">₹{(offer.maxLoanAmountINR / 100000).toFixed(0)}L</p>
                          </div>
                        </div>

                        <div className="flex-1 mb-6">
                           <p className="text-sm text-foreground/90 font-medium leading-relaxed bg-muted/20 p-3 rounded-xl border-l-2 border-emerald-500">
                              {offer.matchReason}
                           </p>
                        </div>

                        <div className="mt-auto pt-4 border-t border-border/30 flex gap-3">
                          <a href={offer.applyUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex justify-center items-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-emerald-600 shadow-sm">
                            Apply Now
                          </a>
                          {offer.sourceUrls && offer.sourceUrls[0] && (
                            <a href={offer.sourceUrls[0]} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center rounded-xl border border-border/50 bg-card px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-muted/30 transition-colors" title="View Source">
                              Source
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <div className="space-y-8">
                 <AnalyticsTab analysis={analysis} kpis={kpis} forumInsights={data.forumInsights} />
                 
                 {/* ROI Section via dynamic data */}
                 {data.roiProjection && (
                    <div className="rounded-2xl border border-border/40 bg-card/80 p-8 backdrop-blur-sm">
                       <h3 className="ivy-font mb-6 text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Dynamic ROI Projection</h3>
                       
                       <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                          <KPICard label="Total Education Cost" value={formatINR(data.roiProjection.totalCostINR)} color="text-rose-500" />
                          <KPICard label="Expected Year 1 Salary" value={formatINR(data.roiProjection.expectedSalaryYear1INR)} color="text-emerald-500" subtext={`Source: ${data.roiProjection.salaryNotes}`} />
                          <KPICard label="Expected Year 3 Salary" value={formatINR(data.roiProjection.expectedSalaryYear3INR)} color="text-sky-500" />
                          <KPICard label="Payback Period" value={`${data.roiProjection.paybackPeriodMonths} mos`} color="text-violet-500" />
                       </div>

                       <div className="space-y-3">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Cost vs Earnings Trajectory</p>
                          {[
                             { label: 'Total Cost', value: data.roiProjection.totalCostINR, color: 'bg-rose-500' },
                             { label: 'Year 1 Salary', value: data.roiProjection.expectedSalaryYear1INR, color: 'bg-emerald-500' },
                             { label: 'Year 3 Salary', value: data.roiProjection.expectedSalaryYear3INR, color: 'bg-sky-500' },
                             { label: 'Year 5 Salary', value: data.roiProjection.expectedSalaryYear5INR, color: 'bg-violet-500' },
                          ].map((item, i) => (
                             <div key={i} className="flex items-center gap-4">
                                <div className="w-24 text-xs font-semibold text-muted-foreground">{item.label}</div>
                                <div className="flex-1 h-4 bg-muted/20 rounded-full overflow-hidden">
                                   <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${Math.min(100, (item.value / Math.max(data.roiProjection.expectedSalaryYear5INR, data.roiProjection.totalCostINR)) * 100)}%` }}></div>
                                </div>
                                <div className="w-24 text-right text-sm font-bold">{formatINR(item.value)}</div>
                             </div>
                          ))}
                       </div>
                    </div>
                 )}
              </div>
            )}

            {/* Comparison Tab */}
            {activeTab === 'comparison' && (
              <OfferComparison offers={offers} />
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <LoanSettings 
                initialParams={data.searchParams} 
                onSave={(params) => fetchLoanData(params)} 
              />
            )}

          </div>
        )}
      </div>
    </div>
  );
}
