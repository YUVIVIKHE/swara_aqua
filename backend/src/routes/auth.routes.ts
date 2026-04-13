import { Router } from 'express';
import { signup, login, getMe, refreshToken, changePassword, updateProfile } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.post('/refresh', refreshToken);
router.post('/change-password', authenticate, changePassword);
router.patch('/profile', authenticate, updateProfile);

export default router;

