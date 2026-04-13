import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export type OrderType   = 'instant' | 'preorder' | 'monthly' | 'bulk';
export type OrderStatus = 'pending' | 'assigned' | 'delivered' | 'completed' | 'cancelled';

export interface Order {
  id: number;
  customer_id: number;
  staff_id: number | null;
  type: OrderType;
  quantity: number;
  price_per_jar: number;
  total_amount: number;
  status: OrderStatus;
  delivery_date: Date | null;
  notes: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: Date;
  updated_at: Date;
  customer_name?: string;
  customer_phone?: string;
  staff_name?: string;
}

export interface Delivery {
  id: number;
  order_id: number;
  staff_id: number;
  delivered_quantity: number;
  collected_amount: number;
  payment_mode: 'cash' | 'online' | 'advance';
  status: 'pending' | 'delivered';
  notes: string | null;
  delivered_at: Date | null;
  created_at: Date;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const orderQuery = (where: string) => `
  SELECT
    o.*,
    c.name  AS customer_name,
    c.phone AS customer_phone,
    s.name  AS staff_name
  FROM orders o
  JOIN  users c ON c.id = o.customer_id
  LEFT JOIN users s ON s.id = o.staff_id
  ${where}
  ORDER BY o.created_at DESC
`;

// ── CRUD ──────────────────────────────────────────────────────────────────────

export const createOrder = async (
  customerId: number,
  data: {
    type: OrderType;
    quantity: number;
    pricePerJar: number;
    deliveryDate?: string;
    notes?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  }
): Promise<number> => {
  const total = data.quantity * data.pricePerJar;
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO orders
       (customer_id, type, quantity, price_per_jar, total_amount,
        delivery_date, notes, address, latitude, longitude)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customerId, data.type, data.quantity, data.pricePerJar, total,
      data.deliveryDate || null,
      data.notes        || null,
      data.address      || null,
      data.latitude     ?? null,
      data.longitude    ?? null,
    ]
  );
  await addTimeline(result.insertId, 'pending', 'Order placed', customerId);
  return result.insertId;
};

export const getOrdersByCustomer = async (customerId: number): Promise<Order[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    orderQuery('WHERE o.customer_id = ?'),
    [customerId]
  );
  return rows as Order[];
};

export const getOrdersByStaff = async (staffId: number): Promise<Order[]> => {
  // Active orders: all assigned/pending (any staff can deliver)
  // Completed orders: only this staff's own (for history tab)
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      o.*,
      c.name  AS customer_name,
      c.phone AS customer_phone,
      s.name  AS staff_name
    FROM orders o
    JOIN  users c ON c.id = o.customer_id
    LEFT JOIN users s ON s.id = o.staff_id
    WHERE (
      -- Active orders visible to all staff
      o.status IN ('assigned', 'pending')
      OR
      -- Completed/cancelled only for this staff's own orders
      (o.status IN ('completed', 'delivered', 'cancelled') AND o.staff_id = ?)
    )
    ORDER BY
      (o.staff_id = ?) DESC,
      FIELD(o.status,'assigned','pending','completed','delivered','cancelled') ASC,
      o.created_at DESC
  `, [staffId, staffId]);
  return rows as Order[];
};


export const getAllOrders = async (filters: {
  status?: string;
  date?: string;
  month?: string;
  search?: string;
} = {}): Promise<Order[]> => {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];

  if (filters.status) {
    conditions.push('o.status = ?');
    params.push(filters.status);
  }
  if (filters.date) {
    conditions.push('DATE(o.created_at) = ?');
    params.push(filters.date);
  } else if (filters.month) {
    conditions.push("DATE_FORMAT(o.created_at, '%Y-%m') = ?");
    params.push(filters.month);
  }
  if (filters.search) {
    conditions.push('(c.name LIKE ? OR c.phone LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    orderQuery(`WHERE ${conditions.join(' AND ')}`),
    params
  );
  return rows as Order[];
};

export const getOrderById = async (id: number): Promise<Order | null> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    orderQuery('WHERE o.id = ?'),
    [id]
  );
  return rows.length ? (rows[0] as Order) : null;
};

export const assignOrder = async (orderId: number, staffId: number): Promise<void> => {
  await pool.query(
    `UPDATE orders SET staff_id = ?, status = 'assigned', updated_at = NOW() WHERE id = ?`,
    [staffId, orderId]
  );
};

export const updateOrderStatus = async (
  orderId: number,
  status: OrderStatus,
  actorId: number
): Promise<void> => {
  await pool.query(
    'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
    [status, orderId]
  );
  await addTimeline(orderId, status, `Status changed to ${status}`, actorId);
};

export const cancelOrder = async (orderId: number, actorId: number): Promise<void> => {
  await pool.query(
    `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
    [orderId]
  );
  await addTimeline(orderId, 'cancelled', 'Order cancelled', actorId);
};

// ── Deliveries ────────────────────────────────────────────────────────────────

export const createDelivery = async (data: {
  orderId: number;
  staffId: number;
  deliveredQuantity: number;
  collectedAmount: number;
  paymentMode: 'cash' | 'online' | 'advance';
  notes?: string;
}): Promise<number> => {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO deliveries
       (order_id, staff_id, delivered_quantity, collected_amount,
        payment_mode, status, notes, delivered_at)
     VALUES (?, ?, ?, ?, ?, 'delivered', ?, NOW())`,
    [
      data.orderId, data.staffId,
      data.deliveredQuantity, data.collectedAmount,
      data.paymentMode,
      data.notes || null,
    ]
  );
  return result.insertId;
};

export const getDeliveryByOrder = async (orderId: number): Promise<Delivery | null> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM deliveries WHERE order_id = ?',
    [orderId]
  );
  return rows.length ? (rows[0] as Delivery) : null;
};

export const getDeliveriesByStaff = async (staffId: number): Promise<Delivery[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM deliveries WHERE staff_id = ? ORDER BY created_at DESC',
    [staffId]
  );
  return rows as Delivery[];
};

// ── Timeline ──────────────────────────────────────────────────────────────────

export const getOrderTimeline = async (orderId: number): Promise<RowDataPacket[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT t.*, u.name AS actor_name
     FROM order_timeline t
     LEFT JOIN users u ON u.id = t.created_by
     WHERE t.order_id = ?
     ORDER BY t.created_at ASC`,
    [orderId]
  );
  return rows;
};

export const addTimeline = async (
  orderId: number,
  status: string,
  note: string,
  createdBy?: number
): Promise<void> => {
  await pool.query(
    'INSERT INTO order_timeline (order_id, status, note, created_by) VALUES (?, ?, ?, ?)',
    [orderId, status, note, createdBy ?? null]
  );
};

// ── Stats ─────────────────────────────────────────────────────────────────────

export const getOrderStats = async (): Promise<RowDataPacket> => {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      COUNT(*)                                                          AS total,
      SUM(status = 'pending')                                           AS pending,
      SUM(status = 'assigned')                                          AS assigned,
      SUM(status = 'completed')                                         AS completed,
      SUM(status = 'cancelled')                                         AS cancelled,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount END), 0) AS total_revenue
    FROM orders
  `);
  return rows[0];
};
