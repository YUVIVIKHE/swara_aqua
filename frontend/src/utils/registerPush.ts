import { getToken } from 'firebase/messaging';
import { getFirebaseMessaging } from '../config/firebase';
import api from '../api/axios';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY
  || 'BNutSNz9HosmoEOeGzgz2TibmCtwPBKpgJaq0ty57b0zL1PUHbKSX4bNOKlrvHW16Ej8n5TSdkjiOpVnDvj5eMk';

const SW_URL = '/firebase-messaging-sw.js';

/** Ensure the FCM service worker is active (required for background push when app is closed). */
export const ensureMessagingServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) return null;

  let registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration?.active) {
    registration = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
  }
  await navigator.serviceWorker.ready;
  return registration;
};

/**
 * Request permission, obtain FCM token, and save it on the server.
 * Call after login and on app load so background notifications work.
 */
export const registerPushNotifications = async (
  requestPermission = true
): Promise<{ ok: boolean; token?: string; permission: NotificationPermission | 'unsupported' }> => {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return { ok: false, permission: 'unsupported' };
  }

  try {
    let permission = Notification.permission;
    if (requestPermission && permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      return { ok: false, permission };
    }

    const registration = await ensureMessagingServiceWorker();
    if (!registration) return { ok: false, permission };

    const messaging = await getFirebaseMessaging();
    if (!messaging) return { ok: false, permission };

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn('[FCM] No token — check VAPID key and Firebase console');
      return { ok: false, permission };
    }

    // Always sync token to server (user may have re-logged in on same device)
    await api.post('/notifications/register-token', { token, platform: 'web' });
    localStorage.setItem('fcm_token', token);
    console.log('[FCM] Token registered for background push');

    return { ok: true, token, permission };
  } catch (err) {
    console.error('[FCM] registerPushNotifications failed:', err);
    return { ok: false, permission: Notification.permission };
  }
};
