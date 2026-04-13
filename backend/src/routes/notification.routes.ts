import { Router } from 'express';
import { authenticate, allowAdmin } from '../middleware/auth.middleware';
import {
  registerToken,
  unregisterToken,
  sendNotification,
  broadcastNotification,
  getNotifications,
  markRead,
  markAllRead,
} from '../controllers/notification.controller';

const router = Router();

// All authenticated users
router.post('/register-token', authenticate, registerToken);
router.delete('/token',        authenticate, unregisterToken);
router.get('/',                authenticate, getNotifications);
router.patch('/read-all',      authenticate, markAllRead);
router.patch('/:id/read',      authenticate, markRead);

// Admin only
router.post('/send',      ...allowAdmin, sendNotification);
router.post('/broadcast', ...allowAdmin, broadcastNotification);

export default router;
