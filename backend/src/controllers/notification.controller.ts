import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as NotifService from '../services/notification.service';

// POST /api/notifications/register-token
export const registerToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token, platform } = req.body;
    if (!token) { res.status(400).json({ message: 'Token required' }); return; }

    await NotifService.saveToken(req.user!.id, token, platform || 'web');
    res.json({ message: 'Token registered' });
  } catch (err) {
    console.error('registerToken error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/notifications/token
export const unregisterToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    if (!token) { res.status(400).json({ message: 'Token required' }); return; }

    await NotifService.removeToken(token);
    res.json({ message: 'Token removed' });
  } catch (err) {
    console.error('unregisterToken error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/notifications/send  (admin only)
export const sendNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, title, body, type, data } = req.body;
    if (!userId || !title || !body) {
      res.status(400).json({ message: 'userId, title and body are required' });
      return;
    }

    await NotifService.sendToUser({ userId, title, body, type: type || 'general', data });
    res.json({ message: 'Notification sent' });
  } catch (err) {
    console.error('sendNotification error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/notifications/broadcast  (admin only)
export const broadcastNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, title, body, type, data } = req.body;
    if (!role || !title || !body) {
      res.status(400).json({ message: 'role, title and body are required' });
      return;
    }

    await NotifService.sendToRole(role, title, body, type || 'general', data);
    res.json({ message: `Broadcast sent to role: ${role}` });
  } catch (err) {
    console.error('broadcastNotification error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/notifications
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifications = await NotifService.getNotifications(req.user!.id);
    const unreadCount   = await NotifService.getUnreadCount(req.user!.id);
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// PATCH /api/notifications/:id/read
export const markRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await NotifService.markAsRead(Number(req.params.id), req.user!.id);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('markRead error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// PATCH /api/notifications/read-all
export const markAllRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await NotifService.markAllAsRead(req.user!.id);
    res.json({ message: 'All marked as read' });
  } catch (err) {
    console.error('markAllRead error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
