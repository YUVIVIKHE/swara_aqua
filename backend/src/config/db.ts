import mysql from 'mysql2/promise';
// dotenv already loaded in index.ts before this import

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               Number(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'swara_aqua',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  connectTimeout:     30000,
  multipleStatements: false,
  // Hostinger uses SSL on shared hosting — disable cert verification
  ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
});

// Quick connectivity check — non-fatal
pool.getConnection()
  .then(conn => {
    console.log(`✅ MySQL connected → ${process.env.DB_NAME}`);
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('   Check .env DB credentials and that the database exists.');
  });

export default pool;
