/**
 * Emergency revocation for a registered FICTIONAL test Clocking device.
 * Server-only; NEVER callable from an unauthenticated browser.
 */
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';

const DEVICE=/^[A-Za-z0-9_-]{8,128}$/;
export async function revokeClockTestKiosk(
  registry:Firestore,
  identityProvider:Pick<Auth,'updateUser'|'revokeRefreshTokens'>,
  deviceId:string
):Promise<'revoked'|'already_revoked'> {
  if (!DEVICE.test(deviceId)) throw new Error('Invalid kiosk ID.');
  const ref=registry.collection('clocking_kiosk_devices').doc(deviceId);
  const snap=await ref.get();
  if (!snap.exists) throw new Error('Test kiosk is not registered.');
  const registration=snap.data();
  const uid=registration?.firebaseUid;
  if (typeof uid!=='string' || !uid.startsWith('tsj-clock-test-') ||
      !/^timbersmith-clock-test-[a-z0-9-]{3,40}$/.test(registration?.enabledNamespace||'')) {
    throw new Error('Refusing to revoke a non-test identity.');
  }
  if (registration?.revoked===true) return 'already_revoked';
  // Deny backend requests immediately even if Auth operations are delayed.
  await ref.update({revoked:true,approved:false,revokedAt:FieldValue.serverTimestamp()});
  // The Firebase Auth user is test-specific; prevent fresh custom-token login
  // and invalidate any existing refreshable sessions.
  await identityProvider.updateUser(uid,{disabled:true});
  await identityProvider.revokeRefreshTokens(uid);
  return 'revoked';
}
