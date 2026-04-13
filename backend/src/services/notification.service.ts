import admin from '../config/firebase';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface SendPayload {
  userId: number;
  title: string;
  body: string;
  type: 'order' | 'payment' | 'delivery' | 'approval' | 'stock' | 'general';
  data?: Record<string, string>;
}

// ── Token management ──────────────────────────────────────────────────────────

export const saveToken = async (userId: number, token: string, platform = 'web') => {
  await pool.query(
    `INSERT INTO device_tokens (user_id, token, platform)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), platform = VALUES(platform)`,
    [userId, token, platform]
  );
};

export const removeToken = async (token: string) => {
  await pool.query('DELETE FROM device_tokens WHERE token = ?', [token]);
};

export const getTokensByUserId = async (userId: number): Promise<string[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT token FROM device_tokens WHERE user_id = ?',
    [userId]
  );
  return rows.map(r => r.token);
};

export const getTokensByRole = async (role: string): Promise<string[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT dt.token FROM device_tokens dt
     JOIN users u ON u.id = dt.user_id
     WHERE u.role = ? AND u.status = 'active'`,
    [role]
  );
  return rows.map(r => r.token);
};

// ── Notification history ──────────────────────────────────────────────────────

export const saveNotification = async (payload: SendPayload): Promise<number> => {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO notifications (user_id, title, body, type, data)
     VALUES (?, ?, ?, ?, ?)`,
    [payload.userId, payload.title, payload.body, payload.type, JSON.stringify(payload.data || {})]
  );
  return result.insertId;
};

export const getNotifications = async (userId: number) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [userId]
  );
  return rows;
};

export const markAsRead = async (notificationId: number, userId: number) => {
  await pool.query(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [notificationId, userId]
  );
};

export const markAllAsRead = async (userId: number) => {
  await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
};

export const getUnreadCount = async (userId: number): Promise<number> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId]
  );
  return rows[0].count;
};

// ── FCM send ──────────────────────────────────────────────────────────────────

const buildMessage = (token: string, payload: SendPayload): admin.messaging.Message => ({
  token,
  notification: {
    title: payload.title,
    body:  payload.body,
  },
  webpush: {
    notification: {
      title: payload.title,
      body:  payload.body,
      icon:  '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      data: {
        type:   payload.type,
        ...(payload.data || {}),
      },
    },
    fcmOptions: {
      link: getScreenLink(payload.type, payload.data),
    },
  },
  android: {
    priority: 'high',
    notification: {
      sound:     'default',
      channelId: 'swara_aqua_default',
      priority:  'high',
      defaultSound: true,
    },
  },
  apns: {
    payload: {
      aps: {
        sound: 'default',
        badge: 1,
        contentAvailable: true,
      },
    },
  },
  data: {
    type:   payload.type,
    ...(payload.data || {}),
  },
});

const getScreenLink = (type: string, data?: Record<string, string>): string => {
  const base = process.env.FRONTEND_URL || 'http://localhost:5173';
  const map: Record<string, string> = {
    order:    '/customer/orders',
    payment:  '/customer/payments',
    delivery: '/staff/deliveries',
    approval: '/admin/users',
    stock:    '/admin',
    general:  '/',
  };
  return base + (map[type] || '/');
};

/**
 * Send to a single user — fans out to all their registered tokens.
 * Automatically removes stale/invalid tokens.
 */
export const sendToUser = async (payload: SendPayload): Promise<void> => {
  const tokens = await getTokensByUserId(payload.userId);
  if (!tokens.length) return;

  // Save to notification history
  await saveNotification(payload);

  const results = await Promise.allSettled(
    tokens.map(token =>
      admin.messaging().send(buildMessage(token, payload))
    )
  );

  // Clean up invalid tokens
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'rejected') {
      const code = (r.reason as any)?.errorInfo?.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        await removeToken(tokens[i]);
      }
    }
  }
};

/**
 * Broadcast to all users with a given role.
 */
export const sendToRole = async (
  role: string,
  title: string,
  body: string,
  type: SendPayload['type'],
  data?: Record<string, string>
): Promise<void> => {
  const tokens = await getTokensByRole(role);
  if (!tokens.length) return;

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title, body },
    webpush: {
      notification: {
        title, body,
        icon: '/icons/icon-192x192.png',
        requireInteraction: true,
      },
      fcmOptions: { link: getScreenLink(type, data) },
    },
    android: {
      priority: 'high',
      notification: { sound: 'default', channelId: 'swara_aqua_default', priority: 'high' },
    },
    data: { type, ...(data || {}) },
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  // Clean up invalid tokens
  response.responses.forEach(async (r, i) => {
    if (!r.success) {
      const code = (r.error as any)?.errorInfo?.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        await removeToken(tokens[i]);
      }
    }
  });
};
