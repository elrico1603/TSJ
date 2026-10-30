import type {ClockSyncTransport} from './clockSync';
import {createAuthenticatedClockTestTransport} from './clockTestApiTransport';
import {getRegisteredClockKioskIdToken} from './clockKioskAuth';

/**
 * Future end-to-end protected test transport.
 * The same existing indexedDB sync worker can use this after a kiosk has been
 * explicitly enrolled. Never silently fall back to anonymous Firebase Auth or
 * to direct Firestore writes if the separate kiosk session is missing.
 *
 * This is not attached to the production terminal.
 */
export function createEnrolledKioskClockTestTransport(
  registeredDeviceId:string
):ClockSyncTransport {
  return createAuthenticatedClockTestTransport(
    ()=>getRegisteredClockKioskIdToken(registeredDeviceId),
    registeredDeviceId
  );
}
