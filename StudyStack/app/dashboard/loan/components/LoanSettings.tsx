'use client';

import { useState } from 'react';

export default function LoanSettings({ initialParams, onSave }: { initialParams: any, onSave: (params: any) => void }) {
  const [params, setParams] = useState(initialParams || {});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // For checkboxes, we need to check if it's an HTMLInputElement
    let finalValue: string | number | boolean = value;
    
    if (type === 'number') {
      finalValue = Number(value);
    } else if (type === 'checkbox') {
      finalValue = (e.target as HTMLInputElement).checked;
    }
    
    setParams({ ...params, [name]: finalValue });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(params);
  };

  return (
    <div className="rounded-2xl border border-border/40 bg-card/80 p-8 backdrop-blur-sm">
      <h3 className="ivy-font mb-6 text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Search Parameters & Overrides</h3>
      
      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1">Target Country</label>
          <input type="text" name="targetCountry" value={params.targetCountry || ''} onChange={handleChange} placeholder="e.g. US, UK, Canada" className="w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-emerald-500/50" />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1">Course/Field</label>
          <input type="text" name="courseInterest" value={params.courseInterest || ''} onChange={handleChange} placeholder="e.g. Computer Science, MBA" className="w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-emerald-500/50" />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1">University Name</label>
          <input type="text" name="universityName" value={params.universityName || ''} onChange={handleChange} placeholder="Target university" className="w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-emerald-500/50" />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1">Loan Amount Needed (₹)</label>
          <input type="number" name="loanAmountNeeded" value={params.loanAmountNeeded || ''} onChange={handleChange} className="w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-emerald-500/50" />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1">GPA / Percentage</label>
          <input type="text" name="gpa" value={params.gpa || ''} onChange={handleChange} placeholder="e.g. 8.5 or 85%" className="w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-emerald-500/50" />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1">Test Score (IELTS/TOEFL)</label>
          <input type="text" name="testScore" value={params.testScore || ''} onChange={handleChange} placeholder="e.g. IELTS 7.5" className="w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-emerald-500/50" />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1">Scholarship Amount (₹)</label>
          <input type="number" name="scholarshipAmount" value={params.scholarshipAmount || ''} onChange={handleChange} className="w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-emerald-500/50" />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1">Prioritize By</label>
          <select name="prioritizeBy" value={params.prioritizeBy || 'best_match'} onChange={handleChange} className="w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-emerald-500/50">
            <option value="best_match">Best Match</option>
            <option value="interest_rate">Lowest Interest Rate</option>
            <option value="no_collateral">No Collateral</option>
            <option value="max_amount">Max Loan Amount</option>
            <option value="fast_processing">Fast Processing</option>
          </select>
        </div>
        <div className="flex items-center space-x-2 pt-6">
          <input type="checkbox" id="collateralAvailable" name="collateralAvailable" checked={params.collateralAvailable || false} onChange={handleChange} className="h-4 w-4 rounded border-border/40 text-emerald-500 focus:ring-emerald-500" />
          <label htmlFor="collateralAvailable" className="text-sm font-semibold text-foreground">Collateral Available</label>
        </div>
        <div className="md:col-span-2 lg:col-span-3 mt-4">
          <button type="submit" className="w-full sm:w-auto rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-600">
            Apply Settings & Re-Run Search
          </button>
        </div>
      </form>
    </div>
  );
}
