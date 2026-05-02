'use client';

export default function AnalyticsTab({ analysis, kpis, forumInsights }: { analysis: any, kpis: any, forumInsights: any[] }) {
  if (!analysis) return <div className="text-center p-8 text-muted-foreground">No analytics data available</div>;

  return (
    <div className="space-y-8">
      {/* Overall Assessment */}
      <div className="rounded-2xl border border-border/40 bg-card/80 p-8 backdrop-blur-sm">
         <h3 className="ivy-font mb-4 text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">AI Assessment</h3>
         <p className="text-sm leading-relaxed text-foreground">{analysis.overallAssessment}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
          <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-wide mb-4 flex items-center gap-2">
             <span>💪</span> Strengths
          </h4>
          <ul className="space-y-3">
             {analysis.strengthFactors?.map((s: string, i: number) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                   <span className="text-emerald-500 mt-0.5">•</span> <span>{s}</span>
                </li>
             ))}
          </ul>
        </div>

        {/* Risks */}
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6">
          <h4 className="text-sm font-bold text-rose-500 uppercase tracking-wide mb-4 flex items-center gap-2">
             <span>⚠️</span> Risk Factors
          </h4>
          <ul className="space-y-3">
             {analysis.riskFactors?.map((r: string, i: number) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                   <span className="text-rose-500 mt-0.5">•</span> <span>{r}</span>
                </li>
             ))}
          </ul>
        </div>
      </div>

      {/* Dynamic Factors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="rounded-xl bg-muted/20 p-5 border border-border/40">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Exam Score Impact</p>
            <p className="text-xs font-medium text-foreground">{analysis.dynamicFactors?.examScoreImpact || 'N/A'}</p>
         </div>
         <div className="rounded-xl bg-muted/20 p-5 border border-border/40">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">University Tier Impact</p>
            <p className="text-xs font-medium text-foreground">{analysis.dynamicFactors?.universityTierImpact || 'N/A'}</p>
         </div>
         <div className="rounded-xl bg-muted/20 p-5 border border-border/40">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Scholarship Probability</p>
            <div className="flex items-center gap-3 mt-1">
               <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: `${analysis.dynamicFactors?.scholarshipChancePct || 0}%` }}></div>
               </div>
               <span className="font-bold text-sky-500 text-sm">{analysis.dynamicFactors?.scholarshipChancePct || 0}%</span>
            </div>
         </div>
      </div>

      {/* Forum Insights */}
      {forumInsights && forumInsights.length > 0 && (
         <div className="rounded-2xl border border-border/40 bg-card/80 p-8 backdrop-blur-sm">
            <h3 className="ivy-font mb-6 text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Community Insights (Reddit/Forums)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {forumInsights.map((insight: any, i: number) => (
                  <div key={i} className="border border-border/30 rounded-xl p-4 bg-muted/10">
                     <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground">
                           {insight.platform}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${insight.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-500' : insight.sentiment === 'negative' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                           {insight.sentiment}
                        </span>
                     </div>
                     <a href={insight.url} target="_blank" rel="noopener noreferrer" className="font-bold text-sm text-foreground hover:text-emerald-500 transition-colors line-clamp-1 mb-2">
                        {insight.title}
                     </a>
                     <p className="text-xs text-muted-foreground leading-relaxed">{insight.keyTakeaway}</p>
                  </div>
               ))}
            </div>
         </div>
      )}
    </div>
  );
}
