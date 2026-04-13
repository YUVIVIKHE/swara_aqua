import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';

// ── Revenue ───────────────────────────────────────────────────────────────────

export const getDailyRevenue = async (days = 30): Promise<RowDataPacket[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       DATE(t.created_at)                                    AS date,
       COALESCE(SUM(t.amount), 0)                            AS total,
       COALESCE(SUM(CASE WHEN t.mode='cash'   THEN t.amount END), 0) AS cash,
       COALESCE(SUM(CASE WHEN t.mode='online' THEN t.amount END), 0) AS online,
       COUNT(*)                                              AS count
     FROM transactions t
     WHERE t.type = 'credit'
       AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(t.created_at)
     ORDER BY date ASC`,
    [days]
  );
  return rows;
};

export const getMonthlyRevenue = async (months = 12): Promise<RowDataPacket[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       DATE_FORMAT(t.created_at, '%Y-%m')                   AS month,
       COALESCE(SUM(t.amount), 0)                            AS total,
       COALESCE(SUM(CASE WHEN t.mode='cash'   THEN t.amount END), 0) AS cash,
       COALESCE(SUM(CASE WHEN t.mode='online' THEN t.amount END), 0) AS online,
       COUNT(*)                                              AS count
     FROM transactions t
     WHERE t.type = 'credit'
       AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
     GROUP BY DATE_FORMAT(t.created_at, '%Y-%m')
     ORDER BY month ASC`,
    [months]
  );
  return rows;
};

// ── Pending payments ──────────────────────────────────────────────────────────

export const getPendingPayments = async (): Promise<RowDataPacket[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       u.id, u.name, u.phone,
       COALESCE(SUM(b.total_amount - b.paid_amount), 0) AS pending_amount,
       COUNT(b.id)                                       AS bill_count,
       MIN(b.due_date)                                   AS oldest_due
     FROM users u
     JOIN bills b ON b.customer_id = u.id
     WHERE b.status IN ('unpaid','partial')
     GROUP BY u.id, u.name, u.phone
     ORDER BY pending_amount DESC`
  );
  return rows;
};

// ── Staff performance ─────────────────────────────────────────────────────────

export const getStaffPerformance = async (month?: string): Promise<RowDataPacket[]> => {
  const condition = month
    ? `AND DATE_FORMAT(d.delivered_at, '%Y-%m') = '${month}'`
    : 'AND d.delivered_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       u.id, u.name, u.phone,
       COUNT(d.id)                                AS deliveries,
       COALESCE(SUM(d.delivered_quantity), 0)     AS jars_delivered,
       COALESCE(SUM(d.collected_amount), 0)       AS cash_collected
     FROM users u
     LEFT JOIN deliveries d ON d.staff_id = u.id ${condition}
     WHERE u.role = 'staff' AND u.status = 'active'
     GROUP BY u.id, u.name, u.phone
     ORDER BY deliveries DESC`
  );
  return rows;
};

// ── Summary stats ─────────────────────────────────────────────────────────────

export const getRevenueSummary = async (): Promise<RowDataPacket> => {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      COALESCE(SUM(CASE WHEN DATE(t.created_at) = CURDATE() THEN t.amount END), 0)          AS today,
      COALESCE(SUM(CASE WHEN DATE_FORMAT(t.created_at,'%Y-%m') = DATE_FORMAT(NOW(),'%Y-%m') THEN t.amount END), 0) AS this_month,
      COALESCE(SUM(t.amount), 0)                                                              AS all_time,
      COALESCE(SUM(CASE WHEN t.mode='cash'   THEN t.amount END), 0)                          AS cash_total,
      COALESCE(SUM(CASE WHEN t.mode='online' THEN t.amount END), 0)                          AS online_total,
      COALESCE((SELECT SUM(total_amount - paid_amount) FROM bills WHERE status IN ('unpaid','partial')), 0) AS total_pending
    FROM transactions t
    WHERE t.type = 'credit'
  `);
  return rows[0];
};
