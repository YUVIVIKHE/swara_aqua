import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as Inv from '../models/inventory.model';
import * as NotifService from '../services/notification.service';

const LOW_STOCK_THRESHOLD = 20;

const notify = (fn: () => Promise<void>) =>
  fn().catch(err => console.warn('FCM (non-fatal):', err?.message));

// ── Inventory ─────────────────────────────────────────────────────────────────

// GET /api/inventory
export const getInventory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [inventory, staffInventory] = await Promise.all([
      Inv.getInventory(),
      req.user!.role === 'staff'
        ? Inv.getStaffInventory(req.user!.id)
        : Inv.getStaffInventory(),
    ]);
    res.json({ inventory, staffInventory });
  } catch (err) {
    console.error('getInventory error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// POST /api/inventory/add  (admin)
export const addStock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { quantity, note } = req.body;
    if (!quantity || Number(quantity) < 1) {
      res.status(400).json({ message: 'quantity must be a positive number' }); return;
    }
    await Inv.addStock(Number(quantity), req.user!.id, note);
    res.json({ message: `${quantity} jars added to inventory` });
  } catch (err) {
    console.error('addStock error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// POST /api/inventory/assign  (admin)
export const assignJars = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { staffId, quantity } = req.body;
    if (!staffId || !quantity || Number(quantity) < 1) {
      res.status(400).json({ message: 'staffId and quantity are required' }); return;
    }
    await Inv.assignJarsToStaff(Number(staffId), Number(quantity), req.user!.id);

    // Low stock alert
    const inv = await Inv.getInventory();
    if (inv.available_jars <= LOW_STOCK_THRESHOLD) {
      notify(() =>
        NotifService.sendToRole('admin',
          '⚠️ Low Stock Alert',
          `Only ${inv.available_jars} jars remaining in inventory.`,
          'stock'
        )
      );
    }

    notify(() =>
      NotifService.sendToUser({
        userId: Number(staffId),
        title:  'Jars Assigned',
        body:   `${quantity} jars have been assigned to you.`,
        type:   'delivery',
      })
    );

    res.json({ message: `${quantity} jars assigned to staff #${staffId}` });
  } catch (err) {
    console.error('assignJars error:', err);
    const msg = (err as Error).message;
    const status = msg.includes('Insufficient') ? 400 : 500;
    res.status(status).json({ message: msg });
  }
};

// POST /api/inventory/return  (staff)
export const returnJars = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { quantity } = req.body;
    if (!quantity || Number(quantity) < 1) {
      res.status(400).json({ message: 'quantity must be a positive number' }); return;
    }
    await Inv.returnEmptyJars(req.user!.id, Number(quantity));
    res.json({ message: `${quantity} empty jars returned` });
  } catch (err) {
    console.error('returnJars error:', err);
    const msg = (err as Error).message;
    const status = msg.includes('Cannot return') ? 400 : 500;
    res.status(status).json({ message: msg });
  }
};

