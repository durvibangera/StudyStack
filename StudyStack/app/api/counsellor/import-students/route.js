import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import Lead from '@/lib/models/Lead';
import CounsellorSession from '@/lib/models/CounsellorSession';
import Booking from '@/lib/models/Booking';
import ConversationMemory from '@/lib/models/ConversationMemory';
import { buildCounsellingSnapshot } from '@/lib/counselling-profile';
import { computeLeadScore } from '@/lib/lead-scoring';

const AVATAR_OPTIONS = [
  "/avatars/hulk.png",
  "/avatars/ironman.png",
  "/avatars/thor.png",
  "/avatars/spiderman.png",
];

/**
 * GET /api/counsellor/import-students
 *
 * Returns a list of registered students that do NOT exist in the Lead collection.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'counsellor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // 1. Fetch all students
    const students = await User.find({ role: 'student' })
      .select('name email image studentProfile hasCompletedKYC createdAt')
      .lean();

    // 2. Fetch all lead emails
    const leads = await Lead.find({}).select('email').lean();
    const leadEmails = new Set(leads.map((l) => l.email?.toLowerCase().trim()).filter(Boolean));

    // 3. Filter out students that are already leads
    const importable = students.filter((s) => !leadEmails.has(s.email?.toLowerCase().trim()));

    // 4. Map to simplified representation
    const mapped = importable.map((s) => {
      const snapshot = buildCounsellingSnapshot(s.studentProfile || {});
      return {
        _id: String(s._id),
        name: s.name || snapshot.studentName || 'Unknown Student',
        email: s.email,
        image: s.image || '',
        phone: snapshot.phoneNumber || '',
        location: snapshot.currentLocation || '',
        course: snapshot.courseInterest || '',
        countries: snapshot.targetCountries || [],
        hasCompletedKYC: s.hasCompletedKYC,
        joinedAt: s.createdAt,
      };
    });

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('[import-students] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/counsellor/import-students
 *
 * Imports selected student user IDs as pipeline leads.
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'counsellor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Student IDs array is required' }, { status: 400 });
    }

    await dbConnect();

    // Find the students to import
    const students = await User.find({ _id: { $in: ids }, role: 'student' }).lean();

    let importedCount = 0;

    for (const student of students) {
      // Check again to avoid race conditions
      const exists = await Lead.findOne({ email: { $regex: new RegExp('^' + student.email + '$', 'i') } });
      if (exists) continue;

      const snapshot = buildCounsellingSnapshot(student.studentProfile || {});

      // Gather engagement details for scoring
      const [counsellorCount, bookingCount, voiceSessions] = await Promise.all([
        CounsellorSession.countDocuments({ userId: student._id }),
        Booking.countDocuments({ userId: student._id, status: { $in: ['confirmed', 'completed'] } }),
        ConversationMemory.find({ userId: student._id }).lean(),
      ]);

      const score = computeLeadScore(student, counsellorCount, voiceSessions, bookingCount);

      // Select avatar: use student's profile image if available, else a random option
      const avatar = student.image || AVATAR_OPTIONS[Math.floor(Math.random() * AVATAR_OPTIONS.length)];

      await Lead.create({
        name: student.name || snapshot.studentName || 'Imported Student',
        email: student.email,
        phone: snapshot.phoneNumber || '',
        sourceType: 'Registered Student',
        sourceUrl: '',
        location: snapshot.currentLocation || '',
        course: snapshot.courseInterest || '',
        country: Array.isArray(snapshot.targetCountries)
          ? snapshot.targetCountries.join(', ')
          : snapshot.targetCountries || '',
        exam: snapshot.englishTestStatus || '',
        examDetail: '',
        score,
        status: 'new',
        avatar,
        notes: 'Imported from registered students.',
        tags: ['Imported', student.hasCompletedKYC ? 'KYC Complete' : 'KYC Pending'],
        counsellorId: session.user.id,
      });

      importedCount++;
    }

    return NextResponse.json({ success: true, imported: importedCount });
  } catch (error) {
    console.error('[import-students] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
