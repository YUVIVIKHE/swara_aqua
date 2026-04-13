import { Response } from 'express';

interface SSEClient {
  userId: number;
  role: string;
  res: Response;
}

// All connected SSE clients
const clients: SSEClient[] = [];

// Heartbeat interval (30s)
const HEARTBEAT_MS = 30_000;

// Start heartbeat to keep connections alive through nginx/proxies
setInterval(() => {
  for (const client of clients) {
    try {
      client.res.write(': heartbeat\n\n');
    } catch {
      removeClient(client.res);
    }
  }
}, HEARTBEAT_MS);

/**
 * Register a new SSE client connection.
 */
export const addClient = (userId: number, role: string, res: Response): void => {
  clients.push({ userId, role, res });
  console.log(`[SSE] Client connected: ${role}#${userId} (total: ${clients.length})`);
};

/**
 * Remove a disconnected client.
 */
export const removeClient = (res: Response): void => {
  const idx = clients.findIndex(c => c.res === res);
  if (idx !== -1) {
    const removed = clients.splice(idx, 1)[0];
    console.log(`[SSE] Client disconnected: ${removed.role}#${removed.userId} (total: ${clients.length})`);
  }
};

/**
 * Send an SSE event to all clients with a specific role.
 */
export const broadcastToRole = (role: string, event: string, data: unknown): void => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  let sent = 0;
  for (const client of clients) {
    if (client.role === role) {
      try {
        client.res.write(payload);
        sent++;
      } catch {
        removeClient(client.res);
      }
    }
  }
  if (sent > 0) console.log(`[SSE] Broadcast "${event}" to ${sent} ${role}(s)`);
};

/**
 * Send an SSE event to a specific user by ID.
 */
export const sendToUser = (userId: number, event: string, data: unknown): void => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    if (client.userId === userId) {
      try {
        client.res.write(payload);
      } catch {
        removeClient(client.res);
      }
    }
  }
};

/**
 * Send an SSE event to multiple roles at once.
 */
export const broadcastToRoles = (roles: string[], event: string, data: unknown): void => {
  for (const role of roles) {
    broadcastToRole(role, event, data);
  }
};

/**
 * Get current connection count (for health checks).
 */
export const getClientCount = (): number => clients.length;
