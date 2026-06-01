'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { X, Sparkles, Mic } from 'lucide-react';

const AnamVoiceAgent = dynamic(() => import('@/components/AnamVoiceAgent'), { ssr: false });

/**
 * FloatingCounsellor — A floating action button that opens a full-screen
 * Anam AI voice counsellor session on demand.
 *
 * Uses the app's emerald/teal accent palette instead of violet.
 */
export default function FloatingCounsellor() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-counsellor', handleOpen);
    return () => window.removeEventListener('open-counsellor', handleOpen);
  }, []);

  const handleComplete = useCallback(() => {
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent('counsellor:completed'));
  }, []);

  if (isOpen) {
    return (
      <div className="fixed inset-0 z-[9999] flex bg-background">
        <div className="relative flex-1">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute right-4 top-4 z-10 rounded-full border border-border/50 bg-card p-2.5 text-muted-foreground shadow-lg transition-all hover:text-foreground hover:scale-105"
            aria-label="Close counsellor"
          >
            <X className="h-5 w-5" />
          </button>
          <AnamVoiceAgent
            mode="buddy"
            onComplete={handleComplete}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Tooltip */}
      <div
        className={`absolute bottom-full right-0 mb-3 whitespace-nowrap rounded-xl border border-border/50 bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-xl backdrop-blur-sm transition-all duration-300 ${
          isHovered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
          <span>Talk to Aria — AI Counsellor</span>
        </div>
        <div className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-border/50 bg-card" />
      </div>

      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/30 transition-all duration-300 hover:scale-110 hover:shadow-emerald-500/50 active:scale-95"
        aria-label="Open AI Counsellor"
      >
        {/* Subtle pulse */}
        <span className="absolute inset-[-3px] rounded-full border-2 border-emerald-400/25 animate-pulse" />

        {/* Icon */}
        <Mic className="h-6 w-6 transition-transform group-hover:scale-110" />

        {/* Online dot */}
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-background" />
        </span>
      </button>
    </div>
  );
}
