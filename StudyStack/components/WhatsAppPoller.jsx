'use client';

import { useEffect, useRef } from 'react';

const BASE_INTERVAL_MS = 5000;
const MAX_INTERVAL_MS = 120000; // 2 minutes max backoff

/**
 * Invisible component that polls /api/whatsapp/poll at a fixed interval.
 * Mounts once in the dashboard layout so the bot can receive WhatsApp
 * messages without needing a publicly reachable webhook URL.
 *
 * Backs off exponentially on repeated failures and stops entirely
 * if the server reports the feature is disabled (no WHAPI_TOKEN).
 */
export default function WhatsAppPoller() {
  const timerRef = useRef(null);
  const abortRef = useRef(null);
  const failCountRef = useRef(0);
  const disabledRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function poll() {
      if (!active || disabledRef.current) return;

      try {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const res = await fetch('/api/whatsapp/poll', {
          signal: controller.signal,
        });

        if (res.ok) {
          const data = await res.json();

          // If server says disabled (no WHAPI_TOKEN), stop polling entirely
          if (data.disabled) {
            disabledRef.current = true;
            return;
          }

          if (data.processed > 0) {
            console.log(`[WhatsAppPoller] processed ${data.processed} message(s)`);
          }

          // Reset fail count on success
          failCountRef.current = 0;
        } else {
          failCountRef.current += 1;
        }
      } catch (err) {
        if (err?.name === 'AbortError') return;
        failCountRef.current += 1;
      }

      if (active && !disabledRef.current) {
        // Exponential backoff: 5s, 10s, 20s, 40s, 80s, 120s max
        const delay = Math.min(
          BASE_INTERVAL_MS * Math.pow(2, failCountRef.current),
          MAX_INTERVAL_MS
        );
        timerRef.current = setTimeout(poll, delay);
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

  return null;
}
