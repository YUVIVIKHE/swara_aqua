// Swara Aqua — FCM service worker (runs when app is closed or killed)
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

const DEFAULT_PATHS = {
  order: '/customer/orders',
  payment: '/customer/wallet',
  delivery: '/staff/deliveries',
  approval: '/admin/users',
  stock: '/admin/inventory',
  general: '/',
};

// Synchronous dedup — push + onBackgroundMessage must not both show the same alert
const shownTags = new Set();

function resolvePath(type, data) {
  if (data.path && String(data.path).startsWith('/')) return data.path;
  if (data.url) {
    try {
      var u = new URL(data.url);
      if (u.pathname) return u.pathname;
    } catch (e) { /* ignore */ }
  }
  return DEFAULT_PATHS[type] || DEFAULT_PATHS.order;
}

function extractPayload(raw) {
  if (!raw) return { title: 'Swara Aqua', body: 'You have a new update', data: {} };

  var data = raw.data || {};
  var title = raw.notification?.title || data.title || 'Swara Aqua';
  var body = raw.notification?.body || data.body || 'You have a new update';

  return { title: title, body: body, data: data };
}

function showSystemNotification(raw) {
  var extracted = extractPayload(raw);
  var title = extracted.title;
  var body = extracted.body;
  var data = extracted.data;
  var type = data.type || 'general';
  var orderId = data.orderId || '';
  var path = resolvePath(type, data);
  var tag = 'swara-' + type + '-' + (orderId || 'alert');

  if (shownTags.has(tag)) return Promise.resolve();
  shownTags.add(tag);
  setTimeout(function() { shownTags.delete(tag); }, 30000);

  var displayTitle = String(title).includes('Swara Aqua') ? title : 'Swara Aqua — ' + title;

  return self.registration.showNotification(displayTitle, {
    body: String(body),
    icon: ICON,
    badge: BADGE,
    silent: true,
    requireInteraction: false,
    tag: tag,
    renotify: false,
    timestamp: Date.now(),
    data: { type: type, orderId: orderId, path: path, url: ORIGIN + path },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  });
}

// Only use onBackgroundMessage — do NOT also listen to "push" (causes duplicate alerts)
messaging.onBackgroundMessage(function(payload) {
  return showSystemNotification(payload);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;

  var data = event.notification.data || {};
  var path = data.path || DEFAULT_PATHS.order;
  var url = ORIGIN + path;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        var client = list[i];
        if (client.url.indexOf(ORIGIN) === 0 && 'focus' in client) {
          if ('navigate' in client) client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
