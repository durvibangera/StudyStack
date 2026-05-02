import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { z } from 'zod';
import { computeEMIScenarios } from '@/lib/loan/loanUtils';

const emiBodySchema = z.object({
  principalINR: z.number().min(100000).max(20000000),
  interestRatePercent: z.number().min(5).max(20),
  tenureMonths: z.number().min(12).max(180),
});

export async function POST(request: Request) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = emiBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { principalINR, interestRatePercent, tenureMonths } = parsed.data;
    const scenarios = computeEMIScenarios(principalINR, interestRatePercent, tenureMonths);

    return NextResponse.json({ scenarios });

  } catch (err) {
    console.error('[Loan EMI] Error:', err);
    return NextResponse.json(
      { error: 'Failed to compute EMI scenarios', details: (err as Error).message },
      { status: 500 }
    );
  }
}
