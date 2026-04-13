/**
 * Auto-migration: runs on every startup.
 * Creates missing tables and columns — safe to run multiple times.
 */
import pool from './db';

export const runMigrations = async (): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    console.log('🔄 Running database migrations…');
    // ── users table ───────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        name        VARCHAR(100) NOT NULL,
        phone       VARCHAR(20) NOT NULL UNIQUE,
        password    VARCHAR(255) NOT NULL,
        role        ENUM('admin', 'staff', 'customer') NOT NULL DEFAULT 'customer',
        status      ENUM('active', 'pending', 'rejected') NOT NULL DEFAULT 'pending',
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // Seed admin account
    await conn.query(`
      INSERT IGNORE INTO users (name, phone, password, role, status) VALUES (
        'Admin', '0000000000', '$2a$12$jffF5LgXrYE/gMeu71HC5umzm9unPD5cl9aoqVWNjSsin920ZiueO', 'admin', 'active'
      )
    `);

    // ── orders table ──────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        customer_id     INT NOT NULL,
        staff_id        INT NULL,
        type            ENUM('instant','preorder','monthly','bulk') NOT NULL DEFAULT 'instant',
        quantity        INT NOT NULL,
        price_per_jar   DECIMAL(10,2) NOT NULL DEFAULT 50.00,
        total_amount    DECIMAL(10,2) NOT NULL,
        status          ENUM('pending','assigned','delivered','completed','cancelled') NOT NULL DEFAULT 'pending',
        delivery_date   DATETIME NULL,
        notes           TEXT NULL,
        address         VARCHAR(500) NULL,
        latitude        DECIMAL(10,8) NULL,
        longitude       DECIMAL(11,8) NULL,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (staff_id)    REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── bills table ───────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS bills (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        customer_id      INT NOT NULL,
        month            CHAR(7) NOT NULL,
        total_jars       INT NOT NULL DEFAULT 0,
        jar_rate         DECIMAL(10,2) NOT NULL DEFAULT 50.00,
        subtotal         DECIMAL(10,2) NOT NULL DEFAULT 0,
        previous_pending DECIMAL(10,2) NOT NULL DEFAULT 0,
        advance_used     DECIMAL(10,2) NOT NULL DEFAULT 0,
        total_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
        paid_amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
        status           ENUM('paid','partial','unpaid') NOT NULL DEFAULT 'unpaid',
        due_date         DATE NOT NULL,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_customer_month (customer_id, month),
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── inventory table ───────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id                  INT AUTO_INCREMENT PRIMARY KEY,
        total_jars          INT NOT NULL DEFAULT 0,
        available_jars      INT NOT NULL DEFAULT 0,
        low_stock_threshold INT NOT NULL DEFAULT 20,
        updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await conn.query(`INSERT IGNORE INTO inventory (id, total_jars, available_jars) VALUES (1, 0, 0)`);

    // ── staff_inventory ───────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS staff_inventory (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        staff_id        INT NOT NULL UNIQUE,
        assigned_jars   INT NOT NULL DEFAULT 0,
        empty_collected INT NOT NULL DEFAULT 0,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── inventory_logs ────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS inventory_logs (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        type         ENUM('add','assign','return','delivered','damaged') NOT NULL,
        quantity     INT NOT NULL,
        reference_id INT NULL,
        note         VARCHAR(255) NULL,
        created_by   INT NULL,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── transactions ──────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        customer_id  INT NOT NULL,
        order_id     INT NULL,
        amount       DECIMAL(10,2) NOT NULL,
        mode         ENUM('cash','online','advance') NOT NULL DEFAULT 'cash',
        type         ENUM('credit','debit') NOT NULL DEFAULT 'credit',
        collected_by INT NULL,
        status       ENUM('pending','completed') NOT NULL DEFAULT 'pending',
        note         VARCHAR(255) NULL,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id)  REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id)     REFERENCES orders(id) ON DELETE SET NULL,
        FOREIGN KEY (collected_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── cash_submissions ──────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS cash_submissions (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        staff_id     INT NOT NULL,
        total_cash   DECIMAL(10,2) NOT NULL,
        note         VARCHAR(255) NULL,
        status       ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
        verified_by  INT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        verified_at  TIMESTAMP NULL,
        FOREIGN KEY (staff_id)    REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── order_timeline ────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS order_timeline (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        order_id   INT NOT NULL,
        status     VARCHAR(50) NOT NULL,
        note       VARCHAR(255) NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── device_tokens ─────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        token      VARCHAR(512) NOT NULL,
        platform   VARCHAR(20) DEFAULT 'web',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_token (token),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── notifications ─────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        title      VARCHAR(255) NOT NULL,
        body       TEXT NOT NULL,
        type       VARCHAR(50) DEFAULT 'general',
        data       JSON,
        is_read    TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── deliveries ────────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id                 INT AUTO_INCREMENT PRIMARY KEY,
        order_id           INT NOT NULL UNIQUE,
        staff_id           INT NOT NULL,
        delivered_quantity INT NOT NULL,
        collected_amount   DECIMAL(10,2) NOT NULL DEFAULT 0,
        payment_mode       ENUM('cash','online','advance') NOT NULL DEFAULT 'cash',
        status             ENUM('pending','delivered') NOT NULL DEFAULT 'pending',
        notes              TEXT NULL,
        delivered_at       TIMESTAMP NULL,
        created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id)  REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (staff_id)  REFERENCES users(id)  ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── Add columns to users if missing (compatible with MySQL 5.7+) ──────────
    const [cols] = await conn.query<any[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
         AND COLUMN_NAME IN ('advance_balance','jar_rate')`
    );
    const existingCols = (cols as any[]).map((c: any) => c.COLUMN_NAME || c.column_name);

    if (!existingCols.includes('advance_balance')) {
      await conn.query(`ALTER TABLE users ADD COLUMN advance_balance DECIMAL(10,2) NOT NULL DEFAULT 0`);
      console.log('  ✅ Added users.advance_balance');
    }
    if (!existingCols.includes('jar_rate')) {
      await conn.query(`ALTER TABLE users ADD COLUMN jar_rate DECIMAL(10,2) NOT NULL DEFAULT 50.00`);
      console.log('  ✅ Added users.jar_rate');
    }

    // ── Remove out_for_delivery status if it exists in the orders ENUM ─────────
    // First update any existing out_for_delivery orders to 'assigned'
    await conn.query(
      `UPDATE orders SET status = 'assigned' WHERE status = 'out_for_delivery'`
    );
    // Then alter the column to remove the old ENUM value
    await conn.query(`
      ALTER TABLE orders MODIFY COLUMN
        status ENUM('pending','assigned','delivered','completed','cancelled') NOT NULL DEFAULT 'pending'
    `).catch(() => { /* already updated */ });
    console.log('  ✅ Removed out_for_delivery from orders status ENUM');

    // ── user_addresses ─────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_addresses (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL,
        label       VARCHAR(50) NOT NULL DEFAULT 'Home',
        address     VARCHAR(500) NOT NULL,
        latitude    DECIMAL(10,8) NULL,
        longitude   DECIMAL(11,8) NULL,
        is_default  TINYINT(1) NOT NULL DEFAULT 0,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── banners ────────────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS banners (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        title      VARCHAR(255) NULL,
        image_url  VARCHAR(500) NOT NULL,
        link_url   VARCHAR(500) NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_active  TINYINT(1) NOT NULL DEFAULT 1,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── wallet_balance column on users ────────────────────────────────────────
    const [walletCols] = await conn.query<any[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
         AND COLUMN_NAME = 'wallet_balance'`
    );
    if (!(walletCols as any[]).length) {
      await conn.query(`ALTER TABLE users ADD COLUMN wallet_balance DECIMAL(10,2) NOT NULL DEFAULT 0`);
      console.log('  ✅ Added users.wallet_balance');
    }

    // ── wallet_transactions ───────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        user_id      INT NOT NULL,
        type         ENUM('credit','debit') NOT NULL,
        amount       DECIMAL(10,2) NOT NULL,
        mode         ENUM('razorpay','cash','wallet','refund') NOT NULL DEFAULT 'razorpay',
        status       ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
        reference_id VARCHAR(255) NULL,
        note         VARCHAR(255) NULL,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log('✅ Migrations complete');  } catch (err) {
    console.error('❌ Migration error:', (err as Error).message);
    // Don't crash the server — log and continue
  } finally {
    conn.release();
  }
};