// POST /api/inventory/damaged  (staff)
export const reportDamaged = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { quantity, note } = req.body;
    if (!quantity || Number(quantity) < 1) {
      res.status(400).json({ message: 'quantity must be a positive number' }); return;
    }
    await Inv.markDamaged(req.user!.id, Number(quantity), note || '');
    notify(() =>
      NotifService.sendToRole('admin',
        '🚨 Damaged Jars Reported',
        `Staff reported ${quantity} damaged jars.`,
        'stock'
      )
    );
    res.json({ message: `${quantity} jars marked as damaged` });
  } catch (err) {
    console.error('reportDamaged error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// GET /api/inventory/logs
export const getLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = Number(req.query.limit) || 50;
    const logs = req.user!.role === 'staff'
      ? await Inv.getStaffLogs(req.user!.id, limit)
      : await Inv.getInventoryLogs(limit);
    res.json({ logs });
  } catch (err) {
    console.error('getLogs error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// ── Transactions ──────────────────────────────────────────────────────────────

// GET /api/transactions
export const getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { mode, status, date } = req.query as Record<string, string>;
    const filters: Parameters<typeof Inv.getTransactions>[0] = { mode, status, date };

    if (req.user!.role === 'staff')    filters.staffId    = req.user!.id;
    if (req.user!.role === 'customer') filters.customerId = req.user!.id;

    const [transactions, stats] = await Promise.all([
      Inv.getTransactions(filters),
      req.user!.role !== 'customer' ? Inv.getTransactionStats() : null,
    ]);
    res.json({ transactions, stats });
  } catch (err) {
    console.error('getTransactions error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// POST /api/transactions  (internal — called after delivery)
export const createTransaction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { customerId, orderId, amount, mode, type, note } = req.body;
    if (!customerId || !amount || !mode || !type) {
      res.status(400).json({ message: 'customerId, amount, mode and type are required' }); return;
    }
    const id = await Inv.createTransaction({
      customerId: Number(customerId),
      orderId:    orderId ? Number(orderId) : undefined,
      amount:     Number(amount),
      mode, type,
      collectedBy: req.user!.role === 'staff' ? req.user!.id : undefined,
      note,
    });
    res.status(201).json({ message: 'Transaction recorded', id });
  } catch (err) {
    console.error('createTransaction error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// ── Cash submissions ──────────────────────────────────────────────────────────

// POST /api/cash/submit  (staff)
export const submitCash = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { totalCash, note } = req.body;
    if (!totalCash || Number(totalCash) < 0) {
      res.status(400).json({ message: 'totalCash is required' }); return;
    }
    const id = await Inv.submitCash(req.user!.id, Number(totalCash), note);

    notify(() =>
      NotifService.sendToRole('admin',
        '💰 Cash Submitted',
        `Staff submitted ₹${totalCash} for verification.`,
        'payment'
      )
    );

    res.status(201).json({ message: 'Cash submitted for verification', id });
  } catch (err) {
    console.error('submitCash error:', err);
    const msg = (err as Error).message;
    const status = msg.includes('pending') ? 409 : 500;
    res.status(status).json({ message: msg });
  }
};

// GET /api/cash  (staff: own, admin: all)
export const getCashSubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query as Record<string, string>;
    const filters: Parameters<typeof Inv.getCashSubmissions>[0] = { status };
    if (req.user!.role === 'staff') filters.staffId = req.user!.id;

    const submissions = await Inv.getCashSubmissions(filters);
    res.json({ submissions });
  } catch (err) {
    console.error('getCashSubmissions error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// PATCH /api/cash/:id/verify  (admin)
export const verifyCash = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action } = req.body; // 'verified' | 'rejected'
    if (!['verified', 'rejected'].includes(action)) {
      res.status(400).json({ message: 'action must be verified or rejected' }); return;
    }
    await Inv.verifyCashSubmission(Number(req.params.id), req.user!.id, action);

    // Notify staff
    const subs = await Inv.getCashSubmissions({ staffId: undefined, status: action });
    const sub = subs.find(s => s.id === Number(req.params.id));
    if (sub) {
      notify(() =>
        NotifService.sendToUser({
          userId: sub.staff_id,
          title:  action === 'verified' ? '✅ Cash Verified' : '❌ Cash Rejected',
          body:   `Your cash submission of ₹${sub.total_cash} has been ${action}.`,
          type:   'payment',
        })
      );
    }

    res.json({ message: `Cash submission ${action}` });
  } catch (err) {
    console.error('verifyCash error:', err);
    const msg = (err as Error).message;
    const status = msg.includes('not found') ? 404 : 500;
    res.status(status).json({ message: msg });
  }
};

// GET /api/inventory/cash/holdings  (staff: own, admin: all)
export const getStaffCashHoldings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const staffId = req.user!.role === 'staff' ? req.user!.id : undefined;
    const holdings = await Inv.getStaffCashHoldings(staffId);
    res.json({ holdings });
  } catch (err) {
    console.error('getStaffCashHoldings error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

