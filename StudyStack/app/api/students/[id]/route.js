import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import CounsellorSession from '@/lib/models/CounsellorSession';
import Booking from '@/lib/models/Booking';
import ConversationMemory from '@/lib/models/ConversationMemory';
import Lead from '@/lib/models/Lead';
import { buildCounsellingProgress, buildCounsellingSnapshot, COUNSELLING_FIELDS } from '@/lib/counselling-profile';
import { recalculateAndCacheUserScore, computeLoanReadiness, findBestLoanMatch } from '@/lib/lead-scoring';
import LenderPolicy from '@/lib/models/LenderPolicy';



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

    // Fetch sessions, bookings, and voice sessions in parallel
    const [sessions, bookings, voiceSessions] = await Promise.all([
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
      ConversationMemory.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('conversationId summary callDurationSecs messages createdAt mode language')
        .lean(),
    ]);

    // Build session summaries
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

    // Build voice session summaries
    const voiceSessionSummaries = voiceSessions.map((v) => ({
      conversationId: v.conversationId,
      summary: v.summary || 'No summary available',
      callDurationSecs: v.callDurationSecs || 0,
      messagesCount: v.messages?.length || 0,
      createdAt: v.createdAt,
      mode: v.mode || 'onboarding',
      language: v.language || 'en',
    }));

    // Build profile fields with labels
    const profileFields = COUNSELLING_FIELDS.map((field) => ({
      key: field.key,
      label: field.label,
      value: snapshot[field.key] ?? null,
      filled: progress.filledFields?.includes(field.key) ?? false,
    }));

    const activePolicies = await LenderPolicy.find({ status: 'active' }).lean();
    return NextResponse.json({
      _id: String(user._id),
      loanReadiness: computeLoanReadiness(user.studentProfile),
      bestLoanMatch: await findBestLoanMatch(user.studentProfile, activePolicies),
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
      voiceSessions: voiceSessionSummaries,
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
    console.error('[students/[id]] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/students/[id]
 *
 * Updates profile fields for the student and synchronizes changes with their Lead record if it exists.
 */
export async function PATCH(request, { params }) {
  const { id } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'counsellor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const body = await request.json();

    // Update main User fields
    if (body.name) {
      user.name = body.name;
    }
    if (body.email) {
      const emailLower = body.email.toLowerCase().trim();
      if (emailLower !== user.email.toLowerCase()) {
        const existingUser = await User.findOne({ email: emailLower });
        if (existingUser) {
          return NextResponse.json({ error: 'Email is already in use by another user' }, { status: 400 });
        }
        user.email = emailLower;
      }
    }

    // Update embedded studentProfile fields
    if (!user.studentProfile) {
      user.studentProfile = {};
    }

    for (const field of COUNSELLING_FIELDS) {
      if (field.key in body) {
        user.studentProfile[field.key] = body[field.key];
      }
    }

    // Recalculate KYC completion progress
    const progress = buildCounsellingProgress(user.studentProfile);
    user.hasCompletedKYC = progress.isComplete;

    // Mark studentProfile as modified for Mongoose Mixed types
    user.markModified('studentProfile');
    await user.save();

    // Recalculate score and sync to Lead document if it exists
    await recalculateAndCacheUserScore(user._id);

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('[students/[id]] PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/students/[id]
 *
 * Cascading delete: permanently removes the student's User account, Leads, Bookings,
 * Counsellor sessions, and Voice transcripts from the database.
 */
export async function DELETE(request, { params }) {
  const { id } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'counsellor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const email = user.email;

    // Perform cascade deletes in parallel
    await Promise.all([
      User.findByIdAndDelete(id),
      CounsellorSession.deleteMany({ userId: id }),
      Booking.deleteMany({ userId: id }),
      ConversationMemory.deleteMany({ userId: id }),
      Lead.deleteMany({ email: { $regex: new RegExp('^' + email + '$', 'i') } }),
    ]);

    return NextResponse.json({ success: true, message: 'Student and all associated records deleted successfully' });
  } catch (error) {
    console.error('[students/[id]] DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

