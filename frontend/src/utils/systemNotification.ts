/**
 * Show a system notification (notification shade on mobile).
 * When a service worker controls the page, `new Notification()` throws —
 * use ServiceWorkerRegistration.showNotification() instead.
 */
export interface SystemNotificationOpts {
  body: string;
  type: string;
  orderId?: string;
  /** In-app route, e.g. /customer/orders — opened on notification click (SW handles). */
  path?: string;
}

export async function showSystemNotification(
  title: string,
  opts: SystemNotificationOpts
): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }

  const displayTitle = title.includes('Swara Aqua') ? title : `Swara Aqua — ${title}`;
  const tag = `swara-${opts.type}-${opts.orderId || 'general'}`;
  const icon = '/icons/icon-192.png';
  const data = {
    type: opts.type,
    orderId: opts.orderId || '',
    path: opts.path || '/',
  };

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(displayTitle, {
        body: opts.body,
        icon,
        badge: icon,
        tag,
        silent: true,
        data,
      });
      return;
    } catch (err) {
      console.warn('[notify] service worker notification failed:', err);
    }
  }

  try {
    new Notification(displayTitle, {
      body: opts.body,
      icon,
      badge: icon,
      tag,
      silent: true,
    });
  } catch (err) {
    console.warn('[notify] Notification constructor not allowed:', err);
  }
}
