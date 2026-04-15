// Firebase Cloud Messaging Service Worker
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

messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message:', payload);

  const title   = payload.notification?.title || payload.data?.title || 'Swara Aqua';
  const body    = payload.notification?.body  || payload.data?.body  || '';
  const type    = payload.data?.type || 'general';
  const orderId = payload.data?.orderId || '';

  self.registration.showNotification(title, {
    body,
    icon:               '/icons/icon-192.png',
    badge:              '/icons/icon-192.png',
    image:              '/icons/icon-512.png',
    vibrate:            [200, 100, 200, 100, 200],
    requireInteraction: false,
    tag:                `swara-${type}-${orderId || Date.now()}`,
    renotify:           true,
    silent:             false,
    data:               { type, orderId, url: self.location.origin },
    actions: [
      { action: 'open',    title: '📱 Open App' },
      { action: 'dismiss', title: 'Dismiss'     },
    ],
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const data = event.notification.data || {};
  const type = data.type || 'general';

  const screenMap = {
    order:    '/customer/orders',
    payment:  '/customer/wallet',
    delivery: '/staff/deliveries',
    approval: '/admin/users',
    stock:    '/admin/inventory',
    general:  '/',
  };

  const url = self.location.origin + (screenMap[type] || '/');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
