import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

/**
 * Server-Side Firebase Admin Initialization
 * TimberSmith Hub — Phase 4B Backend Infrastructure
 * 
 * Privileged Server-Only Context:
 * - Uses Application Default Credentials (ADC) on Google Cloud Run.
 * - Explicitly configures project ID 'timbersmithapp'.
 * - Safe singleton initialization prevents duplicate app registration.
 * - Does not use or require downloaded service-account JSON keys.
 * - Never imported or exposed to browser / frontend clients.
 */

const FIREBASE_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '';
// Fail closed on this dedicated staging branch; never load production ADC.
if (FIREBASE_PROJECT_ID !== 'timbersmith-staging') {
  throw new Error('STAGING BACKEND SAFETY: configure a distinct Firebase test project before starting.');
}

let adminApp: App | null = null;

export function getFirebaseAdminApp(): App {
  if (adminApp) {
    return adminApp;
  }

  const existingApps = getApps();
  const defaultApp = existingApps.find(app => app.name === '[DEFAULT]');
  if (defaultApp) {
    if(defaultApp.options.projectId !== FIREBASE_PROJECT_ID)
      throw new Error('STAGING BACKEND SAFETY: default Firebase admin app references the wrong project.');
    adminApp = defaultApp;
    return adminApp;
  }

  try {
    adminApp = initializeApp({
      projectId: FIREBASE_PROJECT_ID
    });
    return adminApp;
  } catch (err: any) {
    console.error('[FirebaseAdmin] Initialization failure:', err.message);
    throw err;
  }
}

/**
 * Retrieves server-side Firestore instance
 */
export function getServerFirestore(): Firestore {
  const app = getFirebaseAdminApp();
  return getFirestore(app);
}
