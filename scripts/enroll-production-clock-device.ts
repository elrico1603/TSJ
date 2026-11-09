/** Administrator-only provisioning. Dry run by default. Never run --issue through chat tools. */
import { randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp, getServerFirestore } from '../server/firebaseAdmin';
import { getClockKioskRegistryFirestore } from '../server/clocking/clockKioskRegistry';
import { createClockCredential, existingClockPin, PRODUCTION_DEVICES } from '../server/clocking/productionClockSecurity';
import { PRODUCTION_CLOCK_NAMESPACE } from '../src/services/productionClockContract';

function arg(name: string) { return process.argv.find(a => a.startsWith('--'+name+'='))?.slice(name.length+3) || ''; }
async function main() {
  const deviceId = arg('device'), ids = arg('employees').split(',').filter(Boolean);
  const valid = /^[A-Za-z0-9_-]{1,128}$/;
  if (!valid.test(deviceId) || deviceId.length < 8 || ids.length < 1 || ids.length > 100 ||
      new Set(ids).size !== ids.length || ids.some(id => !valid.test(id))) throw new Error('Provide device and 1–100 unique employee IDs.');
  const renew=process.argv.includes('--renew');
  if (!process.argv.includes('--issue') && !renew) {
    console.log('DRY RUN: valid production kiosk input. No database access, writes or token issuance.'); return;
  }
  if (process.env.K_SERVICE || process.env.NETLIFY || process.env.NODE_ENV === 'production' ||
      process.env.TSJ_CLOCK_PRODUCTION_SECURITY_CONFIRMED !== 'REVIEWED_RULES_IAM_BACKUP') throw new Error('Local operator security confirmation required.');
  const registry = getClockKioskRegistryFirestore(), db = getServerFirestore();
  const ref = registry.collection(PRODUCTION_DEVICES).doc(deviceId);
  const previous=await ref.get();
  if (previous.exists && !renew) throw new Error('Device already exists. Use the explicit renewal procedure.');
  if (renew && (!previous.exists || previous.data()?.approved!==true || previous.data()?.revoked!==false ||
      JSON.stringify([...previous.data()!.permittedEmployeeIds].sort())!==JSON.stringify([...ids].sort()))) {
    throw new Error('Renewal requires the same approved device and employee allowlist.');
  }
  const credentials = [];
  for (const id of ids) {
    const snap = await db.collection('artifacts').doc(PRODUCTION_CLOCK_NAMESPACE).collection('public').doc('data').collection('employees').doc(id).get();
    const data = snap.data();
    if (!snap.exists || data?.isArchived === true || !['In','Out'].includes(data?.status)) throw new Error('Provision only existing active employees outside a break.');
    credentials.push(createClockCredential(deviceId,id,existingClockPin(data!)));
  }
  const firebaseUid = renew ? previous.data()!.firebaseUid : 'tsj-clock-production-' + randomUUID();
  const token = renew ? null : await getAuth(getFirebaseAdminApp()).createCustomToken(firebaseUid,
    {clocking_production:true,clocking_device_id:deviceId});
  const batch = registry.batch();
  if (!renew) batch.create(ref,{deviceId,firebaseUid,approved:true,revoked:false,namespace:PRODUCTION_CLOCK_NAMESPACE,
    permittedEmployeeIds:ids,createdAt:new Date().toISOString()});
  // Renewal uses an update-time lease so concurrent revocation or provisioning cannot be overwritten.
  else batch.update(ref,{renewedAt:new Date().toISOString()},{lastUpdateTime:previous.updateTime!});
  for (const c of credentials) {
    batch.set(ref.collection('credentials').doc(c.envelope.employeeId),c);
    batch.create(ref.collection('credentialHistory').doc(c.envelope.id),c);
  }
  await batch.commit();
  if (token) {
    console.log('Registered. Enter this secret token only on the approved tablet. Never share or paste into chat.');
    process.stdout.write(token+'\n');
  } else console.log('Credentials renewed. Old credential history is preserved for original-ID replay. Refresh the enrolled tablet online.');
}
main().catch(() => {console.error('Production provisioning failed; verify input, security confirmation and Admin access locally.');process.exitCode=1;});
