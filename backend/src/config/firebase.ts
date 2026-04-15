import admin from 'firebase-admin';
// dotenv already loaded in index.ts before this import

// Initialize only once
if (!admin.apps.length) {
  try {
    const rawKey = process.env.FIREBASE_PRIVATE_KEY || '';
    // Handle both escaped \\n (from .env file) and real newlines (from hPanel env vars)
    const privateKey = rawKey.includes('\\n')
      ? rawKey.replace(/\\n/g, '\n')
      : rawKey;

    if (!privateKey || !process.env.FIREBASE_PROJECT_ID) {
      console.warn('⚠️ Firebase env vars missing — push notifications disabled');
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId:   process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        } as admin.ServiceAccount),
      });
      console.log('✅ Firebase Admin initialized');
    }
  } catch (error) {
    // Non-fatal — app still works without push notifications
    console.error('⚠️ Firebase Admin failed to initialize:', (error as Error).message);
  }
}

export default admin;
