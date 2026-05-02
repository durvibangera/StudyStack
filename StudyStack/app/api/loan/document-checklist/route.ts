import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import LoanApplication from '@/lib/models/LoanApplication';
import type { IDocumentItem } from '@/lib/models/LoanApplication';

export async function GET(request: Request) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lenderFilter = searchParams.get('lender');

    await dbConnect();
    const loanApp = await LoanApplication.findOne({ userId: session.user.id }).lean();

    let checklist: IDocumentItem[];
    let selectedLender: string | null = null;

    if (loanApp && loanApp.documentChecklist && loanApp.documentChecklist.length > 0) {
      // Return persisted checklist (preserves uploaded/verified statuses)
      checklist = loanApp.documentChecklist as IDocumentItem[];
      selectedLender = (loanApp.selectedLender as string) || null;
    } else {
      // Empty if no AI analysis has run yet
      checklist = [];
    }

    // Filter by lender if specified
    if (lenderFilter) {
      checklist = checklist.filter(item => item.lenders.includes(lenderFilter));
    }

    return NextResponse.json({ checklist, selectedLender });

  } catch (err) {
    console.error('[Loan Document Checklist] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch document checklist', details: (err as Error).message },
      { status: 500 }
    );
  }
}
