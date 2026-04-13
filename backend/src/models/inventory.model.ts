import pool from '../config/db';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Inventory {
  id: number;
  total_jars: number;
  available_jars: number;
  low_stock_threshold: number;
  updated_at: Date;
}

export interface StaffInventory {
  id: number;
  staff_id: number;
  assigned_jars: number;
  empty_collected: number;
  updated_at: Date;
  staff_name?: string;
}

export interface InventoryLog {
  id: number;
  type: 'add' | 'assign' | 'return' | 'delivered' | 'damaged';
  quantity: number;
  reference_id: number | null;
  note: string | null;
  created_by: number | null;
  created_at: Date;
  actor_name?: string;
}

export interface Transaction {
  id: number;
  customer_id: number;
  order_id: number | null;
  amount: number;
  mode: 'cash' | 'online' | 'advance';
  type: 'credit' | 'debit';
  collected_by: number | null;
  status: 'pending' | 'completed';
  note: string | null;
  created_at: Date;
  customer_name?: string;
  staff_name?: string;
}

export interface CashSubmission {
  id: number;
  staff_id: number;
  total_cash: number;
  note: string | null;
  status: 'pending' | 'verified' | 'rejected';
  verified_by: number | null;
  submitted_at: Date;
  verified_at: Date | null;
  staff_name?: string;
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export const getInventory = async (): Promise<Inventory> => {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM inventory WHERE id = 1');
  if (!rows.length) throw new Error('Inventory record not found — run schema.sql');
  return rows[0] as Inventory;
};

export const getStaffInventory = async (staffId?: number): Promise<StaffInventory[]> => {
  const sql = staffId
    ? `SELECT si.*, u.name AS staff_name FROM staff_inventory si
       JOIN users u ON u.id = si.staff_id WHERE si.staff_id = ?`
    : `SELECT si.*, u.name AS staff_name FROM staff_inventory si
       JOIN users u ON u.id = si.staff_id ORDER BY u.name`;
  const [rows] = await pool.query<RowDataPacket[]>(sql, staffId ? [staffId] : []);
  return rows as StaffInventory[];
};

export const ensureStaffInventory = async (
  staffId: number,
  conn?: PoolConnection
): Promise<void> => {
  const db = conn ?? pool;
  await db.query(
    'INSERT IGNORE INTO staff_inventory (staff_id) VALUES (?)',
    [staffId]
  );
};

// ── Atomic: Add stock (admin) ─────────────────────────────────────────────────

export const addStock = async (
  quantity: number,
  adminId: number,
  note?: string
): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      'UPDATE inventory SET total_jars = total_jars + ?, available_jars = available_jars + ? WHERE id = 1',
      [quantity, quantity]
    );
    await conn.query(
      'INSERT INTO inventory_logs (type, quantity, note, created_by) VALUES (?, ?, ?, ?)',
      ['add', quantity, note || `Added ${quantity} jars`, adminId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ── Atomic: Assign jars to staff ──────────────────────────────────────────────

export const assignJarsToStaff = async (
  staffId: number,
  quantity: number,
  adminId: number
): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock inventory row
    const [invRows] = await conn.query<RowDataPacket[]>(
      'SELECT available_jars FROM inventory WHERE id = 1 FOR UPDATE'
    );
    const available = invRows[0]?.available_jars ?? 0;
    if (available < quantity) {
      throw new Error(`Insufficient stock. Available: ${available}, Requested: ${quantity}`);
    }

    await ensureStaffInventory(staffId, conn);

    await conn.query(
      'UPDATE inventory SET available_jars = available_jars - ? WHERE id = 1',
      [quantity]
    );
    await conn.query(
      'UPDATE staff_inventory SET assigned_jars = assigned_jars + ? WHERE staff_id = ?',
      [quantity, staffId]
    );
    await conn.query(
      'INSERT INTO inventory_logs (type, quantity, reference_id, note, created_by) VALUES (?, ?, ?, ?, ?)',
      ['assign', quantity, staffId, `Assigned ${quantity} jars to staff #${staffId}`, adminId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ── Atomic: Return empty jars ─────────────────────────────────────────────────

export const returnEmptyJars = async (
  staffId: number,
  quantity: number
): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [siRows] = await conn.query<RowDataPacket[]>(
      'SELECT empty_collected FROM staff_inventory WHERE staff_id = ? FOR UPDATE',
      [staffId]
    );
    const emptyCollected = siRows[0]?.empty_collected ?? 0;
    if (emptyCollected < quantity) {
      throw new Error(`Cannot return ${quantity} jars. Only ${emptyCollected} empty jars available.`);
    }

    await conn.query(
      'UPDATE staff_inventory SET empty_collected = empty_collected - ? WHERE staff_id = ?',
      [quantity, staffId]
    );
    await conn.query(
      'UPDATE inventory SET available_jars = available_jars + ? WHERE id = 1',
      [quantity]
    );
    await conn.query(
      'INSERT INTO inventory_logs (type, quantity, reference_id, note, created_by) VALUES (?, ?, ?, ?, ?)',
      ['return', quantity, staffId, `Staff #${staffId} returned ${quantity} empty jars`, staffId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ── Atomic: Record delivery inventory update ──────────────────────────────────

export const recordDeliveryInventory = async (
  staffId: number,
  deliveredQty: number,
  orderId: number
): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await ensureStaffInventory(staffId, conn);

    // Reduce assigned, increase empty_collected
    await conn.query(
      `UPDATE staff_inventory
       SET assigned_jars   = GREATEST(0, assigned_jars - ?),
           empty_collected = empty_collected + ?
       WHERE staff_id = ?`,
      [deliveredQty, deliveredQty, staffId]
    );
    await conn.query(
      'INSERT INTO inventory_logs (type, quantity, reference_id, note, created_by) VALUES (?, ?, ?, ?, ?)',
      ['delivered', deliveredQty, orderId, `Delivered ${deliveredQty} jars for order #${orderId}`, staffId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ── Atomic: Mark jars as damaged ──────────────────────────────────────────────

export const markDamaged = async (
  staffId: number,
  quantity: number,
  note: string
): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE staff_inventory
       SET assigned_jars = GREATEST(0, assigned_jars - ?)
       WHERE staff_id = ?`,
      [quantity, staffId]
    );
    await conn.query(
      'UPDATE inventory SET total_jars = GREATEST(0, total_jars - ?) WHERE id = 1',
      [quantity]
    );
    await conn.query(
      'INSERT INTO inventory_logs (type, quantity, reference_id, note, created_by) VALUES (?, ?, ?, ?, ?)',
      ['damaged', quantity, staffId, note || `${quantity} jars damaged`, staffId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ── Logs ──────────────────────────────────────────────────────────────────────

export const getInventoryLogs = async (limit = 50): Promise<InventoryLog[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT il.*, u.name AS actor_name
     FROM inventory_logs il
     LEFT JOIN users u ON u.id = il.created_by
     ORDER BY il.created_at DESC LIMIT ?`,
    [limit]
  );
  return rows as InventoryLog[];
};

export const getStaffLogs = async (staffId: number, limit = 30): Promise<InventoryLog[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT il.*, u.name AS actor_name
     FROM inventory_logs il
     LEFT JOIN users u ON u.id = il.created_by
     WHERE il.created_by = ? OR il.reference_id = ?
     ORDER BY il.created_at DESC LIMIT ?`,
    [staffId, staffId, limit]
  );
  return rows as InventoryLog[];
};

// ── Transactions ──────────────────────────────────────────────────────────────

export const createTransaction = async (data: {
  customerId: number;
  orderId?: number;
  amount: number;
  mode: 'cash' | 'online' | 'advance';
  type: 'credit' | 'debit';
  collectedBy?: number;
  note?: string;
}): Promise<number> => {
  const status = data.mode === 'online' ? 'completed' : 'pending';
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO transactions
       (customer_id, order_id, amount, mode, type, collected_by, status, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.customerId, data.orderId ?? null, data.amount,
      data.mode, data.type, data.collectedBy ?? null,
      status, data.note ?? null,
    ]
  );
  return result.insertId;
};

export const getTransactions = async (filters: {
  staffId?: number;
  customerId?: number;
  mode?: string;
  status?: string;
  date?: string;
  limit?: number;
} = {}): Promise<Transaction[]> => {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];

  if (filters.staffId)    { conditions.push('t.collected_by = ?');       params.push(filters.staffId); }
  if (filters.customerId) { conditions.push('t.customer_id = ?');        params.push(filters.customerId); }
  if (filters.mode)       { conditions.push('t.mode = ?');               params.push(filters.mode); }
  if (filters.status)     { conditions.push('t.status = ?');             params.push(filters.status); }
  if (filters.date)       { conditions.push('DATE(t.created_at) = ?');   params.push(filters.date); }

  params.push(filters.limit ?? 100);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT t.*,
            c.name AS customer_name,
            s.name AS staff_name
     FROM transactions t
     JOIN users c ON c.id = t.customer_id
     LEFT JOIN users s ON s.id = t.collected_by
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.created_at DESC
     LIMIT ?`,
    params
  );
  return rows as Transaction[];
};

export const getTransactionStats = async (): Promise<RowDataPacket> => {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      COALESCE(SUM(amount), 0)                                    AS total_collected,
      COALESCE(SUM(CASE WHEN mode='cash'   THEN amount END), 0)   AS cash_total,
      COALESCE(SUM(CASE WHEN mode='online' THEN amount END), 0)   AS online_total,
      COALESCE(SUM(CASE WHEN status='pending' THEN amount END), 0) AS pending_total,
      COUNT(*)                                                     AS total_count
    FROM transactions
    WHERE type = 'credit'
  `);
  return rows[0];
};

// ── Cash submissions ──────────────────────────────────────────────────────────

export const submitCash = async (
  staffId: number,
  totalCash: number,
  note?: string
): Promise<number> => {
  // Prevent duplicate pending submission
  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM cash_submissions WHERE staff_id = ? AND status = 'pending'",
    [staffId]
  );
  if ((existing as RowDataPacket[]).length) {
    throw new Error('You already have a pending cash submission. Wait for admin verification.');
  }

  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO cash_submissions (staff_id, total_cash, note) VALUES (?, ?, ?)',
    [staffId, totalCash, note ?? null]
  );
  return result.insertId;
};

export const getCashSubmissions = async (filters: {
  staffId?: number;
  status?: string;
} = {}): Promise<CashSubmission[]> => {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];

  if (filters.staffId) { conditions.push('cs.staff_id = ?'); params.push(filters.staffId); }
  if (filters.status)  { conditions.push('cs.status = ?');   params.push(filters.status); }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT cs.*, u.name AS staff_name
     FROM cash_submissions cs
     JOIN users u ON u.id = cs.staff_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY cs.submitted_at DESC`,
    params
  );
  return rows as CashSubmission[];
};

export const verifyCashSubmission = async (
  submissionId: number,
  adminId: number,
  action: 'verified' | 'rejected'
): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM cash_submissions WHERE id = ? AND status = 'pending' FOR UPDATE",
      [submissionId]
    );
    if (!(rows as RowDataPacket[]).length) {
      throw new Error('Submission not found or already processed');
    }

    await conn.query(
      `UPDATE cash_submissions
       SET status = ?, verified_by = ?, verified_at = NOW()
       WHERE id = ?`,
      [action, adminId, submissionId]
    );

    // Mark related pending cash transactions as completed on verification
    if (action === 'verified') {
      const sub = (rows as RowDataPacket[])[0];
      await conn.query(
        `UPDATE transactions
         SET status = 'completed'
         WHERE collected_by = ? AND mode = 'cash' AND status = 'pending'`,
        [sub.staff_id]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ── Staff Cash Holdings ───────────────────────────────────────────────────────

export const getStaffCashHoldings = async (staffId?: number): Promise<RowDataPacket[]> => {
  const conditions = ["t.mode = 'cash'", "t.status = 'pending'", "t.type = 'credit'"];
  const params: unknown[] = [];

  if (staffId) {
    conditions.push('t.collected_by = ?');
    params.push(staffId);
  }

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      t.collected_by AS staff_id,
      u.name         AS staff_name,
      u.phone        AS staff_phone,
      SUM(t.amount)  AS cash_in_hand,
      COUNT(*)       AS transaction_count
    FROM transactions t
    JOIN users u ON u.id = t.collected_by
    WHERE ${conditions.join(' AND ')}
    GROUP BY t.collected_by, u.name, u.phone
    ORDER BY cash_in_hand DESC
  `, params);

  return rows;
};

