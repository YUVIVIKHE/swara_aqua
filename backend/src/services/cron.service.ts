import cron from 'node-cron';
import { generateMonthlyBills } from '../models/billing.model';
import { getBills } from '../models/billing.model';
import * as NotifService from './notification.service';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';

const notify = (fn: () => Promise<void>) =>
  fn().catch(err => console.warn('Cron FCM (non-fatal):', err?.message));

export const startCronJobs = () => {
  // ── Auto-generate bills on 1st of every month at 00:05 ───────────────────
  cron.schedule('5 0 1 * *', async () => {
    const now   = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    console.log(`[CRON] Generating bills for ${month}…`);
    try {
      const result = await generateMonthlyBills(month);
      console.log(`[CRON] Bills: generated=${result.generated} skipped=${result.skipped} errors=${result.errors}`);
    } catch (err) {
      console.error('[CRON] Bill generation failed:', err);
    }
  });

  // ── Payment reminders — daily at 09:00 for overdue bills ─────────────────
  cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Sending payment reminders…');
    try {
      const [overdue] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT b.customer_id
         FROM bills b
         WHERE b.status IN ('unpaid','partial')
           AND b.due_date < CURDATE()`
      );
      for (const row of overdue as RowDataPacket[]) {
        notify(() =>
          NotifService.sendToUser({
            userId: row.customer_id,
            title:  '⚠️ Payment Overdue',
            body:   'You have an overdue water bill. Please pay to avoid service interruption.',
            type:   'payment',
          })
        );
      }
      console.log(`[CRON] Sent reminders to ${(overdue as RowDataPacket[]).length} customers`);
    } catch (err) {
      console.error('[CRON] Payment reminders failed:', err);
    }
  });

  // ── Cash submission reminder — daily at 20:00 for staff ──────────────────
  cron.schedule('0 20 * * *', async () => {
    console.log('[CRON] Checking cash submissions…');
    try {
      const [staffWithCash] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT t.collected_by AS staff_id
         FROM transactions t
         WHERE t.mode = 'cash'
           AND t.status = 'pending'
           AND DATE(t.created_at) = CURDATE()
           AND t.collected_by IS NOT NULL`
      );
      for (const row of staffWithCash as RowDataPacket[]) {
        notify(() =>
          NotifService.sendToUser({
            userId: row.staff_id,
            title:  '💰 Submit Today\'s Cash',
            body:   'You have uncollected cash from today\'s deliveries. Please submit to admin.',
            type:   'payment',
          })
        );
      }
    } catch (err) {
      console.error('[CRON] Cash reminder failed:', err);
    }
  });

  console.log('✅ Cron jobs started');
};
