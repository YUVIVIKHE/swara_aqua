import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Subscription {
  id: number;
  customer_id: number;
  address: string | null;
  status: 'active' | 'paused' | 'expired' | 'cancelled';
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  customer_phone?: string;
  slots?: SubscriptionSlot[];
}

export interface SubscriptionSlot {
  id: number;
  subscription_id: number;
  slot_label: string;
  delivery_time: string;
  quantity: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Get IST "now" - we rely on TZ=Asia/Kolkata or fallback manually */
const getIST = (): Date => {
  const now = new Date();
  // If TZ is set correctly this is already IST, otherwise offset
  return now;
};

const endOfMonth = (date: Date): string => {
  const y = date.getFullYear();
  const m = date.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

const today = (): string => {
  const d = getIST();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ── CRUD ──────────────────────────────────────────────────────────────────────

export const createSubscription = async (
  customerId: number,
  slots: { label: string; time: string; quantity: number }[],
  address?: string,
  autoRenew = false
): Promise<number> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Check for existing active subscription
    const [existing] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM subscriptions WHERE customer_id = ? AND status IN ('active','paused')`,
      [customerId]
    );
    if ((existing as RowDataPacket[]).length) {
      throw new Error('You already have an active subscription. Cancel or let it expire first.');
    }

    const startDate = today();
    const eom = endOfMonth(getIST());

    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO subscriptions (customer_id, address, status, start_date, end_date, auto_renew)
       VALUES (?, ?, 'active', ?, ?, ?)`,
      [customerId, address || null, startDate, eom, autoRenew ? 1 : 0]
    );
    const subId = result.insertId;

    for (const slot of slots) {
      await conn.query(
        `INSERT INTO subscription_slots (subscription_id, slot_label, delivery_time, quantity)
         VALUES (?, ?, ?, ?)`,
        [subId, slot.label, slot.time, slot.quantity]
      );
    }

    await conn.commit();
    return subId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

export const getSubscriptionByCustomer = async (customerId: number): Promise<Subscription | null> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.*, u.name AS customer_name, u.phone AS customer_phone
     FROM subscriptions s
     JOIN users u ON u.id = s.customer_id
     WHERE s.customer_id = ? AND s.status IN ('active','paused')
     ORDER BY s.created_at DESC LIMIT 1`,
    [customerId]
  );
  if (!rows.length) return null;

  const sub = rows[0] as Subscription;
  const [slotRows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM subscription_slots WHERE subscription_id = ? ORDER BY delivery_time ASC`,
    [sub.id]
  );
  sub.slots = slotRows as SubscriptionSlot[];
  return sub;
};

export const getSubscriptionById = async (id: number): Promise<Subscription | null> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.*, u.name AS customer_name, u.phone AS customer_phone
     FROM subscriptions s
     JOIN users u ON u.id = s.customer_id
     WHERE s.id = ?`,
    [id]
  );
  if (!rows.length) return null;
  const sub = rows[0] as Subscription;
  const [slotRows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM subscription_slots WHERE subscription_id = ? ORDER BY delivery_time ASC`,
    [sub.id]
  );
  sub.slots = slotRows as SubscriptionSlot[];
  return sub;
};

export const getAllSubscriptions = async (): Promise<Subscription[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.*, u.name AS customer_name, u.phone AS customer_phone
     FROM subscriptions s
     JOIN users u ON u.id = s.customer_id
     ORDER BY s.created_at DESC`
  );
  // Load slots for each
  for (const row of rows) {
    const [slotRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM subscription_slots WHERE subscription_id = ? ORDER BY delivery_time ASC`,
      [row.id]
    );
    (row as any).slots = slotRows;
  }
  return rows as Subscription[];
};

