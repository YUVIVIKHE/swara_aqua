import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  port:             Number(process.env.DB_PORT) || 3306,
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME     || 'swara_aqua',
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0,
  multipleStatements: false,
});

// Quick connectivity check — non-fatal
pool.getConnection()
  .then(conn => {
    console.log(`✅ MySQL connected → ${process.env.DB_NAME || 'swara_aqua'}`);
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('   Check .env DB credentials and that the database exists.');
  });

export default pool;
