import pool from '../config/db';
import bcrypt from 'bcryptjs';

const runSeed = async () => {
  const conn = await pool.getConnection();

  try {
    console.log('🔄 Starting Database Seeding...');

    // Disable foreign key checks to truncate easily
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('🧹 Truncating tables...');

    // Do NOT truncate users since we want to keep the admin
    // Or we will just selectively delete
    await conn.query(`DELETE FROM users WHERE role != 'admin'`);
    await conn.query('TRUNCATE TABLE user_addresses');
    await conn.query('TRUNCATE TABLE inventory_logs');
    await conn.query('TRUNCATE TABLE staff_inventory');
    await conn.query('TRUNCATE TABLE order_timeline');
    await conn.query('TRUNCATE TABLE deliveries');
    await conn.query('TRUNCATE TABLE transactions');
    await conn.query('TRUNCATE TABLE bills');
    await conn.query('TRUNCATE TABLE cash_submissions');
    await conn.query('TRUNCATE TABLE orders');
    // Ensure inventory has at least one row
    await conn.query('TRUNCATE TABLE inventory');

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('🌱 Seeding Users...');
    const hashedPass = await bcrypt.hash('password123', 10);

    // Staff
    const [s1] = await conn.query<any>(`INSERT INTO users (name, phone, password, role, status) VALUES 
      ('Rahul Staff', '9999988881', ?, 'staff', 'active')`, [hashedPass]);
    const [s2] = await conn.query<any>(`INSERT INTO users (name, phone, password, role, status) VALUES 
      ('Amit Staff', '9999988882', ?, 'staff', 'active')`, [hashedPass]);

    // Customers
    const [c1] = await conn.query<any>(`INSERT INTO users (name, phone, password, role, status, jar_rate) VALUES 
      ('Neha Sharma', '9000000001', ?, 'customer', 'active', 45.00)`, [hashedPass]);
    const [c2] = await conn.query<any>(`INSERT INTO users (name, phone, password, role, status) VALUES 
      ('Priya Singh', '9000000002', ?, 'customer', 'active')`, [hashedPass]);
    const [c3] = await conn.query<any>(`INSERT INTO users (name, phone, password, role, status) VALUES 
      ('Vikas Patel', '9000000003', ?, 'customer', 'active')`, [hashedPass]);
    const [c4] = await conn.query<any>(`INSERT INTO users (name, phone, password, role, status, advance_balance) VALUES 
      ('Karan Mehta', '9000000004', ?, 'customer', 'active', 500.00)`, [hashedPass]);

    const staffIds = [s1.insertId, s2.insertId];
    const customerIds = [c1.insertId, c2.insertId, c3.insertId, c4.insertId];

    console.log('🏠 Seeding Addresses...');
    await conn.query(`INSERT INTO user_addresses (user_id, label, address, is_default) VALUES 
      (?, 'Home', 'A-101, Sunshine Apts, MG Road', 1),
      (?, 'Work', 'Tech Park, Block B', 0),
      (?, 'Home', 'B-20, Lotus Complex', 1),
      (?, 'Home', 'C-15, Green Villas', 1),
      (?, 'Home', 'D-12, Blue Ridge', 1)`,
      [c1.insertId, c1.insertId, c2.insertId, c3.insertId, c4.insertId]
    );

    console.log('📦 Seeding Inventory...');
    await conn.query(`INSERT INTO inventory (id, total_jars, available_jars) VALUES (1, 500, 300) ON DUPLICATE KEY UPDATE total_jars=500, available_jars=450`);

    await conn.query(`INSERT INTO staff_inventory (staff_id, assigned_jars, empty_collected) VALUES 
      (?, 30, 5),
      (?, 20, 10)`,
      [s1.insertId, s2.insertId]
    );

    await conn.query(`INSERT INTO inventory_logs (type, quantity, note) VALUES 
      ('add', 500, 'Initial Stock'),
      ('assign', 30, 'Morning Dispatch'),
      ('assign', 20, 'Morning Dispatch')`);

    console.log('🚚 Seeding Orders & Deliveries...');
    const now = new Date();

    // Helper to format date for MySQL
    const formatDt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

    // 1. Pending Order
    await conn.query(`INSERT INTO orders (customer_id, type, quantity, total_amount, status, address, created_at) VALUES 
      (?, 'instant', 2, 90.00, 'pending', 'A-101, Sunshine Apts, MG Road', ?)`,
      [c1.insertId, formatDt(new Date(now.getTime() - 1000 * 60 * 10))] // 10 mins ago
    );

    // 2. Assigned Order
    await conn.query(`INSERT INTO orders (customer_id, staff_id, type, quantity, total_amount, status, address, created_at) VALUES 
      (?, ?, 'instant', 4, 200.00, 'assigned', 'B-20, Lotus Complex', ?)`,
      [c2.insertId, s1.insertId, formatDt(new Date(now.getTime() - 1000 * 60 * 30))] // 30 mins ago
    );

    // 3. Assigned Order (was out-for-delivery, concept removed)
    await conn.query(`INSERT INTO orders (customer_id, staff_id, type, quantity, total_amount, status, address, created_at) VALUES 
      (?, ?, 'instant', 1, 50.00, 'assigned', 'C-15, Green Villas', ?)`,
      [c3.insertId, s2.insertId, formatDt(new Date(now.getTime() - 1000 * 60 * 60))] // 1 hour ago
    );

    // 4. Completed Order
    const [ordComp] = await conn.query<any>(`INSERT INTO orders (customer_id, staff_id, type, quantity, total_amount, status, address, created_at) VALUES 
      (?, ?, 'instant', 5, 250.00, 'completed', 'D-12, Blue Ridge', ?)`,
      [c4.insertId, s1.insertId, formatDt(new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2))] // 2 days ago
    );

    await conn.query(`INSERT INTO deliveries (order_id, staff_id, delivered_quantity, collected_amount, payment_mode, status) VALUES 
      (?, ?, 5, 250.00, 'cash', 'delivered')`,
      [ordComp.insertId, s1.insertId]
    );

    console.log('🧾 Seeding Bills...');
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthRaw = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = `${lastMonthRaw.getFullYear()}-${String(lastMonthRaw.getMonth() + 1).padStart(2, '0')}`;

    await conn.query(`INSERT INTO bills (customer_id, month, total_jars, jar_rate, subtotal, total_amount, paid_amount, status, due_date) VALUES 
      (?, ?, 20, 45.00, 900.00, 900.00, 900.00, 'paid', '2026-03-05'),
      (?, ?, 15, 50.00, 750.00, 750.00, 400.00, 'partial', '2026-03-05'),
      (?, ?, 25, 50.00, 1250.00, 1250.00, 0.00, 'unpaid', '2026-04-05')`,
      [c1.insertId, lastMonth, c2.insertId, lastMonth, c3.insertId, currentMonth]
    );

    console.log('✅ Seeding Complete. Use "password" to log in with ANY newly created user.');

  } catch (err) {
    console.error('❌ Seeding failed:', err);
  } finally {
    conn.release();
    pool.end();
  }
};

runSeed();