export const updateSubscription = async (
  id: number,
  slots: { label: string; time: string; quantity: number }[],
  address?: string,
  autoRenew?: boolean
): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const updates: string[] = [];
    const params: unknown[] = [];
    if (address !== undefined) { updates.push('address = ?'); params.push(address); }
    if (autoRenew !== undefined) { updates.push('auto_renew = ?'); params.push(autoRenew ? 1 : 0); }
    if (updates.length) {
      params.push(id);
      await conn.query(`UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    // Replace slots
    if (slots.length) {
      await conn.query('DELETE FROM subscription_slots WHERE subscription_id = ?', [id]);
      for (const slot of slots) {
        await conn.query(
          `INSERT INTO subscription_slots (subscription_id, slot_label, delivery_time, quantity) VALUES (?, ?, ?, ?)`,
          [id, slot.label, slot.time, slot.quantity]
        );
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

export const pauseSubscription = async (id: number): Promise<void> => {
  await pool.query(`UPDATE subscriptions SET status = 'paused' WHERE id = ? AND status = 'active'`, [id]);
};

export const resumeSubscription = async (id: number): Promise<void> => {
  await pool.query(`UPDATE subscriptions SET status = 'active' WHERE id = ? AND status = 'paused'`, [id]);
};

export const cancelSubscription = async (id: number): Promise<void> => {
  await pool.query(`UPDATE subscriptions SET status = 'cancelled' WHERE id = ?`, [id]);
  // Cancel all pending/assigned orders from this subscription that haven't been delivered
  await pool.query(
    `UPDATE orders SET status = 'cancelled' WHERE subscription_id = ? AND status IN ('pending', 'assigned')`,
    [id]
  );
};

export const renewSubscription = async (id: number): Promise<void> => {
  // Extend end_date to end of NEXT month
  const now = getIST();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const eom = endOfMonth(nextMonth);
  await pool.query(
    `UPDATE subscriptions SET end_date = ?, status = 'active', auto_renew = 1 WHERE id = ?`,
    [eom, id]
  );
};

// ── Cron helpers ──────────────────────────────────────────────────────────────

/** Get all active subscriptions with their slots for today's date range */
export const getActiveSubscriptionsForToday = async (): Promise<Subscription[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.*, u.name AS customer_name, u.phone AS customer_phone, u.jar_rate
     FROM subscriptions s
     JOIN users u ON u.id = s.customer_id
     WHERE s.status = 'active'
       AND CURDATE() BETWEEN s.start_date AND s.end_date`
  );
  for (const row of rows) {
    const [slotRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM subscription_slots WHERE subscription_id = ?`,
      [row.id]
    );
    (row as any).slots = slotRows;
  }
  return rows as Subscription[];
};

/** Check if an order already exists for a subscription + date + slot */
export const subscriptionOrderExists = async (
  subscriptionId: number,
  date: string,
  slotLabel: string
): Promise<boolean> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM orders
     WHERE subscription_id = ?
       AND DATE(delivery_date) = ?
       AND notes LIKE ?
       AND status != 'cancelled'
     LIMIT 1`,
    [subscriptionId, date, `%[${slotLabel}]%`]
  );
  return rows.length > 0;
};

/**
 * Generate orders for a single subscription for a given date.
 * Used by both the daily cron AND immediately on subscription creation.
 * Returns number of orders created.
 */
export const generateOrdersForSubscription = async (
  subscriptionId: number,
  targetDate: string
): Promise<number> => {
  const sub = await getSubscriptionById(subscriptionId);
  if (!sub || sub.status !== 'active') return 0;

  // Get jar rate for this customer
  const [userRows] = await pool.query<RowDataPacket[]>(
    'SELECT jar_rate FROM users WHERE id = ?', [sub.customer_id]
  );
  const jarRate = userRows[0]?.jar_rate || 50;

  const OrderModel = await import('./order.model');
  let created = 0;

  for (const slot of sub.slots || []) {
    const exists = await subscriptionOrderExists(subscriptionId, targetDate, slot.slot_label);
    if (exists) continue;

    const orderId = await OrderModel.createOrder(sub.customer_id, {
      type:         'monthly',
      quantity:     slot.quantity,
      pricePerJar:  Number(jarRate),
      deliveryDate: `${targetDate}T${slot.delivery_time}`,
      notes:        `[${slot.slot_label}] Auto-generated from subscription #${subscriptionId}`,
      address:      sub.address || undefined,
    });

    await pool.query('UPDATE orders SET subscription_id = ? WHERE id = ?', [subscriptionId, orderId]);

    // Auto-assign to staff with least active orders
    const [staffRows] = await pool.query<RowDataPacket[]>(`
      SELECT u.id, u.name, COUNT(o.id) AS cnt
      FROM users u LEFT JOIN orders o ON o.staff_id = u.id AND o.status NOT IN ('completed','cancelled')
      WHERE u.role = 'staff' AND u.status = 'active'
      GROUP BY u.id, u.name ORDER BY cnt ASC, u.id ASC LIMIT 1
    `);
    if (staffRows.length) {
      await pool.query(`UPDATE orders SET staff_id = ?, status = 'assigned' WHERE id = ?`, [staffRows[0].id, orderId]);
      await OrderModel.addTimeline(orderId, 'assigned', `Auto-assigned to ${staffRows[0].name} (subscription)`, null as any);
    }

    created++;
  }
  return created;
};

/** Get subscriptions expiring in N days (for renewal reminders) */
export const getExpiringSubscriptions = async (withinDays: number): Promise<Subscription[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.*, u.name AS customer_name, u.phone AS customer_phone
     FROM subscriptions s
     JOIN users u ON u.id = s.customer_id
     WHERE s.status = 'active'
       AND s.end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
       AND s.auto_renew = 0`,
    [withinDays]
  );
  return rows as Subscription[];
};

/** Expire all subscriptions past their end_date */
export const expireOldSubscriptions = async (): Promise<number> => {
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE subscriptions SET status = 'expired' WHERE status = 'active' AND end_date < CURDATE()`
  );
  return result.affectedRows;
};

