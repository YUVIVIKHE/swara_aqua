import { Router } from 'express';
import { authenticate, allowAdmin } from '../middleware/auth.middleware';
import {
  generateBills, getBills, getBillById, downloadBillPDF, recordPayment, payBillWithWallet,
  getDeliveryReport, getDeliveryReportPDF,
} from '../controllers/billing.controller';
import {
  getRevenue, getPendingPayments, getStaffPerformance, getCustomerGrowth,
} from '../controllers/reports.controller';

const router = Router();

// ── Static routes FIRST (before /:id) ────────────────────────────────────────
router.post('/generate',                 ...allowAdmin, generateBills);
router.get('/reports/revenue',           ...allowAdmin, getRevenue);
router.get('/reports/pending',           ...allowAdmin, getPendingPayments);
router.get('/reports/staff-performance', ...allowAdmin, getStaffPerformance);
router.get('/reports/customer-growth',   ...allowAdmin, getCustomerGrowth);

// ── Delivery report (flexible date range — admin + customer) ──────────────────
router.get('/delivery-report',           authenticate, getDeliveryReport);
router.get('/delivery-report/pdf',       authenticate, getDeliveryReportPDF);

// ── Billing list + detail ─────────────────────────────────────────────────────
router.get('/',              authenticate, getBills);
router.get('/:id/pdf',       authenticate, downloadBillPDF);
router.get('/:id',           authenticate, getBillById);
router.patch('/:id/pay',    ...allowAdmin, recordPayment);
router.patch('/:id/pay-wallet', authenticate, payBillWithWallet);

export default router;

