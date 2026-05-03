"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Search, GraduationCap, Globe, MapPin, DollarSign, ChevronRight,
  ArrowLeft, Sparkles, Loader2, TrendingUp, Calendar, ArrowRight,
  Landmark, Star, Shield, Target, Zap, BookOpen, Briefcase, Clock,
  CheckCircle2, AlertCircle, RefreshCw,
} from "lucide-react";

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany",
  "Ireland", "New Zealand", "Singapore", "Netherlands", "France", "India (Domestic)",
];

const PROGRAMS = [
  "Computer Science / IT", "Data Science / AI", "MBA / Business",
  "Engineering", "Finance / Accounting", "Healthcare / Medicine",
  "Arts / Humanities", "Law", "Biotechnology", "Environmental Science",
];

const TIER_STYLES = {
  Reach: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/30", icon: Target },
  Match: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30", icon: CheckCircle2 },
  Safe:  { bg: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-400", border: "border-sky-500/30", icon: Shield },
};

function AdmissionGauge({ value, size = 140 }) {
  const radius = size / 2 - 16;
  const circumference = 2 * Math.PI * radius;
  const startAngle = 135;
  const endAngle = 405;
  const arcLength = (circumference * (endAngle - startAngle)) / 360;
  const arcFilled = arcLength * (value / 100);
  const color = value >= 70 ? "#10b981" : value >= 45 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.75}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(${startAngle} ${size / 2} ${size / 2})`}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${arcFilled} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(${startAngle} ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 1.2s ease-out" }}
        />
        <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fill="currentColor" fontSize={size / 4} fontWeight="900">
          {value}%
        </text>
        <text x={size / 2} y={size / 2 + 18} textAnchor="middle" fill="currentColor" opacity="0.5" fontSize={10} fontWeight="600">
          Admission Chance
        </text>
      </svg>
    </div>
  );
}

export default function ExplorePage() {
  const router = useRouter();

  // Filters
  const [country, setCountry] = useState("United Kingdom");
  const [program, setProgram] = useState("Computer Science / IT");
  const [budget, setBudget] = useState("₹20-30 Lakhs");

  // Results
  const [data, setData] = useState(null);
  const [admission, setAdmission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [admissionLoading, setAdmissionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("universities");

  const explore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, program, budget }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [country, program, budget]);

  const checkAdmission = useCallback(async () => {
    setAdmissionLoading(true);
    try {
      const res = await fetch("/api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, program, budget, mode: "admission" }),
      });
      if (!res.ok) throw new Error("Failed");
      const result = await res.json();
      setAdmission(result.admission);
    } catch {
      // Silently fail admission — non-critical
    } finally {
      setAdmissionLoading(false);
    }
  }, [country, program, budget]);

  // Auto-explore on mount
  useEffect(() => {
    explore();
    checkAdmission();
  }, []);

  const universities = data?.universities || [];
  const countryInsights = data?.countryInsights || {};
  const careerPaths = data?.careerPaths || [];
  const timeline = data?.timeline || [];

  return (
    <div className="min-h-screen w-full pb-20">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <button
              onClick={() => router.back()}
              className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <h1 className="ivy-font text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              University Explorer
            </h1>
            <p className="ivy-font mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              AI-powered university discovery. Find your best-fit institutions, predict admission chances, and plan your application timeline.
            </p>
          </div>
        </div>

        {/* Filters Bar */}
        <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="ivy-font mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <Globe className="mr-1 inline h-3 w-3 text-sky-500" /> Country
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="ivy-font mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <GraduationCap className="mr-1 inline h-3 w-3 text-violet-500" /> Program
                </label>
                <select
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  className="w-full rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="ivy-font mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <DollarSign className="mr-1 inline h-3 w-3 text-emerald-500" /> Annual Budget
                </label>
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  {["Below ₹10 Lakhs", "₹10-20 Lakhs", "₹20-30 Lakhs", "₹30-50 Lakhs", "₹50 Lakhs+"].map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <Button
                onClick={() => { explore(); checkAdmission(); }}
                disabled={loading}
                className="h-[42px] gap-2 bg-emerald-500 px-6 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? "Searching..." : "Explore"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <p className="ivy-font text-lg font-bold text-foreground">AI is exploring universities...</p>
            <p className="ivy-font text-sm text-muted-foreground">Analyzing programs, rankings, and fit for your profile</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <Card className="border-rose-500/40 bg-rose-500/5">
            <CardContent className="flex items-center gap-4 p-6">
              <AlertCircle className="h-6 w-6 text-rose-500 shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-rose-500">Exploration failed</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button onClick={explore} variant="outline" size="sm" className="border-rose-500/30 text-rose-500 hover:bg-rose-500/10">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {!loading && !error && data && (
          <>
            {/* Tab Navigation */}
            <div className="flex gap-2 overflow-x-auto border-b border-border/40 pb-2">
              {[
                { id: "universities", label: "Universities", count: universities.length },
                { id: "admission", label: "Admission Predictor" },
                { id: "careers", label: "Career Paths" },
                { id: "timeline", label: "Application Timeline" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap px-4 py-2 text-sm font-bold rounded-t-lg transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? "border-emerald-500 text-emerald-500 bg-emerald-500/5"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/10"
                  }`}
                >
                  {tab.label}
                  {tab.count != null && (
                    <span className="ml-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Universities Tab */}
            {activeTab === "universities" && (
              <div className="space-y-6">
                {/* Country Insights Bar */}
                {countryInsights && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {[
                      { label: "Avg Tuition", value: countryInsights.avgTuition || "—", icon: DollarSign, color: "text-rose-500" },
                      { label: "Avg Living", value: countryInsights.avgLiving || "—", icon: MapPin, color: "text-sky-500" },
                      { label: "Post-Study Visa", value: countryInsights.postStudyVisa || "—", icon: Globe, color: "text-emerald-500" },
                      { label: "Top City", value: countryInsights.topCities?.[0] || "—", icon: MapPin, color: "text-violet-500" },
                      { label: "Deadlines", value: countryInsights.applicationDeadlines || "—", icon: Calendar, color: "text-amber-500" },
                      { label: "Job Market", value: countryInsights.jobMarket?.slice(0, 30) || "—", icon: Briefcase, color: "text-teal-500" },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div key={label} className="rounded-xl border border-border/30 bg-muted/10 p-3">
                        <div className={`mb-1 flex items-center gap-1.5 ${color}`}>
                          <Icon className="h-3 w-3" />
                          <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
                        </div>
                        <p className="ivy-font text-xs font-bold text-foreground leading-tight">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* University Cards */}
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {universities.map((uni, i) => {
                    const tier = TIER_STYLES[uni.tier] || TIER_STYLES.Match;
                    const TierIcon = tier.icon;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                      >
                        <Card className={`group h-full border-border/40 bg-card/80 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg`}>
                          <CardContent className="flex h-full flex-col p-5">
                            {/* Header */}
                            <div className="mb-3 flex items-start justify-between">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15">
                                <GraduationCap className="h-5 w-5 text-blue-500" />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full ${tier.bg} ${tier.border} border px-2 py-0.5 text-[10px] font-bold ${tier.text} flex items-center gap-1`}>
                                  <TierIcon className="h-3 w-3" /> {uni.tier}
                                </span>
                                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                  {uni.matchScore}%
                                </span>
                              </div>
                            </div>

                            {/* Name + Location */}
                            <h3 className="ivy-font text-base font-black text-foreground leading-tight">{uni.name}</h3>
                            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span>{uni.city}, {uni.country}</span>
                              {uni.ranking && <span className="ml-auto text-[10px] font-bold text-amber-500">📊 {uni.ranking}</span>}
                            </div>

                            {/* Program */}
                            <p className="mt-2 text-xs font-medium text-muted-foreground">{uni.program}</p>

                            {/* Stats */}
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              {uni.tuitionRange && (
                                <div className="rounded-lg bg-muted/20 px-2.5 py-1.5">
                                  <p className="text-[9px] text-muted-foreground uppercase font-bold">Tuition</p>
                                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{uni.tuitionRange}</p>
                                </div>
                              )}
                              {uni.acceptanceRate && (
                                <div className="rounded-lg bg-muted/20 px-2.5 py-1.5">
                                  <p className="text-[9px] text-muted-foreground uppercase font-bold">Accept Rate</p>
                                  <p className="text-xs font-bold text-sky-600 dark:text-sky-400">{uni.acceptanceRate}</p>
                                </div>
                              )}
                            </div>

                            {/* Scholarships */}
                            {uni.scholarships && uni.scholarships !== "Check website" && (
                              <p className="mt-2 text-[11px] text-violet-600 dark:text-violet-400 font-semibold">
                                <Star className="inline h-3 w-3 mr-0.5" /> {uni.scholarships}
                              </p>
                            )}

                            {/* Highlights */}
                            {uni.highlights?.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {uni.highlights.map((h, j) => (
                                  <span key={j} className="rounded-full bg-muted/30 border border-border/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    {h}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Reason */}
                            <p className="mt-auto pt-3 text-[11px] leading-relaxed text-muted-foreground border-t border-border/30">{uni.reason}</p>

                            {/* Salary */}
                            {uni.avgStartingSalary && (
                              <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                <TrendingUp className="h-3 w-3" /> Avg Starting: {uni.avgStartingSalary}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Admission Predictor Tab */}
            {activeTab === "admission" && (
              <div className="space-y-6">
                {admissionLoading ? (
                  <div className="flex flex-col items-center gap-4 py-16">
                    <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
                    <p className="ivy-font font-bold text-foreground">Predicting admission chances...</p>
                  </div>
                ) : admission ? (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Gauge + Band */}
                    <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
                      <CardContent className="flex flex-col items-center gap-4 p-6">
                        <AdmissionGauge value={admission.overallChance} />
                        <div className={`rounded-full px-4 py-1.5 text-sm font-bold ${
                          admission.band === "High" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                          admission.band === "Medium" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
                          "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                        }`}>
                          {admission.band} Chance
                        </div>

                        {/* School distribution */}
                        <div className="mt-4 grid w-full grid-cols-3 gap-2 text-center">
                          <div className="rounded-xl bg-rose-500/10 p-3">
                            <p className="text-2xl font-black text-rose-500">{admission.reachSchools}</p>
                            <p className="text-[10px] font-bold text-muted-foreground">Reach</p>
                          </div>
                          <div className="rounded-xl bg-emerald-500/10 p-3">
                            <p className="text-2xl font-black text-emerald-500">{admission.matchSchools}</p>
                            <p className="text-[10px] font-bold text-muted-foreground">Match</p>
                          </div>
                          <div className="rounded-xl bg-sky-500/10 p-3">
                            <p className="text-2xl font-black text-sky-500">{admission.safeSchools}</p>
                            <p className="text-[10px] font-bold text-muted-foreground">Safe</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Factors */}
                    <Card className="border-border/40 bg-card/80 backdrop-blur-sm lg:col-span-2">
                      <CardHeader className="pb-3">
                        <CardTitle className="ivy-font text-lg font-extrabold text-foreground">Profile Factors</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {(admission.factors || []).map((f, i) => {
                          const color = f.score >= 70 ? "bg-emerald-500" : f.score >= 45 ? "bg-amber-500" : "bg-rose-500";
                          return (
                            <div key={i}>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-sm font-bold text-foreground">{f.name}</span>
                                <span className="text-sm font-black text-foreground">{f.score}/100</span>
                              </div>
                              <div className="h-2.5 w-full rounded-full bg-muted/30">
                                <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${f.score}%` }} />
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{f.insight}</p>
                            </div>
                          );
                        })}

                        {/* Tips */}
                        {admission.tips?.length > 0 && (
                          <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                            <p className="mb-2 text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                              <Zap className="inline h-3.5 w-3.5 mr-1" /> Improvement Tips
                            </p>
                            <ul className="space-y-1.5">
                              {admission.tips.map((tip, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                                  {tip}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-16 text-center">
                    <Target className="h-12 w-12 text-muted-foreground/40" />
                    <p className="text-muted-foreground">Click Explore to generate admission predictions</p>
                  </div>
                )}
              </div>
            )}

            {/* Career Paths Tab */}
            {activeTab === "careers" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {careerPaths.length > 0 ? careerPaths.map((cp, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <Card className="border-border/40 bg-card/80 backdrop-blur-sm transition-all hover:shadow-md">
                      <CardContent className="p-5">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15">
                          <Briefcase className="h-5 w-5 text-violet-500" />
                        </div>
                        <h3 className="ivy-font text-base font-black text-foreground">{cp.role}</h3>
                        <p className="mt-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">{cp.avgSalary}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{cp.growth}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                )) : (
                  <p className="text-muted-foreground col-span-full text-center py-12">No career data available</p>
                )}
              </div>
            )}

            {/* Timeline Tab */}
            {activeTab === "timeline" && (
              <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="ivy-font text-lg font-extrabold text-foreground flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-emerald-500" /> Application Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {timeline.length > 0 ? timeline.map((item, i) => {
                    const priorityStyle = item.priority === "high"
                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                      : item.priority === "medium"
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "bg-muted/30 text-muted-foreground";
                    return (
                      <div key={i} className="flex items-start gap-4 rounded-xl border border-border/30 bg-muted/10 px-5 py-4">
                        <div className="relative flex flex-col items-center">
                          <div className={`h-3 w-3 rounded-full ${
                            item.priority === "high" ? "bg-rose-500" : item.priority === "medium" ? "bg-amber-500" : "bg-muted-foreground"
                          }`} />
                          {i < timeline.length - 1 && <div className="mt-1.5 h-8 w-px bg-border/50" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="ivy-font text-xs font-bold text-muted-foreground">{item.month}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${priorityStyle}`}>{item.priority}</span>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-foreground">{item.action}</p>
                        </div>
                      </div>
                    );
                  }) : (
                    <p className="text-muted-foreground text-center py-12">No timeline data available</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Loan CTA */}
            <Card className="border-emerald-500/30 bg-linear-to-r from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/30 dark:to-teal-950/30">
              <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:text-left">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15">
                  <Landmark className="h-7 w-7 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <h3 className="ivy-font text-lg font-black text-foreground">Found your dream university?</h3>
                  <p className="ivy-font mt-1 text-sm text-muted-foreground">
                    Get personalised loan offers and EMI plans matched to your profile and chosen university.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => router.push("/dashboard/roi")}
                    variant="outline"
                    className="h-11 gap-2 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                  >
                    Calculate ROI
                  </Button>
                  <Button
                    onClick={() => router.push("/dashboard/loan")}
                    className="h-11 gap-2 bg-emerald-500 px-6 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600"
                  >
                    View Loan Offers <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
