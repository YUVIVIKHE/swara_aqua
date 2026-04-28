import { Router } from 'express';
import { authenticate, allowAdmin } from '../middleware/auth.middleware';
import {
  getWallet,
  createTopupOrder,
  verifyTopup,
  payOrderWithWallet,
  requestWalletAccess,
  getWalletAccessRequests,
  approveWalletAccess,
  rejectWalletAccess,
} from '../controllers/wallet.controller';

const router = Router();

// Customer routes
router.get('/',                    authenticate, getWallet);
router.post('/request-access',     authenticate, requestWalletAccess);
router.post('/topup/order',        authenticate, createTopupOrder);
router.post('/topup/verify',       authenticate, verifyTopup);
router.post('/pay-order',          authenticate, payOrderWithWallet);

// Admin routes
router.get('/access-requests',                    ...allowAdmin, getWalletAccessRequests);
router.patch('/access-requests/:userId/approve',  ...allowAdmin, approveWalletAccess);
router.patch('/access-requests/:userId/reject',   ...allowAdmin, rejectWalletAccess);

export default router;
