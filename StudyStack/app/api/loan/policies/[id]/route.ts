import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import LenderPolicy from '@/lib/models/LenderPolicy';

/* ────────────────────────────────────────────────────────────────────────────
 *  GET    /api/loan/policies/[id] — Get single policy details
 *  PUT    /api/loan/policies/[id] — Edit extracted policy fields
 *  DELETE /api/loan/policies/[id] — Delete a policy
 * ──────────────────────────────────────────────────────────────────────────── */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;
    const policy = await LenderPolicy.findById(id).lean();

    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    // Students can only see active policies
    if (session.user.role !== 'counsellor' && (policy as any).status !== 'active') {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    return NextResponse.json({ policy });
  } catch (error) {
    console.error('[loan-policy GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch policy', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'counsellor') {
      return NextResponse.json({ error: 'Only counsellors can edit policies' }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;
    const policy = await LenderPolicy.findById(id);

    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    const body = await request.json();
    const { lenderName, productName, extractedPolicies } = body;

    if (lenderName) policy.lenderName = lenderName;
    if (productName) policy.productName = productName;
    if (extractedPolicies) {
      // Deep merge the extracted policies
      const existing = policy.extractedPolicies?.toObject?.() || policy.extractedPolicies || {};
      policy.extractedPolicies = {
        ...existing,
        ...extractedPolicies,
        eligibility: { ...(existing.eligibility || {}), ...(extractedPolicies.eligibility || {}) },
        financial: { ...(existing.financial || {}), ...(extractedPolicies.financial || {}) },
        repayment: { ...(existing.repayment || {}), ...(extractedPolicies.repayment || {}) },
        restrictions: { ...(existing.restrictions || {}), ...(extractedPolicies.restrictions || {}) },
        documents: extractedPolicies.documents || existing.documents || [],
      } as any;
      policy.markModified('extractedPolicies');
    }

    await policy.save();

    return NextResponse.json({
      success: true,
      policy: {
        _id: policy._id,
        lenderName: policy.lenderName,
        productName: policy.productName,
        status: policy.status,
        extractedPolicies: policy.extractedPolicies,
      },
    });
  } catch (error) {
    console.error('[loan-policy PUT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update policy', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'counsellor') {
      return NextResponse.json({ error: 'Only counsellors can delete policies' }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;
    const policy = await LenderPolicy.findByIdAndDelete(id);

    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('[loan-policy DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete policy', details: (error as Error).message },
      { status: 500 }
    );
  }
}
