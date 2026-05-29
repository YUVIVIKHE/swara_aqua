import { Router } from 'express';
import { getStats, getUsers, updateStatus, createStaff, updateJarRate, getCustomerProfile, getCustomerBalances, getStaffProfile, createCustomer, createOrderForCustomer } from '../controllers/admin.controller';
import { getStatus as getFirebaseStatus, uploadCredentials, reloadCredentials } from '../controllers/firebase-setup.controller';
import { allowAdmin } from '../middleware/auth.middleware';

const router = Router();

router.get('/stats',              ...allowAdmin, getStats);
router.get('/users',              ...allowAdmin, getUsers);
router.get('/users/:id/profile',  ...allowAdmin, getCustomerProfile);
router.patch('/users/:id/status', ...allowAdmin, updateStatus);
router.patch('/users/:id/jar-rate', ...allowAdmin, updateJarRate);
router.post('/staff',             ...allowAdmin, createStaff);
router.post('/customer',          ...allowAdmin, createCustomer);
router.post('/orders',            ...allowAdmin, createOrderForCustomer);
router.get('/staff/:id/profile',  ...allowAdmin, getStaffProfile);
router.get('/customer-balances',  ...allowAdmin, getCustomerBalances);

router.get('/firebase/status',    ...allowAdmin, getFirebaseStatus);
router.post('/firebase/upload',   ...allowAdmin, uploadCredentials);
router.post('/firebase/reload',   ...allowAdmin, reloadCredentials);

export default router;

