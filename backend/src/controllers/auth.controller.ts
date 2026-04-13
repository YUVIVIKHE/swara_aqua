import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as UserModel from '../models/user.model';
import { AuthRequest } from '../middleware/auth.middleware';

import { StringValue } from 'ms';

const signToken = (id: number, role: string) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as StringValue,
  });

const signRefreshToken = (id: number, role: string) =>
  jwt.sign({ id, role }, process.env.JWT_REFRESH_SECRET as string, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as StringValue,
  });

export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, phone, password, address } = req.body;

    if (!name || !phone || !password) {
      res.status(400).json({ message: 'All fields are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' });
      return;
    }

    const existing = await UserModel.findByPhone(phone);
    if (existing) {
      res.status(409).json({ message: 'Phone number already registered' });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);
    const userId = await UserModel.createUser(name, phone, hashed);

    // Save address if provided
    if (address && address.trim()) {
      const AddrModel = await import('../models/address.model');
      await AddrModel.addAddress(userId, { label: 'Home', address: address.trim(), isDefault: true });
    }

    res.status(201).json({
      message: 'Registration submitted. Waiting for admin approval.',
      userId,
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      res.status(400).json({ message: 'Phone and password are required' });
      return;
    }

    const user = await UserModel.findByPhone(phone);
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    if (user.status === 'pending') {
      res.status(403).json({ message: 'Your account is pending admin approval' });
      return;
    }

    if (user.status === 'rejected') {
      res.status(403).json({ message: 'Your account has been rejected' });
      return;
    }

    const accessToken = signToken(user.id, user.role);
    const refreshToken = signRefreshToken(user.id, user.role);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        status: user.status,
        jar_rate: user.jar_rate,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await UserModel.findById(req.user!.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json({ user });
  } catch (err) {
    console.error('GetMe error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ message: 'Refresh token required' });
    return;
  }

  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET as string
    ) as { id: number; role: string };

    const accessToken = signToken(decoded.id, decoded.role);
    res.json({ accessToken });
  } catch {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: 'Current and new passwords are required' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ message: 'New password must be at least 6 characters' });
      return;
    }

    const user = await UserModel.findById(req.user!.id);
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      res.status(401).json({ message: 'Current password is incorrect' });
      return;
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await UserModel.updatePassword(req.user!.id, hashed);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('changePassword error:', err);
    res.status(500).json({ message: 'Internal server error', detail: (err as Error).message });
  }
};

// PATCH /auth/profile — update name and/or password
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const userId = req.user!.id;
    const pool = (await import('../config/db')).default;

    // Update name if provided
    if (name && name.trim()) {
      await pool.query('UPDATE users SET name = ? WHERE id = ?', [name.trim(), userId]);
    }

    // Update password if provided
    if (currentPassword && newPassword) {
      if (newPassword.length < 6) {
        res.status(400).json({ message: 'New password must be at least 6 characters' });
        return;
      }
      const [rows] = await pool.query<any[]>('SELECT password FROM users WHERE id = ?', [userId]);
      const user = (rows as any[])[0];
      if (!user) { res.status(404).json({ message: 'User not found' }); return; }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) { res.status(401).json({ message: 'Current password is incorrect' }); return; }
      const hashed = await bcrypt.hash(newPassword, 12);
      await UserModel.updatePassword(userId, hashed);
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
