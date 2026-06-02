'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Upload, FileText, CheckCircle2, XCircle, Clock, Shield,
  ChevronDown, ChevronUp, Trash2, Eye, ToggleLeft,
  ToggleRight, AlertTriangle, Sparkles, Building2,
  GraduationCap, IndianRupee, FileCheck, Loader2,
  TrendingUp, TrendingDown, Minus, ArrowRight, Zap
} from 'lucide-react';

/* ── Status Badge ─────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: any; label: string }> = {
    processing: { bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-500', icon: Loader2, label: 'Processing' },
    review: { bg: 'bg-sky-500/10 border-sky-500/30', text: 'text-sky-500', icon: Eye, label: 'In Review' },
    active: { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-500', icon: CheckCircle2, label: 'Active' },
    inactive: { bg: 'bg-gray-500/10 border-gray-500/30', text: 'text-gray-400', icon: XCircle, label: 'Inactive' },
  };
  const c = config[status] || config.inactive;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${c.bg} ${c.text}`}>
      <Icon className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {c.label}
    </span>
  );
}

/* ── Confidence Indicator ─────────────────────────────────────────────────── */
function ConfidenceBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-muted/20 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold text-muted-foreground">{score}%</span>
    </div>
  );
}

/* ── Policy Detail Section ────────────────────────────────────────────────── */
function PolicySection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-border/30 bg-muted/5 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
            <Icon className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <span className="text-sm font-bold text-foreground">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-border/20">{children}</div>}
    </div>
  );
}

/* ── Tag List ─────────────────────────────────────────────────────────────── */
function TagList({ items, color = 'emerald' }: { items: string[]; color?: string }) {
  if (!items || items.length === 0) return <span className="text-xs text-muted-foreground italic">Not specified</span>;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {items.map((item, i) => (
        <span key={i} className={`rounded-full bg-${color}-500/10 border border-${color}-500/20 px-2.5 py-0.5 text-xs font-medium text-${color}-500`}>
          {item}
        </span>
      ))}
    </div>
  );
}

