/**
 * Firebase Realtime Database & Anonymous Authentication Configuration
 * Initializes Firebase if credentials exist in .env or localStorage.
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, User } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';

export interface FirebaseConfigParams {
  apiKey?: string;
  authDomain?: string;
  databaseURL?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export function getStoredFirebaseConfig(): FirebaseConfigParams {
  const envConfig: FirebaseConfigParams = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  const stored = localStorage.getItem('escola_firebase_config');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return { ...envConfig, ...parsed };
    } catch (e) {
      // ignore
    }
  }

  return envConfig;
}

export function isFirebaseConfigured(): boolean {
  const config = getStoredFirebaseConfig();
  return Boolean(
    config.apiKey &&
    config.databaseURL &&
    config.projectId &&
    !config.apiKey.includes('seu-api-key')
  );
}

let app: FirebaseApp | null = null;
let db: Database | null = null;

export async function initFirebaseService(): Promise<{ db: Database | null; user: User | null }> {
  if (!isFirebaseConfigured()) {
    return { db: null, user: null };
  }

  try {
    const config = getStoredFirebaseConfig();
    if (!getApps().length) {
      app = initializeApp(config as any);
    } else {
      app = getApps()[0];
    }

    const auth = getAuth(app);
    let user = auth.currentUser;
    if (!user) {
      const cred = await signInAnonymously(auth);
      user = cred.user;
    }

    db = getDatabase(app);
    return { db, user };
  } catch (err) {
    console.warn('Firebase init notice:', err);
    return { db: null, user: null };
  }
}
