'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Upload, CheckCircle2, AlertTriangle, FileText, Loader2,
  Shield, Eye, XCircle
} from 'lucide-react';

interface DocumentItem {
  name: string;
  required: boolean;
  status: 'pending' | 'uploaded' | 'verified';
  lenders: string[];
}

interface UploadedDoc {
  documentName: string;
  cloudinaryUrl: string;
  uploadedAt: string;
  aiValidation: {
    status: 'valid' | 'issues_found' | 'unreadable' | 'pending';
    extractedData: Record<string, any>;
    issues: string[];
    confidenceScore: number;
    suggestions?: string;
  };
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string; icon: any }> = {
  pending:  { bg: 'bg-muted/30', text: 'text-muted-foreground', label: 'Pending', icon: FileText },
  uploaded: { bg: 'bg-sky-500/15', text: 'text-sky-400', label: 'Uploaded', icon: Upload },
  verified: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Verified', icon: CheckCircle2 },
};

const VALIDATION_STYLES: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  valid:        { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-500', icon: CheckCircle2, label: 'AI Verified' },
  issues_found: { bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-500', icon: AlertTriangle, label: 'Issues Found' },
  unreadable:   { bg: 'bg-rose-500/10 border-rose-500/20', text: 'text-rose-500', icon: XCircle, label: 'Unreadable' },
  pending:      { bg: 'bg-muted/10 border-border/20', text: 'text-muted-foreground', icon: Loader2, label: 'Pending Review' },
};

export default function DocumentChecklist() {
  const [checklist, setChecklist] = useState<DocumentItem[]>([]);
  const [selectedLender, setSelectedLender] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<Record<string, UploadedDoc>>({});
  const [guidedMode, setGuidedMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  const handleUpload = async (docName: string, file: File) => {
    setUploadingDoc(docName);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentName', docName);

      const res = await fetch('/api/loan/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }

      const data = await res.json();

      // Store validation result
      setUploadResults(prev => ({
        ...prev,
        [docName]: data.document,
      }));

      // Update checklist status
      const newStatus = data.document.validation?.status === 'valid' ? 'verified' : 'uploaded';
      setChecklist(prev => prev.map(item =>
        item.name === docName ? { ...item, status: newStatus as DocumentItem['status'] } : item
      ));

      // In guided mode, advance to next step
      if (guidedMode) {
        const pendingDocs = checklist.filter(d => d.status === 'pending' && d.name !== docName);
        if (pendingDocs.length > 0) {
          const nextIdx = checklist.findIndex(d => d.name === pendingDocs[0].name);
          setCurrentStep(nextIdx);
        }
      }
    } catch (e) {
      console.error('Upload failed:', e);
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleLenderChange = (lender: string) => {
    setSelectedLender(lender);
    fetchChecklist(lender);
  };

  const uploaded = checklist.filter(d => d.status !== 'pending').length;
  const dynamicLenders = Array.from(new Set(checklist.flatMap(c => c.lenders || [])));
  const pendingRequired = checklist.filter(d => d.required && d.status === 'pending');

  return (
    <div className="rounded-2xl border border-border/40 bg-card/80 p-8 backdrop-blur-sm">
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <h3 className="ivy-font text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Document Checklist</h3>
        <div className="flex items-center gap-2">
          {/* Guided Mode Toggle */}
          <button
            onClick={() => { setGuidedMode(!guidedMode); setCurrentStep(checklist.findIndex(d => d.status === 'pending')); }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              guidedMode
                ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                : 'bg-muted/20 text-muted-foreground border border-border/30 hover:bg-muted/40'
            }`}
          >
            <Shield className="h-3 w-3" />
            {guidedMode ? 'Guided Mode ON' : 'Guided Mode'}
          </button>
          <select value={selectedLender || ''} onChange={(e) => handleLenderChange(e.target.value)}
            className="ivy-font rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5 text-xs font-semibold text-foreground outline-none">
            <option value="">All Lenders</option>
            {dynamicLenders.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
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

      {/* Guided Mode Banner */}
      {guidedMode && pendingRequired.length > 0 && (
        <div className="mb-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-bold text-emerald-500">AI-Guided Upload</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Upload documents step by step. {pendingRequired.length} required document{pendingRequired.length !== 1 ? 's' : ''} remaining.
            The AI will validate each document as you upload.
          </p>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-muted/20" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {checklist.map((item, idx) => {
            const style = STATUS_STYLES[item.status];
            const validation = uploadResults[item.name]?.aiValidation;
            const valStyle = validation ? VALIDATION_STYLES[validation.status] : null;
            const isUploading = uploadingDoc === item.name;
            const isGuidedActive = guidedMode && idx === currentStep;
            const StatusIcon = style.icon;

            return (
              <div key={item.name}
                className={`rounded-xl border transition-all duration-300 ${
                  isGuidedActive
                    ? 'border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20 scale-[1.01]'
                    : 'border-border/20 bg-muted/10 hover:bg-muted/20'
                }`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Status Checkbox */}
                  <button type="button" onClick={() => handleToggle(item.name, item.status)}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      item.status !== 'pending' ? 'border-emerald-500 bg-emerald-500/20' : 'border-border/50 bg-muted/20'
                    }`}>
                    {item.status !== 'pending' && <span className="text-xs text-emerald-400">✓</span>}
                  </button>

                  {/* Document Name */}
                  <div className="flex-1 min-w-0">
                    <span className="ivy-font text-sm font-medium text-foreground">{item.name}</span>
                    {isGuidedActive && item.status === 'pending' && (
                      <p className="text-[10px] text-emerald-500 font-medium mt-0.5">← Upload this document next</p>
                    )}
                  </div>

                  {/* Tags */}
                  <span className={`ivy-font rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    item.required ? 'bg-rose-500/15 text-rose-400' : 'bg-muted/30 text-muted-foreground'
                  }`}>
                    {item.required ? 'Required' : 'Optional'}
                  </span>
                  <span className={`ivy-font rounded-full px-2 py-0.5 text-[10px] font-bold ${style.bg} ${style.text}`}>{style.label}</span>

                  {/* Upload Button */}
                  <div className="shrink-0">
                    <input
                      type="file"
                      ref={(el) => { fileInputRefs.current[item.name] = el; }}
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => e.target.files?.[0] && handleUpload(item.name, e.target.files[0])}
                    />
                    <button
                      onClick={() => fileInputRefs.current[item.name]?.click()}
                      disabled={isUploading}
                      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        isUploading
                          ? 'bg-amber-500/10 text-amber-500 cursor-not-allowed'
                          : item.status === 'pending'
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20'
                          : 'bg-muted/20 border border-border/30 text-muted-foreground hover:bg-muted/30'
                      }`}
                    >
                      {isUploading ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Uploading...</>
                      ) : (
                        <><Upload className="h-3 w-3" /> {item.status === 'pending' ? 'Upload' : 'Re-upload'}</>
                      )}
                    </button>
                  </div>
                </div>

                {/* AI Validation Result */}
                {valStyle && validation && (
                  <div className={`mx-4 mb-3 rounded-lg border p-3 ${valStyle.bg}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <valStyle.icon className={`h-3.5 w-3.5 ${valStyle.text} ${validation.status === 'pending' ? 'animate-spin' : ''}`} />
                      <span className={`text-xs font-bold ${valStyle.text}`}>{valStyle.label}</span>
                      {validation.confidenceScore > 0 && (
                        <span className="text-[10px] text-muted-foreground ml-auto">Confidence: {validation.confidenceScore}%</span>
                      )}
                    </div>
                    {validation.issues && validation.issues.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {validation.issues.map((issue: string, i: number) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                            <span className="text-amber-500 mt-0.5">•</span> {issue}
                          </li>
                        ))}
                      </ul>
                    )}
                    {validation.suggestions && (
                      <p className="mt-1.5 text-xs text-muted-foreground/80 italic">{validation.suggestions}</p>
                    )}
                    {validation.extractedData?.keyInformation && (
                      <p className="mt-1.5 text-[10px] text-muted-foreground border-t border-border/20 pt-1.5">
                        <span className="font-bold">Extracted:</span> {validation.extractedData.keyInformation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
