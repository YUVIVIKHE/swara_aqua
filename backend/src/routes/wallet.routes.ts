import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getWallet,
  createTopupOrder,
  verifyTopup,
  payOrderWithWallet,
} from '../controllers/wallet.controller';

const router = Router();

router.get('/',               authenticate, getWallet);
router.post('/topup/order',   authenticate, createTopupOrder);
router.post('/topup/verify',  authenticate, verifyTopup);
router.post('/pay-order',     authenticate, payOrderWithWallet);

export default router;
