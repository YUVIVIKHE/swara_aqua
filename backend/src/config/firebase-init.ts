import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const getCredentialsPath = (): string =>
  path.join(__dirname, '..', '..', 'config', 'firebase-service-account.json');

export const candidateJsonPaths = (): string[] => {
  const fromEnv =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  const backendRoot = path.join(__dirname, '..', '..');
  const cwd = process.cwd();
  const home = os.homedir();

  const paths: string[] = [getCredentialsPath()];

  if (fromEnv) {
    paths.push(path.isAbsolute(fromEnv) ? fromEnv : path.join(backendRoot, fromEnv));
    paths.push(path.isAbsolute(fromEnv) ? fromEnv : path.join(cwd, fromEnv));
  }

  paths.push(
    path.join(cwd, 'config', 'firebase-service-account.json'),
    path.join(cwd, 'firebase-service-account.json'),
    path.join(home, 'firebase-service-account.json'),
  );

  return [...new Set(paths)];
};

const loadFromJsonFile = (filePath: string): admin.ServiceAccount | null => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(raw) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!json.private_key || !json.client_email) return null;
    return {
      projectId: json.project_id || process.env.FIREBASE_PROJECT_ID,
      clientEmail: json.client_email,
      privateKey: json.private_key,
    };
  } catch {
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

let initialized = false;
let source: 'json' | 'env' | null = null;
let loadedPath: string | null = null;

export const isFirebaseReady = (): boolean => initialized && admin.apps.length > 0;

export const getFirebaseStatus = () => ({
  ready: isFirebaseReady(),
  source,
  path: loadedPath,
  credentialsPath: getCredentialsPath(),
  checkedPaths: candidateJsonPaths(),
});

const applyCredentials = (creds: admin.ServiceAccount, jsonPath: string | null): boolean => {
  try {
    if (admin.apps.length === 0) {
      admin.initializeApp({ credential: admin.credential.cert(creds) });
    }
    initialized = true;
    source = jsonPath ? 'json' : 'env';
    loadedPath = jsonPath;
    return true;
  } catch (err) {
    console.error('[Firebase] initializeApp failed:', (err as Error).message);
    return false;
  }
};

const resolveCredentials = (): { creds: admin.ServiceAccount; jsonPath: string | null } | null => {
  const jsonPath = candidateJsonPaths().find(p => fs.existsSync(p)) || null;
  let creds = jsonPath ? loadFromJsonFile(jsonPath) : null;
  if (!creds) creds = loadFromEnv();
  if (!creds) return null;
  return { creds, jsonPath };
};

/** First boot — sync */
const bootInit = (): boolean => {
  if (isFirebaseReady()) return true;
  const resolved = resolveCredentials();
  if (!resolved) return false;
  return applyCredentials(resolved.creds, resolved.jsonPath);
};

export const initFirebase = async (force = false): Promise<boolean> => {
  if (isFirebaseReady() && !force) return true;

  if (force && admin.apps.length) {
    await Promise.all(
      admin.apps
        .filter((app): app is admin.app.App => app != null)
        .map(app => app.delete())
    );
    initialized = false;
    source = null;
    loadedPath = null;
  }

  const resolved = resolveCredentials();
  if (!resolved) return false;
  return applyCredentials(resolved.creds, resolved.jsonPath);
};

export const saveServiceAccountJson = async (json: Record<string, unknown>): Promise<boolean> => {
  const target = getCredentialsPath();
  const cwdTarget = path.join(process.cwd(), 'config', 'firebase-service-account.json');

  for (const filePath of [target, cwdTarget]) {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(json, null, 2), { encoding: 'utf8', mode: 0o600 });
      console.log(`[Firebase] Credentials saved to ${filePath}`);
    } catch (err) {
      console.warn(`[Firebase] Could not write ${filePath}:`, (err as Error).message);
    }
  }

  if (!fs.existsSync(target) && !fs.existsSync(cwdTarget)) {
    console.error('[Firebase] Credentials file was not written — check folder permissions');
    return false;
  }

  const ok = await initFirebase(true);
  if (ok) {
    console.log('✅ Firebase Admin initialized after upload', loadedPath || cwdTarget);
  }
  return ok;
};

if (!bootInit()) {
  console.warn(
    '⚠️ Firebase not configured — push notifications disabled.\n' +
    '   Fix: Admin app → Profile → Push Notifications → upload Firebase JSON file.\n' +
    `   Or upload to: ${getCredentialsPath()}`
  );
} else {
  console.log(
    '✅ Firebase Admin initialized',
    loadedPath ? `(from ${loadedPath})` : '(from env vars)'
  );
}

export default admin;
