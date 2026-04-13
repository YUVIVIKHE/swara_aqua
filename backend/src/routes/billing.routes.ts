import { Router } from 'express';
import { authenticate, allowAdmin } from '../middleware/auth.middleware';
import {
  generateBills, getBills, getBillById, downloadBillPDF, recordPayment,
} from '../controllers/billing.controller';
import {
  getRevenue, getPendingPayments, getStaffPerformance,
} from '../controllers/reports.controller';

const router = Router();

// ── Static routes FIRST (before /:id) ────────────────────────────────────────
router.post('/generate',                 ...allowAdmin, generateBills);
router.get('/reports/revenue',           ...allowAdmin, getRevenue);
router.get('/reports/pending',           ...allowAdmin, getPendingPayments);
router.get('/reports/staff-performance', ...allowAdmin, getStaffPerformance);

// ── Billing list + detail ─────────────────────────────────────────────────────
router.get('/',              authenticate, getBills);
router.get('/:id/pdf',       authenticate, downloadBillPDF);  // /pdf before /:id
router.get('/:id',           authenticate, getBillById);
router.patch('/:id/pay',    ...allowAdmin, recordPayment);

export default router;
