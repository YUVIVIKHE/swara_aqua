import { useEffect, useRef, useCallback } from 'react';

type SSEHandler = (data: any) => void;

/**
 * Custom hook to subscribe to Server-Sent Events.
 *
 * Usage:
 *   useSSE({
 *     order_created:        () => refetchOrders(),
 *     order_status_changed: (data) => handleStatusChange(data),
 *   });
 *
 * Automatically connects using the stored JWT token,
 * reconnects on disconnect with exponential backoff,
 * and cleans up on unmount.
 */
export const useSSE = (handlers: Record<string, SSEHandler>) => {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const retriesRef = useRef(0);
  const handlersRef = useRef(handlers);

  // Keep handlers ref current without re-triggering effect
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Build URL — use relative path so it works with Vite proxy in dev
    // and directly in production
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/api/events?token=${encodeURIComponent(token)}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      retriesRef.current = 0; // Reset backoff on successful connect
    };

    // Listen for the connected confirmation
    es.addEventListener('connected', () => {
      console.log('[SSE] Connected');
    });

    // Register all event handlers
    const eventNames = Object.keys(handlersRef.current);
    for (const eventName of eventNames) {
      es.addEventListener(eventName, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          handlersRef.current[eventName]?.(data);
        } catch (err) {
          console.warn(`[SSE] Failed to parse "${eventName}" event:`, err);
        }
      });
    }

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;

      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000);
      retriesRef.current++;
      console.log(`[SSE] Reconnecting in ${delay / 1000}s (attempt ${retriesRef.current})`);

      reconnectTimerRef.current = setTimeout(connect, delay);
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);
};
