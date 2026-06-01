import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: 'Missing referral code' }, { status: 400 });
    }

    await dbConnect();
    
    // Find the current user
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Initialize gamification if missing
    if (!user.gamification) {
      user.gamification = { xp: 0, level: 1, streakDays: 0, badges: [], referralCount: 0, milestoneFlags: {} };
    }

    // Check if user already used a referral code
    if (user.gamification.referredBy) {
      return NextResponse.json({ error: 'Already referred' }, { status: 400 });
    }

    // Find the referrer
    const referrer = await User.findOne({ 'gamification.referralCode': code });
    if (!referrer || referrer._id.toString() === user._id.toString()) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 });
    }

    // 1. Update the new user
    user.gamification.referredBy = code;
    user.gamification.xp += 50; // Welcome bonus
    user.markModified('gamification');
    await user.save();

    // 2. Update the referrer
    if (!referrer.gamification) referrer.gamification = { xp: 0, level: 1, streakDays: 0, badges: [], referralCount: 0 };
    
    referrer.gamification.referralCount = (referrer.gamification.referralCount || 0) + 1;
    referrer.gamification.xp += 200; // Reward for referring
    
    // Pioneer badge for first referral
    if (referrer.gamification.referralCount === 1) {
      if (!referrer.gamification.badges) referrer.gamification.badges = [];
      if (!referrer.gamification.badges.some(b => b.id === 'pioneer')) {
        referrer.gamification.badges.push({ id: 'pioneer', earnedAt: new Date() });
      }
    }
    
    referrer.markModified('gamification');
    await referrer.save();

    return NextResponse.json({ success: true, bonusXP: 50 });
  } catch (error) {
    console.error('[gamification/referral] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
