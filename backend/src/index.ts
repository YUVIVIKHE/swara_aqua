import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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
import path from 'path';
import { startCronJobs } from './services/cron.service';
import { runMigrations } from './config/migrate';
import { Request, Response, NextFunction } from 'express';

dotenv.config();
import './config/firebase';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

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

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

import { getClientCount } from './services/sse.service';
app.get('/health', (_req, res) => res.json({ status: 'ok', sseClients: getClientCount() }));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

const start = async () => {
  await runMigrations();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    startCronJobs();
  });
};

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
