import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const POONAWALA_SCHEMES = {
  standard: {
    minRate: 11.25,
    maxRate: 13.5,
    processingFeeMin: 1,
    processingFeeMax: 2,
  },
  premium: {
    minRate: 10.5,
    maxRate: 12,
    processingFeeMin: 0.5,
    processingFeeMax: 1.5,
  },
  topup: {
    minRate: 12,
    maxRate: 14,
    processingFeeMin: 1,
    processingFeeMax: 2,
  },
};

function calculateEMI(principal, annualRate, months) {
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) return principal / months;
  return (
    (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
  );
}

function calculateTotalInterest(emi, months) {
  return emi * months - (emi * months) / (1 + 0.01); // Simplified
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentLoan, selectedScheme, proposedRate } = await request.json();
    if (!currentLoan || !selectedScheme || proposedRate === undefined) {
      return NextResponse.json(
        { error: 'Current loan, scheme, and proposed rate required' },
        { status: 400 }
      );
    }

    const { outstandingBalance, interestRate, currentEMI, remainingTenure } = currentLoan;
    const scheme = POONAWALA_SCHEMES[selectedScheme];
    if (!scheme) {
      return NextResponse.json({ error: 'Invalid scheme' }, { status: 400 });
    }

    // Calculate current loan total interest
    const currentTotalInterest = currentEMI * remainingTenure - outstandingBalance;

    // Calculate Poonawala loan details
    const processingFee = outstandingBalance * ((scheme.processingFeeMin + scheme.processingFeeMax) / 2 / 100);
    const loanAmountAfterFee = outstandingBalance + processingFee;
    const proposedEMI = calculateEMI(loanAmountAfterFee, proposedRate, remainingTenure);
    const proposedTotalInterest = proposedEMI * remainingTenure - loanAmountAfterFee;

    // Calculate savings
    const monthlyEMISavings = currentEMI - proposedEMI;
    const totalInterestSavings = currentTotalInterest - proposedTotalInterest;
    const breakEvenMonths = processingFee > 0 ? Math.ceil(processingFee / Math.max(monthlyEMISavings, 1)) : 0;
    const netSavings = totalInterestSavings - processingFee;

    // Generate repayment schedule
    const repaymentSchedule = [];
    let remainingBalance = loanAmountAfterFee;
    for (let month = 1; month <= remainingTenure; month++) {
      const interestPayment = remainingBalance * (proposedRate / 12 / 100);
      const principalPayment = proposedEMI - interestPayment;
      remainingBalance -= principalPayment;
      repaymentSchedule.push({
        month,
        emi: proposedEMI,
        principal: principalPayment,
        interest: interestPayment,
        balance: Math.max(0, remainingBalance),
      });
    }

    return NextResponse.json({
      currentLoan: {
        emi: currentEMI,
        totalInterest: currentTotalInterest,
        remainingTenure,
      },
      proposedLoan: {
        interestRate: proposedRate,
        emi: proposedEMI,
        totalInterest: proposedTotalInterest,
        processingFee,
        tenure: remainingTenure,
      },
      savings: {
        monthlyEMISavings,
        totalInterestSavings,
        breakEvenMonths,
        netSavings,
      },
      repaymentSchedule: repaymentSchedule.slice(0, 12), // First 12 months
    });
  } catch (err) {
    console.error('[loan/calculate-savings] Error:', err);
    return NextResponse.json(
      { error: 'Failed to calculate savings', details: err.message },
      { status: 500 }
    );
  }
}
