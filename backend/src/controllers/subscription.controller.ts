import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as SubModel from '../models/subscription.model';

// ── Customer endpoints ────────────────────────────────────────────────────────

export const createSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { slots, address, autoRenew } = req.body;
    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      res.status(400).json({ message: 'At least one delivery slot is required' });
      return;
    }
    for (const s of slots) {
      if (!s.label || !s.time || !s.quantity || s.quantity < 1) {
        res.status(400).json({ message: 'Each slot needs label, time, and quantity >= 1' });
        return;
      }
    }
    const id = await SubModel.createSubscription(
      req.user!.id,
      slots.map((s: any) => ({ label: s.label, time: s.time, quantity: Number(s.quantity) })),
      address,
      autoRenew
    );

    // Immediately generate orders for today (if within booking hours) and tomorrow
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const tmrw = new Date(now); tmrw.setDate(tmrw.getDate() + 1);
    const tomorrowStr = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, '0')}-${String(tmrw.getDate()).padStart(2, '0')}`;

    const currentHour = now.getHours();
    // If before 6 PM, generate today's orders too
    if (currentHour < 18) {
      await SubModel.generateOrdersForSubscription(id, todayStr);
    }
    // Always generate tomorrow's orders
    await SubModel.generateOrdersForSubscription(id, tomorrowStr);

    res.status(201).json({ message: 'Subscription created', subscriptionId: id });
  } catch (err: any) {
    if (err.message?.includes('already have')) {
      res.status(409).json({ message: err.message });
    } else {
      console.error('createSubscription error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
};

export const getMySubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sub = await SubModel.getSubscriptionByCustomer(req.user!.id);
    res.json({ subscription: sub });
  } catch (err) {
    console.error('getMySubscription error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const sub = await SubModel.getSubscriptionById(id);
    if (!sub || sub.customer_id !== req.user!.id) {
      res.status(404).json({ message: 'Subscription not found' }); return;
    }
    if (sub.status === 'cancelled' || sub.status === 'expired') {
      res.status(400).json({ message: 'Cannot update a cancelled/expired subscription' }); return;
    }
    const { slots, address, autoRenew } = req.body;
    const parsedSlots = slots
      ? slots.map((s: any) => ({ label: s.label, time: s.time, quantity: Number(s.quantity) }))
      : [];
    await SubModel.updateSubscription(id, parsedSlots, address, autoRenew);
    res.json({ message: 'Subscription updated' });
  } catch (err) {
    console.error('updateSubscription error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const pauseSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const sub = await SubModel.getSubscriptionById(id);
    if (!sub || sub.customer_id !== req.user!.id) {
      res.status(404).json({ message: 'Subscription not found' }); return;
    }
    await SubModel.pauseSubscription(id);
    res.json({ message: 'Subscription paused — takes effect from tomorrow' });
  } catch (err) {
    console.error('pauseSubscription error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const resumeSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const sub = await SubModel.getSubscriptionById(id);
    if (!sub || sub.customer_id !== req.user!.id) {
      res.status(404).json({ message: 'Subscription not found' }); return;
    }
    await SubModel.resumeSubscription(id);

    // Generate orders for today/tomorrow immediately
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const tmrw = new Date(now); tmrw.setDate(tmrw.getDate() + 1);
    const tomorrowStr = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, '0')}-${String(tmrw.getDate()).padStart(2, '0')}`;
    if (now.getHours() < 18) await SubModel.generateOrdersForSubscription(id, todayStr);
    await SubModel.generateOrdersForSubscription(id, tomorrowStr);

    res.json({ message: 'Subscription resumed' });
  } catch (err) {
    console.error('resumeSubscription error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const renewSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const sub = await SubModel.getSubscriptionById(id);
    if (!sub || sub.customer_id !== req.user!.id) {
      res.status(404).json({ message: 'Subscription not found' }); return;
    }
    await SubModel.renewSubscription(id);
    res.json({ message: 'Subscription renewed for next month' });
  } catch (err) {
    console.error('renewSubscription error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const cancelSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const sub = await SubModel.getSubscriptionById(id);
    if (!sub || sub.customer_id !== req.user!.id) {
      res.status(404).json({ message: 'Subscription not found' }); return;
    }
    await SubModel.cancelSubscription(id);
    res.json({ message: 'Subscription cancelled' });
  } catch (err) {
    console.error('cancelSubscription error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── Admin endpoints ───────────────────────────────────────────────────────────

export const adminCreateSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { customerId, slots, address, autoRenew } = req.body;
    if (!customerId) { res.status(400).json({ message: 'customerId is required' }); return; }
    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      res.status(400).json({ message: 'At least one delivery slot is required' }); return;
    }
    for (const s of slots) {
      if (!s.label || !s.time || !s.quantity || s.quantity < 1) {
        res.status(400).json({ message: 'Each slot needs label, time, and quantity >= 1' }); return;
      }
    }
    const id = await SubModel.createSubscription(
      customerId,
      slots.map((s: any) => ({ label: s.label, time: s.time, quantity: Number(s.quantity) })),
      address,
      autoRenew
    );

    // Immediately generate orders for today + tomorrow
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const tmrw = new Date(now); tmrw.setDate(tmrw.getDate() + 1);
    const tomorrowStr = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, '0')}-${String(tmrw.getDate()).padStart(2, '0')}`;
    if (now.getHours() < 18) await SubModel.generateOrdersForSubscription(id, todayStr);
    await SubModel.generateOrdersForSubscription(id, tomorrowStr);

    res.status(201).json({ message: 'Subscription created for customer', subscriptionId: id });
  } catch (err: any) {
    if (err.message?.includes('already have')) {
      res.status(409).json({ message: err.message });
    } else {
      console.error('adminCreateSubscription error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
};

export const adminCancelSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const sub = await SubModel.getSubscriptionById(id);
    if (!sub) { res.status(404).json({ message: 'Subscription not found' }); return; }
    await SubModel.cancelSubscription(id);
    res.json({ message: 'Subscription cancelled' });
  } catch (err) {
    console.error('adminCancelSubscription error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getAllSubscriptions = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const subs = await SubModel.getAllSubscriptions();
    res.json({ subscriptions: subs });
  } catch (err) {
    console.error('getAllSubscriptions error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getCancelRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query as Record<string, string>;
    const requests = await SubModel.getCancelRequests(status || 'pending');
    res.json({ requests });
  } catch (err) {
    console.error('getCancelRequests error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const reviewCancelRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { action } = req.body; // 'approved' | 'rejected'
    if (!['approved', 'rejected'].includes(action)) {
      res.status(400).json({ message: 'action must be approved or rejected' }); return;
    }

    // Get the cancel request to find the order
    const [rows] = await (await import('../config/db')).default.query<any[]>(
      'SELECT * FROM cancel_requests WHERE id = ?', [id]
    );
    if (!rows.length) { res.status(404).json({ message: 'Cancel request not found' }); return; }

    await SubModel.reviewCancelRequest(id, action, req.user!.id);

    // If approved, actually cancel the order
    if (action === 'approved') {
      const OrderModel = await import('../models/order.model');
      await OrderModel.cancelOrder(rows[0].order_id, req.user!.id);
    }

    res.json({ message: `Cancel request ${action}` });
  } catch (err) {
    console.error('reviewCancelRequest error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getTimeSlots = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const start = await SubModel.getSetting('booking_start_time') || '08:00';
    const end = await SubModel.getSetting('booking_end_time') || '18:00';
    res.json({ start, end });
  } catch (err) {
    console.error('getTimeSlots error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateTimeSlots = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { start, end } = req.body;
    if (start) await SubModel.setSetting('booking_start_time', start);
    if (end) await SubModel.setSetting('booking_end_time', end);
    res.json({ message: 'Time slots updated' });
  } catch (err) {
    console.error('updateTimeSlots error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
