import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import LoanTransfer from '@/lib/models/LoanTransfer';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      currentLoan,
      selectedScheme,
      proposedRate,
      monthlyEMISavings,
      totalInterestSavings,
      breakEvenMonths,
      netSavings,
      processingFee,
      proposedEMI,
      proposedTenure,
      totalInterestPayable,
    } = await request.json();

    if (!currentLoan || !selectedScheme) {
      return NextResponse.json(
        { error: 'Current loan and scheme required' },
        { status: 400 }
      );
    }

    await dbConnect();

    const loanTransfer = new LoanTransfer({
      userId: session.user.id,
      currentLoan,
      selectedScheme,
      poonawalaLoan: {
        proposedInterestRate: proposedRate,
        proposedEMI,
        proposedTenure,
        processingFee,
        totalInterestPayable,
      },
      savings: {
        monthlyEMISavings,
        totalInterestSavings,
        breakEvenMonths,
        netSavings,
      },
      status: 'draft',
    });

    await loanTransfer.save();

    return NextResponse.json({
      success: true,
      applicationId: loanTransfer._id,
      message: 'Loan transfer application created',
    });
  } catch (err) {
    console.error('[loan/apply] Error:', err);
    return NextResponse.json(
      { error: 'Failed to create application', details: err.message },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const applications = await LoanTransfer.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      applications,
    });
  } catch (err) {
    console.error('[loan/apply GET] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch applications', details: err.message },
      { status: 500 }
    );
  }
}