/** Auto-renew subscriptions that have auto_renew = 1 and are expiring today */
export const autoRenewSubscriptions = async (): Promise<number> => {
  const now = getIST();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const eom = endOfMonth(nextMonth);
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE subscriptions SET end_date = ?, status = 'active'
     WHERE auto_renew = 1 AND status = 'active' AND end_date = CURDATE()`,
    [eom]
  );
  return result.affectedRows;
};

// ── Cancel requests ───────────────────────────────────────────────────────────

export const createCancelRequest = async (
  orderId: number,
  customerId: number,
  reason: string
): Promise<number> => {
  // Check for existing pending request
  const [existing] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM cancel_requests WHERE order_id = ? AND status = 'pending'`,
    [orderId]
  );
  if (existing.length) throw new Error('A cancellation request is already pending for this order.');

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO cancel_requests (order_id, customer_id, reason) VALUES (?, ?, ?)`,
    [orderId, customerId, reason]
  );
  return result.insertId;
};

export const getCancelRequests = async (status?: string): Promise<RowDataPacket[]> => {
  const condition = status ? `AND cr.status = '${status}'` : '';
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT cr.*, o.quantity, o.total_amount, o.type AS order_type,
            u.name AS customer_name, u.phone AS customer_phone
     FROM cancel_requests cr
     JOIN orders o ON o.id = cr.order_id
     JOIN users u ON u.id = cr.customer_id
     WHERE 1=1 ${condition}
     ORDER BY cr.created_at DESC`
  );
  return rows;
};

export const getCancelRequestByOrder = async (orderId: number): Promise<RowDataPacket | null> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM cancel_requests WHERE order_id = ? ORDER BY created_at DESC LIMIT 1`,
    [orderId]
  );
  return rows.length ? rows[0] : null;
};

export const reviewCancelRequest = async (
  id: number,
  action: 'approved' | 'rejected',
  reviewedBy: number
): Promise<void> => {
  await pool.query(
    `UPDATE cancel_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`,
    [action, reviewedBy, id]
  );
};

// ── App settings ──────────────────────────────────────────────────────────────

export const getSetting = async (key: string): Promise<string | null> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT setting_value FROM app_settings WHERE setting_key = ?`,
    [key]
  );
  return rows.length ? rows[0].setting_value : null;
};

export const setSetting = async (key: string, value: string): Promise<void> => {
  await pool.query(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`,
    [key, value, value]
  );
};
