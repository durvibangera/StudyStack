"use client";

import { useState } from "react";
import { Copy, Check, Users, Share2, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function ReferralCard({ referralCode, referralCount = 0 }) {
  const [copied, setCopied] = useState(false);

  const referralLink = `https://studystack.app/signup?ref=${referralCode || ''}`;
  const whatsappMsg = encodeURIComponent(`I'm using StudyStack to plan my study abroad journey 🎓 Join me and get 50 bonus XP! → ${referralLink}`);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const target = 5;
  const progressPct = Math.min(100, (referralCount / target) * 100);

  return (
    <div className="relative overflow-hidden bg-card/80 backdrop-blur-md border border-border/50 rounded-3xl p-8 shadow-sm mt-8">
      {/* Background decoration */}
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
      <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center justify-between">
        
        {/* Left: Info */}
        <div className="flex-1 text-center md:text-left">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
            <Users className="w-3.5 h-3.5" />
            Refer & Earn
          </div>
          <h3 className="ivy-font text-2xl md:text-3xl font-black text-foreground mb-2">
            Invite friends, earn XP together
          </h3>
          <p className="ivy-font text-muted-foreground text-sm max-w-md mx-auto md:mx-0">
            When a friend signs up with your link, they get 50 XP to start, and you get 200 XP and the Networker badge!
          </p>
        </div>

        {/* Right: Actions */}
        <div className="w-full md:w-auto flex flex-col items-center gap-4 bg-muted/30 border border-border/50 p-5 rounded-2xl">
          
          <div className="flex items-center gap-2 w-full">
            <div className="bg-background border border-border/50 rounded-xl px-4 py-3 flex-1 overflow-hidden">
              <p className="text-xs font-mono text-muted-foreground truncate select-all">{referralLink}</p>
            </div>
            <button 
              onClick={handleCopy}
              className="bg-violet-500 hover:bg-violet-600 text-white p-3 rounded-xl transition-colors shadow-lg shadow-violet-500/20"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex w-full gap-2">
            <a 
              href={`https://wa.me/?text=${whatsappMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 py-2.5 rounded-xl text-sm font-bold transition-colors"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
            <button 
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: 'StudyStack', text: decodeURIComponent(whatsappMsg), url: referralLink });
                } else {
                  handleCopy();
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground border border-border/50 py-2.5 rounded-xl text-sm font-bold transition-colors"
            >
              <Share2 className="w-4 h-4" /> Share
            </button>
          </div>

          <div className="w-full mt-2">
            <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
              <span>{referralCount} Joined</span>
              <span>Target: {target}</span>
            </div>
            <div className="h-1.5 w-full bg-border/50 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-linear-to-r from-violet-500 to-fuchsia-500"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
