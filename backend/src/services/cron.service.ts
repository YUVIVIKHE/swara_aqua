import cron from 'node-cron';
import { generateMonthlyBills } from '../models/billing.model';
import { previousMonthKey } from '../utils/date';
import * as NotifService from './notification.service';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';

const notify = (fn: () => Promise<void>) =>
  fn().catch(err => console.warn('Cron FCM (non-fatal):', err?.message));

export const startCronJobs = () => {
  // ── Startup cleanup: cancel orphaned orders from cancelled/expired subscriptions
  pool.query(`
    UPDATE orders o
    JOIN subscriptions s ON s.id = o.subscription_id
    SET o.status = 'cancelled'
    WHERE s.status IN ('cancelled', 'expired')
      AND o.status IN ('pending', 'assigned')
  `).then(([r]: any) => {
    if (r.affectedRows > 0) console.log(`[STARTUP] Cancelled ${r.affectedRows} orphaned subscription orders`);
  }).catch(err => console.warn('[STARTUP] Orphan cleanup failed:', err?.message));

  // ── Auto-generate bills on 1st of every month at 00:05 ───────────────────
  cron.schedule('5 0 1 * *', async () => {
    const month = previousMonthKey();
    console.log(`[CRON] Generating bills for ${month} (previous month)…`);
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

  // ── Subscription: auto-generate daily orders at 05:30 AM ────────────────
  cron.schedule('30 5 * * *', async () => {
    console.log('[CRON] Generating subscription orders…');
    try {
      const SubModel = await import('../models/subscription.model');
      const subs = await SubModel.getActiveSubscriptionsForToday();

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      let created = 0;

      for (const sub of subs) {
        const count = await SubModel.generateOrdersForSubscription(sub.id, todayStr);
        created += count;

        // Notify staff about their new subscription deliveries
        if (count > 0) {
          const totalJars = (sub.slots || []).reduce((s: number, sl: any) => s + sl.quantity, 0);
          const [assignedOrders] = await pool.query<RowDataPacket[]>(
            `SELECT DISTINCT staff_id FROM orders WHERE subscription_id = ? AND DATE(delivery_date) = ? AND staff_id IS NOT NULL`,
            [sub.id, todayStr]
          );
          for (const row of assignedOrders) {
            notify(() =>
              NotifService.sendToUser({
                userId: row.staff_id,
                title:  `📦 Daily Plan — ${totalJars} jar${totalJars > 1 ? 's' : ''} for ${sub.customer_name || 'customer'}`,
                body:   `${count} delivery slot${count > 1 ? 's' : ''} scheduled today from monthly plan.`,
                type:   'delivery',
                data:   {},
              })
            );
          }
        }
      }
      console.log(`[CRON] Subscription orders: ${created} created for ${subs.length} active subscriptions`);
    } catch (err) {
      console.error('[CRON] Subscription order generation failed:', err);
    }
  });

  // ── Subscription: renewal reminders on 28th at 10:00 AM ─────────────────
  cron.schedule('0 10 28 * *', async () => {
    console.log('[CRON] Sending subscription renewal reminders…');
    try {
      const SubModel = await import('../models/subscription.model');
      const expiring = await SubModel.getExpiringSubscriptions(5);
      for (const sub of expiring) {
        notify(() =>
          NotifService.sendToUser({
            userId: sub.customer_id,
            title:  '🔄 Subscription Expiring Soon',
            body:   `Your water delivery plan expires on ${new Date(sub.end_date).toLocaleDateString('en-IN')}. Renew now to continue!`,
            type:   'subscription',
          })
        );
      }
      console.log(`[CRON] Sent renewal reminders to ${expiring.length} customers`);
    } catch (err) {
      console.error('[CRON] Renewal reminders failed:', err);
    }
  });

  // ── Subscription: auto-renew / expire on 1st at 00:10 ──────────────────
  cron.schedule('10 0 1 * *', async () => {
    console.log('[CRON] Processing subscription renewals/expirations…');
    try {
      const SubModel = await import('../models/subscription.model');
      const renewed = await SubModel.autoRenewSubscriptions();
      const expired = await SubModel.expireOldSubscriptions();
      console.log(`[CRON] Subscriptions: ${renewed} auto-renewed, ${expired} expired`);
    } catch (err) {
      console.error('[CRON] Subscription renewal/expiry failed:', err);
    }
  });

  console.log('✅ Cron jobs started');
};
