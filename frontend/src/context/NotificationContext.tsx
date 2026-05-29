import {
  createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { onMessage } from 'firebase/messaging';
import { useAuth, type Role } from './AuthContext';
import api from '../api/axios';
import { getFirebaseMessaging } from '../config/firebase';
import { registerPushNotifications } from '../utils/registerPush';
import { useToast } from '../components/ui/Toast';
import { playNotificationSound } from '../utils/notificationSound';
import { notificationScreenPath } from '../utils/notificationRoutes';

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
  showBrowserAlert: (title: string, body: string, type: string, orderId?: string) => void;
  /** Instant sound + system notification (e.g. right after placing an order). */
  pushLocal: (title: string, body: string, type: string, orderId?: string) => void;
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
  const handleIncomingRef = useRef<(typeof handleIncoming) | null>(null);
  const refreshRef = useRef<(() => Promise<void>) | null>(null);
  const userRoleRef = useRef(user?.role);

  const showBrowserAlert = useCallback((
    title: string,
    body: string,
    type: string,
    orderId?: string
  ) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const role = (user?.role || 'customer') as Role;
    const displayTitle = title.includes('Swara Aqua') ? title : `Swara Aqua — ${title}`;
    const n = new Notification(displayTitle, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `swara-${type}-${orderId || 'general'}`,
      silent: false,
      requireInteraction: false,
    });
    n.onclick = () => {
      window.focus();
      navigate(notificationScreenPath(type, role));
      n.close();
    };
  }, [navigate, user?.role]);

  const handleIncoming = useCallback((
    title: string,
    body: string,
    type: string,
    playSound = true,
    orderId?: string,
    showToast = true
  ) => {
    if (playSound) playNotificationSound();
    showBrowserAlert(title, body, type, orderId);
    if (showToast) toast(`${title}: ${body}`, 'success');
  }, [showBrowserAlert, toast]);

  const pushLocal = useCallback((
    title: string,
    body: string,
    type: string,
    orderId?: string
  ) => {
    handleIncoming(title, body, type, true, orderId, true);
  }, [handleIncoming]);

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

  const registerFcmToken = useCallback(async (askPermission = true): Promise<boolean> => {
    if (!user) return false;

    try {
      const result = await registerPushNotifications(askPermission);
      setPermission(result.permission);
      if (!result.ok) return false;

      fcmRegistered.current = true;
      setPushEnabled(true);

      const messaging = await getFirebaseMessaging();
      if (messaging) {
        onMessage(messaging, (payload) => {
          const title = payload.notification?.title || payload.data?.title || 'Notification';
          const body = payload.notification?.body || payload.data?.body || '';
          const type = (payload.data?.type as string) || 'general';
          const orderId = payload.data?.orderId as string | undefined;
          handleIncoming(title, body, type, true, orderId, true);
          refresh();
        });
      }

      return true;
    } catch (err) {
      console.error('[FCM] registration failed:', err);
      return false;
    }
  }, [user, handleIncoming, refresh]);

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

  handleIncomingRef.current = handleIncoming;
  refreshRef.current = refresh;
  userRoleRef.current = user?.role;

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
    // Always sync FCM token so background push works when app is closed
    registerFcmToken(Notification.permission === 'default');

    const pollMs = sseConnected ? 120_000 : 15_000;
    const interval = setInterval(refresh, pollMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, sseConnected]);

  // SSE — one connection per login; handlers via refs so we don't reconnect on every render
  useEffect(() => {
    if (!user) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setSseConnected(false);
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    eventSourceRef.current?.close();
    eventSourceRef.current = null;

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
        const orderId = data.data?.orderId || data.orderId;
        handleIncomingRef.current?.(title, body, type, true, orderId, true);
        void refreshRef.current?.();
      } catch {
        void refreshRef.current?.();
      }
    });

    es.addEventListener('order_created', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data);
        const orderId = String(data.orderId || '');
        const qty = data.quantity ?? '';
        if (userRoleRef.current === 'admin') {
          handleIncomingRef.current?.(
            'New Order 📦',
            `Order #${orderId}${qty ? ` — ${qty} jars` : ''} placed by customer`,
            'order',
            true,
            orderId,
            true
          );
          void refreshRef.current?.();
        }
      } catch { /* ignore */ }
    });

    return () => {
      es.close();
      if (eventSourceRef.current === es) eventSourceRef.current = null;
      setSseConnected(false);
    };
  }, [user?.id]);

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
    pushLocal,
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
