import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

/** Delivered jars for a customer in YYYY-MM (uses delivered_at, falls back to created_at). */
const countDeliveredJarsForMonth = async (
  conn: Awaited<ReturnType<typeof pool.getConnection>>,
  customerId: number,
  month: string
): Promise<number> => {
  const [jarRows] = await conn.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(d.delivered_quantity), 0) AS total_jars
     FROM deliveries d
     JOIN orders o ON o.id = d.order_id
     WHERE o.customer_id = ?
       AND DATE_FORMAT(COALESCE(d.delivered_at, d.created_at), '%Y-%m') = ?
       AND d.status = 'delivered'`,
    [customerId, month]
  );
  return Number((jarRows as RowDataPacket[])[0].total_jars);
};

const previousPendingForMonth = async (
  conn: Awaited<ReturnType<typeof pool.getConnection>>,
  customerId: number,
  month: string
): Promise<number> => {
  const [pendRows] = await conn.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(total_amount - paid_amount), 0) AS pending
     FROM bills
     WHERE customer_id = ? AND status IN ('unpaid','partial') AND month < ?`,
    [customerId, month]
  );
  return Number((pendRows as RowDataPacket[])[0].pending);
};

const billStatusFromAmounts = (
  totalAmount: number,
  paidAmount: number
): Bill['status'] => {
  const remaining = parseFloat((totalAmount - paidAmount).toFixed(2));
  if (remaining <= 0) return 'paid';
  if (paidAmount > 0) return 'partial';
  return 'unpaid';
};

export interface Bill {
  id: number;
  customer_id: number;
  month: string;
  total_jars: number;
  jar_rate: number;
  subtotal: number;
  previous_pending: number;
  advance_used: number;
  total_amount: number;
  paid_amount: number;
  status: 'paid' | 'partial' | 'unpaid';
  due_date: string;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
}

