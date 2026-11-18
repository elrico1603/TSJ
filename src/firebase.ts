import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

const env = typeof import.meta !== 'undefined' ? (import.meta as unknown as { env?: Record<string, string> }).env || {} : {};

// This staging branch must never use the live TS Hub Firebase project.
const STAGING_ONLY = true;
if (STAGING_ONLY) {
  const required=['VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID',
    'VITE_FIREBASE_MESSAGING_SENDER_ID','VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_TSJ_MANAGED_USER_API_BASE_URL'];
  const missing=required.filter(k=>!env[k]?.trim());
  if (missing.length || env.VITE_FIREBASE_PROJECT_ID!=='timbersmith-staging' ||
      /timbersmithapp/i.test(env.VITE_FIREBASE_AUTH_DOMAIN || '') ||
      /timbersmithapp/i.test(env.VITE_FIREBASE_STORAGE_BUCKET || '') ||
      !/^https:\/\//.test(env.VITE_TSJ_MANAGED_USER_API_BASE_URL || '') ||
      /tsjoinery\.co\.za|timbersmith-terminal/i.test(env.VITE_TSJ_MANAGED_USER_API_BASE_URL || '')) {
    throw new Error('STAGING SAFETY: isolated Firebase project and separate HTTPS test API are required. No production connection was opened.');
  }
}

export const firebaseConfig = {
    apiKey: "AIzaSyAuUMb1blX8fwUkHMgu5WYagm37kDMhO5Q",
    authDomain: "timbersmith-staging.firebaseapp.com",
    projectId: "timbersmith-staging",
    storageBucket: "timbersmith-staging.firebasestorage.app",
    messagingSenderId: "351455828495",
    appId: "1:351455828495:web:0fd1d0a7846feb7a92a17a"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();

// Configure Firestore WebChannel transport to use long-polling in browser environments
// This eliminates WebChannelConnection RPC 'Listen' transport errors behind buffering proxies
if (typeof window !== 'undefined') {
    try {
        db.settings({
            experimentalForceLongPolling: true,
            experimentalAutoDetectLongPolling: false,
            merge: true
        });
    } catch (e) {
        console.warn('[FIRESTORE CONFIG] Settings initialization notice:', e);
    }
}

export const APP_ID_PATH = 'timbersmith-terminal-v1';
export const PRODUCTION_TS_HUB_URL = 'https://timbersmith-terminal.netlify.app/';
export const APP_MOBILE_LINK = (env.VITE_PRODUCTION_APP_URL as string) || PRODUCTION_TS_HUB_URL;
