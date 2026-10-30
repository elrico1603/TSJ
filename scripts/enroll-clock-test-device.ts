/**
 * MANUAL ADMINISTRATOR-ONLY TEST DEVICE ENROLLMENT.
 *
 * Usage (AFTER the dedicated registry DB has deny-all client rules):
 *   npx tsx scripts/enroll-clock-test-device.ts --device=<device-id> --employee=<pilot-id> --issue
 *
 * Requires Firebase Admin Application Default Credentials, and explicitly:
 *   TSJ_CLOCK_REGISTRY_RULES_CONFIRMED=I_VERIFIED_DENY_ALL
 *
 * No HTTP route, no existing kiosk login/password, no employee PIN changes.
 * The output custom token is sensitive: paste it ONLY into the local test
 * device's enrollment screen. Never send it via chat, email or GitHub.
 */
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp, getServerFirestore } from '../server/firebaseAdmin';
import { getClockKioskRegistryFirestore, CLOCK_KIOSK_REGISTRY_DATABASE } from '../server/clocking/clockKioskRegistry';
import { issueClockTestKioskEnrollment, validateClockTestEnrollment } from '../server/clocking/clockTestKioskEnrollment';

const TEST_NAMESPACE='timbersmith-clock-test-local';
function getArg(name:string):string {
  const arg=process.argv.slice(2).find(item=>item.startsWith('--'+name+'='));
  return arg?.slice(name.length+3)||'';
}
async function main(){
  const values=validateClockTestEnrollment({
    namespace:TEST_NAMESPACE,deviceId:getArg('device'),employeeId:getArg('employee')
  });

  // An explicit local operation, not a public deployment or browser endpoint.
  if (!process.argv.includes('--issue')) {
    console.log('DRY RUN: test-only device and employee IDs are valid.');
    console.log('Target registry: '+CLOCK_KIOSK_REGISTRY_DATABASE);
    console.log('No database writes or tokens were created.');
    return;
  }
  if (process.env.NODE_ENV==='production' || process.env.K_SERVICE || process.env.NETLIFY ||
      process.env.TSJ_CLOCK_REGISTRY_RULES_CONFIRMED!=='I_VERIFIED_DENY_ALL') {
    throw new Error('Enrollment refused: only a local operator who verified the dedicated registry deny-all rules may issue a test token.');
  }

  const result=await issueClockTestKioskEnrollment(
    getServerFirestore(),getClockKioskRegistryFirestore(),
    getAuth(getFirebaseAdminApp()),values
  );
  console.log('TEST DEVICE REGISTERED. Custom token will be shown once.');
  console.log('Paste ONLY into the localhost Clocking Pilot device-enrollment field.');
  console.log('Never share this token with ChatGPT, GitHub or other people.');
  process.stdout.write(result.customToken+'\n');
}
main().catch(error=>{
  console.error('Clock test enrollment failed:',error instanceof Error?error.message:'Unknown error');
  process.exitCode=1;
});
