"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, ChevronRight } from "lucide-react";

export default function SmartNudge({ status, profile }) {
  const [nudge, setNudge] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!status) return;

    // Determine the highest priority nudge
    let currentNudge = null;
    const now = new Date();
    const todayStr = now.toDateString();

    // 1. Streak risk
    if (status.streakDays > 0) {
      const lastActive = status.lastActiveDate ? new Date(status.lastActiveDate) : null;
      if (lastActive && lastActive.toDateString() !== todayStr) {
        currentNudge = {
          id: 'streak_risk',
          title: "Don't break your streak! 🔥",
          message: "Check in to earn your daily XP multiplier.",
          actionLabel: "Claim Daily XP",
          action: () => alert("Daily XP Claimed!") // In a real app, this might just close or trigger an API
        };
      }
    }

    // 2. Profile completion reminder
    if (!currentNudge && status.milestoneFlags && !status.milestoneFlags.profileComplete) {
      currentNudge = {
        id: 'profile_incomplete',
        title: "Profile Incomplete",
        message: "Finish your profile to unlock accurate university matching.",
        actionLabel: "Complete Profile",
        action: () => window.location.href = '/dashboard'
      };
    }

    // 3. Referral reminder (if they have no referrals but are active)
    if (!currentNudge && status.referralCount === 0) {
      currentNudge = {
        id: 'referral_reminder',
        title: "Invite & Earn 🎁",
        message: "Invite friends to StudyStack and earn 200 XP each!",
        actionLabel: "Share Link",
        action: () => {
          document.getElementById('referral-section')?.scrollIntoView({ behavior: 'smooth' });
        }
      };
    }

    // 4. Fallback welcome nudge for new users
    if (!currentNudge && status.level === 1 && status.xp < 100) {
      currentNudge = {
        id: 'welcome_nudge',
        title: "Welcome to StudyStack! 🎓",
        message: "Complete your profile or talk to Anam AI to start earning XP.",
        actionLabel: "Get Started",
        action: () => {}
      };
    }

    if (currentNudge) {
      // Check if we already dismissed this specific nudge today
      const dismissed = localStorage.getItem(`nudge_dismissed_${currentNudge.id}`);
      if (dismissed !== todayStr) {
        setNudge(currentNudge);
        // Delay showing it slightly
        const t = setTimeout(() => setShow(true), 3000);
        return () => clearTimeout(t);
      }
    }
  }, [status, profile]);

  const handleDismiss = () => {
    setShow(false);
    if (nudge) {
      localStorage.setItem(`nudge_dismissed_${nudge.id}`, new Date().toDateString());
    }
  };

  return (
    <AnimatePresence>
      {show && nudge && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-28 right-6 z-50 max-w-sm w-[calc(100%-3rem)] bg-card border border-border/50 shadow-2xl rounded-2xl overflow-hidden"
        >
          {/* Subtle gradient strip at top */}
          <div className="h-1 w-full bg-linear-to-r from-emerald-500 to-teal-500" />
          
          <div className="p-4">
            <button 
              onClick={handleDismiss}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 shrink-0">
                <Bell className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <h4 className="ivy-font text-sm font-black text-foreground">{nudge.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {nudge.message}
                </p>
                <button
                  onClick={() => { handleDismiss(); nudge.action(); }}
                  className="mt-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 flex items-center gap-1"
                >
                  {nudge.actionLabel} <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
