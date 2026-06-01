import { buildCounsellingProgress } from './counselling-profile';
import dbConnect from './mongodb';
import User from './models/User';
import CounsellorSession from './models/CounsellorSession';
import Booking from './models/Booking';
import ConversationMemory from './models/ConversationMemory';
import Lead from './models/Lead';

/**
 * Robust parser to extract a normalized percentage (0-100) from various GPA/CGPA formats.
 * e.g., "9.7 GPA" -> 97, "8.1 CGPA" -> 81, "78%" -> 78, "3.8/4" -> 95, "8.5/10" -> 85
 */
export function parseGPA(gpaStr) {
  if (!gpaStr) return 0;
  const str = String(gpaStr).toLowerCase().trim();

  // 1. If it contains a percentage sign
  const pctMatch = str.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pctMatch) {
    return parseFloat(pctMatch[1]);
  }

  // 2. Check for fraction format e.g. "3.8/4", "8.5/10"
  const fracMatch = str.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (fracMatch) {
    const num = parseFloat(fracMatch[1]);
    const den = parseFloat(fracMatch[2]);
    if (den > 0) {
      return (num / den) * 100;
    }
  }

  // 3. Just a plain number, let's extract it
  const numMatch = str.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    const val = parseFloat(numMatch[1]);
    // Determine scale
    if (val <= 4.0) {
      return (val / 4.0) * 100;
    } else if (val <= 10.0) {
      return val * 10; // e.g. 9.7 CGPA -> 97%
    } else if (val <= 100.0) {
      return val;
    }
  }
  return 0;
}

/**
 * Robust parser to extract maximum budget in Lakhs.
 * e.g., "55-60 lakhs" -> 60, "30 Lakhs" -> 30, "Below ₹10 lakhs" -> 9, "20-25 lakhs" -> 25
 */
export function parseBudget(budgetStr) {
  if (!budgetStr) return 0;
  const str = String(budgetStr).toLowerCase().trim();

  // Find all numbers in the string
  const numbers = str.match(/(\d+(?:\.\d+)?)/g);
  if (!numbers || numbers.length === 0) return 0;

  const parsedNumbers = numbers.map(n => parseFloat(n));
  const maxVal = Math.max(...parsedNumbers);

  // If it specifies below/under
  if (str.includes('below') || str.includes('less than') || str.includes('under')) {
    return Math.max(0, maxVal - 1);
  }

  return maxVal;
}

/**
 * Compute a lead score (0-100) for a student based on profile features,
 * funding conversations, human sessions, bookings, and voice agent interactions.
 */
