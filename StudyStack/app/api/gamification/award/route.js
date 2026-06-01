import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';

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
  for (const t of LEVEL_THRESHOLDS) {
    if (xp >= t.minXP) lvl = t;
  }
  return lvl;
}

// ── XP + badge award map ──────────────────────────────────────────────────────
const AWARD_MAP = {
  profile_complete:       { xp: 100, badge: 'profile_pioneer',  flag: 'profileComplete' },
  session_complete:       { xp: 50,  badge: 'first_chat',       flag: 'firstSession' },
  streak_checkin:         { xp: 25,  badge: null,               flag: null },
  ielts_score_added:      { xp: 150, badge: 'test_warrior',     flag: 'ieltsScoreAdded' },
  shortlist_done:         { xp: 100, badge: 'shortlist_pro',    flag: 'shortlistDone' },
  sop_done:               { xp: 120, badge: 'sop_master',       flag: 'sopDone' },
  application_submitted:  { xp: 200, badge: 'application_ace',  flag: 'applicationSubmitted' },
  visa_done:              { xp: 250, badge: 'visa_champion',    flag: 'visaDone' },
  referral_joined:        { xp: 200, badge: 'pioneer',          flag: null },
  welcome_bonus:          { xp: 50,  badge: null,               flag: null },
};

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await req.json();
    const award = AWARD_MAP[action];
    if (!award) {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Ensure gamification subdoc exists
    if (!user.gamification) {
      user.gamification = { xp: 0, level: 1, streakDays: 0, badges: [], referralCount: 0, milestoneFlags: {} };
    }

    const g = user.gamification;
    const oldLevel = g.level || 1;
    let xpToAward = award.xp;
    const newBadges = [];

    // Streak multiplier for streak_checkin
    if (action === 'streak_checkin') {
      const streak = Math.min(g.streakDays || 1, 7);
      xpToAward = 25 * streak;

      // Update streak
      const now = new Date();
      const lastActive = g.lastActiveDate ? new Date(g.lastActiveDate) : null;
      
      if (lastActive) {
        // To accurately check calendar days, compare date strings
        const lastDateStr = lastActive.toISOString().split('T')[0];
        const nowDateStr = now.toISOString().split('T')[0];
        
        if (lastDateStr === nowDateStr) {
          // Already checked in today!
          return NextResponse.json({
            xp: g.xp, level: g.level, newBadges: [], levelUp: false, alreadyEarned: true, streakDays: g.streakDays || 1
          });
        }

        // Calculate if it's the very next day
        const lastDate = new Date(lastDateStr);
        const currDate = new Date(nowDateStr);
        const diffDays = Math.round((currDate - lastDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          g.streakDays = (g.streakDays || 0) + 1;
        } else if (diffDays > 1) {
          g.streakDays = 1;
        }
      } else {
        g.streakDays = 1;
      }
      g.lastActiveDate = now;

      // Streak badge at 7 days
      if (g.streakDays >= 7 && !g.badges.some(b => b.id === 'streak_7')) {
        g.badges.push({ id: 'streak_7', earnedAt: new Date() });
        newBadges.push('streak_7');
      }
    }

    // Flag-based dedup: only award once per milestone
    if (award.flag) {
      if (!g.milestoneFlags) g.milestoneFlags = {};
      if (g.milestoneFlags[award.flag]) {
        // Already earned — return current state without re-awarding
        return NextResponse.json({
          xp: g.xp, level: g.level, newBadges: [], levelUp: false, alreadyEarned: true,
        });
      }
      g.milestoneFlags[award.flag] = true;
    }

    // Award XP
    g.xp = (g.xp || 0) + xpToAward;

    // Award badge (dedup)
    if (award.badge && !g.badges.some(b => b.id === award.badge)) {
      g.badges.push({ id: award.badge, earnedAt: new Date() });
      newBadges.push(award.badge);
    }

    // Compute new level
    const newLevelObj = computeLevel(g.xp);
    g.level = newLevelObj.level;
    const levelUp = newLevelObj.level > oldLevel;

    user.markModified('gamification');
    await user.save();

    return NextResponse.json({
      xp: g.xp,
      level: g.level,
      levelName: newLevelObj.name,
      xpAwarded: xpToAward,
      newBadges,
      levelUp,
      streakDays: g.streakDays || 0,
    });
  } catch (error) {
    console.error('[gamification/award] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
