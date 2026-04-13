-- Run this in phpMyAdmin or MySQL CLI

CREATE DATABASE IF NOT EXISTS swara_aqua CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE swara_aqua;

CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  phone       VARCHAR(20) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('admin', 'staff', 'customer') NOT NULL DEFAULT 'customer',
  status      ENUM('active', 'pending', 'rejected') NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- FCM device tokens
CREATE TABLE IF NOT EXISTS device_tokens (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token      VARCHAR(512) NOT NULL,
  platform   VARCHAR(20) DEFAULT 'web',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_token (token),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notification history
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
);

-- Seed an admin account (password: admin123)
INSERT IGNORE INTO users (name, phone, password, role, status) VALUES (
  'Admin',
  '0000000000',
  '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'admin',
  'active'
);

-- ── Orders ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  customer_id     INT NOT NULL,
  staff_id        INT NULL,
  type            ENUM('instant','preorder','monthly','bulk') NOT NULL DEFAULT 'instant',
  quantity        INT NOT NULL,
  price_per_jar   DECIMAL(10,2) NOT NULL DEFAULT 50.00,
  total_amount    DECIMAL(10,2) NOT NULL,
  status          ENUM('pending','assigned','out_for_delivery','delivered','completed','cancelled') NOT NULL DEFAULT 'pending',
  delivery_date   DATETIME NULL,
  notes           TEXT NULL,
  address         VARCHAR(500) NULL,
  latitude        DECIMAL(10,8) NULL,
  longitude       DECIMAL(11,8) NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id)    REFERENCES users(id) ON DELETE SET NULL
);

-- ── Deliveries ────────────────────────────────────────────────────────────────
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
);

-- ── Order timeline ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_timeline (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  order_id   INT NOT NULL,
  status     VARCHAR(50) NOT NULL,
  note       VARCHAR(255) NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- ── Inventory ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  total_jars     INT NOT NULL DEFAULT 0,
  available_jars INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 20,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed one inventory row
INSERT IGNORE INTO inventory (id, total_jars, available_jars) VALUES (1, 0, 0);

CREATE TABLE IF NOT EXISTS staff_inventory (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  staff_id         INT NOT NULL UNIQUE,
  assigned_jars    INT NOT NULL DEFAULT 0,
  empty_collected  INT NOT NULL DEFAULT 0,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory_logs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  type         ENUM('add','assign','return','delivered','damaged') NOT NULL,
  quantity     INT NOT NULL,
  reference_id INT NULL,
  note         VARCHAR(255) NULL,
  created_by   INT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ── Transactions ──────────────────────────────────────────────────────────────
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
);

-- ── Cash submissions ──────────────────────────────────────────────────────────
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
);

-- ── Billing ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bills (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  customer_id      INT NOT NULL,
  month            CHAR(7) NOT NULL,          -- YYYY-MM
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
);

-- Customer advance balance & jar rate
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS advance_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jar_rate        DECIMAL(10,2) NOT NULL DEFAULT 50.00;
