import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import LenderPolicy from '@/lib/models/LenderPolicy';

/* ────────────────────────────────────────────────────────────────────────────
 *  GET  /api/loan/policies — List all policies (optionally filtered by status)
 *  PATCH /api/loan/policies — Activate or deactivate a policy
 * ──────────────────────────────────────────────────────────────────────────── */

export async function GET(request: Request) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    const query: any = {};
    // Counsellors see all; students only see active
    if (session.user.role !== 'counsellor') {
      query.status = 'active';
    } else if (statusFilter) {
      query.status = statusFilter;
    }

    const policies = await LenderPolicy.find(query)
      .select('-rawExtractedText') // Don't send full raw text in list view
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({ policies });
  } catch (error) {
    console.error('[loan-policies GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch policies', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'counsellor') {
      return NextResponse.json({ error: 'Only counsellors can manage policies' }, { status: 403 });
    }

    await dbConnect();

    const body = await request.json();
    const { policyId, action } = body;

    if (!policyId || !action) {
      return NextResponse.json({ error: 'policyId and action are required' }, { status: 400 });
    }

    const policy = await LenderPolicy.findById(policyId);
    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    switch (action) {
      case 'activate':
        policy.status = 'active';
        policy.activatedAt = new Date();
        break;
      case 'deactivate':
        policy.status = 'inactive';
        break;
      case 'review':
        policy.status = 'review';
        break;
      default:
        return NextResponse.json({ error: 'Invalid action. Use: activate, deactivate, review' }, { status: 400 });
    }

    await policy.save();

    return NextResponse.json({
      success: true,
      policy: {
        _id: policy._id,
        lenderName: policy.lenderName,
        productName: policy.productName,
        status: policy.status,
        activatedAt: policy.activatedAt,
      },
    });
  } catch (error) {
    console.error('[loan-policies PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update policy', details: (error as Error).message },
      { status: 500 }
    );
  }
}
