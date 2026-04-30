import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import CounsellorSession from '@/lib/models/CounsellorSession';
import Booking from '@/lib/models/Booking';
import { buildCounsellingProgress, buildCounsellingSnapshot } from '@/lib/counselling-profile';

/**
 * Compute a lead score (0-100) for a student based on:
 *   Intent Seriousness (40%): profile completeness, specific goals, session engagement
 *   Financial Readiness (30%): budget clarity, funding awareness
 *   Timeline Urgency (30%): application timeline, intake timing
 */
function computeLeadScore(user, sessionCount, bookingCount) {
  const profile = user.studentProfile || {};
  const progress = buildCounsellingProgress(profile);

  // ── Intent Seriousness (0-40) ──────────────────────────────────────
  let intent = 0;

  // Profile completeness (0-12)
  intent += Math.round((progress.filledCount / Math.max(progress.totalCount, 1)) * 12);

  // Has specific target countries (0-6)
  const countries = profile.targetCountries || [];
  if (countries.length > 0 && !countries.includes('Not Sure')) intent += 6;
  else if (countries.length > 0) intent += 2;

  // Has clear primary objective (0-5)
  if (profile.primaryObjective && profile.primaryObjective !== 'Other') intent += 5;
  else if (profile.primaryObjective) intent += 2;

  // Course interest specificity (0-4)
  if (profile.courseInterest && profile.courseInterest !== 'Other') intent += 4;
  else if (profile.courseInterest) intent += 1;

  // Session engagement: counselling sessions attended (0-8)
  if (sessionCount >= 3) intent += 8;
  else if (sessionCount >= 1) intent += 5;
  else if (bookingCount >= 1) intent += 3;

  // Has pain points identified (0-5)
  const pains = profile.painPoints || [];
  if (pains.length >= 3) intent += 5;
  else if (pains.length >= 1) intent += 3;

  // ── Financial Readiness (0-30) ─────────────────────────────────────
  let financial = 0;

  // Budget specified (0-12)
  const budget = profile.budgetRange || '';
  if (budget.includes('50 Lakhs+')) financial += 12;
  else if (budget.includes('30-50')) financial += 10;
  else if (budget.includes('20-30')) financial += 8;
  else if (budget.includes('10-20')) financial += 6;
  else if (budget.includes('Below')) financial += 4;

  // Scholarship/funding awareness (0-10)
  const scholarship = profile.scholarshipInterest || '';
  if (scholarship.includes('self-funded')) financial += 10;
  else if (scholarship.includes('loan planned')) financial += 8;
  else if (scholarship.includes('not essential')) financial += 6;
  else if (scholarship.includes('definitely need')) financial += 4;

  // GPA strength signal (0-8)
  const gpa = profile.gpaPercentage || '';
  if (gpa.includes('90%+')) financial += 8;
  else if (gpa.includes('80-90')) financial += 7;
  else if (gpa.includes('70-80')) financial += 5;
  else if (gpa.includes('60-70')) financial += 3;
  else if (gpa.includes('50-60')) financial += 1;

  // ── Timeline Urgency (0-30) ────────────────────────────────────────
  let timeline = 0;

  // Application timeline (0-15)
  const appTimeline = profile.applicationTimeline || '';
  if (appTimeline === 'Immediately') timeline += 15;
  else if (appTimeline === 'Within 1 Month') timeline += 12;
  else if (appTimeline === '1-3 Months') timeline += 8;
  else if (appTimeline === '3-6 Months') timeline += 4;
  else if (appTimeline === '6+ Months') timeline += 2;

  // Test preparation status (0-8)
  const testStatus = profile.testStatus || '';
  if (testStatus === 'Score Available') timeline += 8;
  else if (testStatus === 'Booked Exam') timeline += 6;
  else if (testStatus === 'Preparing') timeline += 3;
  else if (testStatus === 'Not Required') timeline += 7;

  // Intake timing proximity (0-7)
  const intake = profile.intakeTiming || '';
  if (intake.includes('January 2026') || intake.includes('May 2026')) timeline += 7;
  else if (intake.includes('September 2026')) timeline += 5;
  else if (intake.includes('January 2027')) timeline += 3;
  else if (intake.includes('Not Sure')) timeline += 1;

  return Math.min(100, intent + financial + timeline);
}

function classifyLead(score) {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

/**
 * GET /api/students/scored
 *
 * Returns all students with computed lead scores and classification.
 */
export async function GET() {
  try {
    await dbConnect();

    const students = await User.find({
      role: 'student',
      hasCompletedKYC: true,
    })
      .select('name email image studentProfile hasCompletedKYC createdAt')
      .lean();

    // Batch-fetch session counts and booking counts
    const userIds = students.map((s) => s._id);

    const [sessionCounts, bookingCounts] = await Promise.all([
      CounsellorSession.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        {
          $match: {
            userId: { $in: userIds },
            status: { $in: ['confirmed', 'completed'] },
          },
        },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ]),
    ]);

    const sessionMap = Object.fromEntries(
      sessionCounts.map((s) => [String(s._id), s.count])
    );
    const bookingMap = Object.fromEntries(
      bookingCounts.map((b) => [String(b._id), b.count])
    );

    const scored = students.map((student) => {
      const uid = String(student._id);
      const sessions = sessionMap[uid] || 0;
      const bookings = bookingMap[uid] || 0;
      const score = computeLeadScore(student, sessions, bookings);
      const classification = classifyLead(score);
      const snapshot = buildCounsellingSnapshot(student.studentProfile || {});
      const progress = buildCounsellingProgress(student.studentProfile || {});

      return {
        _id: uid,
        name: student.name || snapshot.studentName || 'Unknown',
        email: student.email,
        image: student.image,
        phone: snapshot.phoneNumber || '',
        location: snapshot.currentLocation || '',
        targetCountries: snapshot.targetCountries || [],
        courseInterest: snapshot.courseInterest || '',
        educationLevel: snapshot.educationLevel || '',
        applicationTimeline: snapshot.applicationTimeline || '',
        budgetRange: snapshot.budgetRange || '',
        profileProgress: {
          filled: progress.filledCount,
          total: progress.totalCount,
          complete: progress.isComplete,
        },
        sessionCount: sessions,
        bookingCount: bookings,
        score,
        classification,
        joinedAt: student.createdAt,
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return NextResponse.json(scored);
  } catch (error) {
    console.error('[students/scored] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
