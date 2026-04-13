import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize only once
if (!admin.apps.length) {
  try {
    const serviceAccount = {
      projectId:    process.env.FIREBASE_PROJECT_ID,
      clientEmail:  process.env.FIREBASE_CLIENT_EMAIL,
      // Replace escaped newlines from env var
      privateKey:   process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });

    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('⚠️ Firebase Admin failed to initialize:', (error as Error).message);
  }
}

export default admin;
