import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as Addr from '../models/address.model';

// GET /api/addresses
export const getAddresses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const addresses = await Addr.getAddresses(req.user!.id);
    res.json({ addresses });
  } catch (err) {
    console.error('getAddresses error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/addresses
export const addAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { label, address, latitude, longitude, isDefault } = req.body;
    if (!address || !address.trim()) {
      res.status(400).json({ message: 'address is required' }); return;
    }
    const id = await Addr.addAddress(req.user!.id, {
      label: label || 'Home',
      address: address.trim(),
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      isDefault: !!isDefault,
    });
    res.status(201).json({ message: 'Address saved', id });
  } catch (err) {
    console.error('addAddress error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// PATCH /api/addresses/:id
export const updateAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { label, address, latitude, longitude } = req.body;
    await Addr.updateAddress(Number(req.params.id), req.user!.id, { label, address, latitude, longitude });
    res.json({ message: 'Address updated' });
  } catch (err) {
    console.error('updateAddress error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// PATCH /api/addresses/:id/default
export const setDefault = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Addr.setDefault(Number(req.params.id), req.user!.id);
    res.json({ message: 'Default address updated' });
  } catch (err) {
    console.error('setDefault error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/addresses/:id
export const deleteAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Addr.deleteAddress(Number(req.params.id), req.user!.id);
    res.json({ message: 'Address deleted' });
  } catch (err) {
    console.error('deleteAddress error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
