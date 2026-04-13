import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getAddresses, addAddress, updateAddress, setDefault, deleteAddress
} from '../controllers/address.controller';

const router = Router();

router.get('/',            authenticate, getAddresses);
router.post('/',           authenticate, addAddress);
router.patch('/:id',       authenticate, updateAddress);
router.patch('/:id/default', authenticate, setDefault);
router.delete('/:id',      authenticate, deleteAddress);

export default router;
