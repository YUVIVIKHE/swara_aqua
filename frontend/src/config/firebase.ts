import { initializeApp, getApps } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY             || 'AIzaSyBuM5DkMqfW-STRiEyi3OCIVWk8E3aHz7g',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN         || 'waterdelivery-a2126.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID          || 'waterdelivery-a2126',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET      || 'waterdelivery-a2126.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '86432708341',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID              || '1:86432708341:web:d89c23e595ca4df023b7bc',
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID      || 'G-DPGK2X7N59',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const analytics = getAnalytics(app);

export const getFirebaseMessaging = async () => {
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
};

export default app;
