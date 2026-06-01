import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import ConversationMemory from '@/lib/models/ConversationMemory';
import { recalculateAndCacheUserScore } from '@/lib/lead-scoring';
import {
  buildCounsellingProgress,
  buildCounsellingSnapshot,
} from '@/lib/counselling-profile';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to continue.' },
        { status: 401 }
      );
    }

    const kycData = await request.json();
    
    // Validate required fields
    if (!kycData || typeof kycData !== 'object') {
      return NextResponse.json(
        { error: 'Invalid KYC data provided' },
        { status: 400 }
      );
    }

    // Required fields validation - matching the student onboarding form
    const requiredFields = [
      'educationLevel', 'fieldOfStudy', 'institution',
      'gpa', 'testStatus', 'courseInterest',
      'applicationTimeline', 'budget', 'scholarshipInterest'
    ];
    const missingFields = requiredFields.filter(field => {
      const value = kycData[field];
      return !value || (Array.isArray(value) && value.length === 0);
    });
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    await dbConnect();
    
    // Check if user exists
    const existingUser = await User.findById(session.user.id);
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if KYC already completed
    if (existingUser.hasCompletedKYC) {
      return NextResponse.json(
        { error: 'KYC already completed for this account' },
        { status: 400 }
      );
    }

    // Normalize fields: bridge new onboarding field names → canonical counselling names
    // so the dashboard's COUNSELLING_FIELDS can read them.
    const normalized = { ...kycData };
    if (kycData.fullName && !kycData.studentName) normalized.studentName = kycData.fullName;
    if (kycData.phone && !kycData.phoneNumber) normalized.phoneNumber = kycData.phone;
    if (kycData.email && !kycData.contactEmail) normalized.contactEmail = kycData.email;
    if (kycData.city && !kycData.currentLocation) normalized.currentLocation = kycData.city;
    if (kycData.gpa && !kycData.gpaPercentage) normalized.gpaPercentage = kycData.gpa;
    if (kycData.targetCountry && !kycData.targetCountries) normalized.targetCountries = kycData.targetCountry;
    if (kycData.budget && !kycData.budgetRange) normalized.budgetRange = kycData.budget;
    if (kycData.testStatus && !kycData.englishTestStatus) {
      normalized.englishTestStatus = kycData.testScore
        ? `${kycData.testStatus} (${kycData.testScore})`
        : kycData.testStatus;
    }

    // Update user with KYC data — MERGE with existing profile instead of replacing
    const existingProfile = (existingUser.studentProfile?.toObject ? existingUser.studentProfile.toObject() : existingUser.studentProfile) || {};
    const mergedProfile = {
      ...existingProfile,
      ...normalized,
      submittedAt: new Date()
    };

    const user = await User.findByIdAndUpdate(
      session.user.id,
      {
        studentProfile: mergedProfile,
        hasCompletedKYC: true,
        updatedAt: new Date()
      },
      { new: true, runValidators: false }
    );

    // Recalculate and cache lead score
    await recalculateAndCacheUserScore(session.user.id).catch((err) =>
      console.error('[kyc POST] Recalculate score failed:', err.message)
    );

    return NextResponse.json({
      success: true,
      message: 'KYC completed successfully',
      hasCompletedKYC: true
    });

  } catch (error) {
    console.error('KYC submission error:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return NextResponse.json(
        { error: `Validation failed: ${errors.join(', ')}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to submit KYC data. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const [user, latestConversation] = await Promise.all([
      User.findById(session.user.id).select('studentProfile hasCompletedKYC updatedAt'),
      ConversationMemory.findOne({ userId: session.user.id, mode: 'onboarding' })
        .sort({ createdAt: -1 })
        .select('conversationId summary extractedFacts callDurationSecs createdAt messages')
        .lean(),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const studentProfile = user.studentProfile?.toObject?.() || user.studentProfile || {};
    const counsellingProgress = buildCounsellingProgress(studentProfile);

    return NextResponse.json({
      hasCompletedKYC: user.hasCompletedKYC,
      studentProfile,
      counsellingProfile: buildCounsellingSnapshot(studentProfile),
      counsellingProgress,
      latestConversation: serializeConversation(latestConversation),
    });

  } catch (error) {
    console.error('KYC fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KYC data' },
      { status: 500 }
    );
  }
}

// PUT endpoint to save progress without completing KYC
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to continue.' },
        { status: 401 }
      );
    }

    const kycData = await request.json();
    
    if (!kycData || typeof kycData !== 'object') {
      return NextResponse.json(
        { error: 'Invalid KYC data provided' },
        { status: 400 }
      );
    }

    await dbConnect();
    
    const existingUser = await User.findById(session.user.id);
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Save progress — merge with existing data
    const existingProfile = (existingUser.studentProfile?.toObject ? existingUser.studentProfile.toObject() : existingUser.studentProfile) || {};
    const merged = {
      ...existingProfile,
      ...kycData
    };

    const counsellingProgress = buildCounsellingProgress(merged);
    const isNowComplete = existingUser.hasCompletedKYC || counsellingProgress.isComplete;

    const user = await User.findByIdAndUpdate(
      session.user.id,
      {
        studentProfile: merged,
        hasCompletedKYC: isNowComplete,
        updatedAt: new Date()
      },
      { new: true, runValidators: false }
    );

    // Recalculate and cache lead score
    await recalculateAndCacheUserScore(session.user.id).catch((err) =>
      console.error('[kyc PUT] Recalculate score failed:', err.message)
    );

    return NextResponse.json({
      success: true,
      message: 'Progress saved successfully',
      studentProfile: user.studentProfile,
      hasCompletedKYC: user.hasCompletedKYC,
      counsellingProgress,
    });

  } catch (error) {
    console.error('KYC save progress error:', error);
    return NextResponse.json(
      { error: 'Failed to save progress. Please try again.' },
      { status: 500 }
    );
  }
}

function serializeConversation(conversation) {
  if (!conversation) return null;

  const extractedFacts = conversation.extractedFacts instanceof Map
    ? Object.fromEntries(conversation.extractedFacts)
    : (conversation.extractedFacts || {});

  return {
    conversationId: conversation.conversationId,
    summary: conversation.summary || '',
    extractedFacts,
    callDurationSecs: conversation.callDurationSecs || 0,
    createdAt: conversation.createdAt,
    messages: Array.isArray(conversation.messages)
      ? conversation.messages.map((message) => ({
          role: message.role,
          message: message.message || '',
          timeInCallSecs: message.timeInCallSecs || 0,
        }))
      : [],
  };
}
