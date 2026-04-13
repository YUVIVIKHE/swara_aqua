import { Router } from 'express';
import { getStats, getUsers, updateStatus, createStaff, updateJarRate, getCustomerProfile, getCustomerBalances, getStaffProfile } from '../controllers/admin.controller';
import { allowAdmin } from '../middleware/auth.middleware';

const router = Router();

router.get('/stats',              ...allowAdmin, getStats);
router.get('/users',              ...allowAdmin, getUsers);
router.get('/users/:id/profile',  ...allowAdmin, getCustomerProfile);
router.patch('/users/:id/status', ...allowAdmin, updateStatus);
router.patch('/users/:id/jar-rate', ...allowAdmin, updateJarRate);
router.post('/staff',             ...allowAdmin, createStaff);
router.get('/staff/:id/profile',  ...allowAdmin, getStaffProfile);
router.get('/customer-balances',  ...allowAdmin, getCustomerBalances);

export default router;
