import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// POST /api/casual-deliveries
// Staff records a jar given to a non-registered person
export const createCasualDelivery = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const staffId = req.user!.id;
    const {
      person_name = null,
      phone       = null,
      quantity,
      amount_collected = 0,
      payment_mode     = 'cash',
      notes            = null,
    } = req.body;

    if (!quantity || Number(quantity) < 1) {
      res.status(400).json({ message: 'quantity must be at least 1' }); return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO casual_deliveries
         (staff_id, person_name, phone, quantity, amount_collected, payment_mode, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [staffId, person_name, phone, Number(quantity), Number(amount_collected), payment_mode, notes]
    );

    res.status(201).json({
      message: 'Casual delivery recorded',
      id: result.insertId,
    });
  } catch (err) {
    console.error('createCasualDelivery error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/casual-deliveries  (staff sees only their own; admin sees all or by staffId)
export const getCasualDeliveries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { staffId, startDate, endDate, page = '1', limit = '30' } = req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: any[] = [];

    if (user.role === 'staff') {
      conditions.push('cd.staff_id = ?');
      params.push(user.id);
    } else if (staffId) {
      conditions.push('cd.staff_id = ?');
      params.push(staffId);
    }

    if (startDate) { conditions.push('DATE(cd.created_at) >= ?'); params.push(startDate); }
    if (endDate)   { conditions.push('DATE(cd.created_at) <= ?'); params.push(endDate); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT cd.*, u.name AS staff_name, u.phone AS staff_phone
       FROM casual_deliveries cd
       JOIN users u ON u.id = cd.staff_id
       ${where}
       ORDER BY cd.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    const [[{ total }]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM casual_deliveries cd ${where}`,
      params
    );

    res.json({ deliveries: rows, total: Number(total) });
  } catch (err) {
    console.error('getCasualDeliveries error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/casual-deliveries/:id  (staff can delete their own; admin can delete any)
export const deleteCasualDelivery = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT staff_id FROM casual_deliveries WHERE id = ?', [id]
    );
    if (!rows.length) { res.status(404).json({ message: 'Record not found' }); return; }

    if (user.role === 'staff' && rows[0].staff_id !== user.id) {
      res.status(403).json({ message: 'Access denied' }); return;
    }

    await pool.query('DELETE FROM casual_deliveries WHERE id = ?', [id]);
    res.json({ message: 'Record deleted' });
  } catch (err) {
    console.error('deleteCasualDelivery error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
