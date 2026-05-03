"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calculator, ArrowRight, TrendingUp, DollarSign, GraduationCap,
  Globe, Clock, Landmark, ChevronRight, Sparkles, IndianRupee,
  ArrowLeft,
} from "lucide-react";

// ── Country presets ──────────────────────────────────────────────────────────
const COUNTRY_PRESETS = {
  US:      { label: "United States", tuition: 4500000, living: 1800000, currency: "USD", avgSalaryY1: 7500000, avgSalaryY3: 11000000, avgSalaryY5: 15000000 },
  UK:      { label: "United Kingdom", tuition: 3200000, living: 1500000, currency: "GBP", avgSalaryY1: 5000000, avgSalaryY3: 7500000, avgSalaryY5: 10000000 },
  Canada:  { label: "Canada", tuition: 2800000, living: 1200000, currency: "CAD", avgSalaryY1: 5500000, avgSalaryY3: 8000000, avgSalaryY5: 11000000 },
  Germany: { label: "Germany", tuition: 500000, living: 1000000, currency: "EUR", avgSalaryY1: 4500000, avgSalaryY3: 7000000, avgSalaryY5: 9500000 },
  Australia: { label: "Australia", tuition: 3500000, living: 1400000, currency: "AUD", avgSalaryY1: 5500000, avgSalaryY3: 8500000, avgSalaryY5: 12000000 },
  India:   { label: "India (Domestic)", tuition: 800000, living: 400000, currency: "INR", avgSalaryY1: 1200000, avgSalaryY3: 2500000, avgSalaryY5: 4500000 },
};

const PROGRAM_MULTIPLIERS = {
  "Computer Science / IT": 1.2,
  "Data Science / AI": 1.25,
  "MBA / Business": 1.3,
  "Engineering": 1.05,
  "Finance / Accounting": 1.15,
  "Healthcare / Medicine": 1.1,
  "Arts / Humanities": 0.85,
  "Law": 1.1,
  "Other": 1.0,
};

function formatINR(val) {
  if (!val || val === 0) return "₹0";
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
  return `₹${val.toLocaleString("en-IN")}`;
}

