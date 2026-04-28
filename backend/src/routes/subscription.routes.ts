import { Router } from 'express';
import { authenticate, allowAdmin } from '../middleware/auth.middleware';
import {
  createSubscription, getMySubscription, updateSubscription,
  pauseSubscription, resumeSubscription, renewSubscription, cancelSubscription,
  getAllSubscriptions, getCancelRequests, reviewCancelRequest,
  getTimeSlots, updateTimeSlots,
  adminCreateSubscription, adminCancelSubscription,
} from '../controllers/subscription.controller';

const router = Router();

// ── Customer routes ───────────────────────────────────────────────────────────
router.post('/',              authenticate, createSubscription);
router.get('/my',             authenticate, getMySubscription);
router.patch('/:id',          authenticate, updateSubscription);
router.patch('/:id/pause',    authenticate, pauseSubscription);
router.patch('/:id/resume',   authenticate, resumeSubscription);
router.patch('/:id/renew',    authenticate, renewSubscription);
router.delete('/:id',         authenticate, cancelSubscription);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get('/admin/all',                ...allowAdmin, getAllSubscriptions);
router.post('/admin/create',            ...allowAdmin, adminCreateSubscription);
router.delete('/admin/:id',             ...allowAdmin, adminCancelSubscription);
router.get('/admin/cancel-requests',    ...allowAdmin, getCancelRequests);
router.patch('/admin/cancel-requests/:id', ...allowAdmin, reviewCancelRequest);
router.get('/admin/time-slots',         ...allowAdmin, getTimeSlots);
router.patch('/admin/time-slots',       ...allowAdmin, updateTimeSlots);

export default router;
