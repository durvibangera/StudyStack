'use client';

import { useState, useEffect } from 'react';

interface DocumentItem {
  name: string;
  required: boolean;
  status: 'pending' | 'uploaded' | 'verified';
  lenders: string[];
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending:  { bg: 'bg-muted/30', text: 'text-muted-foreground', label: 'Pending' },
  uploaded: { bg: 'bg-sky-500/15', text: 'text-sky-400', label: 'Uploaded' },
  verified: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Verified' },
};

export default function DocumentChecklist() {
  const [checklist, setChecklist] = useState<DocumentItem[]>([]);
  const [selectedLender, setSelectedLender] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchChecklist = async (lender?: string) => {
    try {
      setLoading(true);
      const url = lender ? `/api/loan/document-checklist?lender=${encodeURIComponent(lender)}` : '/api/loan/document-checklist';
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setChecklist(data.checklist || []);
      if (data.selectedLender) setSelectedLender(data.selectedLender);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchChecklist(); }, []);

  const handleToggle = async (docName: string, currentStatus: string) => {
    const newStatus = currentStatus === 'pending' ? 'uploaded' : currentStatus === 'uploaded' ? 'verified' : 'pending';
    try {
      await fetch('/api/loan/application-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentStatus: { documentName: docName, status: newStatus } }),
      });
      setChecklist(prev => prev.map(item =>
        item.name === docName ? { ...item, status: newStatus as DocumentItem['status'] } : item
      ));
    } catch { /* silent */ }
  };

  const handleLenderChange = (lender: string) => {
    setSelectedLender(lender);
    fetchChecklist(lender);
  };

  const uploaded = checklist.filter(d => d.status !== 'pending').length;

  const dynamicLenders = Array.from(new Set(checklist.flatMap(c => c.lenders || [])));

  return (
    <div className="rounded-2xl border border-border/40 bg-card/80 p-8 backdrop-blur-sm">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="ivy-font text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Document Checklist</h3>
        <select value={selectedLender || ''} onChange={(e) => handleLenderChange(e.target.value)}
          className="ivy-font rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5 text-xs font-semibold text-foreground outline-none">
          <option value="">All Lenders</option>
          {dynamicLenders.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {selectedLender && (
        <p className="ivy-font mb-3 text-xs text-muted-foreground">Showing documents for: <span className="font-bold text-foreground">{selectedLender}</span></p>
      )}

      {/* Progress bar */}
      <div className="mb-5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="ivy-font text-xs font-bold text-muted-foreground">{uploaded} of {checklist.length} uploaded</span>
          <span className="ivy-font text-xs font-bold text-emerald-400">{checklist.length > 0 ? Math.round((uploaded / checklist.length) * 100) : 0}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/20">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${checklist.length > 0 ? (uploaded / checklist.length) * 100 : 0}%` }} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-muted/20" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {checklist.map((item) => {
            const style = STATUS_STYLES[item.status];
            return (
              <div key={item.name}
                className="flex items-center gap-3 rounded-xl border border-border/20 bg-muted/10 px-4 py-3 transition-colors hover:bg-muted/20">
                <button type="button" onClick={() => handleToggle(item.name, item.status)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    item.status !== 'pending' ? 'border-emerald-500 bg-emerald-500/20' : 'border-border/50 bg-muted/20'
                  }`}>
                  {item.status !== 'pending' && <span className="text-xs text-emerald-400">✓</span>}
                </button>
                <span className="ivy-font flex-1 text-sm font-medium text-foreground">{item.name}</span>
                <span className={`ivy-font rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  item.required ? 'bg-rose-500/15 text-rose-400' : 'bg-muted/30 text-muted-foreground'
                }`}>
                  {item.required ? 'Required' : 'Optional'}
                </span>
                <span className={`ivy-font rounded-full px-2 py-0.5 text-[10px] font-bold ${style.bg} ${style.text}`}>{style.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