/* ── Main Page Component ──────────────────────────────────────────────────── */
export default function PoliciesPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // RBAC
  useEffect(() => {
    if (authStatus === 'authenticated' && (session?.user as any)?.role !== 'counsellor') {
      router.replace('/dashboard');
    }
  }, [session, authStatus, router]);

  // Fetch policies
  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch('/api/loan/policies');
      if (res.ok) {
        const data = await res.json();
        setPolicies(data.policies || []);
      }
    } catch (e) {
      console.error('Failed to fetch policies:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  // Upload handler
  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/loan/policies/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      const data = await res.json();
      setUploadResult(data);
      await fetchPolicies();
    } catch (e) {
      setUploadResult({ error: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  // Drag and drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]);
  };

  // Policy actions
  const handleAction = async (policyId: string, action: string) => {
    setActionLoading(policyId);
    try {
      const res = await fetch('/api/loan/policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyId, action }),
      });
      if (res.ok) await fetchPolicies();
    } catch (e) {
      console.error('Action failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (policyId: string) => {
    if (!confirm('Are you sure you want to delete this policy?')) return;
    setActionLoading(policyId);
    try {
      const res = await fetch(`/api/loan/policies/${policyId}`, { method: 'DELETE' });
      if (res.ok) await fetchPolicies();
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  if (authStatus === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if ((session?.user as any)?.role !== 'counsellor') return null;

  const activePolicies = policies.filter(p => p.status === 'active');
  const reviewPolicies = policies.filter(p => p.status === 'review');
  const inactivePolicies = policies.filter(p => p.status === 'inactive' || p.status === 'processing');

  return (
    <div className="min-h-screen w-full pb-20">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">

        {/* Header */}
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Lender Policy Manager
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Upload lender policy documents and let AI extract eligibility rules, financial terms, and requirements. Activate policies to power the student matching engine.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-500">
              {activePolicies.length} Active
            </span>
            <span className="rounded-full bg-sky-500/10 border border-sky-500/30 px-3 py-1 text-xs font-bold text-sky-500">
              {reviewPolicies.length} In Review
            </span>
            <span className="rounded-full bg-gray-500/10 border border-gray-500/30 px-3 py-1 text-xs font-bold text-gray-400">
              {inactivePolicies.length} Inactive
            </span>
          </div>
        </div>

        {/* Upload Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300 ${
            dragActive
              ? 'border-emerald-500 bg-emerald-500/5 scale-[1.01]'
              : uploading
              ? 'border-amber-500/40 bg-amber-500/5 cursor-not-allowed'
              : 'border-border/40 bg-card/80 hover:border-emerald-500/40 hover:bg-emerald-500/5'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.docx"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            disabled={uploading}
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
              <p className="text-sm font-bold text-foreground">Running RAG pipeline — extraction + verification…</p>
              <p className="text-xs text-muted-foreground">This takes ~20–30 seconds (two AI passes)</p>
            </div>
          ) : uploadResult && !uploadResult.error ? (
            <div className="w-full text-left space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-black text-foreground">
                    {uploadResult.isUpdate ? `↻ Policy Updated — v${uploadResult.policy?.version}` : '✓ New Policy Extracted'}
                    {' '}· {uploadResult.policy?.lenderName} — {uploadResult.policy?.productName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{uploadResult.policy?.sourceDocumentName}</p>
                </div>
                <button onClick={() => setUploadResult(null)} className="text-xs text-muted-foreground underline">Dismiss</button>
              </div>

              {/* RAG Score Bar */}
              {uploadResult.ragEvaluation && (() => {
                const ev = uploadResult.ragEvaluation;
                const scoreColor = ev.overallScore >= 85 ? 'text-emerald-400' : ev.overallScore >= 70 ? 'text-sky-400' : ev.overallScore >= 50 ? 'text-amber-400' : 'text-rose-400';
                const barColor = ev.overallScore >= 85 ? 'bg-emerald-500' : ev.overallScore >= 70 ? 'bg-sky-500' : ev.overallScore >= 50 ? 'bg-amber-500' : 'bg-rose-500';
                return (
                  <div className="rounded-xl border border-border/30 bg-muted/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">RAG Evaluation</p>
                      <span className={`text-sm font-black ${scoreColor}`}>
                        {ev.verdict.toUpperCase()} · {ev.overallScore}/100
                      </span>
                    </div>
                    {/* Composite score bar */}
                    <div className="space-y-1.5">
                      {[
                        { label: `Faithfulness (${ev.faithfulnessScore}%)`, score: ev.faithfulnessScore, weight: '60%' },
                        { label: `Completeness (${ev.completenessScore}%)`, score: ev.completenessScore, weight: '40%' },
                        { label: `Overall (${ev.overallScore}%)`, score: ev.overallScore, weight: '' },
                      ].map(({ label, score, weight }) => (
                        <div key={label} className="flex items-center gap-3">
                          <span className="text-[10px] font-semibold text-muted-foreground w-44 shrink-0">{label}{weight ? ` · weight ${weight}` : ''}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                            <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${score}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    {ev.missingCriticalFields?.length > 0 && (
                      <p className="text-xs text-rose-400">⚠ Missing critical fields: {ev.missingCriticalFields.join(', ')}</p>
                    )}
                  </div>
                );
              })()}

              {/* Faithfulness flags — per-field verification with evidence */}
              {uploadResult.ragEvaluation?.faithfulnessFlags?.length > 0 && (
                <div className="rounded-xl border border-border/30 bg-muted/5 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-3">
                    Faithfulness Verification ({uploadResult.ragEvaluation.faithfulnessFlags.filter((f: any) => f.verified).length}/{uploadResult.ragEvaluation.faithfulnessFlags.length} verified)
                  </p>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {uploadResult.ragEvaluation.faithfulnessFlags.map((f: any, i: number) => (
                      <div key={i} className={`rounded-lg px-3 py-2 border ${ f.verified ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5' }`}>
                        <div className="flex items-center gap-2">
                          {f.verified
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            : <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                          <span className="text-xs font-semibold text-foreground">{f.field}:</span>
                          <span className="text-xs font-mono text-foreground/70">{f.extractedValue}</span>
                        </div>
                        <p className={`text-[10px] mt-1 ml-5 italic ${ f.verified ? 'text-emerald-500/70' : 'text-rose-400' }`}>
                          {f.evidence}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Change diff — only shown for policy updates */}
              {uploadResult.isUpdate && uploadResult.changeDetection && (
                <div className="rounded-xl border border-border/30 bg-muted/5 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-3">
                    {uploadResult.changeDetection.changes.length > 0
                      ? `${uploadResult.changeDetection.changes.length} Field(s) Changed vs. Previous Version`
                      : 'No changes detected vs. previous version'}
                  </p>
                  {uploadResult.changeDetection.changes.map((c: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-border/10 last:border-0">
                      <span className="text-xs font-semibold text-foreground min-w-[170px]">{c.field}</span>
                      <span className="text-xs text-rose-400 font-mono line-through">{String(c.old)}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-emerald-400 font-mono font-bold">{String(c.new)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : uploadResult?.error ? (
            <div className="flex flex-col items-center gap-2">
              <XCircle className="h-10 w-10 text-rose-500" />
              <p className="text-sm font-bold text-rose-400">Upload failed: {uploadResult.error}</p>
              <button onClick={() => setUploadResult(null)} className="text-xs text-muted-foreground underline">Try again</button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <Upload className="h-7 w-7 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">Upload Lender Policy Document</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Drag & drop or click to browse. Supports PDF, DOCX, TXT.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {['Eligibility Guidelines', 'Loan Brochures', 'Underwriting Rules', 'Document Sheets'].map(t => (
                  <span key={t} className="rounded-full bg-muted/20 border border-border/30 px-3 py-1 text-[10px] font-medium text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>


        {/* Policies List */}
        {policies.length === 0 && !loading ? (
          <div className="rounded-2xl border border-border/40 bg-card/80 p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-lg font-bold text-muted-foreground">No Policies Yet</p>
            <p className="mt-1 text-sm text-muted-foreground/70">Upload your first lender policy document to get started.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Review Policies First */}
            {reviewPolicies.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-4 w-4 text-sky-500" />
                  <h2 className="text-sm font-black uppercase tracking-[0.15em] text-sky-500">Awaiting Review</h2>
                </div>
                <div className="space-y-4">
                  {reviewPolicies.map(policy => renderPolicyCard(policy))}
                </div>
              </div>
            )}

            {/* Active Policies */}
            {activePolicies.length > 0 && (
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.15em] text-emerald-500 mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Active Policies
                </h2>
                <div className="space-y-4">
                  {activePolicies.map(policy => renderPolicyCard(policy))}
                </div>
              </div>
            )}

            {/* Inactive */}
            {inactivePolicies.length > 0 && (
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.15em] text-muted-foreground mb-4">Inactive / Processing</h2>
                <div className="space-y-4">
                  {inactivePolicies.map(policy => renderPolicyCard(policy))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  function renderPolicyCard(policy: any) {
    const isExpanded = expandedPolicy === policy._id;
    const pol = policy.extractedPolicies || {};
    const isLoading = actionLoading === policy._id;

    return (
      <div key={policy._id} className="rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-lg">
        {/* Card Header */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Building2 className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-foreground truncate">{policy.lenderName}</h3>
                  <p className="text-sm text-muted-foreground">{policy.productName}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <StatusBadge status={policy.status} />
                {pol.financial && (
                  <span className="text-xs font-medium text-muted-foreground bg-muted/20 px-2.5 py-1 rounded-full border border-border/30">
                    {pol.financial.interestRateMin || '?'}% – {pol.financial.interestRateMax || '?'}%
                  </span>
                )}
                {pol.financial?.maxLoanAmountINR > 0 && (
                  <span className="text-xs font-medium text-muted-foreground bg-muted/20 px-2.5 py-1 rounded-full border border-border/30">
                    Max ₹{(pol.financial.maxLoanAmountINR / 100000).toFixed(0)}L
                  </span>
                )}
                {pol.financial?.collateralRequired && (
                  <span className="text-xs font-medium text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                    Collateral Required
                  </span>
                )}
              </div>

              {/* AI Confidence */}
              <div className="mt-3 max-w-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">AI Extraction Confidence</p>
                <ConfidenceBar score={policy.aiConfidenceScore || 0} />
              </div>
              {policy.aiExtractionNotes && (
                <p className="mt-2 text-xs text-muted-foreground/70 italic">{policy.aiExtractionNotes}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 shrink-0">
              {policy.status === 'review' && (
                <button
                  onClick={() => handleAction(policy._id, 'activate')}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ToggleRight className="h-3 w-3" />}
                  Activate
                </button>
              )}
              {policy.status === 'active' && (
                <button
                  onClick={() => handleAction(policy._id, 'deactivate')}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-muted/20 border border-border/30 px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ToggleLeft className="h-3 w-3" />}
                  Deactivate
                </button>
              )}
              {policy.status === 'inactive' && (
                <button
                  onClick={() => handleAction(policy._id, 'activate')}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-xs font-bold text-emerald-500 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                >
                  Reactivate
                </button>
              )}
              <button
                onClick={() => handleDelete(policy._id)}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-lg bg-rose-500/5 border border-rose-500/20 px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/15 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
              <button
                onClick={() => setExpandedPolicy(isExpanded ? null : policy._id)}
                className="flex items-center gap-1.5 rounded-lg bg-muted/10 border border-border/30 px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted/20 transition-colors"
              >
                <Eye className="h-3 w-3" /> {isExpanded ? 'Collapse' : 'Details'}
              </button>
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="border-t border-border/30 p-6 space-y-4 bg-muted/5 animate-in slide-in-from-top-2 duration-300">

            <PolicySection title="Eligibility Criteria" icon={GraduationCap}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Supported Countries</p>
                  <TagList items={pol.eligibility?.supportedCountries} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Supported Degrees</p>
                  <TagList items={pol.eligibility?.supportedDegrees} color="sky" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Min GPA</p>
                  <p className="text-sm font-semibold text-foreground">{pol.eligibility?.minGPA || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Min Co-Applicant Income</p>
                  <p className="text-sm font-semibold text-foreground">
                    {pol.eligibility?.minCoApplicantIncomeINR
                      ? `₹${(pol.eligibility.minCoApplicantIncomeINR / 100000).toFixed(1)}L`
                      : 'Not specified'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Co-Applicant Required</p>
                  <p className="text-sm font-semibold text-foreground">{pol.eligibility?.requiresCoApplicant ? 'Yes' : 'No'}</p>
                </div>
                {pol.eligibility?.additionalCriteria?.length > 0 && (
                  <div className="md:col-span-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Additional Criteria</p>
                    <ul className="space-y-1">
                      {pol.eligibility.additionalCriteria.map((c: string, i: number) => (
                        <li key={i} className="text-xs text-foreground/80">• {c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </PolicySection>

            <PolicySection title="Financial Terms" icon={IndianRupee}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                {[
                  ['Interest Rate', `${pol.financial?.interestRateMin || '?'}% – ${pol.financial?.interestRateMax || '?'}%`],
                  ['Max Loan', pol.financial?.maxLoanAmountINR ? `₹${(pol.financial.maxLoanAmountINR / 100000).toFixed(0)}L` : 'N/A'],
                  ['Processing Fee', pol.financial?.processingFeePercent ? `${pol.financial.processingFeePercent}%` : 'N/A'],
                  ['Collateral', pol.financial?.collateralRequired ? `Required (>₹${pol.financial?.collateralThresholdINR ? (pol.financial.collateralThresholdINR / 100000).toFixed(0) + 'L' : 'threshold'})` : 'Not required'],
                  ['Moratorium', `${pol.repayment?.moratoriumMonths || 0} months`],
                  ['Tenure', `${pol.repayment?.minTenureMonths || '?'} – ${pol.repayment?.maxTenureMonths || '?'} months`],
                  ['Prepayment', pol.repayment?.prepaymentAllowed ? 'Allowed' : 'Not allowed'],
                  ['Insurance', pol.financial?.insuranceRequired ? 'Required' : 'Not required'],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            </PolicySection>

            {pol.documents?.length > 0 && (
              <PolicySection title="Required Documents" icon={FileCheck}>
                <div className="space-y-2 mt-3">
                  {pol.documents.map((doc: any, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-muted/10 px-3 py-2 border border-border/20">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">{doc.name}</span>
                        {doc.required && <span className="text-[9px] font-bold text-rose-500 uppercase">Required</span>}
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted/20 px-2 py-0.5 rounded-full">
                        {doc.category}
                      </span>
                    </div>
                  ))}
                </div>
              </PolicySection>
            )}

            {pol.specialFeatures?.length > 0 && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-xs font-bold text-emerald-500 mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Special Features
                </p>
                <ul className="space-y-1">
                  {pol.specialFeatures.map((f: string, i: number) => (
                    <li key={i} className="text-xs text-foreground/80">✓ {f}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-[10px] text-muted-foreground/50 pt-2 border-t border-border/20">
              Source: {policy.sourceDocumentName || 'Unknown'} · Uploaded {new Date(policy.createdAt).toLocaleDateString()}
              {policy.activatedAt && ` · Activated ${new Date(policy.activatedAt).toLocaleDateString()}`}
            </div>
          </div>
        )}
      </div>
    );
  }
}
