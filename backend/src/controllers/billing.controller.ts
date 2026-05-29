import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as BillingModel from '../models/billing.model';
import * as NotifService from '../services/notification.service';
import { generateBillPDF, generateReportPDF } from '../services/pdf.service';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

const notify = (fn: () => Promise<void>) =>
  fn().catch(err => console.warn('FCM (non-fatal):', err?.message));

// POST /api/billing/generate  (admin)
export const generateBills = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM') });
    const { month } = schema.parse(req.body);

    const result = await BillingModel.generateMonthlyBills(month);

    // Notify customers whose bills were generated
    if (result.generated > 0) {
      notify(async () => {
        await NotifService.sendToRole('customer',
          '📄 Monthly Bill Ready',
          `Your bill for ${month} has been generated. Please check and pay before the due date.`,
          'payment'
        );
      });
    }

    res.json({
      message: `Bills generated for ${month}`,
      ...result,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: err.issues[0].message }); return;
    }
    console.error('generateBills error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// GET /api/billing  (role-aware)
export const getBills = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, status } = req.query as Record<string, string>;
    const filters: Parameters<typeof BillingModel.getBills>[0] = { month, status };

    if (req.user!.role === 'customer') filters.customerId = req.user!.id;

    if (filters.customerId) {
      await BillingModel.syncStaleBills(filters.customerId);
    }

    const bills = await BillingModel.getBills(filters);
    res.json({ bills });
  } catch (err) {
    console.error('getBills error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// GET /api/billing/:id  (role-aware)
export const getBillById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bill = await BillingModel.getBillById(Number(req.params.id));
    if (!bill) { res.status(404).json({ message: 'Bill not found' }); return; }
    if (req.user!.role === 'customer' && bill.customer_id !== req.user!.id) {
      res.status(403).json({ message: 'Access denied' }); return;
    }
    res.json({ bill });
  } catch (err) {
    console.error('getBillById error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// GET /api/billing/:id/pdf
export const downloadBillPDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bill = await BillingModel.getBillById(Number(req.params.id));
    if (!bill) { res.status(404).json({ message: 'Bill not found' }); return; }
    if (req.user!.role === 'customer' && bill.customer_id !== req.user!.id) {
      res.status(403).json({ message: 'Access denied' }); return;
    }
    await generateBillPDF(bill, res);
  } catch (err) {
    console.error('downloadBillPDF error:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Failed to generate PDF' });
  }
};

