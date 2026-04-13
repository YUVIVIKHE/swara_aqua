import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as Reports from '../models/reports.model';

// GET /api/reports/revenue?period=daily|monthly
export const getRevenue = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { period = 'daily', days, months } = req.query as Record<string, string>;
    const [data, summary] = await Promise.all([
      period === 'monthly'
        ? Reports.getMonthlyRevenue(Number(months) || 12)
        : Reports.getDailyRevenue(Number(days) || 30),
      Reports.getRevenueSummary(),
    ]);
    res.json({ data, summary, period });
  } catch (err) {
    console.error('getRevenue error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// GET /api/reports/pending
export const getPendingPayments = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await Reports.getPendingPayments();
    res.json({ data });
  } catch (err) {
    console.error('getPendingPayments error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// GET /api/reports/staff-performance?month=YYYY-MM
export const getStaffPerformance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month } = req.query as Record<string, string>;
    const data = await Reports.getStaffPerformance(month);
    res.json({ data });
  } catch (err) {
    console.error('getStaffPerformance error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};
