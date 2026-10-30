/**
 * Local emergency test kiosk revocation.
 * Required: authorized Firebase Admin ADC credentials.
 * ONLY for identities issued by the fictional Clocking test enrollment.
 *
 * Preview: npx tsx scripts/revoke-clock-test-device.ts --device=<ID>
 * Confirm: npx tsx scripts/revoke-clock-test-device.ts --device=<ID> --revoke
 *
 * Never disable an existing TimberSmith user or clocking@tsjoinery.co.za.
 */
import {getAuth} from 'firebase-admin/auth';
import {getFirebaseAdminApp} from '../server/firebaseAdmin';
import {getClockKioskRegistryFirestore} from '../server/clocking/clockKioskRegistry';
import {revokeClockTestKiosk} from '../server/clocking/clockTestKioskRevocation';

async function main(){
  const input=process.argv.slice(2).find(arg=>arg.startsWith('--device='));
  const deviceId=input?.slice('--device='.length)||'';
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(deviceId)) {
    throw new Error('Provide a valid test device ID using --device=<ID>.');
  }
  if(!process.argv.includes('--revoke')){
    console.log('DRY RUN: would revoke the test device '+deviceId);
    console.log('No Firestore or Firebase Auth changes have been made.');
    return;
  }
  if(process.env.NODE_ENV==='production' || process.env.K_SERVICE || process.env.NETLIFY ||
     process.env.TSJ_CLOCK_REGISTRY_RULES_CONFIRMED!=='I_VERIFIED_DENY_ALL') {
    throw new Error('Revocation requires explicit local admin approval and confirmed registry rules.');
  }
  const result=await revokeClockTestKiosk(
    getClockKioskRegistryFirestore(),getAuth(getFirebaseAdminApp()),deviceId
  );
  console.log(result==='revoked'
    ? 'TEST KIOSK REVOKED: registry blocked and Auth identity disabled.'
    : 'Test kiosk was already revoked.');
}
main().catch(error=>{
  console.error('Test kiosk revocation failed:',error instanceof Error?error.message:'Unknown error');
  process.exitCode=1;
});
