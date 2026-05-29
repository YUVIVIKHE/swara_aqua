import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  getFirebaseStatus,
  saveServiceAccountJson,
  initFirebase,
} from '../config/firebase-init';

// GET /api/admin/firebase/status
export const getStatus = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(getFirebaseStatus());
};

// POST /api/admin/firebase/upload  — body = full service account JSON object
export const uploadCredentials = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const json = req.body;
    if (!json?.private_key || !json?.client_email) {
      res.status(400).json({
        message: 'Invalid Firebase JSON. Paste the full file from Firebase Console → Service accounts → Generate new private key.',
      });
      return;
    }

    const ok = await saveServiceAccountJson(json);
    if (!ok) {
      res.status(500).json({
        message:
          'JSON received but Firebase failed to start. In hPanel restart the Node.js app, then Admin → Profile → Reload Firebase. Check server logs for [Firebase] errors.',
        ...getFirebaseStatus(),
      });
      return;
    }

    res.json({
      message: 'Firebase configured successfully. Push notifications are now enabled.',
      ...getFirebaseStatus(),
    });
  } catch (err) {
    console.error('uploadCredentials error:', err);
    res.status(500).json({ message: (err as Error).message });
  }
};

// POST /api/admin/firebase/reload — retry init after manual file upload via FTP
export const reloadCredentials = async (_req: AuthRequest, res: Response): Promise<void> => {
  const ok = await initFirebase(true);
  res.json({
    message: ok ? 'Firebase reloaded' : 'Still not configured — upload credentials first',
    ...getFirebaseStatus(),
  });
};
