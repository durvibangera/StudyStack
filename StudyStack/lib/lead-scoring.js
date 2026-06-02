import { buildCounsellingProgress } from './counselling-profile';
import dbConnect from './mongodb';
import User from './models/User';
import CounsellorSession from './models/CounsellorSession';
import Booking from './models/Booking';
import ConversationMemory from './models/ConversationMemory';
import Lead from './models/Lead';
import LenderPolicy from './models/LenderPolicy';


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

/**
 * Compute loan readiness based on academic, test, country, and budget profiles
 */
export function computeLoanReadiness(studentProfile) {
  const profile = studentProfile || {};
  let score = 30; // base score
  const reasons = [];
  let loanTypePreference = 'Secured';
  
  // 1. GPA Analysis
  const gpaStr = profile.gpaPercentage || profile.gpa || '';
  const gpaVal = parseGPA(gpaStr);
  if (gpaVal >= 85) { // 8.5 CGPA or 85%
    score += 30;
    reasons.push("Excellent academic profile (GPA ≥ 8.5/10 or CGPA equivalent) qualifies for premium Unsecured Loans at competitive interest rates.");
    loanTypePreference = 'Unsecured';
  } else if (gpaVal >= 70) { // 7.0 to 8.4 CGPA
    score += 20;
    reasons.push("Strong academic profile (GPA 7.0 - 8.4) qualifies for standard Unsecured Loans or Partially Secured Loans.");
    loanTypePreference = 'Partially Secured';
  } else if (gpaVal > 0) {
    score += 10;
    reasons.push("Moderate academic profile (GPA < 7.0) might require a fully Secured Loan (collateral asset like property/FD).");
    loanTypePreference = 'Secured';
  } else {
    reasons.push("Academic profile incomplete; cannot evaluate unsecured loan eligibility. Add GPA to unlock premium lender access.");
  }

  // 2. Target Countries Analysis
  const countries = profile.targetCountries || [];
  const normalizedCountries = Array.isArray(countries) ? countries : [countries];
  const primaryCountry = normalizedCountries[0] || '';
  if (primaryCountry && !primaryCountry.toLowerCase().includes('not sure')) {
    score += 15;
    if (['usa', 'uk', 'canada', 'australia', 'germany', 'ireland'].includes(primaryCountry.toLowerCase().trim())) {
      reasons.push(`Target country (${primaryCountry}) has highly structured education lending products with low-interest NBFC tie-ups.`);
    } else {
      reasons.push(`Target country (${primaryCountry}) is supported; loan rates may vary depending on school rankings.`);
    }
  } else {
    reasons.push("Target destination not specified. Specific country selection is needed to match international student loan policies.");
  }

  // 3. English Test Scores (IELTS/PTE/GRE)
  const testStatus = profile.testStatus || profile.englishTestStatus || '';
  if (testStatus.toLowerCase().includes('score available') || testStatus.toLowerCase().includes('score')) {
    score += 15;
    reasons.push("English language test scores are ready, which speeds up pre-visa loan sanction approvals by 5-7 days.");
  } else if (testStatus.toLowerCase().includes('booked') || testStatus.toLowerCase().includes('preparing')) {
    score += 5;
    reasons.push("Language test in progress. Pre-sanction loan is possible, but final disbursement requires test scores.");
  }

  // 4. Budget Range Analysis
  const budgetStr = profile.budgetRange || '';
  const budgetVal = parseBudget(budgetStr);
  if (budgetVal > 0) {
    score += 10;
    if (budgetVal >= 50) {
      reasons.push(`High budget (₹${budgetVal}L+) requires significant co-applicant income (e.g. ₹8L+/yr) to secure unsecured loans.`);
    } else if (budgetVal >= 25) {
      reasons.push(`Standard budget (₹${budgetVal}L) matches standard NBFC unsecured lending limits (up to ₹45L).`);
    } else {
      reasons.push(`Low budget range (₹${budgetVal}L) can be fully covered without collateral in most premier institutions.`);
    }
  }

  // Final score cap
  const finalScore = Math.min(100, score);
  
  let band = 'Poor';
  if (finalScore >= 80) band = 'Excellent';
  else if (finalScore >= 60) band = 'Good';
  else if (finalScore >= 40) band = 'Fair';

  return {
    score: finalScore,
    band,
    reasons,
    loanTypePreference
  };
}

