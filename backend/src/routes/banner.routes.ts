import { Router } from 'express';
import {
  listBanners, listActiveBanners, createBanner,
  updateBanner, deleteBanner, upload,
} from '../controllers/banner.controller';
import { allowAdmin, authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public — active banners for customer home
router.get('/active', authenticate, listActiveBanners);

// Admin — full CRUD
router.get('/',        allowAdmin, listBanners);
router.post('/',       allowAdmin, upload.single('image'), createBanner);
router.patch('/:id',   allowAdmin, updateBanner);
router.delete('/:id',  allowAdmin, deleteBanner);

export default router;
