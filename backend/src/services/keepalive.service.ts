/**
 * Keep-alive: pings the server every 4 minutes to prevent
 * Hostinger shared hosting from putting the Node process to sleep.
 */
import http from 'http';

export const startKeepAlive = () => {
  const url = process.env.FRONTEND_URL || 'http://localhost:3000';
  const host = url.replace(/^https?:\/\//, '').split('/')[0];
  const port = Number(process.env.PORT) || 3000;

  setInterval(() => {
    try {
      const req = http.request(
        { hostname: '127.0.0.1', port, path: '/health', method: 'GET', timeout: 5000 },
        (res) => res.resume()
      );
      req.on('error', () => {}); // silent
      req.end();
    } catch {}
  }, 4 * 60 * 1000); // every 4 minutes

  console.log('✅ Keep-alive started (ping every 4 min)');
};