/**
 * Perform matching between a student's profile and active lender policies in the database
 */
export async function findBestLoanMatch(studentProfile, preFetchedPolicies = null) {
  const profile = studentProfile || {};
  
  const activePolicies = preFetchedPolicies || (await LenderPolicy.find({ status: 'active' }).lean());
  
  if (!activePolicies || activePolicies.length === 0) {
    return null;
  }

  const gpaStr = profile.gpaPercentage || profile.gpa || '';
  const gpaVal = parseGPA(gpaStr); // e.g. 85 (8.5 CGPA equivalent)

  const budgetStr = profile.budgetRange || '';
  const budgetVal = parseBudget(budgetStr); // e.g. 35 (Lakhs)
  const budgetINR = budgetVal * 100000;

  const countries = profile.targetCountries || [];
  const normalizedCountries = Array.isArray(countries) 
    ? countries.map(c => String(c).toLowerCase().trim()) 
    : [String(countries).toLowerCase().trim()];

  let bestMatch = null;
  let bestScore = -1;

  for (const policy of activePolicies) {
    let score = 100;
    const matchReasons = [];
    const eligibility = policy.extractedPolicies?.eligibility || {};
    const financial = policy.extractedPolicies?.financial || {};

    // 1. GPA compatibility check
    if (eligibility.minGPA && gpaVal > 0) {
      const minGpaPct = eligibility.minGPA * 10;
      if (gpaVal < minGpaPct) {
        score -= 30;
        matchReasons.push(`GPA (${gpaVal/10}/10) is below the minimum required GPA (${eligibility.minGPA}/10) for ${policy.lenderName}'s ${policy.productName}.`);
      } else {
        score += 5;
        matchReasons.push(`GPA (${gpaVal/10}/10) satisfies the lender's academic standard.`);
      }
    }

    // 2. Country compatibility check
    if (eligibility.supportedCountries && eligibility.supportedCountries.length > 0 && normalizedCountries.length > 0 && normalizedCountries[0] !== '') {
      const supported = eligibility.supportedCountries.map(c => String(c).toLowerCase().trim());
      const hasMatch = normalizedCountries.some(c => supported.includes(c));
      if (!hasMatch) {
        score -= 40;
        matchReasons.push(`Target countries are not supported by this scheme.`);
      } else {
        score += 10;
        matchReasons.push(`Target country is fully supported by the lender.`);
      }
    }

    // 3. Collateral check
    if (financial.maxLoanAmountINR && budgetINR > 0) {
      if (budgetINR > financial.maxLoanAmountINR) {
        score -= 15;
        matchReasons.push(`Requested budget exceeds the maximum loan amount limit of ₹${(financial.maxLoanAmountINR/100000).toFixed(0)} Lakhs.`);
      } else {
        score += 5;
      }
    }

    const finalScore = Math.max(0, Math.min(100, score));
    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestMatch = {
        lenderName: policy.lenderName,
        productName: policy.productName,
        matchScore: finalScore,
        interestRateMin: financial.interestRateMin || 9.5,
        interestRateMax: financial.interestRateMax || 13.0,
        maxLoanAmountINR: financial.maxLoanAmountINR || 4500000,
        collateralRequired: financial.collateralRequired || false,
        reasons: matchReasons.slice(0, 3),
        specialFeatures: policy.extractedPolicies?.specialFeatures || []
      };
    }
  }

  return bestMatch;
}

