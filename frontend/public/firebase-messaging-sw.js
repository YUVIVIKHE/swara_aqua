// Swara Aqua — Firebase Cloud Messaging service worker
// Handles push when the app is closed or in the background (mobile notification panel).

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyBuM5DkMqfW-STRiEyi3OCIVWk8E3aHz7g',
  authDomain:        'waterdelivery-a2126.firebaseapp.com',
  projectId:         'waterdelivery-a2126',
  storageBucket:     'waterdelivery-a2126.firebasestorage.app',
  messagingSenderId: '86432708341',
  appId:             '1:86432708341:web:d89c23e595ca4df023b7bc',
});

const messaging = firebase.messaging();
const ORIGIN = self.location.origin;
const ICON = ORIGIN + '/icons/icon-192.png';
const BADGE = ORIGIN + '/icons/icon-192.png';
const IMAGE = ORIGIN + '/icons/icon-512.png';

const DEFAULT_PATHS = {
  order: '/customer/orders',
  payment: '/customer/wallet',
  delivery: '/staff/deliveries',
  approval: '/admin/users',
  stock: '/admin/inventory',
  general: '/',
};

function resolvePath(type, data) {
  if (data.path && String(data.path).startsWith('/')) return data.path;
  if (data.url) {
    try {
      const u = new URL(data.url);
      if (u.pathname) return u.pathname;
    } catch (e) { /* ignore */ }
  }
  return DEFAULT_PATHS[type] || DEFAULT_PATHS.order;
}

function extractPayload(raw) {
  if (!raw) return { title: 'Swara Aqua', body: 'You have a new update', data: {} };

  const data = raw.data || {};
  const title =
    raw.notification?.title ||
    data.title ||
    'Swara Aqua';
  const body =
    raw.notification?.body ||
    data.body ||
    'You have a new update';

  return { title, body, data };
}

/** Display in the phone notification shade (works when app is fully closed). */
function showSystemNotification(raw) {
  const { title, body, data } = extractPayload(raw);
  const type = data.type || 'general';
  const orderId = data.orderId || '';
  const path = resolvePath(type, data);
  const displayTitle = String(title).includes('Swara Aqua') ? title : 'Swara Aqua — ' + title;

  return self.registration.showNotification(displayTitle, {
    body: String(body),
    icon: ICON,
    badge: BADGE,
    image: IMAGE,
    silent: true,
    requireInteraction: false,
    tag: 'swara-' + type + '-' + (orderId || 'alert'),
    renotify: false,
    timestamp: Date.now(),
    data: { type, orderId, path, url: ORIGIN + path },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  });
}

// Firebase background handler (app in background or closed)
messaging.onBackgroundMessage(function(payload) {
  console.log('[FCM SW] background message', payload);
  // If FCM included a notification payload, the OS already shows it when the app is closed
  if (payload.notification) return;
  return showSystemNotification(payload);
});

// Raw Web Push fallback (some browsers when app is killed)
self.addEventListener('push', function(event) {
  if (!event.data) return;
  console.log('[FCM SW] push event');
  try {
    const raw = event.data.json();
    event.waitUntil(showSystemNotification(raw));
  } catch (e) {
    try {
      const text = event.data.text();
      event.waitUntil(showSystemNotification({
        data: { title: 'Swara Aqua', body: text || 'New notification' },
      }));
    } catch (e2) {
      console.warn('[FCM SW] push parse failed', e2);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const data = event.notification.data || {};
  const path = data.path || DEFAULT_PATHS.order;
  const url = ORIGIN + path;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        var client = list[i];
        if (client.url.indexOf(ORIGIN) === 0 && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
