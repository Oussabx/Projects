import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, initializeFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
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

export function watchUser(callback) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
}

// Accounts: email + password, plus a public username everyone sees in lobbies.
export async function signUp({ username, email, password }) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(cred.user, { displayName: username.trim() });
  await setDoc(doc(db, 'users', cred.user.uid), {
    username: username.trim(),
    createdAt: serverTimestamp(),
  });
  // onAuthStateChanged fired before the name was set; hand back the updated user.
  await cred.user.reload();
  return auth.currentUser;
}

export async function loadUsername(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data().username : null;
  } catch {
    return null;
  }
}

export function logIn({ email, password }) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email.trim());
}

export function signOut() {
  return fbSignOut(auth);
}

const AUTH_ERRORS = {
  'auth/email-already-in-use': 'An account with that email already exists. Try logging in.',
  'auth/invalid-email': 'That email address looks wrong.',
  'auth/weak-password': 'Use at least 6 characters for your password.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'No account with that email.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed': 'No connection. Check your internet.',
  'auth/operation-not-allowed': 'Email sign-in is not enabled in Firebase (Authentication → Sign-in method).',
};

export function authErrorMessage(e) {
  return AUTH_ERRORS[e?.code] || e?.message || 'Something went wrong.';
}
