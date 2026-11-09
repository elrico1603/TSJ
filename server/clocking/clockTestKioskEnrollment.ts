/**
 * Privileged, one-time TEST kiosk enrollment.
 *
 * Call ONLY from a local operator using Firebase Admin credentials with access
 * to the dedicated 'tsj-clock-registry' database. This function is NOT an HTTP
 * route and cannot be invoked from the existing TimberSmith user login.
 *
 * Registered device records are protected by the dedicated database's deny-all
 * client rules. Never store or log the issued Firebase custom token.
 */
import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';

export type ClockTestKioskEnrollment = Readonly<{
  deviceId: string;
  namespace: string;
  employeeId: string;
}>;

const VALID_ID=/^[A-Za-z0-9_-]{8,128}$/;
const TEST_NAMESPACE=/^timbersmith-clock-test-[a-z0-9-]{3,40}$/;

export function validateClockTestEnrollment(value:unknown): ClockTestKioskEnrollment {
  if (!value || typeof value!=='object') throw new Error('Clock enrollment details missing.');
  const p=value as Record<string,unknown>;
  if (typeof p.deviceId!=='string' || !VALID_ID.test(p.deviceId) ||
      typeof p.employeeId!=='string' || !VALID_ID.test(p.employeeId) ||
      typeof p.namespace!=='string' || !TEST_NAMESPACE.test(p.namespace)) {
    throw new Error('Test kiosk requires a valid device ID, fictional employee and test namespace.');
  }
  return {deviceId:p.deviceId,employeeId:p.employeeId,namespace:p.namespace};
}

export async function issueClockTestKioskEnrollment(
  dataDb:Firestore,
  protectedRegistryDb:Firestore,
  tokenIssuer:Pick<Auth,'createCustomToken'>,
  rawInput:unknown
):Promise<{deviceId:string;customToken:string}> {
  const input=validateClockTestEnrollment(rawInput);
  // Only allow existing fictional test employees in isolated namespace.
  const employee=await dataDb.collection('artifacts').doc(input.namespace)
    .collection('public').doc('data').collection('employees')
    .doc(input.employeeId).get();
  if (!employee.exists || employee.data()?.isArchived===true ||
      employee.data()?.status==='Archived') {
    throw new Error('A non-archived fictional test employee must exist before enrollment.');
  }

  const uid='tsj-clock-test-'+randomUUID();
  const registrationRef=protectedRegistryDb.collection('clocking_kiosk_devices')
    .doc(input.deviceId);

  // These signed custom claims bind the device, namespace AND single allowed
  // employee. A browser cannot change its permissions by editing request JSON.
  const customToken=await tokenIssuer.createCustomToken(uid,{
    clocking_kiosk:true,
    clocking_device_id:input.deviceId,
    clocking_namespace:input.namespace,
    clocking_employee_ids:[input.employeeId]
  });
  // create() refuses overwrite: a re-enrollment must be a deliberate
  // administrator action rather than silently taking over a device.
  await registrationRef.create({
    firebaseUid:uid,
    approved:true,
    revoked:false,
    enabledNamespace:input.namespace,
    permittedEmployeeIds:[input.employeeId],
    createdAt:FieldValue.serverTimestamp(),
    enrollmentType:'clocking-test-only'
  });
  return {deviceId:input.deviceId,customToken};
}
