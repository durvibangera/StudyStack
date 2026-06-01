"use client";

import { Award, Shield, Star, CheckCircle, GraduationCap, PenTool, Plane } from "lucide-react";
import { motion } from "framer-motion";

const ALL_BADGES = [
  { id: 'profile_pioneer', name: 'Profile Pioneer', desc: 'Completed basic profile', icon: Shield, color: 'text-blue-500', bg: 'bg-blue-500/20' },
  { id: 'first_chat', name: 'First Chat', desc: 'Completed AI session', icon: Star, color: 'text-fuchsia-500', bg: 'bg-fuchsia-500/20' },
  { id: 'streak_7', name: '7-Day Streak', desc: 'Maintained a week streak', icon: FlameIcon, color: 'text-orange-500', bg: 'bg-orange-500/20' },
  { id: 'test_warrior', name: 'Test Warrior', desc: 'Added IELTS/TOEFL score', icon: PenTool, color: 'text-rose-500', bg: 'bg-rose-500/20' },
  { id: 'shortlist_pro', name: 'Shortlist Pro', desc: 'Finalized target list', icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/20' },
  { id: 'sop_master', name: 'SOP Master', desc: 'Completed Statement of Purpose', icon: GraduationCap, color: 'text-indigo-500', bg: 'bg-indigo-500/20' },
  { id: 'application_ace', name: 'Application Ace', desc: 'Submitted first application', icon: Award, color: 'text-amber-500', bg: 'bg-amber-500/20' },
  { id: 'visa_champion', name: 'Visa Champion', desc: 'Approved visa', icon: Plane, color: 'text-sky-500', bg: 'bg-sky-500/20' },
  { id: 'pioneer', name: 'Networker', desc: 'Referred a friend', icon: UsersIcon, color: 'text-violet-500', bg: 'bg-violet-500/20' },
];

function FlameIcon(props) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>;
}

function UsersIcon(props) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}

export default function BadgeShowcase({ earnedBadges = [] }) {
  const earnedIds = new Set(earnedBadges.map(b => b.id));

  return (
    <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="ivy-font text-lg font-black text-foreground">Achievement Badges</h3>
          <p className="ivy-font text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">
            {earnedIds.size} of {ALL_BADGES.length} Unlocked
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-9 gap-4">
        {ALL_BADGES.map((badge, i) => {
          const isEarned = earnedIds.has(badge.id);
          const Icon = badge.icon;
          
          return (
            <motion.div 
              key={badge.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative group flex flex-col items-center"
            >
              <div 
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isEarned 
                    ? `${badge.bg} ring-2 ring-white/10 shadow-lg cursor-pointer hover:scale-110` 
                    : 'bg-muted border border-border/50 opacity-40 grayscale'
                }`}
              >
                <Icon className={`w-6 h-6 ${isEarned ? badge.color : 'text-muted-foreground'}`} />
              </div>
              
              <p className={`ivy-font mt-2 text-[10px] font-bold text-center leading-tight ${isEarned ? 'text-foreground' : 'text-muted-foreground'}`}>
                {badge.name}
              </p>

              {/* Tooltip */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-popover border border-border/50 shadow-xl px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 w-max max-w-[150px] text-center">
                <p className="text-[10px] font-bold text-popover-foreground">{badge.desc}</p>
                {!isEarned && <p className="text-[9px] text-muted-foreground mt-0.5 uppercase">Locked</p>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
