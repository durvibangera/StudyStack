'use client';

import { useEffect, useRef } from 'react';

const POLL_INTERVAL_MS = 5000; // 5 seconds

/**
 * Invisible component that polls /api/whatsapp/poll at a fixed interval.
 * Mounts once in the dashboard layout so the bot can receive WhatsApp
 * messages without needing a publicly reachable webhook URL.
 */
export default function WhatsAppPoller() {
  const timerRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      if (!active) return;
      try {
        // Abort any previous in-flight request
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const res = await fetch('/api/whatsapp/poll', {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.processed > 0) {
            console.log(`[WhatsAppPoller] processed ${data.processed} message(s)`);
          }
        }
      } catch (err) {
        // Ignore abort errors and network errors
        if (err?.name === 'AbortError') return;
      }
      if (active) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    // Start polling after a short delay to avoid blocking page load
    timerRef.current = setTimeout(poll, 2000);

    return () => {
      active = false;
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Renders nothing
  return null;
}