// ── Recalculate an existing bill from current delivery data ───────────────────
export const recalculateBillForCustomer = async (
  customerId: number,
  month: string,
  billId: number
): Promise<Bill | null> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [billRows] = await conn.query<RowDataPacket[]>(
      'SELECT * FROM bills WHERE id = ? AND customer_id = ? AND month = ? FOR UPDATE',
      [billId, customerId, month]
    );
    if (!(billRows as RowDataPacket[]).length) {
      await conn.rollback();
      return null;
    }
    const existing = (billRows as RowDataPacket[])[0];

    const totalJars = await countDeliveredJarsForMonth(conn, customerId, month);
    const previousPending = await previousPendingForMonth(conn, customerId, month);

    const jarRate = Number(existing.jar_rate);
    const subtotal = parseFloat((totalJars * jarRate).toFixed(2));
    const advanceUsed = Number(existing.advance_used);
    const paidAmount = Number(existing.paid_amount);
    let totalAmount = parseFloat((subtotal + previousPending - advanceUsed).toFixed(2));
    if (totalAmount < 0) totalAmount = 0;

    const status = billStatusFromAmounts(totalAmount, paidAmount);

    await conn.query(
      `UPDATE bills SET total_jars = ?, subtotal = ?, previous_pending = ?,
              total_amount = ?, status = ?
       WHERE id = ?`,
      [totalJars, subtotal, previousPending, totalAmount, status, billId]
    );

    await conn.commit();

    return getBillById(billId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ── Generate bill for one customer for a given month ──────────────────────────
export const generateBillForCustomer = async (
  customerId: number,
  month: string   // YYYY-MM
): Promise<Bill | null> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query<RowDataPacket[]>(
      'SELECT id, total_jars, paid_amount FROM bills WHERE customer_id = ? AND month = ? FOR UPDATE',
      [customerId, month]
    );
    if ((existing as RowDataPacket[]).length) {
      const row = (existing as RowDataPacket[])[0];
      await conn.commit();
      // Refresh stale bills (generated before deliveries were recorded)
      if (Number(row.total_jars) === 0 || Number(row.paid_amount) === 0) {
        return recalculateBillForCustomer(customerId, month, row.id);
      }
      return null;
    }

    const [custRows] = await conn.query<RowDataPacket[]>(
      `SELECT id,
              COALESCE(jar_rate, 50)        AS jar_rate,
              COALESCE(advance_balance, 0)  AS advance_balance
       FROM users WHERE id = ? AND role = 'customer'`,
      [customerId]
    );
    if (!(custRows as RowDataPacket[]).length) { await conn.rollback(); return null; }
    const cust = (custRows as RowDataPacket[])[0];

    const totalJars = await countDeliveredJarsForMonth(conn, customerId, month);
    const previousPending = await previousPendingForMonth(conn, customerId, month);

    const jarRate: number   = Number(cust.jar_rate);
    const subtotal: number  = parseFloat((totalJars * jarRate).toFixed(2));
    let totalAmount: number = subtotal + previousPending;
    let advanceUsed         = 0;
    let advanceBalance: number = Number(cust.advance_balance);

    if (advanceBalance > 0 && totalAmount > 0) {
      advanceUsed    = Math.min(advanceBalance, totalAmount);
      totalAmount    = parseFloat((totalAmount - advanceUsed).toFixed(2));
      advanceBalance = parseFloat((advanceBalance - advanceUsed).toFixed(2));
      await conn.query('UPDATE users SET advance_balance = ? WHERE id = ?', [advanceBalance, customerId]);
    }

    const status: Bill['status'] = billStatusFromAmounts(totalAmount, 0);

    const [y, m] = month.split('-').map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    const dueDate = `${nextMonth}-10`;

    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO bills
         (customer_id, month, total_jars, jar_rate, subtotal,
          previous_pending, advance_used, total_amount, paid_amount, status, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [customerId, month, totalJars, jarRate, subtotal,
       previousPending, advanceUsed, totalAmount, status, dueDate]
    );

    await conn.commit();

    return getBillById(result.insertId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/** Sync bills that show 0 jars but may have deliveries recorded since generation. */
export const syncStaleBills = async (customerId: number): Promise<void> => {
  const bills = await getBills({ customerId });
  const stale = bills.filter(b => Number(b.total_jars) === 0);
  for (const b of stale) {
    await recalculateBillForCustomer(customerId, b.month, b.id);
  }
};

// ── Generate bills for ALL customers ─────────────────────────────────────────
export const generateMonthlyBills = async (month: string): Promise<{
  generated: number; recalculated: number; skipped: number; errors: number;
}> => {
  const [customers] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM users WHERE role = 'customer' AND status = 'active'"
  );

  if (!(customers as RowDataPacket[]).length) {
    console.log('[Billing] No active customers found');
    return { generated: 0, recalculated: 0, skipped: 0, errors: 0 };
  }

  let generated = 0, recalculated = 0, skipped = 0, errors = 0;

  for (const c of customers as RowDataPacket[]) {
    try {
      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT id, total_jars, paid_amount FROM bills WHERE customer_id = ? AND month = ?',
        [c.id, month]
      );
      const hadBill = (existing as RowDataPacket[]).length > 0;

      const bill = await generateBillForCustomer(c.id, month);
      if (bill) {
        if (hadBill) {
          recalculated++;
          console.log(`[Billing] Recalculated bill #${bill.id} for customer ${c.id} (${month})`);
        } else {
          generated++;
          console.log(`[Billing] Generated bill #${bill.id} for customer ${c.id} (${month})`);
        }
      } else {
        skipped++;
        console.log(`[Billing] Skipped customer ${c.id} — bill already up to date for ${month}`);
      }
    } catch (err) {
      errors++;
      console.error(`[Billing] Failed for customer ${c.id}:`, (err as Error).message);
    }
  }

  console.log(`[Billing] Done — generated:${generated} recalculated:${recalculated} skipped:${skipped} errors:${errors}`);
  return { generated, recalculated, skipped, errors };
};

// ── Queries ───────────────────────────────────────────────────────────────────

export const getBills = async (filters: {
  customerId?: number;
  month?: string;
  status?: string;
} = {}): Promise<Bill[]> => {
  const conditions = ['1=1'];
  const params: unknown[] = [];

  if (filters.customerId) { conditions.push('b.customer_id = ?'); params.push(filters.customerId); }
  if (filters.month)      { conditions.push('b.month = ?');       params.push(filters.month); }
  if (filters.status)     { conditions.push('b.status = ?');      params.push(filters.status); }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT b.*, u.name AS customer_name, u.phone AS customer_phone
     FROM bills b JOIN users u ON u.id = b.customer_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY b.month DESC, b.created_at DESC`,
    params
  );
  return rows as Bill[];
};

export const getBillById = async (id: number): Promise<Bill | null> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT b.*, u.name AS customer_name, u.phone AS customer_phone
     FROM bills b JOIN users u ON u.id = b.customer_id WHERE b.id = ?`,
    [id]
  );
  return (rows as RowDataPacket[]).length ? (rows as RowDataPacket[])[0] as Bill : null;
};

// ── Record payment against a bill ─────────────────────────────────────────────
export const recordBillPayment = async (
  billId: number,
  amount: number
): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT * FROM bills WHERE id = ? FOR UPDATE',
      [billId]
    );
    const bill = (rows as RowDataPacket[])[0];
    if (!bill) throw new Error('Bill not found');

    const newPaid = parseFloat((Number(bill.paid_amount) + amount).toFixed(2));
    const remaining = parseFloat((Number(bill.total_amount) - newPaid).toFixed(2));
    const status: Bill['status'] = remaining <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

    await conn.query(
      'UPDATE bills SET paid_amount = ?, status = ? WHERE id = ?',
      [newPaid, status, billId]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
