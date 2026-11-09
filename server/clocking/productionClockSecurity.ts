import { createCipheriv, createHmac, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '../firebaseAdmin';
import { clockSigningText, credentialBinding, CLOCK_LEASE_MS, CLOCK_PIN_ITERATIONS,
  PRODUCTION_CLOCK_NAMESPACE, type ClockCredentialEnvelope, type ProductionClockEvent } from '../../src/services/productionClockContract';
import { KioskAuthorizationError } from './clockKioskIdentity';

export const PRODUCTION_DEVICES = 'production_clocking_devices';
export type ProductionDevice = {
  firebaseUid: string; deviceId: string; approved: boolean; revoked: boolean;
  namespace: string; permittedEmployeeIds: string[];
};
export type StoredClockCredential = {
  envelope: ClockCredentialEnvelope; signingKey: string; pinBinding: string;
};
const ID = /^[A-Za-z0-9_-]{1,128}$/;
export function existingClockPin(employee: Record<string, unknown>): string {
  const pin = String(employee.personalCode || employee.pin || employee.clockPin || '');
  if (!/^\d{4}$/.test(pin)) throw new Error('Employee requires a valid existing four-digit Clocking PIN.');
  return pin;
}
export function pinBinding(key: string, pin: string): string {
  return createHmac('sha256', Buffer.from(key, 'base64')).update('clock-pin-v1:' + pin).digest('base64');
}
export function createClockCredential(deviceId: string, employeeId: string, pin: string,
  now = new Date()): StoredClockCredential {
  if (!ID.test(deviceId) || !ID.test(employeeId) || !/^\d{4}$/.test(pin)) throw new Error('Invalid provisioning input.');
  const key = randomBytes(32), salt = randomBytes(16), iv = randomBytes(12);
  const envelope: ClockCredentialEnvelope = {
    id: randomUUID(), deviceId, employeeId, issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CLOCK_LEASE_MS).toISOString(),
    salt: salt.toString('base64'), iv: iv.toString('base64'), encryptedKey: ''
  };
  const cipher = createCipheriv('aes-256-gcm', pbkdf2Sync(pin, salt, CLOCK_PIN_ITERATIONS, 32, 'sha256'), iv);
  cipher.setAAD(Buffer.from(credentialBinding(envelope)));
  envelope.encryptedKey = Buffer.concat([cipher.update(key), cipher.final(), cipher.getAuthTag()]).toString('base64');
  const signingKey = key.toString('base64');
  return { envelope, signingKey, pinBinding: pinBinding(signingKey, pin) };
}
export async function verifyProductionDevice(token: string, deviceId: string, registry: Firestore,
  auth: Pick<Auth, 'verifyIdToken'> = getAuth(getFirebaseAdminApp())): Promise<ProductionDevice> {
  if (!token || token.length > 8192 || !ID.test(deviceId)) throw new KioskAuthorizationError();
  let verified;
  try { verified = await auth.verifyIdToken(token, true); } catch { throw new KioskAuthorizationError(); }
  if (verified.clocking_production !== true || verified.clocking_device_id !== deviceId ||
      verified.firebase?.sign_in_provider !== 'custom') throw new KioskAuthorizationError();
  const snap = await registry.collection(PRODUCTION_DEVICES).doc(deviceId).get();
  const device = snap.data() as ProductionDevice | undefined;
  if (!snap.exists || !device || device.approved !== true || device.revoked !== false ||
      device.firebaseUid !== verified.uid || device.deviceId !== deviceId ||
      device.namespace !== PRODUCTION_CLOCK_NAMESPACE || !Array.isArray(device.permittedEmployeeIds) ||
      device.permittedEmployeeIds.length < 1 || device.permittedEmployeeIds.length > 100 ||
      device.permittedEmployeeIds.some(id => typeof id !== 'string' || !ID.test(id))) throw new KioskAuthorizationError();
  return device;
}
export function validateProductionEvent(raw: unknown, device: ProductionDevice): ProductionClockEvent {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid event.');
  const e = raw as ProductionClockEvent;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (typeof e.id !== 'string' || !uuid.test(e.id) || typeof e.credentialId !== 'string' || !uuid.test(e.credentialId) ||
      typeof e.employeeId !== 'string' || !ID.test(e.employeeId) || e.deviceId !== device.deviceId ||
      !device.permittedEmployeeIds.includes(e.employeeId) || !['In', 'Out', 'Break', 'Return'].includes(e.action) ||
      (e.action === 'Break'
        ? typeof e.reason !== 'string' || !e.reason || e.reason.length > 200 || e.reason !== e.reason.trim()
        : e.reason !== undefined) ||
      typeof e.occurredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.occurredAt) ||
      !Number.isFinite(Date.parse(e.occurredAt)) || new Date(e.occurredAt).toISOString() !== e.occurredAt ||
      typeof e.signature !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(e.signature)) throw new Error('Invalid clocking event fields.');
  if (!Number.isSafeInteger(e.expectedRevision) || e.expectedRevision < 0) throw new Error('Invalid clocking revision.');
  return {id:e.id,employeeId:e.employeeId,deviceId:e.deviceId,credentialId:e.credentialId,
    action:e.action,...(e.reason ? {reason:e.reason} : {}),occurredAt:e.occurredAt,expectedRevision:e.expectedRevision,signature:e.signature};
}
export function verifyClockSignature(event: ProductionClockEvent, credential: StoredClockCredential): boolean {
  if (credential.envelope.id !== event.credentialId || credential.envelope.employeeId !== event.employeeId ||
      credential.envelope.deviceId !== event.deviceId) return false;
  const expected = createHmac('sha256', Buffer.from(credential.signingKey, 'base64')).update(clockSigningText(event)).digest();
  const actual = Buffer.from(event.signature, 'base64');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
