import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// dotenv already loaded in index.ts before this import

const resolveServiceAccountPath = (): string | null => {
  const fromEnv =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const backendRoot = path.join(__dirname, '..', '..');

  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.join(backendRoot, fromEnv);
  }

  const defaultPath = path.join(backendRoot, 'config', 'firebase-service-account.json');
  return fs.existsSync(defaultPath) ? defaultPath : null;
};

const loadFromJsonFile = (filePath: string): admin.ServiceAccount | null => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(raw) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!json.private_key || !json.client_email) {
      console.warn('[Firebase] JSON file missing private_key or client_email');
      return null;
    }
    return {
      projectId: json.project_id || process.env.FIREBASE_PROJECT_ID,
      clientEmail: json.client_email,
      privateKey: json.private_key,
    };
  } catch (err) {
    console.warn('[Firebase] Failed to read service account file:', (err as Error).message);
    return null;
  }
};

const loadFromEnv = (): admin.ServiceAccount | null => {
  const rawKey = process.env.FIREBASE_PRIVATE_KEY || '';
  const privateKey = rawKey.includes('\\n')
    ? rawKey.replace(/\\n/g, '\n')
    : rawKey;

  if (!privateKey || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
    return null;
  }

  return {
    projectId:   process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  };
};

// Initialize only once
if (!admin.apps.length) {
  try {
    const jsonPath = resolveServiceAccountPath();
    const creds = jsonPath ? loadFromJsonFile(jsonPath) : loadFromEnv();

    if (!creds) {
      console.warn(
        '⚠️ Firebase not configured — push notifications disabled.\n' +
        '   Hostinger: upload firebase-service-account.json to backend/config/ and set\n' +
        '   FIREBASE_SERVICE_ACCOUNT_PATH=config/firebase-service-account.json (under 255 chars).\n' +
        '   Or paste the full key in backend/.env via File Manager (not hPanel env UI).'
      );
    } else {
      admin.initializeApp({ credential: admin.credential.cert(creds) });
      console.log(
        '✅ Firebase Admin initialized',
        jsonPath ? `(from ${path.basename(jsonPath)})` : '(from env vars)'
      );
    }
  } catch (error) {
    console.error('⚠️ Firebase Admin failed to initialize:', (error as Error).message);
  }
}

export default admin;
