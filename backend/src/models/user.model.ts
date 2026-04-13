import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export type Role = 'admin' | 'staff' | 'customer';
export type Status = 'active' | 'pending' | 'rejected';

export interface User {
  id: number;
  name: string;
  phone: string;
  password: string;
  role: Role;
  status: Status;
  jar_rate: number;
  created_at: Date;
}

export const findByPhone = async (phone: string): Promise<User | null> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM users WHERE phone = ?',
    [phone]
  );
  return rows.length ? (rows[0] as User) : null;
};

export const findById = async (id: number): Promise<User | null> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM users WHERE id = ?',
    [id]
  );
  return rows.length ? (rows[0] as User) : null;
};

export const createUser = async (
  name: string,
  phone: string,
  hashedPassword: string
): Promise<number> => {
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO users (name, phone, password, role, status) VALUES (?, ?, ?, 'customer', 'pending')",
    [name, phone, hashedPassword]
  );
  return result.insertId;
};

export const getAllUsers = async (): Promise<Omit<User, 'password'>[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, name, phone, role, status, jar_rate, created_at FROM users'
  );
  return rows as Omit<User, 'password'>[];
};

export const updateUserStatus = async (id: number, status: Status): Promise<void> => {
  await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
};

export const updateJarRate = async (id: number, jarRate: number): Promise<void> => {
  await pool.query('UPDATE users SET jar_rate = ? WHERE id = ?', [jarRate, id]);
};

export const updatePassword = async (id: number, hashedPassword: string): Promise<void> => {
  await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
};

export const updateName = async (id: number, name: string): Promise<void> => {
  await pool.query('UPDATE users SET name = ? WHERE id = ?', [name, id]);
};

