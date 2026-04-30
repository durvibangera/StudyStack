import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import CounsellorSession from '@/lib/models/CounsellorSession';
import Booking from '@/lib/models/Booking';
import { buildCounsellingProgress, buildCounsellingSnapshot, COUNSELLING_FIELDS } from '@/lib/counselling-profile';

/**
 * GET /api/students/[id]
 *
 * Returns detailed information for a single student,
 * including their full profile, session history, bookings, and dashboard analysis.
 */
export async function GET(request, { params }) {
  const { id } = await params;

  try {
    await dbConnect();

    const user = await User.findById(id)
      .select('name email image studentProfile hasCompletedKYC dashboardAnalysis createdAt')
      .lean();

    if (!user) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const snapshot = buildCounsellingSnapshot(user.studentProfile || {});
    const progress = buildCounsellingProgress(user.studentProfile || {});

    // Fetch sessions and bookings in parallel
    const [sessions, bookings] = await Promise.all([
      CounsellorSession.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('title summary status startedAt endedAt followUpQuestions transcript')
        .lean(),
      Booking.find({ userId: user._id })
        .sort({ scheduledAt: -1 })
        .limit(20)
        .select('scheduledAt durationMinutes status notes phoneNumber createdAt')
        .lean(),
    ]);

    // Build session summaries (don't send full transcripts, just key data)
    const sessionSummaries = sessions.map((s) => ({
      _id: String(s._id),
      title: s.title || 'Counselling Session',
      summary: s.summary || '',
      status: s.status,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      followUpQuestions: s.followUpQuestions || [],
      messageCount: s.transcript?.length || 0,
    }));

    // Build profile fields with labels
    const profileFields = COUNSELLING_FIELDS.map((field) => ({
      key: field.key,
      label: field.label,
      value: snapshot[field.key] ?? null,
      filled: progress.filledFields?.includes(field.key) ?? false,
    }));

    return NextResponse.json({
      _id: String(user._id),
      name: user.name || snapshot.studentName || 'Unknown',
      email: user.email,
      image: user.image,
      joinedAt: user.createdAt,
      hasCompletedKYC: user.hasCompletedKYC,
      profileProgress: {
        filled: progress.filledCount,
        total: progress.totalCount,
        complete: progress.isComplete,
      },
      profileFields,
      sessions: sessionSummaries,
      bookings: bookings.map((b) => ({
        _id: String(b._id),
        scheduledAt: b.scheduledAt,
        durationMinutes: b.durationMinutes,
        status: b.status,
        notes: b.notes,
        phoneNumber: b.phoneNumber,
        createdAt: b.createdAt,
      })),
      dashboardAnalysis: user.dashboardAnalysis || null,
    });
  } catch (error) {
    console.error('[students/[id]] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
