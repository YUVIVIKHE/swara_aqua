import { useEffect, useRef, useCallback } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { getFirebaseMessaging } from '../config/firebase';
import api from '../api/axios';
import { useToast } from '../components/ui/Toast';
import { useNavigate } from 'react-router-dom';
import { playNotificationSound } from '../utils/notificationSound';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BNutSNz9HosmoEOeGzgz2TibmCtwPBKpgJaq0ty57b0zL1PUHbKSX4bNOKlrvHW16Ej8n5TSdkjiOpVnDvj5eMk';

const SCREEN_MAP: Record<string, string> = {
  order:    '/customer/orders',
  payment:  '/customer/payments',
  delivery: '/staff/deliveries',
  approval: '/admin/users',
  stock:    '/admin',
  general:  '/',
};

export const useNotifications = (userId?: number) => {
  const { toast } = useToast();
  const navigate  = useNavigate();
  const tokenSent = useRef(false);

  const requestAndRegister = useCallback(async () => {
    if (!userId || tokenSent.current) return;

    try {
      // 1. Request browser permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission denied');
        return;
      }

      // 2. Get messaging instance
      const messaging = await getFirebaseMessaging();
      if (!messaging) {
        console.warn('Firebase Messaging not supported in this browser');
        return;
      }

      // 3. Get FCM token
      const token = await getToken(messaging, {
        vapidKey:            VAPID_KEY,
        serviceWorkerRegistration: await navigator.serviceWorker.register(
          '/firebase-messaging-sw.js',
          { scope: '/' }
        ),
      });

      if (!token) {
        console.warn('No FCM token received');
        return;
      }

      // 4. Send token to backend
      await api.post('/notifications/register-token', { token, platform: 'web' });
      tokenSent.current = true;
      console.log('✅ FCM token registered');

      // 5. Handle token refresh
      // (FCM tokens can rotate — re-register on next mount if needed)
      localStorage.setItem('fcm_token', token);

      // 6. Foreground message handler
      onMessage(messaging, (payload) => {
        console.log('[FCM] Foreground message:', payload);

        const title = payload.notification?.title || 'Swara Aqua';
        const body  = payload.notification?.body  || '';
        const type  = (payload.data?.type as string) || 'general';

        // Play notification sound
        playNotificationSound();

        // Show in-app toast
        toast(`${title}: ${body}`, 'success');

        // Also show a browser notification even in foreground
        if (Notification.permission === 'granted') {
          const n = new Notification(title, {
            body,
            icon:  '/icons/icon-192x192.png',
            badge: '/icons/badge-72x72.png',
          });

          n.onclick = () => {
            window.focus();
            navigate(SCREEN_MAP[type] || '/');
            n.close();
          };
        }
      });

    } catch (err) {
      console.error('FCM setup error:', err);
    }
  }, [userId, toast, navigate]);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    requestAndRegister();
  }, [requestAndRegister]);

  // Unregister token on logout
  const unregisterToken = useCallback(async () => {
    const token = localStorage.getItem('fcm_token');
    if (!token) return;
    try {
      await api.delete('/notifications/token', { data: { token } });
      localStorage.removeItem('fcm_token');
      tokenSent.current = false;
    } catch {}
  }, []);

  return { unregisterToken };
};
