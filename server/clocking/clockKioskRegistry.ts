/**
 * Isolated registry for approved Clocking kiosk identities.
 *
 * SECURITY: Do not store clocking_kiosk_devices in the default Firestore
 * database while its legacy security rules allow browser writes.
 *
 * This named database must be CREATED separately and deployed with deny-all
 * client rules before any kiosk enrollment is enabled.
 *
 * Firebase Admin SDK bypasses security rules; browsers never read this DB.
 * A missing database MUST cause an error, never a fallback to (default).
 */
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '../firebaseAdmin';

export const CLOCK_KIOSK_REGISTRY_DATABASE = 'tsj-clock-registry';

export function getClockKioskRegistryFirestore(): Firestore {
  return getFirestore(getFirebaseAdminApp(), CLOCK_KIOSK_REGISTRY_DATABASE);
}
