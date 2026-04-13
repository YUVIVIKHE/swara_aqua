import { Router } from 'express';
import { authenticate, allowAdmin } from '../middleware/auth.middleware';
import {
  createOrder, getOrders, getOrderById, cancelOrder,
  assignOrder, updateOrderStatus, getOrderStats, getStaffList,
  completeDelivery, getDeliveries, getCalendarData, getDailySummary,
} from '../controllers/order.controller';

const router = Router();

// ── Static routes FIRST (before /:id to avoid param conflicts) ────────────────
router.get('/stats',       ...allowAdmin, getOrderStats);    // admin
router.get('/staff-list',  ...allowAdmin, getStaffList);     // admin
router.get('/deliveries',  authenticate, getDeliveries);     // staff + admin
router.post('/deliveries', authenticate, completeDelivery);  // staff
router.get('/calendar',      authenticate, getCalendarData);   // customer + admin
router.get('/daily-summary', authenticate, getDailySummary);   // staff + admin

// ── Orders ────────────────────────────────────────────────────────────────────
router.post('/',           authenticate,  createOrder);       // customer
router.get('/',            authenticate,  getOrders);         // role-aware
router.get('/:id',         authenticate,  getOrderById);      // all roles
router.put('/:id/assign',  ...allowAdmin, assignOrder);       // admin
router.put('/:id/status',  authenticate,  updateOrderStatus); // staff + admin
router.delete('/:id',      authenticate,  cancelOrder);       // customer

export default router;
