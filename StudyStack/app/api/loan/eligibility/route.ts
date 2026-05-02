import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import LoanApplication from '@/lib/models/LoanApplication';

export async function POST(request: Request) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const existingApp = await LoanApplication.findOne({ userId: session.user.id }).lean();

    return NextResponse.json({
      eligibilityScore: existingApp?.eligibilityScore || 0,
      eligibilityBand: existingApp?.eligibilityBand || 'Not Eligible',
      eligibilityNarrative: existingApp?.eligibilityNarrative || 'Run a loan search to compute eligibility.',
      scoreBreakdown: existingApp?.scoreBreakdown || {},
    });

  } catch (err) {
    console.error('[Loan Eligibility] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch eligibility', details: (err as Error).message },
      { status: 500 }
    );
  }
}
