import {
  createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { getToken, onMessage } from 'firebase/messaging';
import { useAuth, type Role } from './AuthContext';
import api from '../api/axios';
import { getFirebaseMessaging } from '../config/firebase';
import { useToast } from '../components/ui/Toast';
import { playNotificationSound } from '../utils/notificationSound';
import { notificationScreenPath } from '../utils/notificationRoutes';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY
  || 'BNutSNz9HosmoEOeGzgz2TibmCtwPBKpgJaq0ty57b0zL1PUHbKSX4bNOKlrvHW16Ej8n5TSdkjiOpVnDvj5eMk';

const API_ORIGIN = import.meta.env.VITE_API_URL || '';

export interface AppNotification {
  id: number;
  title: string;
  body: string;
  type: string;
  is_read: number;
  created_at: string;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  permission: NotificationPermission | 'unsupported';
  sseConnected: boolean;
  pushEnabled: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  enablePush: () => Promise<boolean>;
  unregisterPush: () => Promise<void>;
  showBrowserAlert: (title: string, body: string, type: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const prevUnread = useRef(0);
  const fcmRegistered = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const showBrowserAlert = useCallback((title: string, body: string, type: string) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const role = (user?.role || 'customer') as Role;
    const n = new Notification(`Swara Aqua — ${title}`, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `swara-${type}-${Date.now()}`,
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      navigate(notificationScreenPath(type, role));
      n.close();
    };
  }, [navigate, user?.role]);

  const handleIncoming = useCallback((title: string, body: string, type: string, playSound = true) => {
    if (playSound) playNotificationSound();
    showBrowserAlert(title, body, type);
    toast(`${title}: ${body}`, 'success');
  }, [showBrowserAlert, toast]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications);
      const count = data.unreadCount as number;
      if (count > prevUnread.current && prevUnread.current > 0 && !sseConnected) {
        const latest = (data.notifications as AppNotification[]).find(n => !n.is_read);
        if (latest) handleIncoming(latest.title, latest.body, latest.type, true);
      }
      prevUnread.current = count;
      setUnreadCount(count);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [user, sseConnected, handleIncoming]);

  const markRead = useCallback(async (id: number) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    prevUnread.current = Math.max(0, prevUnread.current - 1);
  }, []);

  const markAllRead = useCallback(async () => {
    await api.patch('/notifications/read-all');
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
    prevUnread.current = 0;
  }, []);

  const registerFcmToken = useCallback(async (): Promise<boolean> => {
    if (!user || fcmRegistered.current) return pushEnabled;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return false;

      const messaging = await getFirebaseMessaging();
      if (!messaging) return false;

      const registration = await navigator.serviceWorker.ready;
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (!token) return false;

      await api.post('/notifications/register-token', { token, platform: 'web' });
      localStorage.setItem('fcm_token', token);
      fcmRegistered.current = true;
      setPushEnabled(true);

      onMessage(messaging, (payload) => {
        const title = payload.notification?.title || payload.data?.title || 'Notification';
        const body = payload.notification?.body || payload.data?.body || '';
        const type = (payload.data?.type as string) || 'general';
        handleIncoming(title, body, type, true);
        refresh();
      });

      return true;
    } catch (err) {
      console.error('[FCM] registration failed:', err);
      return false;
    }
  }, [user, pushEnabled, handleIncoming, refresh]);

  const enablePush = useCallback(async () => registerFcmToken(), [registerFcmToken]);

  const unregisterPush = useCallback(async () => {
    const token = localStorage.getItem('fcm_token');
    if (token) {
      try {
        await api.delete('/notifications/token', { data: { token } });
      } catch { /* ignore */ }
      localStorage.removeItem('fcm_token');
    }
    fcmRegistered.current = false;
    setPushEnabled(false);
  }, []);

  // Initial load + fallback poll when SSE is down
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      prevUnread.current = 0;
      fcmRegistered.current = false;
      return;
    }

    refresh();
    if (!fcmRegistered.current) registerFcmToken();

    const pollMs = sseConnected ? 120_000 : 15_000;
    const interval = setInterval(refresh, pollMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, sseConnected]);

  // SSE — real-time notification stream
  useEffect(() => {
    if (!user) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setSseConnected(false);
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const base = API_ORIGIN ? `${API_ORIGIN}/api` : '/api';
    const url = `${base}/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => setSseConnected(true));
    es.addEventListener('error', () => setSseConnected(false));

    es.addEventListener('notification', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data);
        const title = data.title || 'Notification';
        const body = data.body || '';
        const type = data.type || 'general';
        handleIncoming(title, body, type, true);
        refresh();
      } catch { refresh(); }
    });

    return () => {
      es.close();
      setSseConnected(false);
    };
  }, [user?.id, handleIncoming, refresh]);

  const value: NotificationContextValue = {
    notifications,
    unreadCount,
    permission,
    sseConnected,
    pushEnabled,
    loading,
    refresh,
    markRead,
    markAllRead,
    enablePush,
    unregisterPush,
    showBrowserAlert,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationCenter = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotificationCenter must be used within NotificationProvider');
  return ctx;
};
