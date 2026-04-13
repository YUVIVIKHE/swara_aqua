import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as BillingModel from '../models/billing.model';
import * as NotifService from '../services/notification.service';
import { generateBillPDF } from '../services/pdf.service';
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
    generateBillPDF(bill, res);
  } catch (err) {
    console.error('downloadBillPDF error:', err);
    res.status(500).json({ message: 'Failed to generate PDF' });
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
