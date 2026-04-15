import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import * as NotifService from '../services/notification.service';
import * as SSE from '../services/sse.service';

// Lazy init — only created when first request comes in so missing keys don't crash startup
let _razorpay: Razorpay | null = null;
const getRazorpay = () => {
  if (!_razorpay) {
    const key_id     = process.env.RAZORPAY_KEY_ID     || '';
    const key_secret = process.env.RAZORPAY_KEY_SECRET || '';
    if (!key_id || !key_secret) throw new Error('Razorpay keys not configured in environment');
    _razorpay = new Razorpay({ key_id, key_secret });
  }
  return _razorpay;
};

const notify = (fn: () => Promise<void>) =>
  fn().catch(err => console.warn('FCM (non-fatal):', err?.message));

// GET /api/wallet  — balance + recent transactions
export const getWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const [userRows] = await pool.query<RowDataPacket[]>(
      'SELECT wallet_balance FROM users WHERE id = ?', [userId]
    );
    const balance = Number(userRows[0]?.wallet_balance ?? 0);

    const [txRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );

    res.json({ balance, transactions: txRows });
  } catch (err) {
    console.error('getWallet error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/wallet/topup/order  — create Razorpay order for wallet top-up
export const createTopupOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || amount < 1) {
      res.status(400).json({ message: 'amount must be >= 1' }); return;
    }

    const order = await getRazorpay().orders.create({
      amount:   Math.round(amount * 100), // paise
      currency: 'INR',
      receipt:  `wallet_${req.user!.id}_${Date.now()}`,
      notes:    { userId: String(req.user!.id), purpose: 'wallet_topup' },
    });

    res.json({
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      keyId:    process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('createTopupOrder error:', err);
    res.status(500).json({ message: 'Failed to create payment order' });
  }
};

// POST /api/wallet/topup/verify  — verify Razorpay payment & credit wallet
export const verifyTopup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !amount) {
      res.status(400).json({ message: 'Missing payment verification fields' }); return;
    }

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      res.status(400).json({ message: 'Payment verification failed' }); return;
    }

    const creditAmount = Number(amount) / 100; // convert paise → rupees
    const userId = req.user!.id;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Credit wallet
      await conn.query(
        'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
        [creditAmount, userId]
      );

      // Record transaction
      await conn.query(
        `INSERT INTO wallet_transactions
           (user_id, type, amount, mode, status, reference_id, note)
         VALUES (?, 'credit', ?, 'razorpay', 'completed', ?, 'Wallet top-up via Razorpay')`,
        [userId, creditAmount, razorpay_payment_id]
      );

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    // Fetch updated balance
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT wallet_balance FROM users WHERE id = ?', [userId]
    );
    const newBalance = Number(rows[0]?.wallet_balance ?? 0);

    notify(() =>
      NotifService.sendToUser({
        userId,
        title: '💰 Wallet Topped Up!',
        body:  `₹${creditAmount} added to your wallet. Balance: ₹${newBalance}`,
        type:  'payment',
      })
    );

    SSE.sendToUser(userId, 'wallet_updated', { balance: newBalance });

    res.json({ message: 'Wallet topped up successfully', balance: newBalance });
  } catch (err) {
    console.error('verifyTopup error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/wallet/pay-order  — pay for an order using wallet balance
export const payOrderWithWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.body;
    if (!orderId) { res.status(400).json({ message: 'orderId is required' }); return; }

    const userId = req.user!.id;
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Lock user row
      const [userRows] = await conn.query<RowDataPacket[]>(
        'SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE', [userId]
      );
      const balance = Number(userRows[0]?.wallet_balance ?? 0);

      // Get order
      const [orderRows] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM orders WHERE id = ? AND customer_id = ?', [orderId, userId]
      );
      if (!orderRows.length) {
        await conn.rollback();
        res.status(404).json({ message: 'Order not found' }); return;
      }
      const order = orderRows[0];
      const due = Number(order.total_amount);

      if (balance < due) {
        await conn.rollback();
        res.status(400).json({ message: `Insufficient wallet balance. Need ₹${due}, have ₹${balance}` }); return;
      }

      // Debit wallet
      await conn.query(
        'UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?',
        [due, userId]
      );

      // Record wallet transaction
      await conn.query(
        `INSERT INTO wallet_transactions
           (user_id, type, amount, mode, status, reference_id, note)
         VALUES (?, 'debit', ?, 'wallet', 'completed', ?, ?)`,
        [userId, due, String(orderId), `Payment for Order #${orderId}`]
      );

      // Record in transactions table (for billing/reports)
      await conn.query(
        `INSERT INTO transactions
           (customer_id, order_id, amount, mode, type, status, note)
         VALUES (?, ?, ?, 'advance', 'credit', 'completed', 'Paid via wallet')`,
        [userId, orderId, due]
      );

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT wallet_balance FROM users WHERE id = ?', [userId]
    );
    const newBalance = Number(rows[0]?.wallet_balance ?? 0);

    notify(() =>
      NotifService.sendToUser({
        userId,
        title: '✅ Payment Successful',
        body:  `Order #${orderId} paid via wallet. Remaining balance: ₹${newBalance}`,
        type:  'payment',
      })
    );

    SSE.sendToUser(userId, 'wallet_updated', { balance: newBalance });

    res.json({ message: 'Order paid via wallet', balance: newBalance });
  } catch (err) {
    console.error('payOrderWithWallet error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
