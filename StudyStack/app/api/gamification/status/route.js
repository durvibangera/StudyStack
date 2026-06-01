import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import crypto from 'crypto';

// ── Level thresholds ──────────────────────────────────────────────────────────
const LEVEL_THRESHOLDS = [
  { level: 1, name: 'Dreamer',          minXP: 0 },
  { level: 2, name: 'Explorer',         minXP: 200 },
  { level: 3, name: 'Applicant',        minXP: 500 },
  { level: 4, name: 'Candidate',        minXP: 1000 },
  { level: 5, name: 'Achiever',         minXP: 2000 },
  { level: 6, name: 'Departure Ready',  minXP: 3500 },
];

function computeLevel(xp) {
  let lvl = LEVEL_THRESHOLDS[0];
  let nextLvl = LEVEL_THRESHOLDS[1];
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i].minXP) {
      lvl = LEVEL_THRESHOLDS[i];
      nextLvl = LEVEL_THRESHOLDS[i + 1] || null;
    }
  }
  return { ...lvl, nextXP: nextLvl ? nextLvl.minXP : null };
}

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Initialize gamification if missing
    let g = user.gamification;
    let modified = false;
    
    if (!g) {
      g = { xp: 0, level: 1, streakDays: 0, badges: [], referralCount: 0, milestoneFlags: {} };
      user.gamification = g;
      modified = true;
    }
    
    // Generate referral code if missing
    if (!g.referralCode) {
      // 6 char alphanumeric
      g.referralCode = crypto.randomBytes(3).toString('hex').toUpperCase();
      user.gamification = g;
      modified = true;
    }

    if (modified) {
      user.markModified('gamification');
      await user.save();
    }

    const lvlObj = computeLevel(g.xp || 0);

    return NextResponse.json({
      xp: g.xp || 0,
      level: lvlObj.level,
      levelName: lvlObj.name,
      nextLevelXP: lvlObj.nextXP,
      streakDays: g.streakDays || 0,
      lastActiveDate: g.lastActiveDate,
      badges: g.badges || [],
      referralCode: g.referralCode,
      referralCount: g.referralCount || 0,
      milestoneFlags: g.milestoneFlags || {},
    });
  } catch (error) {
    console.error('[gamification/status] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
