import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import LoanApplication from '@/lib/models/LoanApplication';
import { logAuditEvent } from '@/lib/audit-logger';

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const existingApp = await LoanApplication.findOne({ userId: session.user.id }).lean();

    const offers = existingApp?.matchedOffers || [];

    // Audit log
    logAuditEvent({
      request,
      session,
      action: 'loan.offers.viewed',
      metadata: { offerCount: offers.length },
      startTime,
    }).catch(() => {});

    return NextResponse.json({ offers });

  } catch (err) {
    console.error('[Loan Offers] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch loan offers', details: (err as Error).message },
      { status: 500 }
    );
  }
}
