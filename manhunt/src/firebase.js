import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  onAuthStateChanged,
  signInAnonymously,
} from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Values come from .env (see .env.example). EXPO_PUBLIC_* vars are inlined at build time.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app, auth, db;
if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  // Long polling is the most reliable transport on React Native.
  db = initializeFirestore(app, { experimentalForceLongPolling: true });
}

export { auth, db };

// Every phone gets an anonymous Firebase account — no sign-up needed to play.
export function watchUser(callback) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, (user) => {
    if (user) callback(user);
    else signInAnonymously(auth).catch((e) => callback(null, e));
  });
}
