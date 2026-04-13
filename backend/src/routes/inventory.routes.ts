import { Router } from 'express';
import { authenticate, allowAdmin, allowStaff } from '../middleware/auth.middleware';
import {
  getInventory, addStock, assignJars, returnJars, reportDamaged, getLogs,
  getTransactions, createTransaction,
  submitCash, getCashSubmissions, verifyCash, getStaffCashHoldings,
} from '../controllers/inventory.controller';

const router = Router();

// ── Inventory ─────────────────────────────────────────────────────────────────
router.get('/',          authenticate,  getInventory);
router.post('/add',      ...allowAdmin, addStock);
router.post('/assign',   ...allowAdmin, assignJars);
router.post('/return',   authenticate,  returnJars);   // staff
router.post('/damaged',  authenticate,  reportDamaged); // staff
router.get('/logs',      authenticate,  getLogs);

// ── Transactions ──────────────────────────────────────────────────────────────
router.get('/transactions',  authenticate,  getTransactions);
router.post('/transactions', authenticate,  createTransaction);

// ── Cash ──────────────────────────────────────────────────────────────────────
router.post('/cash/submit',      authenticate,  submitCash);
router.get('/cash/holdings',     authenticate,  getStaffCashHoldings);
router.get('/cash',              authenticate,  getCashSubmissions);
router.patch('/cash/:id/verify', ...allowAdmin, verifyCash);

export default router;
