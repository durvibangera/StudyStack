import { IEMIScenario } from '@/lib/models/LoanApplication';

export interface StudentProfile {
  gpa?: number;
  testScore?: string;
  targetCountries?: string[];
  targetProgram?: string;
  budgetINR?: number;
  familyIncomeINR?: number;
  hasCoApplicant?: boolean;
  completionPercent?: number;
}

export function adaptUserProfile(raw: Record<string, unknown>): StudentProfile {
  // Extract completion percent
  const profileFields = [
    raw.educationLevel, raw.fieldOfStudy, raw.institution,
    raw.gpa || raw.gpaPercentage, raw.testStatus, raw.testScore,
    raw.targetCountry || raw.targetCountries, raw.courseInterest, raw.intakeMonth || raw.intakeTiming,
    raw.budget || raw.budgetRange, raw.careerGoal || raw.primaryObjective,
  ];
  const filledCount = profileFields.filter(v => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)).length;
  const completionPercent = Math.round((filledCount / profileFields.length) * 100);

  let budgetStr = (raw.budget as string) || (raw.budgetRange as string) || '';
  let budgetINR = 0;
  if (budgetStr) {
    const lower = budgetStr.toLowerCase().replace(/[₹,]/g, '');
    const num = parseFloat(lower.replace(/[^\d.]/g, ''));
    if (!isNaN(num)) {
       if (lower.includes('crore') || lower.includes('cr')) budgetINR = num * 10000000;
       else if (lower.includes('lakh') || lower.includes('lac') || lower.includes('l')) budgetINR = num * 100000;
       else budgetINR = num * 100000;
    }
  }

  let gpaStr = (raw.gpa as string) || (raw.gpaPercentage as string) || '';
  let gpa = parseFloat(gpaStr);

  return {
    gpa: !isNaN(gpa) ? gpa : undefined,
    testScore: raw.testScore as string,
    targetCountries: Array.isArray(raw.targetCountry) ? raw.targetCountry : (Array.isArray(raw.targetCountries) ? raw.targetCountries : []),
    targetProgram: (raw.courseInterest as string) || (raw.fieldOfStudy as string),
    budgetINR: budgetINR > 0 ? budgetINR : undefined,
    completionPercent,
  };
}

export function computeEMIScenarios(
  principalINR: number,
  interestRatePercent: number,
  tenureMonths: number
): IEMIScenario[] {
  const r = interestRatePercent / 100 / 12; // Monthly rate

  function calcEMI(principal: number, rate: number, months: number): number {
    if (rate === 0) return principal / months;
    const factor = Math.pow(1 + rate, months);
    return Math.round(principal * rate * factor / (factor - 1));
  }

  const standardEMI = calcEMI(principalINR, r, tenureMonths);
  const standardTotalRepayable = standardEMI * tenureMonths;
  const standardTotalInterest = standardTotalRepayable - principalINR;

  const interestOnlyMonths = Math.min(24, tenureMonths);
  const interestOnlyEMI = Math.round(principalINR * r);
  const remainingMonths2 = Math.max(tenureMonths - interestOnlyMonths, 1);
  const fullEMI2 = calcEMI(principalINR, r, remainingMonths2);
  const totalRepayable2 = (interestOnlyEMI * interestOnlyMonths) + (fullEMI2 * remainingMonths2);
  const totalInterest2 = totalRepayable2 - principalINR;

  const moratoriumMonths = 6;
  const accruedPrincipal = Math.round(principalINR * Math.pow(1 + r, moratoriumMonths));
  const moratoriumEMI = calcEMI(accruedPrincipal, r, tenureMonths);
  const totalRepayable3 = moratoriumEMI * tenureMonths;
  const totalInterest3 = totalRepayable3 - principalINR;

  return [
    {
      label: 'Standard Repayment',
      principalINR,
      tenureMonths,
      interestRatePercent,
      monthlyEMI: standardEMI,
      totalRepayableINR: standardTotalRepayable,
      totalInterestINR: standardTotalInterest,
    },
    {
      label: 'Interest-Only During Study',
      principalINR,
      tenureMonths,
      interestRatePercent,
      monthlyEMI: interestOnlyMonths < tenureMonths ? fullEMI2 : interestOnlyEMI,
      totalRepayableINR: totalRepayable2,
      totalInterestINR: totalInterest2,
    },
    {
      label: 'Moratorium (6 months)',
      principalINR: accruedPrincipal,
      tenureMonths: tenureMonths + moratoriumMonths,
      interestRatePercent,
      monthlyEMI: moratoriumEMI,
      totalRepayableINR: totalRepayable3,
      totalInterestINR: totalInterest3,
    },
  ];
}

export function formatINR(amount: number): string {
  if (!amount) return '₹0';
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

// Eligibility and matching logic is now handled dynamically in the backend API
// using Exa AI and Gemini, rather than static arrays here.
