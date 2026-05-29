import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import os from 'os';

// dotenv already loaded in index.ts before this import

const candidateJsonPaths = (): string[] => {
  const fromEnv =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  const backendRoot = path.join(__dirname, '..', '..');
  const cwd = process.cwd();
  const home = os.homedir();

  const paths: string[] = [];

  if (fromEnv) {
    paths.push(path.isAbsolute(fromEnv) ? fromEnv : path.join(backendRoot, fromEnv));
    paths.push(path.isAbsolute(fromEnv) ? fromEnv : path.join(cwd, fromEnv));
  }

  paths.push(
    path.join(backendRoot, 'config', 'firebase-service-account.json'),
    path.join(cwd, 'config', 'firebase-service-account.json'),
    path.join(cwd, 'firebase-service-account.json'),
    path.join(home, 'firebase-service-account.json'),
    path.join(home, 'config', 'firebase-service-account.json'),
  );

  return [...new Set(paths)];
};

const resolveServiceAccountPath = (): string | null => {
  for (const p of candidateJsonPaths()) {
    if (fs.existsSync(p)) return p;
  }
  return null;
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

  if (
    !privateKey ||
    privateKey.includes('YOUR_') ||
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL
  ) {
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
    let creds = jsonPath ? loadFromJsonFile(jsonPath) : null;

    if (!creds) {
      creds = loadFromEnv();
    }

    if (!creds) {
      const tried = candidateJsonPaths().slice(0, 4).join('\n   ');
      console.warn(
        '⚠️ Firebase not configured — push notifications disabled.\n' +
        '   Upload firebase-service-account.json to:\n' +
        `   ${path.join(__dirname, '..', '..', 'config', 'firebase-service-account.json')}\n` +
        '   Or add FIREBASE_PRIVATE_KEY to backend/.env via File Manager.\n' +
        `   Checked:\n   ${tried}`
      );
    } else {
      admin.initializeApp({ credential: admin.credential.cert(creds) });
      console.log(
        '✅ Firebase Admin initialized',
        jsonPath ? `(from ${jsonPath})` : '(from env vars)'
      );
    }
  } catch (error) {
    console.error('⚠️ Firebase Admin failed to initialize:', (error as Error).message);
  }
}

export default admin;
