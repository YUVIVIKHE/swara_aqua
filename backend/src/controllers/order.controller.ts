import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as OrderModel from '../models/order.model';
import * as NotifService from '../services/notification.service';
import * as Inv from '../models/inventory.model';
import * as SSE from '../services/sse.service';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2';

const DEFAULT_PRICE = 50;

// Fire-and-forget FCM — never let notification errors crash the request
const notify = (fn: () => Promise<void>) => {
  fn().catch(err => console.warn('FCM notification failed (non-fatal):', err?.message));
};

// ── Customer ──────────────────────────────────────────────────────────────────

export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, quantity, pricePerJar, deliveryDate, notes, address, latitude, longitude } = req.body;

    if (!type || !quantity) {
      res.status(400).json({ message: 'type and quantity are required' });
      return;
    }
    if (!['instant', 'preorder', 'monthly', 'bulk'].includes(type)) {
      res.status(400).json({ message: 'Invalid order type' });
      return;
    }
    if (type === 'preorder' && !deliveryDate) {
      res.status(400).json({ message: 'deliveryDate is required for preorder' });
      return;
    }

    // Use customer's personalized jar rate from DB
    const [userRows] = await pool.query<RowDataPacket[]>(
      'SELECT jar_rate FROM users WHERE id = ?',
      [req.user!.id]
    );
    const customerRate = userRows.length ? Number(userRows[0].jar_rate) : DEFAULT_PRICE;
    const price = Number(pricePerJar) || customerRate;

    const orderId = await OrderModel.createOrder(req.user!.id, {
      type,
      quantity:     Number(quantity),
      pricePerJar:  price,
      deliveryDate: deliveryDate  || undefined,
      notes:        notes         || undefined,
      address:      address       || undefined,
      latitude:     latitude      ? Number(latitude)  : undefined,
      longitude:    longitude     ? Number(longitude) : undefined,
    });

    // ── Auto-assign to all active staff (broadcast model) ─────────────────────
    // Pick staff via round-robin: staff with fewest recent active order assignments
    const [staffRows] = await pool.query<RowDataPacket[]>(`
      SELECT u.id, u.name,
             COUNT(o.id) AS active_order_count
      FROM users u
      LEFT JOIN orders o ON o.staff_id = u.id
                        AND o.status NOT IN ('completed','cancelled')
      WHERE u.role = 'staff' AND u.status = 'active'
      GROUP BY u.id, u.name
      ORDER BY active_order_count ASC, u.id ASC
    `);

    if (staffRows.length > 0) {
      // Assign to the staff member with the least current active orders (round-robin)
      const assignedStaff = staffRows[0] as any;
      await pool.query(
        `UPDATE orders SET staff_id = ?, status = 'assigned', updated_at = NOW() WHERE id = ?`,
        [assignedStaff.id, orderId]
      );
      await OrderModel.addTimeline(
        orderId, 'assigned',
        `Auto-assigned to ${assignedStaff.name}`,
        req.user!.id
      );

      // Notify the specifically assigned staff
      notify(() =>
        NotifService.sendToUser({
          userId: assignedStaff.id,
          title:  'New Delivery Assigned! 📦',
          body:   `Order #${orderId} — ${quantity} jars assigned to you.`,
          type:   'delivery',
          data:   { orderId: String(orderId) },
        })
      );

      // Also notify ALL other active staff so they are aware
      const otherStaffIds = (staffRows as any[])
        .slice(1)
        .map((s: any) => s.id);

      for (const sid of otherStaffIds) {
        notify(() =>
          NotifService.sendToUser({
            userId: sid,
            title:  'New Order Received 🚚',
            body:   `Order #${orderId} — ${quantity} jars. Check deliveries.`,
            type:   'delivery',
            data:   { orderId: String(orderId) },
          })
        );
      }
    } else {
      // No active staff — keep pending, notify admin
      notify(() =>
        NotifService.sendToRole(
          'admin',
          '⚠️ No Staff Available',
          `Order #${orderId} placed but no active staff to assign.`,
          'delivery',
          { orderId: String(orderId) }
        )
      );
    }

    // SSE: notify admin + all staff of new order
    SSE.broadcastToRoles(['admin', 'staff'], 'order_created', { orderId, quantity, customerId: req.user!.id });

    res.status(201).json({ message: 'Order placed successfully', orderId });
  } catch (err) {
    console.error('createOrder error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};


export const getOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, date, month, search } = req.query as Record<string, string>;
    let orders;

    if (req.user!.role === 'customer') {
      orders = await OrderModel.getOrdersByCustomer(req.user!.id);
    } else if (req.user!.role === 'staff') {
      orders = await OrderModel.getOrdersByStaff(req.user!.id);
    } else {
      orders = await OrderModel.getAllOrders({ status, date, month, search });
    }

    res.json({ orders });
  } catch (err) {
    console.error('getOrders error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

export const getOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ message: 'Invalid order id' }); return; }

    const order = await OrderModel.getOrderById(id);
    if (!order) { res.status(404).json({ message: 'Order not found' }); return; }

    if (req.user!.role === 'customer' && order.customer_id !== req.user!.id) {
      res.status(403).json({ message: 'Access denied' }); return;
    }

    const [timeline, delivery] = await Promise.all([
      OrderModel.getOrderTimeline(order.id),
      OrderModel.getDeliveryByOrder(order.id),
    ]);

    res.json({ order, timeline, delivery });
  } catch (err) {
    console.error('getOrderById error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

export const cancelOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await OrderModel.getOrderById(Number(req.params.id));
    if (!order) { res.status(404).json({ message: 'Order not found' }); return; }
    if (order.customer_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ message: 'Access denied' }); return;
    }
    if (!['pending'].includes(order.status)) {
      res.status(400).json({ message: 'Only pending orders can be cancelled' }); return;
    }
    await OrderModel.cancelOrder(order.id, req.user!.id);
    res.json({ message: 'Order cancelled' });
  } catch (err) {
    console.error('cancelOrder error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export const assignOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { staffId } = req.body;
    if (!staffId) { res.status(400).json({ message: 'staffId is required' }); return; }

    const order = await OrderModel.getOrderById(Number(req.params.id));
    if (!order) { res.status(404).json({ message: 'Order not found' }); return; }
    if (['completed', 'cancelled'].includes(order.status)) {
      res.status(400).json({ message: `Cannot assign a ${order.status} order` }); return;
    }

    const [staffRows] = await pool.query<RowDataPacket[]>(
      "SELECT id, name FROM users WHERE id = ? AND role = 'staff'",
      [staffId]
    );
    if (!staffRows.length) { res.status(404).json({ message: 'Staff not found' }); return; }

    await OrderModel.assignOrder(order.id, Number(staffId));
    await OrderModel.addTimeline(
      order.id, 'assigned',
      `Assigned to ${staffRows[0].name}`,
      req.user!.id
    );

    notify(() =>
      NotifService.sendToUser({
        userId: Number(staffId),
        title:  'New Delivery Assigned',
        body:   `Order #${order.id} — ${order.quantity} jars for ${order.customer_name}`,
        type:   'delivery',
        data:   { orderId: String(order.id) },
      })
    );

    // SSE: notify assigned staff + admin
    SSE.sendToUser(staffId, 'order_assigned', { orderId: order.id, quantity: order.quantity });
    SSE.broadcastToRole('admin', 'order_updated', { orderId: order.id, status: 'assigned' });

    res.json({ message: 'Order assigned successfully' });
  } catch (err) {
    console.error('assignOrder error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    const valid = ['pending','assigned','delivered','completed','cancelled'];
    if (!valid.includes(status)) {
      res.status(400).json({ message: 'Invalid status' }); return;
    }

    const order = await OrderModel.getOrderById(Number(req.params.id));
    if (!order) { res.status(404).json({ message: 'Order not found' }); return; }

    if (req.user!.role === 'staff') {
      // Staff can only mark an order as delivered
      if (status !== 'delivered') {
        res.status(403).json({ message: 'Staff can only mark orders as delivered' }); return;
      }
    }

    await OrderModel.updateOrderStatus(order.id, status, req.user!.id);

    // SSE: notify customer + admin of status change
    SSE.sendToUser(order.customer_id, 'order_status_changed', { orderId: order.id, status });
    SSE.broadcastToRole('admin', 'order_updated', { orderId: order.id, status });
    SSE.broadcastToRole('staff', 'order_updated', { orderId: order.id, status });

    res.json({ message: `Order status updated to ${status}` });
  } catch (err) {
    console.error('updateOrderStatus error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

export const getOrderStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await OrderModel.getOrderStats();
    res.json({ stats });
  } catch (err) {
    console.error('getOrderStats error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

export const getStaffList = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, name, phone FROM users WHERE role = 'staff' AND status = 'active'"
    );
    res.json({ staff: rows });
  } catch (err) {
    console.error('getStaffList error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// ── Deliveries ────────────────────────────────────────────────────────────────

export const completeDelivery = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderId, deliveredQuantity, collectedAmount, paymentMode, notes } = req.body;

    if (!orderId || deliveredQuantity == null || collectedAmount == null || !paymentMode) {
      res.status(400).json({ message: 'orderId, deliveredQuantity, collectedAmount and paymentMode are required' });
      return;
    }
    if (!['cash','online','advance'].includes(paymentMode)) {
      res.status(400).json({ message: 'Invalid paymentMode' }); return;
    }

    const order = await OrderModel.getOrderById(Number(orderId));
    if (!order) { res.status(404).json({ message: 'Order not found' }); return; }

    // Any staff can complete any active order (first-come-first-served)
    if (req.user!.role !== 'staff' && req.user!.role !== 'admin') {
      res.status(403).json({ message: 'Access denied' }); return;
    }
    if (['completed', 'cancelled'].includes(order.status)) {
      res.status(400).json({ message: 'Order is already ' + order.status }); return;
    }

    const existing = await OrderModel.getDeliveryByOrder(order.id);
    if (existing) { res.status(409).json({ message: 'Delivery already recorded for this order' }); return; }

    await OrderModel.createDelivery({
      orderId:           order.id,
      staffId:           req.user!.id,
      deliveredQuantity: Number(deliveredQuantity),
      collectedAmount:   Number(collectedAmount),
      paymentMode,
      notes:             notes || undefined,
    });

    await OrderModel.updateOrderStatus(order.id, 'completed', req.user!.id);

    // Update inventory: reduce staff assigned, increase empty_collected
    await Inv.recordDeliveryInventory(req.user!.id, Number(deliveredQuantity), order.id);

    // Record financial transaction
    await Inv.createTransaction({
      customerId:  order.customer_id,
      orderId:     order.id,
      amount:      Number(collectedAmount),
      mode:        paymentMode,
      type:        'credit',
      collectedBy: req.user!.id,
    });

    // Notify customer
    notify(() =>
      NotifService.sendToUser({
        userId: order.customer_id,
        title:  'Order Delivered! 🎉',
        body:   `Your order of ${deliveredQuantity} jars has been delivered. Amount collected: ₹${collectedAmount}.`,
        type:   'order',
        data:   { orderId: String(order.id) },
      })
    );

    // Notify all other staff that this order has been delivered
    notify(() =>
      NotifService.sendToRole(
        'staff',
        'Order Delivered',
        `Order #${order.id} — ${order.quantity} jars for ${order.customer_name} has been delivered.`,
        'delivery',
        { orderId: String(order.id) }
      )
    );

    // SSE: notify customer + admin + staff of completed delivery
    SSE.sendToUser(order.customer_id, 'order_status_changed', { orderId: order.id, status: 'completed' });
    SSE.broadcastToRoles(['admin', 'staff'], 'delivery_completed', { orderId: order.id, staffId: req.user!.id });

    res.status(201).json({ message: 'Delivery completed successfully' });
  } catch (err) {
    console.error('completeDelivery error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

export const getDeliveries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let rows;
    if (req.user!.role === 'staff') {
      rows = await OrderModel.getDeliveriesByStaff(req.user!.id);
    } else {
      const [all] = await pool.query<RowDataPacket[]>(`
        SELECT d.*, o.quantity, o.type,
               c.name AS customer_name,
               s.name AS staff_name
        FROM deliveries d
        JOIN orders o ON o.id = d.order_id
        JOIN users  c ON c.id = o.customer_id
        JOIN users  s ON s.id = d.staff_id
        ORDER BY d.created_at DESC
      `);
      rows = all;
    }
    res.json({ deliveries: rows });
  } catch (err) {
    console.error('getDeliveries error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// ── Calendar ──────────────────────────────────────────────────────────────────

export const getCalendarData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, customerId } = req.query as Record<string, string>;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ message: 'month query param required in YYYY-MM format' });
      return;
    }

    let targetCustomerId: number;

    if (req.user!.role === 'customer') {
      targetCustomerId = req.user!.id;
    } else if (customerId) {
      targetCustomerId = Number(customerId);
    } else {
      res.status(400).json({ message: 'customerId query param required for admin' });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT
        DATE(d.delivered_at)                       AS date,
        SUM(d.delivered_quantity)                   AS jars_delivered,
        COUNT(DISTINCT d.order_id)                 AS orders_count,
        SUM(d.collected_amount)                    AS total_amount
      FROM deliveries d
      JOIN orders o ON o.id = d.order_id
      WHERE o.customer_id = ?
        AND DATE_FORMAT(d.delivered_at, '%Y-%m') = ?
        AND d.status = 'delivered'
      GROUP BY DATE(d.delivered_at)
      ORDER BY date ASC
    `, [targetCustomerId, month]);

    res.json({ days: rows });
  } catch (err) {
    console.error('getCalendarData error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// ── Staff Daily Summary ────────────────────────────────────────────────────────

export const getDailySummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const staffId = req.user!.id;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD in UTC

    // Today's deliveries
    const [deliveryRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        COUNT(*)                          AS deliveries_done,
        COALESCE(SUM(delivered_quantity), 0) AS jars_delivered,
        COALESCE(SUM(collected_amount),  0) AS cash_collected
      FROM deliveries
      WHERE staff_id = ? AND DATE(delivered_at) = ? AND status = 'delivered'
    `, [staffId, today]);

    // Pending orders still assigned to this staff
    const [pendingRows] = await pool.query<RowDataPacket[]>(`
      SELECT COUNT(*) AS pending_orders
      FROM orders
      WHERE staff_id = ? AND status IN ('assigned', 'pending')
    `, [staffId]);

    // Jar inventory
    const [invRows] = await pool.query<RowDataPacket[]>(
      `SELECT assigned_jars, empty_collected FROM staff_inventory WHERE staff_id = ?`,
      [staffId]
    );

    // Cash in hand (uncollected pending cash transactions)
    const [cashRows] = await pool.query<RowDataPacket[]>(`
      SELECT COALESCE(SUM(amount), 0) AS cash_in_hand
      FROM transactions
      WHERE collected_by = ? AND mode = 'cash' AND status = 'pending' AND type = 'credit'
    `, [staffId]);

    res.json({
      today,
      deliveries_done:  Number(deliveryRows[0].deliveries_done),
      jars_delivered:   Number(deliveryRows[0].jars_delivered),
      cash_collected:   Number(deliveryRows[0].cash_collected),
      pending_orders:   Number(pendingRows[0].pending_orders),
      assigned_jars:    Number(invRows[0]?.assigned_jars   ?? 0),
      empty_collected:  Number(invRows[0]?.empty_collected ?? 0),
      cash_in_hand:     Number(cashRows[0]?.cash_in_hand   ?? 0),
    });
  } catch (err) {
    console.error('getDailySummary error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};
