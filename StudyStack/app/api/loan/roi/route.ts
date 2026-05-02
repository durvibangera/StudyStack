import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { z } from 'zod';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import LoanApplication from '@/lib/models/LoanApplication';
import { logAuditEvent } from '@/lib/audit-logger';

/* ────────────────────────────────────────────────────────────────────────────
 *  POST /api/loan/roi
 *
 *  FULLY DYNAMIC ROI — uses Exa AI to search real salary data
 *  for the student's specific country + field + university tier.
 *  No hardcoded salary tables.
 * ──────────────────────────────────────────────────────────────── */

const roiBodySchema = z.object({
  principalINR: z.number().min(100000).max(50000000).optional(),
});

async function searchSalaryData(country: string, field: string, university: string): Promise<any[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return [];

  try {
    const query = `average starting salary ${field} graduates ${country} 2025 2026 ${university || ''} median compensation package`;
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        query,
        numResults: 6,
        type: 'auto',
        contents: { text: { maxCharacters: 2000 }, summary: true },
        startPublishedDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = roiBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 }
      );
    }

    await dbConnect();
    const user = await User.findById(session.user.id).lean();
    if (!user?.studentProfile) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }

    const profile = user.studentProfile as Record<string, unknown>;
    const country = (Array.isArray(profile.targetCountries) ? (profile.targetCountries as string[])[0] : (profile.targetCountry as string)) || 'UK';
    const field = (profile.courseInterest as string) || (profile.fieldOfStudy as string) || 'Masters';
    const university = (profile.institution as string) || '';
    const budgetStr = (profile.budgetRange as string) || (profile.budget as string) || '';

    // Search real salary data
    const salaryResults = await searchSalaryData(country, field, university);

    // Use Gemini to extract structured salary/ROI from search results
    const { GoogleGenAI } = await import('@google/genai');
    const genAI = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
    });

    const searchContext = salaryResults.map((r: any, i: number) =>
      `[${i + 1}] ${r.title}\nURL: ${r.url}\nSummary: ${r.summary || ''}\nContent: ${(r.text || '').substring(0, 1500)}`
    ).join('\n---\n');

    const estimatedTuition = parsed.data.principalINR || parseBudgetToINR(budgetStr) || 3500000;

    const prompt = `Based on the following real web search results about salaries for ${field} graduates in ${country}${university ? ` (university: ${university})` : ''}, provide a JSON ROI projection.

Search Results:
${searchContext || 'No salary data found — use reasonable estimates for this country and field.'}

Student's estimated total education cost: ₹${estimatedTuition.toLocaleString()}

Return ONLY valid JSON (no code fences):
{
  "estimatedTuitionINR": ${estimatedTuition},
  "estimatedLivingCostINR": <number>,
  "totalCostINR": <number>,
  "expectedSalaryYear1INR": <number in INR>,
  "expectedSalaryYear3INR": <number>,
  "expectedSalaryYear5INR": <number>,
  "paybackPeriodMonths": <number>,
  "roiPercentage": <number>,
  "salarySourceUrls": [<urls from search results>],
  "salaryNotes": "<brief note about data reliability>",
  "currencyConversionNote": "<if salary was in foreign currency, note the conversion>"
}

Use realistic numbers based on the search data. Convert foreign currencies to INR at current rates.`;

    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.3, maxOutputTokens: 2000 },
    });
    const text = (result.text ?? '').trim();

    let roiProjection;
    try {
      roiProjection = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch {
      // Fallback if parsing fails
      roiProjection = {
        estimatedTuitionINR: estimatedTuition,
        estimatedLivingCostINR: Math.round(estimatedTuition * 0.4),
        totalCostINR: Math.round(estimatedTuition * 1.4),
        expectedSalaryYear1INR: 0,
        paybackPeriodMonths: 0,
        salaryNotes: 'Could not parse salary data. Please try again.',
      };
    }

    // Upsert ROI projection
    await LoanApplication.findOneAndUpdate(
      { userId: session.user.id },
      { userId: session.user.id, roiProjection },
      { upsert: true, new: true }
    );

    // Audit log
    logAuditEvent({
      request,
      session,
      action: 'loan.roi.computed',
      metadata: { totalCostINR: roiProjection.totalCostINR },
      startTime,
    }).catch(() => {});

    return NextResponse.json({
      roiProjection,
      sources: salaryResults.map((r: any) => ({ title: r.title, url: r.url })),
    });

  } catch (err) {
    console.error('[Loan ROI] Error:', err);
    return NextResponse.json(
      { error: 'Failed to compute ROI', details: (err as Error).message },
      { status: 500 }
    );
  }
}

function parseBudgetToINR(budget: string): number {
  if (!budget) return 0;
  const lower = budget.toLowerCase().replace(/[₹,]/g, '');
  const num = parseFloat(lower.replace(/[^\d.]/g, ''));
  if (isNaN(num)) return 0;
  if (lower.includes('crore') || lower.includes('cr')) return num * 10000000;
  if (lower.includes('lakh') || lower.includes('lac') || lower.includes('l')) return num * 100000;
  if (num > 10000) return num;
  return num * 100000;
}
