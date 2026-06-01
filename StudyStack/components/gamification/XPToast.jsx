"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Star, Award, Zap } from "lucide-react";

export default function XPToast({ 
  show, 
  xpAmount, 
  reason, 
  levelUp = false, 
  newLevel = null, 
  badge = null,
  onComplete 
}) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (show) {
      // Generate random particles for the burst
      const numParticles = levelUp ? 40 : 20;
      const newParticles = Array.from({ length: numParticles }).map((_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 300,
        y: (Math.random() - 0.5) * 300 - 100,
        scale: Math.random() * 1.5 + 0.5,
        rotation: Math.random() * 360,
        color: ['#10b981', '#f59e0b', '#8b5cf6', '#0ea5e9'][Math.floor(Math.random() * 4)],
        delay: Math.random() * 0.2
      }));
      setParticles(newParticles);

      // Auto dismiss
      const timer = setTimeout(() => {
        if (onComplete) onComplete();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [show, levelUp, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
          
          {/* Particles Burst */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ x: 0, y: 0, scale: 0, rotate: 0, opacity: 1 }}
              animate={{ 
                x: p.x, 
                y: p.y, 
                scale: p.scale, 
                rotate: p.rotation,
                opacity: 0 
              }}
              transition={{ duration: 1.2, delay: p.delay, ease: "easeOut" }}
              className="absolute"
            >
              <Star fill={p.color} className="w-4 h-4" style={{ color: p.color }} />
            </motion.div>
          ))}

          {/* Main Content */}
          <motion.div
            initial={{ scale: 0.5, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: -50, opacity: 0 }}
            transition={{ type: "spring", damping: 15, stiffness: 200 }}
            className={`relative flex flex-col items-center justify-center p-8 rounded-3xl backdrop-blur-xl border border-white/20 shadow-2xl ${
              levelUp ? 'bg-linear-to-br from-violet-600/90 to-fuchsia-600/90' : 'bg-linear-to-br from-emerald-500/90 to-teal-600/90'
            }`}
          >
            {/* Glow orb behind */}
            <div className="absolute inset-0 rounded-3xl blur-3xl opacity-50 bg-white/30" />

            {/* Icon */}
            <motion.div 
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="relative z-10 flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-inner mb-4"
            >
              {levelUp ? (
                <Award className="w-10 h-10 text-violet-500" />
              ) : badge ? (
                <Star className="w-10 h-10 text-emerald-500" fill="currentColor" />
              ) : (
                <Zap className="w-10 h-10 text-emerald-500" fill="currentColor" />
              )}
            </motion.div>

            {/* Text */}
            <div className="relative z-10 text-center">
              {levelUp && (
                <motion.p 
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-white/80 font-bold uppercase tracking-[0.2em] text-sm mb-1"
                >
                  Level Up!
                </motion.p>
              )}
              
              <motion.h2 
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="ivy-font text-5xl font-black text-white drop-shadow-md"
              >
                {levelUp ? `Level ${newLevel}` : `+${xpAmount} XP`}
              </motion.h2>
              
              <motion.p 
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-2 text-white/90 font-medium text-lg"
              >
                {reason}
              </motion.p>

              {badge && (
                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", delay: 0.8 }}
                  className="mt-4 inline-flex items-center gap-2 bg-white/20 border border-white/30 rounded-full px-4 py-1.5"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span className="text-white text-sm font-bold">New Badge Unlocked</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
