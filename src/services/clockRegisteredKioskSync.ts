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

/** Read-only, authenticated status check against the protected server registry. */
export async function verifyProtectedTestKioskWithServer(
  registeredDeviceId:string,
  getToken:()=>Promise<string> = ()=>getRegisteredClockKioskIdToken(registeredDeviceId),
  request:typeof fetch = fetch
):Promise<{deviceId:string;namespace:string;permittedEmployeeCount:number}> {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(registeredDeviceId)) {
    throw new Error('Invalid registered kiosk device ID.');
  }
  const token=await getToken();
  if (!token || typeof token!=='string') {
    throw new Error('Kiosk identity is not enrolled or has expired.');
  }
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);
  try {
    const response=await request('/api/clocking/test-device-status',{
      method:'GET',
      credentials:'omit',
      cache:'no-store',
      headers:{
        'Authorization':'Bearer '+token,
        'X-Clock-Device-ID':registeredDeviceId
      },
      signal:controller.signal
    });
    if (!response.ok) {
      if (response.status===401 || response.status===403) {
        throw new Error('Protected server refused this kiosk registration.');
      }
      throw new Error('Protected kiosk registry is unavailable or the local test API is disabled.');
    }
    const raw:unknown=await response.json();
    if (!raw || typeof raw!=='object') throw new Error('Invalid server kiosk status response.');
    const info=raw as Record<string,unknown>;
    if (info.registered!==true || info.deviceId!==registeredDeviceId ||
        typeof info.namespace!=='string' ||
        !/^timbersmith-clock-test-[a-z0-9-]{3,40}$/.test(info.namespace) ||
        !Number.isInteger(info.permittedEmployeeCount) ||
        Number(info.permittedEmployeeCount)<1) {
      throw new Error('Server did not confirm this specific enrolled test kiosk.');
    }
    return {
      deviceId:registeredDeviceId,
      namespace:info.namespace,
      permittedEmployeeCount:Number(info.permittedEmployeeCount)
    };
  } catch(error) {
    if(controller.signal.aborted) throw new Error('Protected kiosk registry check timed out.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
