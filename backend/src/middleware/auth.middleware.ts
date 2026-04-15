import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '../models/user.model';

export interface AuthRequest extends Request {
  user?: { id: number; role: Role };
}

interface JwtPayload {
  id: number;
  role: Role;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  // Accept token from Authorization header OR ?token= query param (for PDF downloads)
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;

  const raw = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : queryToken;

  if (!raw) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(raw, process.env.JWT_SECRET as string) as JwtPayload;
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const allowRole = (role: Role) => (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== role) {
    res.status(403).json({ message: 'Access denied' });
    return;
  }
  next();
};

export const allowAdmin = [authenticate, allowRole('admin')];
export const allowStaff = [authenticate, allowRole('staff')];
export const allowCustomer = [authenticate, allowRole('customer')];
