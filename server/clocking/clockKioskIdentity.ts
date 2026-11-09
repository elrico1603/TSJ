/**
 * Server-side kiosk identity boundary.
 *
 * AppUser sessions are client-side and MUST NOT authorize payroll writes.
 * Existing Firebase anonymous sessions MUST NOT authorize payroll writes.
 *
 * The future kiosk enrollment flow will issue Firebase custom claims and
 * register a dedicated kiosk UID in a server-managed Firestore collection.
 * Never copy the four-digit employee PIN or user account password here.
 */
import { getAuth } from 'firebase-admin/auth';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '../firebaseAdmin';
import type { VerifiedKioskContext } from './clockEventValidation';

export class KioskAuthorizationError extends Error {
  constructor(message='Clocking kiosk is not authorized.') {
    super(message);
    this.name='KioskAuthorizationError';
  }
}

export type ClockKioskRegistration = {
  firebaseUid: string;
  approved: boolean;
  revoked?: boolean;
  enabledNamespace: string;
  permittedEmployeeIds: string[];
};

const SAFE_DEVICE_ID=/^[a-zA-Z0-9_-]{8,128}$/;
const SAFE_TEST_NAMESPACE=/^timbersmith-clock-test-[a-z0-9-]{3,40}$/;

/**
 * The identity token and deviceId must be obtained from the authenticated
 * request's Authorization header and an enrolled device channel respectively.
 * Neither the employee PIN nor submitted event fields authenticate a kiosk.
 *
 * Injection of verifier enables offline unit tests; callers MUST NOT provide
 * an attacker-controlled verifier or identity object.
 */
export async function verifyRegisteredClockKiosk(
  idToken: string,
  claimedDeviceId: string,
  firestore: Firestore,
  firebaseAuth: Pick<Auth,'verifyIdToken'> = getAuth(getFirebaseAdminApp())
): Promise<VerifiedKioskContext> {
  if (typeof idToken!=='string' || !idToken || idToken.length>8192 ||
      typeof claimedDeviceId!=='string' || !SAFE_DEVICE_ID.test(claimedDeviceId)) {
    throw new KioskAuthorizationError();
  }
  let verified: DecodedIdToken;
  try {
    verified=await firebaseAuth.verifyIdToken(idToken,true);
  } catch {
    throw new KioskAuthorizationError();
  }
  if (!verified.uid || verified.clocking_kiosk !== true ||
      verified.clocking_device_id !== claimedDeviceId ||
      typeof verified.clocking_namespace !== 'string' ||
      !SAFE_TEST_NAMESPACE.test(verified.clocking_namespace) ||
      !Array.isArray(verified.clocking_employee_ids) ||
      verified.clocking_employee_ids.length === 0 ||
      verified.firebase?.sign_in_provider !== 'custom') {
    throw new KioskAuthorizationError();
  }

  // Registration documents are server-controlled and must never be writable
  // via an anonymous or direct browser Firestore request.
  const regSnap=await firestore.collection('clocking_kiosk_devices')
    .doc(claimedDeviceId).get();
  const registration=regSnap.data() as ClockKioskRegistration|undefined;
  if (!regSnap.exists || !registration ||
      registration.approved!==true || registration.revoked===true ||
      registration.firebaseUid!==verified.uid ||
      !SAFE_TEST_NAMESPACE.test(registration.enabledNamespace) ||
      registration.enabledNamespace!==verified.clocking_namespace ||
      !Array.isArray(registration.permittedEmployeeIds) ||
      registration.permittedEmployeeIds.length===0 ||
      registration.permittedEmployeeIds.some(
        id=>typeof id!=='string'||!SAFE_DEVICE_ID.test(id)
      ) ||
      verified.clocking_employee_ids.length!==registration.permittedEmployeeIds.length ||
      !registration.permittedEmployeeIds.every(
        id=>verified.clocking_employee_ids.includes(id)
      )) {
    throw new KioskAuthorizationError();
  }
  return {
    firebaseUid:verified.uid,
    deviceId:claimedDeviceId,
    namespace:registration.enabledNamespace,
    permittedEmployeeIds:registration.permittedEmployeeIds
  };
}
