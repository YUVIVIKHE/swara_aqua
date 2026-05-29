/** Prevent the same alert from showing twice within a short window (SSE + FCM + local). */
const seen = new Map<string, number>();
const TTL_MS = 20_000;

export const shouldShowNotification = (
  type: string,
  title: string,
  body: string,
  orderId?: string
): boolean => {
  const key = orderId
    ? `${type}:${orderId}`
    : `${type}:${title}:${body}`;

  const now = Date.now();
  const prev = seen.get(key);
  if (prev != null && now - prev < TTL_MS) return false;

  seen.set(key, now);
  if (seen.size > 80) {
    for (const [k, t] of seen) {
      if (now - t > TTL_MS) seen.delete(k);
    }
  }
  return true;
};
