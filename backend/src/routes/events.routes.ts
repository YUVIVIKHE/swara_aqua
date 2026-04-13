import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { addClient, removeClient } from '../services/sse.service';

const router = Router();

/**
 * GET /api/events?token=<JWT>
 *
 * SSE endpoint. EventSource doesn't support Authorization headers,
 * so we pass the JWT as a query parameter.
 */
router.get('/', (req: Request, res: Response): void => {
  const token = req.query.token as string;

  if (!token) {
    res.status(401).json({ message: 'Token required' });
    return;
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
  } catch {
    res.status(401).json({ message: 'Invalid token' });
    return;
  }

  const userId = decoded.id as number;
  const role = decoded.role as string;

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',       // Tells nginx not to buffer (critical for SSE)
  });

  // Send initial connection confirmation
  res.write(`event: connected\ndata: ${JSON.stringify({ userId, role })}\n\n`);

  // Register this client
  addClient(userId, role, res);

  // Clean up on disconnect
  req.on('close', () => {
    removeClient(res);
  });
});

export default router;
