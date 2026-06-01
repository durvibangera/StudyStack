"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Flame, Star, Shield, Gift } from "lucide-react";

export default function GamificationHUD({ status }) {
  const [pulsing, setPulsing] = useState(false);
  const [prevXp, setPrevXp] = useState(null);

  // Trigger pulse animation when XP goes up
  useEffect(() => {
    if (status && prevXp !== null && status.xp > prevXp) {
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 2000);
      return () => clearTimeout(t);
    }
    if (status) setPrevXp(status.xp);
  }, [status, prevXp]);

  if (!status) return null;

  // Calculate progress to next level
  const minXP = status.level === 1 ? 0 : 
    (status.level === 2 ? 200 : 
    (status.level === 3 ? 500 : 
    (status.level === 4 ? 1000 : 
    (status.level === 5 ? 2000 : 3500))));
    
  const nextXP = status.nextLevelXP || 5000;
  const progressPct = Math.min(100, Math.max(0, ((status.xp - minXP) / (nextXP - minXP)) * 100));

  const hasCheckedInToday = () => {
    if (!status.lastActiveDate) return false;
    const last = new Date(status.lastActiveDate);
    const now = new Date();
    return last.getDate() === now.getDate() && last.getMonth() === now.getMonth() && last.getFullYear() === now.getFullYear();
  };
  
  const isStreakActive = hasCheckedInToday();

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-4 shadow-sm w-full mb-6">
      
      {/* Level & XP Bar */}
      <div className="flex-1 w-full relative">
        <div className="flex justify-between items-end mb-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-linear-to-br from-violet-500 to-fuchsia-500 shadow-md border border-white/20">
              <Star className="w-4 h-4 text-white" fill="currentColor" />
            </div>
            <div>
              <p className="ivy-font text-sm font-black text-foreground leading-none">Level {status.level}: {status.levelName}</p>
              <p className="ivy-font text-[10px] uppercase font-bold text-muted-foreground tracking-wider mt-1">{status.xp} XP</p>
            </div>
          </div>
          <p className="ivy-font text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{nextXP} XP</p>
        </div>
        
        <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden relative border border-border/50">
          <motion.div 
            className={`absolute top-0 left-0 h-full bg-linear-to-r from-violet-500 to-fuchsia-500 ${pulsing ? 'animate-pulse' : ''}`}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
          {pulsing && (
            <motion.div 
              className="absolute top-0 left-0 h-full bg-white opacity-50"
              initial={{ width: 0, x: 0 }}
              animate={{ width: "100%", x: "100%" }}
              transition={{ duration: 0.8 }}
            />
          )}
        </div>
      </div>

      {/* Streak */}
      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${isStreakActive ? 'bg-orange-500/10 border-orange-500/30' : 'bg-muted border-border/50'} transition-all`}>
        <Flame className={`w-5 h-5 ${isStreakActive ? 'text-orange-500 drop-shadow-md' : 'text-muted-foreground'}`} fill={isStreakActive ? 'currentColor' : 'none'} />
        <div>
          <p className={`ivy-font font-black text-sm leading-none ${isStreakActive ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>
            {status.streakDays} Day
          </p>
          <p className="ivy-font text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-1">Streak</p>
        </div>
      </div>

      {/* Shields/Rewards quick view */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
        <Gift className="w-5 h-5 text-emerald-500" />
        <div>
          <p className="ivy-font font-black text-sm leading-none text-emerald-600 dark:text-emerald-400">
            {status.referralCount}
          </p>
          <p className="ivy-font text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-1">Invites</p>
        </div>
      </div>

    </div>
  );
}
