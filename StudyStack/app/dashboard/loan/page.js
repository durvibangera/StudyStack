"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingDown, DollarSign, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";

export default function LoanTransferPage() {
  const { data: session } = useSession();
  const [step, setStep] = useState("input"); // input | eligibility | comparison | application
  const [loading, setLoading] = useState(false);

  // Current Loan Form
  const [currentLoan, setCurrentLoan] = useState({
    lenderName: "",
    outstandingBalance: "",
    interestRate: "",
    currentEMI: "",
    remainingTenure: "",
  });

  // Eligibility & Schemes
  const [eligibility, setEligibility] = useState(null);
  const [selectedScheme, setSelectedScheme] = useState(null);

  // Savings Calculation
  const [savings, setSavings] = useState(null);
  const [proposedRate, setProposedRate] = useState(null);

  // Applications History
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchApplications();
    }
  }, [session]);

  const fetchApplications = async () => {
    try {
      const res = await fetch("/api/loan/apply");
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.error("Failed to fetch applications:", err);
    }
  };

  const handleCheckEligibility = async () => {
    if (!currentLoan.lenderName || !currentLoan.outstandingBalance || !currentLoan.interestRate || !currentLoan.currentEMI || !currentLoan.remainingTenure) {
      toast.error("Please fill all loan details");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/loan/eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentLoan }),
      });

      if (!res.ok) throw new Error("Failed to check eligibility");

      const data = await res.json();
      setEligibility(data.eligibility);

      if (data.eligibility.isEligible) {
        setSelectedScheme(data.eligibility.eligibleSchemes[0]);
        setProposedRate(data.schemes[data.eligibility.eligibleSchemes[0]].minRate);
        setStep("comparison");
        toast.success("You are eligible! Let's compare options.");
      } else {
        toast.error(data.eligibility.blockers[0] || "Not eligible for transfer");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateSavings = async () => {
    if (!selectedScheme || proposedRate === null) {
      toast.error("Please select a scheme and rate");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/loan/calculate-savings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentLoan,
          selectedScheme,
          proposedRate,
        }),
      });

      if (!res.ok) throw new Error("Failed to calculate savings");

      const data = await res.json();
      setSavings(data);
      toast.success("Savings calculated!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!savings) {
      toast.error("Please calculate savings first");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/loan/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentLoan,
          selectedScheme,
          proposedRate,
          monthlyEMISavings: savings.savings.monthlyEMISavings,
          totalInterestSavings: savings.savings.totalInterestSavings,
          breakEvenMonths: savings.savings.breakEvenMonths,
          netSavings: savings.savings.netSavings,
          processingFee: savings.proposedLoan.processingFee,
          proposedEMI: savings.proposedLoan.emi,
          proposedTenure: savings.proposedLoan.tenure,
          totalInterestPayable: savings.proposedLoan.totalInterest,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit application");

      const data = await res.json();
      toast.success("Application submitted successfully!");
      setStep("input");
      setCurrentLoan({
        lenderName: "",
        outstandingBalance: "",
        interestRate: "",
        currentEMI: "",
        remainingTenure: "",
      });
      setSavings(null);
      setEligibility(null);
      fetchApplications();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-foreground mb-2">Loan Transferability</h1>
          <p className="text-muted-foreground">Switch to Poonawala FinCorp for better rates and lower EMI</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {step === "input" && (
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <CardTitle>Your Current Loan Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Current Lender</label>
                      <input
                        type="text"
                        placeholder="e.g., HDFC Bank"
                        value={currentLoan.lenderName}
                        onChange={(e) => setCurrentLoan({ ...currentLoan, lenderName: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Outstanding Balance (₹)</label>
                      <input
                        type="number"
                        placeholder="e.g., 5000000"
                        value={currentLoan.outstandingBalance}
                        onChange={(e) => setCurrentLoan({ ...currentLoan, outstandingBalance: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Interest Rate (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g., 12.5"
                        value={currentLoan.interestRate}
                        onChange={(e) => setCurrentLoan({ ...currentLoan, interestRate: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Current EMI (₹)</label>
                      <input
                        type="number"
                        placeholder="e.g., 50000"
                        value={currentLoan.currentEMI}
                        onChange={(e) => setCurrentLoan({ ...currentLoan, currentEMI: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium mb-1">Remaining Tenure (months)</label>
                      <input
                        type="number"
                        placeholder="e.g., 120"
                        value={currentLoan.remainingTenure}
                        onChange={(e) => setCurrentLoan({ ...currentLoan, remainingTenure: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleCheckEligibility}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Check Eligibility
                  </Button>
                </CardContent>
              </Card>
            )}

            {step === "comparison" && eligibility && (
              <div className="space-y-6">
                {/* Eligibility Status */}
                <Card className={eligibility.isEligible ? "border-green-200 dark:border-green-800" : "border-red-200 dark:border-red-800"}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {eligibility.isEligible ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      Eligibility Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2">Score: {eligibility.eligibilityScore}/100</p>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${eligibility.eligibilityScore}%` }}
                        />
                      </div>
                    </div>

                    {eligibility.reasons.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">✓ Strengths:</p>
                        <ul className="text-sm space-y-1">
                          {eligibility.reasons.map((reason, i) => (
                            <li key={i} className="text-green-700 dark:text-green-400">
                              • {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {eligibility.blockers.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">✗ Blockers:</p>
                        <ul className="text-sm space-y-1">
                          {eligibility.blockers.map((blocker, i) => (
                            <li key={i} className="text-red-700 dark:text-red-400">
                              • {blocker}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Scheme Selection */}
                {eligibility.eligibleSchemes.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Select Poonawala Scheme</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {eligibility.eligibleSchemes.map((scheme) => (
                        <div
                          key={scheme}
                          onClick={() => {
                            setSelectedScheme(scheme);
                            setProposedRate(
                              scheme === "premium"
                                ? 10.5
                                : scheme === "standard"
                                ? 11.25
                                : 12
                            );
                          }}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                            selectedScheme === scheme
                              ? "border-blue-600 bg-blue-50 dark:bg-blue-950"
                              : "border-slate-200 dark:border-slate-800 hover:border-blue-400"
                          }`}
                        >
                          <p className="font-semibold capitalize">{scheme} Scheme</p>
                          <p className="text-sm text-muted-foreground">
                            {scheme === "premium"
                              ? "10.5% - 12% p.a."
                              : scheme === "standard"
                              ? "11.25% - 13.5% p.a."
                              : "12% - 14% p.a."}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Interest Rate Slider */}
                {selectedScheme && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Proposed Interest Rate</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{proposedRate}% p.a.</p>
                        <input
                          type="range"
                          min={selectedScheme === "premium" ? 10.5 : selectedScheme === "standard" ? 11.25 : 12}
                          max={selectedScheme === "premium" ? 12 : selectedScheme === "standard" ? 13.5 : 14}
                          step="0.1"
                          value={proposedRate}
                          onChange={(e) => setProposedRate(parseFloat(e.target.value))}
                          className="w-full mt-2"
                        />
                      </div>

                      <Button
                        onClick={handleCalculateSavings}
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Calculate Savings
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {step === "comparison" && savings && (
              <Card>
                <CardHeader>
                  <CardTitle>Savings Comparison</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Current vs Proposed */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Current Loan</p>
                      <p className="text-2xl font-bold">₹{parseFloat(currentLoan.currentEMI).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">Monthly EMI @ {currentLoan.interestRate}%</p>
                    </div>
                    <div className="p-4 bg-green-100 dark:bg-green-900 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Poonawala Loan</p>
                      <p className="text-2xl font-bold">₹{Math.round(savings.proposedLoan.emi).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">Monthly EMI @ {proposedRate}%</p>
                    </div>
                  </div>

                  {/* Savings Highlights */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="h-5 w-5 text-green-600" />
                        <p className="text-sm font-medium">Monthly Savings</p>
                      </div>
                      <p className="text-2xl font-bold text-green-600">₹{Math.round(savings.savings.monthlyEMISavings).toLocaleString()}</p>
                    </div>
                    <div className="p-4 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-5 w-5 text-blue-600" />
                        <p className="text-sm font-medium">Total Interest Savings</p>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">₹{Math.round(savings.savings.totalInterestSavings).toLocaleString()}</p>
                    </div>
                    <div className="p-4 border border-purple-200 dark:border-purple-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-5 w-5 text-purple-600" />
                        <p className="text-sm font-medium">Break-Even</p>
                      </div>
                      <p className="text-2xl font-bold text-purple-600">{savings.savings.breakEvenMonths} months</p>
                    </div>
                  </div>

                  <Button
                    onClick={handleApply}
                    disabled={loading}
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-6"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Apply for Loan Transfer
                  </Button>

                  <Button
                    onClick={() => {
                      setStep("input");
                      setSavings(null);
                      setEligibility(null);
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Back
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Applications History */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Applications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {applications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No applications yet</p>
                ) : (
                  applications.map((app) => (
                    <div key={app._id} className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm">{app.selectedScheme}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          app.status === 'approved'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : app.status === 'rejected'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        }`}>
                          {app.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Savings: ₹{Math.round(app.savings.netSavings).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