function SliderInput({ label, value, onChange, min, max, step, format, icon: Icon, color }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center gap-2 ${color}`}>
          <Icon className="h-4 w-4" />
          <span className="ivy-font text-xs font-black uppercase tracking-widest">{label}</span>
        </div>
        <span className="ivy-font text-sm font-black text-foreground">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted/30 accent-emerald-500"
      />
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">{format(min)}</span>
        <span className="text-[10px] text-muted-foreground">{format(max)}</span>
      </div>
    </div>
  );
}

export default function ROICalculatorPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Inputs
  const [country, setCountry] = useState("US");
  const [program, setProgram] = useState("Computer Science / IT");
  const [tuition, setTuition] = useState(COUNTRY_PRESETS.US.tuition);
  const [living, setLiving] = useState(COUNTRY_PRESETS.US.living);
  const [duration, setDuration] = useState(2);
  const [loanPercent, setLoanPercent] = useState(80);
  const [interestRate, setInterestRate] = useState(9.5);
  const [tenureYears, setTenureYears] = useState(10);
  const [scholarshipPercent, setScholarshipPercent] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  // Sync presets when country changes
  useEffect(() => {
    const preset = COUNTRY_PRESETS[country];
    if (preset) {
      setTuition(preset.tuition);
      setLiving(preset.living);
    }
  }, [country]);

  const calc = useMemo(() => {
    const preset = COUNTRY_PRESETS[country];
    const mult = PROGRAM_MULTIPLIERS[program] || 1;

    const totalTuition = tuition * duration;
    const totalLiving = living * duration;
    const scholarshipAmount = Math.round(totalTuition * (scholarshipPercent / 100));
    const totalCost = totalTuition + totalLiving - scholarshipAmount;

    const loanAmount = Math.round(totalCost * (loanPercent / 100));
    const selfFunding = totalCost - loanAmount;

    // EMI calculation
    const r = interestRate / 100 / 12;
    const n = tenureYears * 12;
    const emi = r > 0
      ? Math.round(loanAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1))
      : Math.round(loanAmount / n);
    const totalRepayable = emi * n;
    const totalInterest = totalRepayable - loanAmount;

    // Salary projections (with program multiplier)
    const salaryY1 = Math.round(preset.avgSalaryY1 * mult);
    const salaryY3 = Math.round(preset.avgSalaryY3 * mult);
    const salaryY5 = Math.round(preset.avgSalaryY5 * mult);

    // Cumulative earnings over 5 years (linear interpolation)
    const cumulativeEarnings5Y = Math.round(
      salaryY1 + // Year 1
      (salaryY1 + salaryY3) / 2 + // Year 2
      salaryY3 + // Year 3
      (salaryY3 + salaryY5) / 2 + // Year 4
      salaryY5 // Year 5
    );

    // Payback period (months to recoup total cost from salary)
    const avgMonthlySalary = salaryY1 / 12;
    const avgMonthlyExpense = avgMonthlySalary * 0.5; // assume 50% living expense
    const monthlySavings = avgMonthlySalary - avgMonthlyExpense;
    const paybackMonths = monthlySavings > 0 ? Math.ceil(totalCost / monthlySavings) : 999;

    // ROI percentage
    const roi = totalCost > 0 ? Math.round(((cumulativeEarnings5Y - totalCost) / totalCost) * 100) : 0;

    // Net worth trajectory (year by year)
    const trajectory = [];
    let cumEarnings = 0;
    let cumLoanPaid = 0;
    for (let y = 0; y <= 7; y++) {
      if (y <= duration) {
        // During study
        const yearCost = (tuition + living - Math.round(scholarshipAmount / duration)) * Math.min(1, y > 0 ? 1 : 0);
        trajectory.push({
          year: y === 0 ? "Start" : `Y${y} (Study)`,
          cost: -(yearCost),
          earnings: 0,
          netWorth: -(yearCost * y),
        });
      } else {
        const workYear = y - duration;
        const salary = workYear === 1 ? salaryY1 : workYear <= 3 ? salaryY3 : salaryY5;
        cumEarnings += salary;
        const yearEMI = Math.min(emi * 12, totalRepayable - cumLoanPaid);
        cumLoanPaid += yearEMI;
        trajectory.push({
          year: `Y${workYear} (Work)`,
          cost: -yearEMI,
          earnings: salary,
          netWorth: cumEarnings - totalCost - totalInterest + (totalRepayable - cumLoanPaid > 0 ? 0 : cumLoanPaid - totalRepayable),
        });
      }
    }

    // Cost breakdown for bar chart
    const costBreakdown = [
      { name: "Tuition", value: totalTuition },
      { name: "Living", value: totalLiving },
      { name: "Interest", value: totalInterest },
    ];
    if (scholarshipAmount > 0) {
      costBreakdown.push({ name: "Scholarship", value: -scholarshipAmount });
    }

    // Salary comparison chart
    const salaryComparison = [
      { year: "Year 1", salary: salaryY1, emi: emi * 12 },
      { year: "Year 3", salary: salaryY3, emi: emi * 12 },
      { year: "Year 5", salary: salaryY5, emi: Math.min(emi * 12, Math.max(0, totalRepayable - emi * 12 * 4)) },
    ];

    return {
      totalCost, loanAmount, selfFunding, scholarshipAmount,
      emi, totalRepayable, totalInterest,
      salaryY1, salaryY3, salaryY5,
      paybackMonths, roi, cumulativeEarnings5Y,
      trajectory, costBreakdown, salaryComparison,
    };
  }, [country, program, tuition, living, duration, loanPercent, interestRate, tenureYears, scholarshipPercent]);

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
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </button>
            <h1 className="ivy-font text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              ROI Calculator
            </h1>
            <p className="ivy-font mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Predict your return on education investment. Compare costs, salaries, and loan repayment across countries and programs.
            </p>
          </div>
          <Button
            onClick={() => router.push('/dashboard/loan')}
            className="h-11 gap-2 bg-emerald-500 px-6 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600"
          >
            <Landmark className="h-4 w-4" /> Get Loan Offers <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">

          {/* ── Left: Input Controls ── */}
          <div className="space-y-6 lg:col-span-1">
            <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="ivy-font flex items-center gap-2 text-lg font-extrabold text-foreground">
                  <Calculator className="h-5 w-5 text-emerald-500" /> Configure
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Country */}
                <div>
                  <label className="ivy-font mb-2 block text-xs font-black uppercase tracking-widest text-muted-foreground">
                    <Globe className="mr-1.5 inline h-3.5 w-3.5 text-sky-500" />Target Country
                  </label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full rounded-xl border border-border/50 bg-muted/20 px-4 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {Object.entries(COUNTRY_PRESETS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>

                {/* Program */}
                <div>
                  <label className="ivy-font mb-2 block text-xs font-black uppercase tracking-widest text-muted-foreground">
                    <GraduationCap className="mr-1.5 inline h-3.5 w-3.5 text-violet-500" />Program
                  </label>
                  <select
                    value={program}
                    onChange={(e) => setProgram(e.target.value)}
                    className="w-full rounded-xl border border-border/50 bg-muted/20 px-4 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {Object.keys(PROGRAM_MULTIPLIERS).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Duration */}
                <SliderInput
                  label="Program Duration" icon={Clock} color="text-amber-500"
                  value={duration} onChange={setDuration}
                  min={1} max={4} step={0.5}
                  format={(v) => `${v} year${v !== 1 ? 's' : ''}`}
                />

                {/* Tuition */}
                <SliderInput
                  label="Annual Tuition" icon={IndianRupee} color="text-rose-500"
                  value={tuition} onChange={setTuition}
                  min={100000} max={8000000} step={100000}
                  format={formatINR}
                />

                {/* Living Cost */}
                <SliderInput
                  label="Annual Living Cost" icon={DollarSign} color="text-sky-500"
                  value={living} onChange={setLiving}
                  min={200000} max={4000000} step={50000}
                  format={formatINR}
                />

                {/* Scholarship */}
                <SliderInput
                  label="Scholarship Coverage" icon={Sparkles} color="text-violet-500"
                  value={scholarshipPercent} onChange={setScholarshipPercent}
                  min={0} max={100} step={5}
                  format={(v) => `${v}%`}
                />

                <hr className="border-border/30" />

                {/* Loan Percent */}
                <SliderInput
                  label="Loan Coverage" icon={Landmark} color="text-emerald-500"
                  value={loanPercent} onChange={setLoanPercent}
                  min={0} max={100} step={5}
                  format={(v) => `${v}%`}
                />

                {/* Interest Rate */}
                <SliderInput
                  label="Interest Rate (p.a.)" icon={TrendingUp} color="text-amber-500"
                  value={interestRate} onChange={setInterestRate}
                  min={6} max={16} step={0.25}
                  format={(v) => `${v}%`}
                />

                {/* Tenure */}
                <SliderInput
                  label="Repayment Tenure" icon={Clock} color="text-indigo-500"
                  value={tenureYears} onChange={setTenureYears}
                  min={3} max={20} step={1}
                  format={(v) => `${v} years`}
                />
              </CardContent>
            </Card>
          </div>

          {/* ── Right: Results ── */}
          <div className="space-y-6 lg:col-span-2">

            {/* KPI Row */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              {[
                { label: "Total Cost", value: formatINR(calc.totalCost), color: "text-rose-500", border: "border-rose-500/30", bg: "bg-rose-500/5" },
                { label: "Monthly EMI", value: formatINR(calc.emi), color: "text-amber-500", border: "border-amber-500/30", bg: "bg-amber-500/5" },
                { label: "5-Year ROI", value: `${calc.roi}%`, color: calc.roi >= 100 ? "text-emerald-500" : "text-amber-500", border: calc.roi >= 100 ? "border-emerald-500/30" : "border-amber-500/30", bg: calc.roi >= 100 ? "bg-emerald-500/5" : "bg-amber-500/5" },
                { label: "Payback", value: calc.paybackMonths < 999 ? `${Math.round(calc.paybackMonths / 12)} yrs` : "N/A", color: "text-violet-500", border: "border-violet-500/30", bg: "bg-violet-500/5" },
              ].map(({ label, value, color, border, bg }) => (
                <div key={label} className={`rounded-2xl border ${border} ${bg} p-4 backdrop-blur-sm`}>
                  <p className="ivy-font text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                  <p className={`ivy-font mt-1.5 text-2xl font-black ${color}`}>{value}</p>
                </div>
              ))}
            </motion.div>

            {/* Detailed Breakdown */}
            <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <h3 className="ivy-font mb-5 text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Financial Breakdown
                </h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {[
                    { label: "Total Tuition", value: formatINR(calc.totalCost - calc.totalCost + tuition * duration), color: "text-rose-500" },
                    { label: "Total Living", value: formatINR(living * duration), color: "text-sky-500" },
                    { label: "Scholarship", value: calc.scholarshipAmount > 0 ? `-${formatINR(calc.scholarshipAmount)}` : "—", color: "text-violet-500" },
                    { label: "Loan Amount", value: formatINR(calc.loanAmount), color: "text-emerald-500" },
                    { label: "Self Funding", value: formatINR(calc.selfFunding), color: "text-amber-500" },
                    { label: "Total Interest", value: formatINR(calc.totalInterest), color: "text-rose-500" },
                    { label: "Total Repayable", value: formatINR(calc.totalRepayable), color: "text-foreground" },
                    { label: "Year 1 Salary", value: formatINR(calc.salaryY1), color: "text-emerald-500" },
                    { label: "Year 5 Salary", value: formatINR(calc.salaryY5), color: "text-emerald-600 dark:text-emerald-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl border border-border/30 bg-muted/10 p-3.5">
                      <p className="ivy-font text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                      <p className={`ivy-font mt-1 text-lg font-black ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Charts */}
            {mounted && (
              <>
                {/* Salary vs EMI */}
                <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="ivy-font text-lg font-extrabold text-foreground">Salary vs EMI Comparison</CardTitle>
                    <p className="ivy-font text-xs text-muted-foreground">Annual salary compared to loan repayment</p>
                  </CardHeader>
                  <CardContent className="pb-5">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={calc.salaryComparison} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                        <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted-foreground)", fontWeight: 700 }} />
                        <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
                        <Tooltip
                          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 13, fontWeight: 700 }}
                          formatter={(v) => [formatINR(v)]}
                        />
                        <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
                        <Bar dataKey="salary" name="Annual Salary" fill="#10b981" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="emi" name="Annual EMI" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Cost Breakdown */}
                <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="ivy-font text-lg font-extrabold text-foreground">Cost Breakdown</CardTitle>
                    <p className="ivy-font text-xs text-muted-foreground">Where your money goes</p>
                  </CardHeader>
                  <CardContent className="pb-5">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={calc.costBreakdown} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                        <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => formatINR(Math.abs(v))} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "var(--muted-foreground)", fontWeight: 700 }} width={80} />
                        <Tooltip
                          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 13 }}
                          formatter={(v) => [formatINR(Math.abs(v))]}
                        />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            )}

            {/* CTA */}
            <Card className="border-emerald-500/30 bg-linear-to-r from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/30 dark:to-teal-950/30">
              <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:text-left">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15">
                  <Landmark className="h-7 w-7 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <h3 className="ivy-font text-lg font-black text-foreground">Ready to finance your education?</h3>
                  <p className="ivy-font mt-1 text-sm text-muted-foreground">
                    Get AI-matched loan offers based on your profile and compare lenders in real-time.
                  </p>
                </div>
                <Button
                  onClick={() => router.push('/dashboard/loan')}
                  className="h-12 gap-2 bg-emerald-500 px-8 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600"
                >
                  View Loan Offers <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}
