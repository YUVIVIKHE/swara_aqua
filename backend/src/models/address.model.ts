import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface UserAddress {
  id: number;
  user_id: number;
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  created_at: string;
}

export const getAddresses = async (userId: number): Promise<UserAddress[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
    [userId]
  );
  return rows as UserAddress[];
};

export const getDefaultAddress = async (userId: number): Promise<UserAddress | null> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM user_addresses WHERE user_id = ? AND is_default = 1 LIMIT 1',
    [userId]
  );
  if (rows.length) return rows[0] as UserAddress;
  // Fallback: return the most recent address
  const [fallback] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM user_addresses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  return fallback.length ? (fallback[0] as UserAddress) : null;
};

export const addAddress = async (
  userId: number,
  data: { label: string; address: string; latitude?: number; longitude?: number; isDefault?: boolean }
): Promise<number> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // If this is default, unset other defaults
    if (data.isDefault) {
      await conn.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    }

    // If this is the first address, make it default
    const [existing] = await conn.query<RowDataPacket[]>(
      'SELECT COUNT(*) as cnt FROM user_addresses WHERE user_id = ?', [userId]
    );
    const isFirst = (existing[0] as any).cnt === 0;

    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO user_addresses (user_id, label, address, latitude, longitude, is_default)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, data.label || 'Home', data.address, data.latitude || null, data.longitude || null, data.isDefault || isFirst ? 1 : 0]
    );

    await conn.commit();
    return result.insertId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

export const updateAddress = async (
  addressId: number,
  userId: number,
  data: { label?: string; address?: string; latitude?: number; longitude?: number }
): Promise<void> => {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.label !== undefined) { sets.push('label = ?'); params.push(data.label); }
  if (data.address !== undefined) { sets.push('address = ?'); params.push(data.address); }
  if (data.latitude !== undefined) { sets.push('latitude = ?'); params.push(data.latitude); }
  if (data.longitude !== undefined) { sets.push('longitude = ?'); params.push(data.longitude); }

  if (sets.length === 0) return;

  params.push(addressId, userId);
  await pool.query(`UPDATE user_addresses SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);
};

export const setDefault = async (addressId: number, userId: number): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    await conn.query('UPDATE user_addresses SET is_default = 1 WHERE id = ? AND user_id = ?', [addressId, userId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

export const deleteAddress = async (addressId: number, userId: number): Promise<void> => {
  await pool.query('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [addressId, userId]);
};