// PATCH /api/billing/:id/pay  (admin)
export const recordPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schema = z.object({ amount: z.number().positive() });
    const { amount } = schema.parse(req.body);

    const bill = await BillingModel.getBillById(Number(req.params.id));
    if (!bill) { res.status(404).json({ message: 'Bill not found' }); return; }
    if (bill.status === 'paid') { res.status(400).json({ message: 'Bill already paid' }); return; }

    await BillingModel.recordBillPayment(bill.id, amount);

    notify(() =>
      NotifService.sendToUser({
        userId: bill.customer_id,
        title:  '✅ Payment Recorded',
        body:   `₹${amount} payment recorded for your ${bill.month} bill.`,
        type:   'payment',
      })
    );

    res.json({ message: 'Payment recorded' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: err.issues[0].message }); return;
    }
    console.error('recordPayment error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// PATCH /api/billing/:id/pay-wallet  (customer — pay own bill via wallet)
export const payBillWithWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bill = await BillingModel.getBillById(Number(req.params.id));
    if (!bill) { res.status(404).json({ message: 'Bill not found' }); return; }

    // Customers can only pay their own bills
    if (req.user!.role === 'customer' && bill.customer_id !== req.user!.id) {
      res.status(403).json({ message: 'Access denied' }); return;
    }
    if (bill.status === 'paid') {
      res.status(400).json({ message: 'Bill already paid' }); return;
    }

    const due = parseFloat((Number(bill.total_amount) - Number(bill.paid_amount)).toFixed(2));
    if (due <= 0) { res.status(400).json({ message: 'No amount due' }); return; }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Check wallet balance
      const [userRows] = await conn.query<RowDataPacket[]>(
        'SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE',
        [bill.customer_id]
      );
      const walletBalance = Number(userRows[0]?.wallet_balance ?? 0);
      if (walletBalance < due) {
        await conn.rollback();
        res.status(400).json({ message: `Insufficient wallet balance. Need ₹${due}, have ₹${walletBalance}` });
        return;
      }

      // Debit wallet
      await conn.query('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?', [due, bill.customer_id]);

      // Record wallet transaction
      await conn.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, mode, status, reference_id, note)
         VALUES (?, 'debit', ?, 'wallet', 'completed', ?, ?)`,
        [bill.customer_id, due, `bill-${bill.id}`, `Bill payment for ${bill.month}`]
      );

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    // Record payment on bill
    await BillingModel.recordBillPayment(bill.id, due);

    notify(() =>
      NotifService.sendToUser({
        userId: bill.customer_id,
        title:  '✅ Bill Paid',
        body:   `Your ${bill.month} bill of ₹${due} has been paid via wallet.`,
        type:   'payment',
      })
    );

    res.json({ message: 'Bill paid via wallet' });
  } catch (err) {
    console.error('payBillWithWallet error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// ── Delivery Report — flexible date range ────────────────────────────────────

const getReportData = async (customerId: number, startDate: string, endDate: string) => {
  // Customer info
  const [custRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, phone, COALESCE(jar_rate, 50) AS jar_rate FROM users WHERE id = ?`,
    [customerId]
  );
  if (!custRows.length) return null;
  const customer = custRows[0];

  // Daily breakdown
  const [dailyRows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(COALESCE(d.delivered_at, d.created_at), '%Y-%m-%d') AS delivery_date,
            SUM(d.delivered_quantity) AS jars
     FROM deliveries d
     JOIN orders o ON o.id = d.order_id
     WHERE o.customer_id = ?
       AND DATE(COALESCE(d.delivered_at, d.created_at)) BETWEEN ? AND ?
       AND d.status = 'delivered'
     GROUP BY DATE(COALESCE(d.delivered_at, d.created_at))
     ORDER BY delivery_date ASC`,
    [customerId, startDate, endDate]
  );

  const days = dailyRows.map((r: RowDataPacket) => ({
    date: String(r.delivery_date),
    jars: Number(r.jars),
  }));

  const totalJars = days.reduce((s, d) => s + d.jars, 0);
  const jarRate = Number(customer.jar_rate);
  const totalAmount = totalJars * jarRate;

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      jar_rate: jarRate,
    },
    startDate,
    endDate,
    totalJars,
    jarRate,
    totalAmount,
    days,
  };
};

// GET /api/billing/delivery-report?customerId=X&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export const getDeliveryReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let { customerId, startDate, endDate } = req.query as Record<string, string>;

    // Customer can only see their own
    if (req.user!.role === 'customer') customerId = String(req.user!.id);

    if (!customerId) { res.status(400).json({ message: 'customerId is required' }); return; }
    if (!startDate || !endDate) { res.status(400).json({ message: 'startDate and endDate are required (YYYY-MM-DD)' }); return; }

    const data = await getReportData(Number(customerId), startDate, endDate);
    if (!data) { res.status(404).json({ message: 'Customer not found' }); return; }

    res.json({ report: data });
  } catch (err) {
    console.error('getDeliveryReport error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/billing/delivery-report/pdf?customerId=X&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export const getDeliveryReportPDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let { customerId, startDate, endDate, token } = req.query as Record<string, string>;

    if (req.user!.role === 'customer') customerId = String(req.user!.id);

    if (!customerId || !startDate || !endDate) {
      res.status(400).json({ message: 'customerId, startDate, and endDate are required' }); return;
    }

    const data = await getReportData(Number(customerId), startDate, endDate);
    if (!data) { res.status(404).json({ message: 'Customer not found' }); return; }

    await generateReportPDF(data, res);
  } catch (err) {
    console.error('getDeliveryReportPDF error:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Failed to generate PDF' });
  }
};
