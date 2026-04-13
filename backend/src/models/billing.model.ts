import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

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

// ── Generate bill for one customer for a given month ──────────────────────────
export const generateBillForCustomer = async (
  customerId: number,
  month: string   // YYYY-MM
): Promise<Bill | null> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Prevent duplicate
    const [existing] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM bills WHERE customer_id = ? AND month = ? FOR UPDATE',
      [customerId, month]
    );
    if ((existing as RowDataPacket[]).length) {
      await conn.rollback();
      return null; // already generated
    }

    // Customer jar_rate + advance_balance
    // Use COALESCE to handle missing columns gracefully
    const [custRows] = await conn.query<RowDataPacket[]>(
      `SELECT id,
              COALESCE(jar_rate, 50)        AS jar_rate,
              COALESCE(advance_balance, 0)  AS advance_balance
       FROM users WHERE id = ? AND role = 'customer'`,
      [customerId]
    );
    if (!(custRows as RowDataPacket[]).length) { await conn.rollback(); return null; }
    const cust = (custRows as RowDataPacket[])[0];

    // Total jars delivered this month
    const [jarRows] = await conn.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(d.delivered_quantity), 0) AS total_jars
       FROM deliveries d
       JOIN orders o ON o.id = d.order_id
       WHERE o.customer_id = ?
         AND DATE_FORMAT(d.delivered_at, '%Y-%m') = ?
         AND d.status = 'delivered'`,
      [customerId, month]
    );
    const totalJars: number = Number((jarRows as RowDataPacket[])[0].total_jars);

    // Previous pending = unpaid/partial bills total_amount - paid_amount
    const [pendRows] = await conn.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(total_amount - paid_amount), 0) AS pending
       FROM bills
       WHERE customer_id = ? AND status IN ('unpaid','partial') AND month < ?`,
      [customerId, month]
    );
    const previousPending: number = Number((pendRows as RowDataPacket[])[0].pending);

    const jarRate: number   = Number(cust.jar_rate);
    const subtotal: number  = totalJars * jarRate;
    let totalAmount: number = subtotal + previousPending;
    let advanceUsed         = 0;
    let advanceBalance: number = Number(cust.advance_balance);

    // Deduct advance
    if (advanceBalance > 0 && totalAmount > 0) {
      advanceUsed    = Math.min(advanceBalance, totalAmount);
      totalAmount    = parseFloat((totalAmount - advanceUsed).toFixed(2));
      advanceBalance = parseFloat((advanceBalance - advanceUsed).toFixed(2));
      await conn.query('UPDATE users SET advance_balance = ? WHERE id = ?', [advanceBalance, customerId]);
    }

    const status: Bill['status'] = totalAmount <= 0 ? 'paid' : 'unpaid';
    const dueDate = `${month}-10`; // 10th of next month

    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO bills
         (customer_id, month, total_jars, jar_rate, subtotal,
          previous_pending, advance_used, total_amount, paid_amount, status, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [customerId, month, totalJars, jarRate, subtotal,
       previousPending, advanceUsed, totalAmount, status, dueDate]
    );

    await conn.commit();

    const [billRows] = await pool.query<RowDataPacket[]>(
      `SELECT b.*, u.name AS customer_name, u.phone AS customer_phone
       FROM bills b JOIN users u ON u.id = b.customer_id WHERE b.id = ?`,
      [result.insertId]
    );
    return (billRows as RowDataPacket[])[0] as Bill;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ── Generate bills for ALL customers ─────────────────────────────────────────
export const generateMonthlyBills = async (month: string): Promise<{
  generated: number; skipped: number; errors: number;
}> => {
  const [customers] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM users WHERE role = 'customer' AND status = 'active'"
  );

  if (!(customers as RowDataPacket[]).length) {
    console.log('[Billing] No active customers found');
    return { generated: 0, skipped: 0, errors: 0 };
  }

  let generated = 0, skipped = 0, errors = 0;

  for (const c of customers as RowDataPacket[]) {
    try {
      const bill = await generateBillForCustomer(c.id, month);
      if (bill) {
        generated++;
        console.log(`[Billing] Generated bill #${bill.id} for customer ${c.id} (${month})`);
      } else {
        skipped++;
        console.log(`[Billing] Skipped customer ${c.id} — bill already exists for ${month}`);
      }
    } catch (err) {
      errors++;
      console.error(`[Billing] Failed for customer ${c.id}:`, (err as Error).message);
    }
  }

  console.log(`[Billing] Done — generated:${generated} skipped:${skipped} errors:${errors}`);
  return { generated, skipped, errors };
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
