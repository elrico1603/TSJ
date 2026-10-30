import type {ClockSyncTransport} from './clockSync';
import {createAuthenticatedClockTestTransport} from './clockTestApiTransport';
import {getRegisteredClockKioskIdToken} from './clockKioskAuth';
import {probeProtectedTestKiosk} from './clockKioskServerStatus';

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

/** Read-only backend check using the separate, enrolled Firebase identity. */
export async function verifyProtectedTestKioskWithServer(
  registeredDeviceId:string
):Promise<{deviceId:string;namespace:string;permittedEmployeeCount:number}> {
  return probeProtectedTestKiosk(
    registeredDeviceId,
    ()=>getRegisteredClockKioskIdToken(registeredDeviceId)
  );
}
