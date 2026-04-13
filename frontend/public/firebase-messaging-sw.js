// Firebase Cloud Messaging Service Worker
// This file MUST be at the root of your public folder (served at /firebase-messaging-sw.js)

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// These values are injected at runtime via the VITE env — for the SW we hardcode them.
// Replace with your actual Firebase config values.
firebase.initializeApp({
  apiKey:            'AIzaSyBuM5DkMqfW-STRiEyi3OCIVWk8E3aHz7g',
  authDomain:        'waterdelivery-a2126.firebaseapp.com',
  projectId:         'waterdelivery-a2126',
  storageBucket:     'waterdelivery-a2126.firebasestorage.app',
  messagingSenderId: '86432708341',
  appId:             '1:86432708341:web:d89c23e595ca4df023b7bc',
});

const messaging = firebase.messaging();

// Handle background messages (app in background or killed)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const { title, body } = payload.notification || {};
  const data = payload.data || {};

  const notificationTitle = title || 'Swara Aqua';
  const notificationOptions = {
    body:    body || '',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data:    data,
    actions: [
      { action: 'open',    title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss'  },
    ],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const data = event.notification.data || {};
  const type = data.type || 'general';

  const screenMap = {
    order:    '/customer/orders',
    payment:  '/customer/payments',
    delivery: '/staff/deliveries',
    approval: '/admin/users',
    stock:    '/admin',
    general:  '/',
  };

  const url = (self.location.origin) + (screenMap[type] || '/');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new tab
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
