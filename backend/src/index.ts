import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

// Load .env relative to this file's location, not process.cwd()
// This is critical for Hostinger Passenger which changes cwd
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import notificationRoutes from './routes/notification.routes';
import orderRoutes from './routes/order.routes';
import inventoryRoutes from './routes/inventory.routes';
import billingRoutes from './routes/billing.routes';
import addressRoutes from './routes/address.routes';
import bannerRoutes from './routes/banner.routes';
import eventsRoutes from './routes/events.routes';
import walletRoutes from './routes/wallet.routes';
import { startCronJobs } from './services/cron.service';
import { runMigrations } from './config/migrate';
import { Request, Response, NextFunction } from 'express';
import './config/firebase';

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, SSE)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/orders',        orderRoutes);
app.use('/api/inventory',     inventoryRoutes);
app.use('/api/billing',       billingRoutes);
app.use('/api/addresses',     addressRoutes);
app.use('/api/banners',       bannerRoutes);
app.use('/api/events',        eventsRoutes);
app.use('/api/wallet',        walletRoutes);

// ── Static files ──────────────────────────────────────────────────────────────
// Use __dirname so paths work regardless of where Passenger sets cwd
const appRoot = path.join(__dirname, '..');
app.use('/uploads', express.static(path.join(appRoot, 'uploads')));

// ── Serve React SPA in production ─────────────────────────────────────────────
if (isProd) {
  const distPath = path.join(appRoot, 'public');
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── Health check ──────────────────────────────────────────────────────────────
import { getClientCount } from './services/sse.service';
app.get('/health', (_req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV, sseClients: getClientCount() }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const start = async () => {
  await runMigrations();

  // Hostinger Passenger sets PORT automatically
  // Fall back to 3000 (Passenger default) then 5000 for local dev
  const port = Number(process.env.PORT) || 3000;

  app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${port} [${process.env.NODE_ENV || 'development'}]`);
    startCronJobs();
  });
};

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
