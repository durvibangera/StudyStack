'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle, Send, X, Sparkles, Loader2, Bot, User,
  ChevronDown, Calculator, FileText, Search, RefreshCcw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

/* ── Chat Message Bubble ──────────────────────────────────────────────────── */
function ChatMessage({ message, isLast }: { message: any; isLast: boolean }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} ${isLast ? 'animate-in slide-in-from-bottom-2 duration-300' : ''}`}>
      {/* Avatar */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
        isUser ? 'bg-emerald-500/15 text-emerald-500' : 'bg-violet-500/15 text-violet-500'
      }`}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message */}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-emerald-500 text-white rounded-tr-sm'
          : 'bg-muted/20 border border-border/30 text-foreground rounded-tl-sm'
      }`}>
        {isUser ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:text-sm [&_p]:leading-relaxed [&_p]:my-1.5 [&_ul]:text-sm [&_ol]:text-sm [&_li]:my-0.5 [&_strong]:text-foreground [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}

        {/* Action Buttons */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border/20 pt-3">
            {message.actions.map((action: any, i: number) => (
              <button
                key={i}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-500 hover:bg-emerald-500/20 transition-colors"
              >
                {action.type === 'calculateEMI' && <Calculator className="h-3 w-3" />}
                {action.type === 'showDocChecklist' && <FileText className="h-3 w-3" />}
                {action.type === 'viewOffers' && <Search className="h-3 w-3" />}
                {action.type === 'checkEligibility' && <RefreshCcw className="h-3 w-3" />}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Typing Indicator ─────────────────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-in slide-in-from-bottom-2 duration-200">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
        <Bot className="h-4 w-4 text-violet-500" />
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-muted/20 border border-border/30 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-violet-500/60 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="h-2 w-2 rounded-full bg-violet-500/60 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="h-2 w-2 rounded-full bg-violet-500/60 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

/* ── Quick Action Chips ───────────────────────────────────────────────────── */
const QUICK_ACTIONS = [
  'What loans am I eligible for?',
  'What documents do I need?',
  'Can I get a loan without collateral?',
  'Help me plan my EMI',
  'What are my financing options?',
];

/* ── Main Component ───────────────────────────────────────────────────────── */
export default function LoanChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Load chat history when opened
  useEffect(() => {
    if (isOpen && !hasLoadedHistory) {
      loadHistory();
    }
  }, [isOpen, hasLoadedHistory]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/loan/chat');
      if (res.ok) {
        const data = await res.json();
        if (data.history && data.history.length > 0) {
          setMessages(data.history);
        }
      }
    } catch (e) {
      console.error('Failed to load chat history:', e);
    }
    setHasLoadedHistory(true);
  };

  const sendMessage = useCallback(async (messageText?: string) => {
    const text = (messageText || input).trim();
    if (!text || isLoading) return;

    const userMessage = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/loan/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationHistory: messages.slice(-10),
        }),
      });

      if (!res.ok) throw new Error('Failed to get response');

      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        actions: data.actions,
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-border/30 px-6 py-4 bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/20">
            <Sparkles className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-card" />
            </span>
          </div>
          <div>
            <h3 className="text-sm font-black text-foreground">Aria — Loan Assistant</h3>
            <p className="text-[10px] text-muted-foreground font-medium">Policy-aware AI financing copilot</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-4">
              <MessageCircle className="h-7 w-7 text-violet-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Hi! I&apos;m Aria</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              Your AI financing assistant. I understand lender policies and can help you find the best education loan.
            </p>

            {/* Quick Actions */}
            <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-md">
              {QUICK_ACTIONS.map(action => (
                <button
                  key={action}
                  onClick={() => sendMessage(action)}
                  className="rounded-full border border-border/40 bg-muted/10 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-500 transition-all"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} isLast={i === messages.length - 1} />
          ))
        )}

        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border/30 p-4 bg-card/80 backdrop-blur-sm">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about loans, eligibility, documents..."
              rows={1}
              className="w-full resize-none rounded-xl border border-border/40 bg-muted/10 px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
              style={{ minHeight: '44px', maxHeight: '120px' }}
              disabled={isLoading}
            />
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 shrink-0"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground/50 text-center">
          Answers based on uploaded lender policies · Not financial advice
        </p>
      </div>
    </div>
  );
}

/* ── Floating Toggle Button (used externally) ─────────────────────────────── */
export function LoanChatToggle({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-300 ${
        isOpen
          ? 'bg-muted/80 text-muted-foreground hover:bg-muted scale-90'
          : 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white hover:scale-110 shadow-violet-500/30'
      }`}
    >
      {isOpen ? <ChevronDown className="h-5 w-5" /> : <MessageCircle className="h-6 w-6" />}
      {!isOpen && (
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-background" />
        </span>
      )}
    </button>
  );
}
