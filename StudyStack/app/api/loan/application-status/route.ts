import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { z } from 'zod';
import dbConnect from '@/lib/mongodb';
import LoanApplication from '@/lib/models/LoanApplication';
import { logAuditEvent } from '@/lib/audit-logger';
import type { IDocumentItem } from '@/lib/models/LoanApplication';

const patchBodySchema = z.object({
  applicationStatus: z.enum(['not_started', 'docs_pending', 'submitted', 'under_review', 'approved', 'disbursed']).optional(),
  selectedLender: z.string().optional(),
  documentStatus: z.object({
    documentName: z.string(),
    status: z.enum(['pending', 'uploaded', 'verified']),
  }).optional(),
});

export async function PATCH(request: Request) {
  const startTime = Date.now();

  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 }
      );
    }

    await dbConnect();
    const loanApp = await LoanApplication.findOne({ userId: session.user.id });
    if (!loanApp) {
      return NextResponse.json({ error: 'No loan application found. Please compute eligibility first.' }, { status: 404 });
    }

    const { applicationStatus, selectedLender, documentStatus } = parsed.data;

    // Update application status
    if (applicationStatus) {
      loanApp.applicationStatus = applicationStatus;
    }

    // Update selected lender and regenerate document checklist
    if (selectedLender) {
      loanApp.selectedLender = selectedLender;

      // Filter catalogue for this lender, preserving existing statuses
      const existingChecklist = (loanApp.documentChecklist || []) as IDocumentItem[];
      
      // We don't overwrite with a hardcoded list anymore.
      // The frontend uses the existing DB list.
      // Just mark it as modified.
      loanApp.markModified('documentChecklist');
    }

    // Update a specific document's status
    if (documentStatus) {
      const checklist = loanApp.documentChecklist as IDocumentItem[];
      const docIndex = checklist.findIndex(item => item.name === documentStatus.documentName);
      if (docIndex !== -1) {
        checklist[docIndex].status = documentStatus.status;
        loanApp.documentChecklist = checklist;
        loanApp.markModified('documentChecklist');
      }
    }

    await loanApp.save();

    // Audit log
    logAuditEvent({
      request,
      session,
      action: 'loan.application.status_updated',
      metadata: { applicationStatus, selectedLender },
      startTime,
    }).catch(() => {});

    return NextResponse.json(loanApp.toObject());

  } catch (err) {
    console.error('[Loan Application Status] Error:', err);
    return NextResponse.json(
      { error: 'Failed to update application status', details: (err as Error).message },
      { status: 500 }
    );
  }
}

// GET route for the ApplicationStatusTracker component
export async function GET(request: Request) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const loanApp = await LoanApplication.findOne({ userId: session.user.id }).lean();

    if (!loanApp) {
      return NextResponse.json({
        applicationStatus: 'not_started',
        selectedLender: null,
      });
    }

    return NextResponse.json({
      applicationStatus: loanApp.applicationStatus,
      selectedLender: loanApp.selectedLender,
    });

  } catch (err) {
    console.error('[Loan Application Status GET] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch application status', details: (err as Error).message },
      { status: 500 }
    );
  }
}
