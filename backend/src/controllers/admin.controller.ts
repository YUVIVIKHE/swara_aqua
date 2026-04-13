import { Response } from 'express';
import * as UserModel from '../models/user.model';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';

export const getStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      COUNT(*) as total,
      SUM(status = 'pending') as pending,
      SUM(status = 'active') as active,
      SUM(role = 'customer') as customers,
      SUM(role = 'staff') as staff
    FROM users`
  );
  res.json({ stats: rows[0] });
};

export const getUsers = async (_req: AuthRequest, res: Response): Promise<void> => {
  const users = await UserModel.getAllUsers();
  res.json({ users });
};

export const updateStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['active', 'pending', 'rejected'].includes(status)) {
    res.status(400).json({ message: 'Invalid status' });
    return;
  }

  await UserModel.updateUserStatus(Number(id), status);
  res.json({ message: `User status updated to ${status}` });
};

export const createStaff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, phone, password } = req.body;

    if (!name || !phone || !password) {
      res.status(400).json({ message: 'name, phone and password are required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' });
      return;
    }

    // Check phone not already taken
    const existing = await UserModel.findByPhone(phone);
    if (existing) {
      res.status(409).json({ message: 'Phone number already registered' });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);
    const [result] = await pool.query<any>(
      "INSERT INTO users (name, phone, password, role, status) VALUES (?, ?, ?, 'staff', 'active')",
      [name, phone, hashed]
    );

    res.status(201).json({ message: 'Staff account created', userId: result.insertId });
  } catch (err) {
    console.error('createStaff error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

export const updateJarRate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { jarRate } = req.body;

    if (jarRate == null || isNaN(Number(jarRate)) || Number(jarRate) <= 0) {
      res.status(400).json({ message: 'jarRate must be a positive number' });
      return;
    }

    await UserModel.updateJarRate(Number(id), Number(jarRate));
    res.json({ message: `Jar rate updated to ₹${jarRate}` });
  } catch (err) {
    console.error('updateJarRate error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

export const getCustomerProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);

    // Basic info
    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, phone, role, status, jar_rate, advance_balance, created_at
       FROM users WHERE id = ? AND role = 'customer'`,
      [id]
    );
    if (!userRows.length) {
      res.status(404).json({ message: 'Customer not found' });
      return;
    }
    const customer = userRows[0];

    // Get last known address from most recent order
    const [addrRows] = await pool.query<RowDataPacket[]>(
      `SELECT address, latitude, longitude FROM orders
       WHERE customer_id = ? AND address IS NOT NULL AND address != ''
       ORDER BY created_at DESC LIMIT 1`,
      [id]
    );

    // Stats
    const [statsRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        COALESCE(SUM(d.delivered_quantity), 0)    AS total_jars_delivered,
        COUNT(DISTINCT o.id)                       AS total_orders,
        COALESCE(SUM(d.collected_amount), 0)       AS total_collected
      FROM orders o
      LEFT JOIN deliveries d ON d.order_id = o.id AND d.status = 'delivered'
      WHERE o.customer_id = ?
    `, [id]);

    // Pending bill amount
    const [pendingRows] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(total_amount - paid_amount), 0) AS pending_amount,
              COUNT(*) AS pending_bills
       FROM bills WHERE customer_id = ? AND status IN ('unpaid', 'partial')`,
      [id]
    );

    // Recent bills
    const [bills] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM bills WHERE customer_id = ? ORDER BY month DESC LIMIT 12`,
      [id]
    );

    // Recent orders
    const [orders] = await pool.query<RowDataPacket[]>(
      `SELECT o.*, s.name AS staff_name
       FROM orders o LEFT JOIN users s ON s.id = o.staff_id
       WHERE o.customer_id = ? ORDER BY o.created_at DESC LIMIT 15`,
      [id]
    );

    res.json({
      customer: {
        ...customer,
        address: addrRows.length ? addrRows[0].address : null,
        latitude: addrRows.length ? addrRows[0].latitude : null,
        longitude: addrRows.length ? addrRows[0].longitude : null,
      },
      stats: {
        ...statsRows[0],
        ...pendingRows[0],
      },
      bills,
      orders,
    });
  } catch (err) {
    console.error('getCustomerProfile error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// GET /api/admin/customer-balances — bulk pending balances for all customers
export const getCustomerBalances = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Total pending per customer
    const [totals] = await pool.query<RowDataPacket[]>(`
      SELECT b.customer_id,
             COALESCE(SUM(b.total_amount - b.paid_amount), 0) AS pending_amount
      FROM bills b
      WHERE b.status IN ('unpaid', 'partial')
      GROUP BY b.customer_id
    `);

    // Month-wise breakdown per customer (only unpaid/partial)
    const [monthly] = await pool.query<RowDataPacket[]>(`
      SELECT b.customer_id, b.month,
             b.total_amount, b.paid_amount,
             (b.total_amount - b.paid_amount) AS pending,
             b.status
      FROM bills b
      WHERE b.status IN ('unpaid', 'partial')
      ORDER BY b.month DESC
    `);

    // Index by customer_id
    const balances: Record<number, { total: number; months: any[] }> = {};
    for (const row of totals as any[]) {
      balances[row.customer_id] = { total: Number(row.pending_amount), months: [] };
    }
    for (const row of monthly as any[]) {
      if (balances[row.customer_id]) {
        balances[row.customer_id].months.push({
          month: row.month,
          total_amount: Number(row.total_amount),
          paid_amount: Number(row.paid_amount),
          pending: Number(row.pending),
          status: row.status,
        });
      }
    }

    res.json({ balances });
  } catch (err) {
    console.error('getCustomerBalances error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getStaffProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, phone, role, status, created_at
       FROM users WHERE id = ? AND role = 'staff'`,
      [id]
    );
    if (!userRows.length) { res.status(404).json({ message: 'Staff not found' }); return; }

    const [statsRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        COUNT(DISTINCT d.order_id)              AS total_deliveries,
        COALESCE(SUM(d.delivered_quantity), 0)  AS total_jars_delivered,
        COALESCE(SUM(d.collected_amount), 0)    AS total_cash_collected
      FROM deliveries d
      WHERE d.staff_id = ? AND d.status = 'delivered'
    `, [id]);

    const [activeRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS active_orders FROM orders
       WHERE staff_id = ? AND status IN ('assigned','pending')`, [id]
    );

    const [invRows] = await pool.query<RowDataPacket[]>(
      `SELECT assigned_jars, empty_collected FROM staff_inventory WHERE staff_id = ?`, [id]
    );

    const [recentDeliveries] = await pool.query<RowDataPacket[]>(`
      SELECT d.id, d.delivered_quantity, d.collected_amount, d.payment_mode, d.delivered_at,
             o.quantity, o.type, o.address,
             c.name AS customer_name, c.phone AS customer_phone
      FROM deliveries d
      JOIN orders o ON o.id = d.order_id
      JOIN users  c ON c.id = o.customer_id
      WHERE d.staff_id = ?
      ORDER BY d.delivered_at DESC
      LIMIT 15
    `, [id]);

    res.json({
      staff: userRows[0],
      stats: {
        ...statsRows[0],
        active_orders: Number((activeRows[0] as any).active_orders),
      },
      inventory: invRows.length ? invRows[0] : { assigned_jars: 0, empty_collected: 0 },
      recentDeliveries,
    });
  } catch (err) {
    console.error('getStaffProfile error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};
