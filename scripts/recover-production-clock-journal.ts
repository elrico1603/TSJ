/** Privileged recovery of ORIGINAL signed events. Local validation only unless --replay is explicit. */
import { readFileSync, statSync } from 'node:fs';
import { getServerFirestore } from '../server/firebaseAdmin';
import { getClockKioskRegistryFirestore } from '../server/clocking/clockKioskRegistry';
import { PRODUCTION_DEVICES, validateProductionEvent, type ProductionDevice,
  type StoredClockCredential } from '../server/clocking/productionClockSecurity';
import { processProductionClockEvent } from '../server/clocking/productionClockProcessor';
import { PRODUCTION_CLOCK_NAMESPACE } from '../src/services/productionClockContract';

async function main() {
  const file=process.argv.find(a=>a.startsWith('--file='))?.slice(7) || '';
  if (!file || statSync(file).size>20*1024*1024) throw new Error('A recovery file of at most 20 MB is required.');
  const data=JSON.parse(readFileSync(file,'utf8'));
  if (data.format!=='TSJ-PRODUCTION-CLOCK-RECOVERY' || data.version!==1 ||
      !/^[A-Za-z0-9_-]{8,128}$/.test(data.deviceId) || !Array.isArray(data.events) || data.events.length>10000) throw new Error('Invalid recovery file.');
  const seen=new Set<string>();
  const dryDevice:ProductionDevice={deviceId:data.deviceId,firebaseUid:'dry-run',approved:true,revoked:false,
    namespace:PRODUCTION_CLOCK_NAMESPACE,permittedEmployeeIds:[...new Set<string>(data.events.map((e:any)=>e.event?.employeeId))]};
  for (const item of data.events) {
    const event=validateProductionEvent(item.event,dryDevice);
    if (seen.has(event.id) || !['pending','confirmed','needs_review'].includes(item.status)) throw new Error('Duplicate ID or invalid recovery status.');
    seen.add(event.id);
  }
  if (!process.argv.includes('--replay')) {
    console.log(`DRY RUN: ${data.events.length} well-formed signed events. Signatures and server state NOT yet verified. No Firebase access or writes.`);return;
  }
  if (process.env.K_SERVICE || process.env.NETLIFY || process.env.NODE_ENV==='production' ||
      process.env.TSJ_CLOCK_PRODUCTION_SECURITY_CONFIRMED!=='REVIEWED_RULES_IAM_BACKUP') throw new Error('Local administrator security confirmation required.');
  const registry=getClockKioskRegistryFirestore(),db=getServerFirestore();
  const ref=registry.collection(PRODUCTION_DEVICES).doc(data.deviceId),snapshot=await ref.get();
  const device=snapshot.data() as ProductionDevice;
  if (!snapshot.exists || device.approved!==true || device.revoked!==false || device.namespace!==PRODUCTION_CLOCK_NAMESPACE ||
      !device.firebaseUid.startsWith('tsj-clock-production-')) throw new Error('Unapproved/revoked devices require separate supervised recovery. No automatic reactivation.');
  const blocked=new Set<string>();
  for (const item of data.events) {
    const event=validateProductionEvent(item.event,device);
    if(item.status==='needs_review')blocked.add(event.employeeId);
    if(blocked.has(event.employeeId)){console.log(event.id+': HELD FOR REVIEW');continue;}
    const snap=await ref.collection('credentialHistory').doc(event.credentialId).get();
    if(!snap.exists)throw new Error('Original credential missing; do not mint a replacement event.');
    const receipt=await processProductionClockEvent(db,device,snap.data() as StoredClockCredential,event);
    console.log(event.id+': '+receipt.result);
    if(receipt.result==='rejected')blocked.add(event.employeeId);
  }
  console.log('Original recovery file is unchanged. Retain it and reconcile every ID with the tablet before resuming Clocking.');
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Recovery stopped.');process.exitCode=1;});
