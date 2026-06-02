import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import CounsellorSession from '@/lib/models/CounsellorSession';
import Booking from '@/lib/models/Booking';
import ConversationMemory from '@/lib/models/ConversationMemory';
import { buildCounsellingProgress, buildCounsellingSnapshot } from '@/lib/counselling-profile';
import { computeLeadScore, classifyLead, recalculateAndCacheUserScore, computeLoanReadiness, findBestLoanMatch } from '@/lib/lead-scoring';
import LenderPolicy from '@/lib/models/LenderPolicy';



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
    })
      .select('name email image studentProfile hasCompletedKYC createdAt leadScore leadClassification sessionCount bookingCount voiceSessionCount')
      .lean();

    const activePolicies = await LenderPolicy.find({ status: 'active' }).lean();
    const scored = [];

    for (const student of students) {
      const uid = String(student._id);
      
      let score = student.leadScore;
      let classification = student.leadClassification;
      let sessionCount = student.sessionCount;
      let bookingCount = student.bookingCount;
      let voiceSessionCount = student.voiceSessionCount;

      // Lazy initialization fallback: if the cached score has never been computed
      if (score === undefined || score === null || (score === 0 && classification === 'cold' && sessionCount === undefined)) {
        const cachedResult = await recalculateAndCacheUserScore(student._id);
        if (cachedResult) {
          score = cachedResult.score;
          classification = cachedResult.classification;
          // Fetch updated counts
          const updatedStudent = await User.findById(student._id)
            .select('studentProfile sessionCount bookingCount voiceSessionCount')
            .lean();
          sessionCount = updatedStudent.sessionCount;
          bookingCount = updatedStudent.bookingCount;
          voiceSessionCount = updatedStudent.voiceSessionCount;
          student.studentProfile = updatedStudent.studentProfile;
        }
      }

      const snapshot = buildCounsellingSnapshot(student.studentProfile || {});
      const progress = buildCounsellingProgress(student.studentProfile || {});

      scored.push({
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
        sessionCount: sessionCount || 0,
        bookingCount: bookingCount || 0,
        voiceSessionCount: voiceSessionCount || 0,
        score: score || 0,
        classification: classification || 'cold',
        loanReadiness: computeLoanReadiness(student.studentProfile),
        bestLoanMatch: await findBestLoanMatch(student.studentProfile, activePolicies),
        joinedAt: student.createdAt,
      });
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return NextResponse.json(scored);
  } catch (error) {
    console.error('[students/scored] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

