import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth.middleware';

// ── Multer storage ─────────────────────────────────────────────────────────
const uploadDir = path.join(process.cwd(), 'uploads', 'banners');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `banner_${Date.now()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});

// ── GET /api/banners — public, returns active banners ─────────────────────
export const listBanners = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, image_url, link_url, sort_order, is_active, created_at
       FROM banners ORDER BY sort_order ASC, created_at DESC`
    );
    res.json({ banners: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch banners' });
  }
};

// ── GET /api/banners/active — public (customer view) ──────────────────────
export const listActiveBanners = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, image_url, link_url FROM banners
       WHERE is_active = 1 ORDER BY sort_order ASC, created_at DESC`
    );
    res.json({ banners: rows });
  } catch {
    res.status(500).json({ message: 'Failed to fetch banners' });
  }
};

// ── POST /api/banners — admin: upload a new banner ────────────────────────
export const createBanner = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ message: 'Image required' }); return; }

    const { title, link_url, sort_order } = req.body;
    // Store relative path only — avoids hardcoding localhost or domain
    const image_url = `/uploads/banners/${req.file.filename}`;

    const [result] = await pool.query(
      `INSERT INTO banners (title, image_url, link_url, sort_order, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [title || null, image_url, link_url || null, sort_order ? Number(sort_order) : 0, req.user!.id]
    ) as any;

    res.status(201).json({ message: 'Banner created', id: result.insertId, image_url });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create banner' });
  }
};

// ── PATCH /api/banners/:id — admin: update title/link/sort/active ────────
export const updateBanner = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, link_url, sort_order, is_active } = req.body;
    await pool.query(
      `UPDATE banners SET title = COALESCE(?, title),
        link_url = COALESCE(?, link_url),
        sort_order = COALESCE(?, sort_order),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [title ?? null, link_url ?? null, sort_order ?? null, is_active ?? null, id]
    );
    res.json({ message: 'Banner updated' });
  } catch {
    res.status(500).json({ message: 'Failed to update banner' });
  }
};

// ── DELETE /api/banners/:id — admin: remove banner + file ─────────────────
export const deleteBanner = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`SELECT image_url FROM banners WHERE id = ?`, [id]) as any;
    const banner = (rows as any[])[0];
    if (!banner) { res.status(404).json({ message: 'Banner not found' }); return; }

    // Delete file from disk
    const filename = banner.image_url.split('/uploads/banners/')[1];
    if (filename) {
      const filePath = path.join(uploadDir, filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.query(`DELETE FROM banners WHERE id = ?`, [id]);
    res.json({ message: 'Banner deleted' });
  } catch {
    res.status(500).json({ message: 'Failed to delete banner' });
  }
};
