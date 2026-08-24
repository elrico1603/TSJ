import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

const env = typeof import.meta !== 'undefined' ? (import.meta as unknown as { env?: Record<string, string> }).env || {} : {};

export const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyA4J1TVcpqNBvBoq242vXWwguAAnh3G6ks",
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "timbersmithapp.firebaseapp.com",
    projectId: env.VITE_FIREBASE_PROJECT_ID || "timbersmithapp",
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "timbersmithapp.firebasestorage.app",
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1056525791334",
    appId: env.VITE_FIREBASE_APP_ID || "1:1056525791334:web:0f4a86071477439775f0f3"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();

export const APP_ID_PATH = 'timbersmith-terminal-v1';
export const APP_MOBILE_LINK = 'https://elrico1603.github.io/TSJApp/';