export function computeLeadScore(user, counsellorSessions = [], voiceSessions = [], bookings = []) {
  const profile = user.studentProfile || {};
  const progress = buildCounsellingProgress(profile);

  // Resolve session arrays or counts
  const counsellorCount = Array.isArray(counsellorSessions) ? counsellorSessions.length : (counsellorSessions || 0);
  const voiceCount = Array.isArray(voiceSessions) ? voiceSessions.length : (voiceSessions || 0);
  const bookingCount = Array.isArray(bookings) ? bookings.length : (bookings || 0);

  // Calculate message count if voiceSessions is an array
  let voiceMessageCount = 0;
  let mentionsFunding = false;
  if (Array.isArray(voiceSessions)) {
    voiceMessageCount = voiceSessions.reduce((sum, s) => sum + (s.messages?.length || 0), 0);
    // Scan summaries and transcripts for active funding/loan interests
    for (const vs of voiceSessions) {
      const text = ((vs.summary || '') + ' ' + (vs.transcriptText || '')).toLowerCase();
      if (text.includes('loan') || text.includes('scholarship') || text.includes('funding') || text.includes('financial aid') || text.includes('lakh')) {
        mentionsFunding = true;
      }
    }
  }

  // ── Intent Seriousness (0-40) ──────────────────────────────────────
  let intent = 0;

  // Profile completeness (0-12)
  intent += Math.round((progress.filledCount / Math.max(progress.totalCount, 1)) * 12);

  // Has specific target countries (0-6)
  const countries = profile.targetCountries || [];
  const normalizedCountries = Array.isArray(countries) ? countries : [countries];
  if (normalizedCountries.length > 0 && !normalizedCountries.includes('Not Sure') && normalizedCountries.some(Boolean)) {
    intent += 6;
  } else if (normalizedCountries.length > 0 && normalizedCountries.some(Boolean)) {
    intent += 2;
  }

  // Has clear primary objective (0-5)
  if (profile.primaryObjective && profile.primaryObjective !== 'Other' && profile.primaryObjective !== 'Not Sure') {
    intent += 5;
  } else if (profile.primaryObjective) {
    intent += 2;
  }

  // Course interest specificity (0-4)
  if (profile.courseInterest && profile.courseInterest !== 'Other' && profile.courseInterest !== 'Not Sure') {
    intent += 4;
  } else if (profile.courseInterest) {
    intent += 1;
  }

  // Session engagement (0-10): Combine counsellor sessions, voice agent sessions, and messages
  if (counsellorCount >= 3 || voiceCount >= 3 || voiceMessageCount >= 25) {
    intent += 10;
  } else if (counsellorCount >= 1 || voiceCount >= 1 || voiceMessageCount >= 8) {
    intent += 7;
  } else if (bookingCount >= 1 || voiceMessageCount >= 2) {
    intent += 4;
  }

  // Pain points identified (0-3)
  const pains = profile.painPoints || [];
  const normalizedPains = Array.isArray(pains) ? pains : [pains];
  if (normalizedPains.length >= 3) intent += 3;
  else if (normalizedPains.length >= 1) intent += 1;

  // ── Financial Readiness (0-30) ─────────────────────────────────────
  let financial = 0;

  // Budget specified (0-12)
  const budgetStr = profile.budgetRange || '';
  const budgetVal = parseBudget(budgetStr);
  if (budgetVal >= 50) financial += 12;
  else if (budgetVal >= 30) financial += 10;
  else if (budgetVal >= 20) financial += 8;
  else if (budgetVal >= 10) financial += 6;
  else if (budgetVal > 0) financial += 4;

  // Scholarship/funding awareness (0-10)
  const scholarship = String(profile.scholarshipInterest || '').toLowerCase();
  if (scholarship.includes('self-funded')) financial += 10;
  else if (scholarship.includes('loan planned') || scholarship.includes('loan')) financial += 8;
  else if (scholarship.includes('not essential')) financial += 6;
  else if (scholarship.includes('definitely need') || scholarship.includes('need scholarship')) financial += 4;

  // GPA strength signal (0-8)
  const gpaStr = profile.gpaPercentage || profile.gpa || '';
  const gpaVal = parseGPA(gpaStr);
  if (gpaVal >= 90) financial += 8;
  else if (gpaVal >= 80) financial += 7;
  else if (gpaVal >= 70) financial += 5;
  else if (gpaVal >= 60) financial += 3;
  else if (gpaVal >= 50) financial += 1;

  // Funding conversation bonus (up to 3 points, capped at 30 total financial)
  if (mentionsFunding) {
    financial += 3;
  }
  financial = Math.min(30, financial);

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
  const testStatus = profile.testStatus || profile.englishTestStatus || '';
  if (testStatus.includes('Score Available') || testStatus.includes('score')) timeline += 8;
  else if (testStatus.includes('Booked Exam') || testStatus.includes('booked')) timeline += 6;
  else if (testStatus.includes('Preparing') || testStatus.includes('preparing')) timeline += 3;
  else if (testStatus.includes('Not Required') || testStatus.includes('not required')) timeline += 7;

  // Intake timing proximity (0-7)
  const intake = profile.intakeTiming || '';
  if (intake.includes('January 2026') || intake.includes('May 2026')) timeline += 7;
  else if (intake.includes('September 2026')) timeline += 5;
  else if (intake.includes('January 2027')) timeline += 3;
  else if (intake.includes('Not Sure')) timeline += 1;

  return Math.min(100, intent + financial + timeline);
}

export function classifyLead(score) {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

export async function recalculateAndCacheUserScore(userId) {
  await dbConnect();

  const user = await User.findById(userId);
  if (!user) return null;

  // Gather counts/sessions in parallel
  const [counsellorCount, bookingCount, voiceSessions] = await Promise.all([
    CounsellorSession.countDocuments({ userId: user._id }),
    Booking.countDocuments({ userId: user._id, status: { $in: ['confirmed', 'completed'] } }),
    ConversationMemory.find({ userId: user._id }).lean(),
  ]);

  const score = computeLeadScore(user, counsellorCount, voiceSessions, bookingCount);
  const classification = classifyLead(score);

  // Update and save cached score in User
  user.leadScore = score;
  user.leadClassification = classification;
  user.sessionCount = counsellorCount;
  user.bookingCount = bookingCount;
  user.voiceSessionCount = voiceSessions.length;
  await user.save();

  // Sync with Lead document if it exists
  const lead = await Lead.findOne({ email: { $regex: new RegExp('^' + user.email + '$', 'i') } });
  if (lead) {
    lead.name = user.name;
    lead.email = user.email;
    if (user.studentProfile?.phoneNumber) {
      lead.phone = user.studentProfile.phoneNumber;
    }
    if (user.studentProfile?.currentLocation) {
      lead.location = user.studentProfile.currentLocation;
    }
    if (user.studentProfile?.courseInterest) {
      lead.course = user.studentProfile.courseInterest;
    }
    if (user.studentProfile?.targetCountries) {
      lead.country = Array.isArray(user.studentProfile.targetCountries)
        ? user.studentProfile.targetCountries.join(', ')
        : user.studentProfile.targetCountries;
    }
    lead.score = score;
    await lead.save();
  }

  return { score, classification };
}
