/** Leaves credentials and receipts intact for supervised recovery. Dry run by default. */
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp } from '../server/firebaseAdmin';
import { getClockKioskRegistryFirestore } from '../server/clocking/clockKioskRegistry';
import { PRODUCTION_DEVICES } from '../server/clocking/productionClockSecurity';
async function main() {
  const device = process.argv.find(a => a.startsWith('--device='))?.slice(9) || '';
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(device)) throw new Error('Device ID required.');
  if (!process.argv.includes('--revoke')) {console.log('DRY RUN: no writes, sessions or credentials changed.');return;}
  if (process.env.K_SERVICE || process.env.NETLIFY || process.env.TSJ_CLOCK_PRODUCTION_SECURITY_CONFIRMED !== 'REVIEWED_RULES_IAM_BACKUP') throw new Error('Local operator confirmation required.');
  const ref = getClockKioskRegistryFirestore().collection(PRODUCTION_DEVICES).doc(device);
  const snap = await ref.get();
  if (!snap.exists || !String(snap.data()?.firebaseUid).startsWith('tsj-clock-production-')) throw new Error('Unknown production device.');
  // Registry denies access first, even if the subsequent Auth operation fails.
  await ref.update({approved:false,revoked:true,revokedAt:new Date().toISOString()});
  const auth = getAuth(getFirebaseAdminApp()), uid = snap.data()!.firebaseUid;
  await auth.updateUser(uid,{disabled:true});
  await auth.revokeRefreshTokens(uid);
  console.log('Revoked. Preserve original journal and receipts for supervised recovery.');
}
main().catch(() => {console.error('Revocation incomplete; inspect registry and dedicated Auth user locally.');process.exitCode=1;});
