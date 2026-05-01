import { useEffect, useRef } from 'react';

type SSEHandler = (data: any) => void;

// Poll interval in ms — 15s is a good balance of freshness vs server load
const POLL_INTERVAL = 15_000;

/**
 * Polling-based replacement for SSE.
 *
 * Hostinger's reverse proxy kills long-lived SSE connections with 504.
 * This hook calls all provided handlers on a fixed interval instead,
 * which achieves the same "auto-refresh" effect without a persistent connection.
 *
 * Usage is identical to the old useSSE hook — no changes needed in consumers.
 *
 *   useSSE({
 *     order_created:        () => refetchOrders(),
 *     order_status_changed: () => handleStatusChange(),
 *   });
 */
export const useSSE = (handlers: Record<string, SSEHandler>) => {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const timer = setInterval(() => {
      // Call every handler with no data — consumers only use them as refresh triggers
      for (const fn of Object.values(handlersRef.current)) {
        try { fn({}); } catch {}
      }
    }, POLL_INTERVAL);

    return () => clearInterval(timer);
  }, []);
};
