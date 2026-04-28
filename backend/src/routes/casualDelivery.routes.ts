import { Router } from 'express';
import { authenticate, allowAdmin } from '../middleware/auth.middleware';
import {
  createCasualDelivery,
  getCasualDeliveries,
  deleteCasualDelivery,
} from '../controllers/casualDelivery.controller';

const router = Router();

// Staff + Admin can create
router.post('/',      authenticate, createCasualDelivery);
// Staff sees own; admin sees all
router.get('/',       authenticate, getCasualDeliveries);
// Staff can delete their own; admin can delete any
router.delete('/:id', authenticate, deleteCasualDelivery);

export default router;
