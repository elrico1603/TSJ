import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { createClockCredential, verifyClockSignature, validateProductionEvent, verifyProductionDevice,
  type ProductionDevice } from '../server/clocking/productionClockSecurity';
import { processProductionClockEvent } from '../server/clocking/productionClockProcessor';
import { unlockClockSigningKey, signProductionClockEvent } from '../src/services/productionClockCrypto';
import { clockWorker, clockSigningText, PRODUCTION_CLOCK_NAMESPACE, type ProductionClockEvent, type ProductionClockAction } from '../src/services/productionClockContract';
import { emptyProductionState } from '../src/services/productionClockStore';
import { projectProductionWorker, applyProductionReceipt } from '../src/services/productionClockModel';
import type { Employee } from '../src/types';
import express from 'express';
import { productionClockRoutes } from '../server/clocking/productionClockRoutes';
import { matchesClockKioskClaims } from '../src/services/clockKioskClaims';
import { reportPaidHours, reportPersonalTimeOff } from '../src/services/clockBreakAttendance';

let passed=0;
async function test(name:string, run:()=>unknown|Promise<unknown>) {await run();passed++;console.log('PASS '+name);}
async function main() {
  const now=new Date('2026-11-05T04:00:00.000Z'), employeeId='fictional-worker-001',deviceId='fictional-kiosk-001';
  await test('production enrollment and token checks accept production claims and exclude test identities',()=>{
    const production={clocking_production:true,clocking_device_id:deviceId};
    const sandbox={clocking_kiosk:true,clocking_device_id:deviceId};
    assert.equal(matchesClockKioskClaims(production,deviceId,'production'),true);
    assert.equal(matchesClockKioskClaims(sandbox,deviceId,'production'),false);
    assert.equal(matchesClockKioskClaims(production,deviceId,'test'),false);
    assert.equal(matchesClockKioskClaims(sandbox,deviceId,'test'),true);
    assert.equal(matchesClockKioskClaims(production,'another-device','production'),false);
  });
  const credential=createClockCredential(deviceId,employeeId,'5678',now);
  let key:CryptoKey;
  await test('existing PIN decrypts a nonextractable browser signing key',async()=>{
    key=await unlockClockSigningKey(credential.envelope,'5678');assert.equal(key.extractable,false);
  });
  await test('wrong PIN and envelope swapped to another employee fail',async()=>{
    await assert.rejects(()=>unlockClockSigningKey(credential.envelope,'1234'));
    await assert.rejects(()=>unlockClockSigningKey({...credential.envelope,employeeId:'another-worker'},'5678'));
  });
  const device:ProductionDevice={deviceId,firebaseUid:'fictional-production-uid',approved:true,revoked:false,
    namespace:PRODUCTION_CLOCK_NAMESPACE,permittedEmployeeIds:[employeeId]};
  const event=async(action:ProductionClockAction,time:string,revision:number)=>signProductionClockEvent({id:randomUUID(),employeeId,deviceId,
    credentialId:credential.envelope.id,action,...(action==='Break' ? {reason:'Bank appointment'} : {}),occurredAt:time,expectedRevision:revision},key);
  const first=await event('In','2026-11-05T06:00:00.000Z',0);
  const second=await event('Out','2026-11-05T15:00:00.000Z',1);
  await test('server verifies browser signatures and rejects immutable field tampering',()=>{
    assert.equal(verifyClockSignature(first,credential),true);
    assert.equal(verifyClockSignature({...first,expectedRevision:99},credential),false);
    assert.equal(verifyClockSignature({...first,occurredAt:second.occurredAt},credential),false);
    assert.deepEqual(validateProductionEvent(first,device),first);
    assert.throws(()=>validateProductionEvent({...first,expectedRevision:-1},device));
    assert.throws(()=>validateProductionEvent({...first,deviceId:'another-device'},device));
  });
  const worker={id:employeeId,name:'Fictional',surname:'Worker',role:'Test',personalCode:'5678',status:'Out',
    isArchived:false,todayHours:0,yesterdayHours:0,weeklyHours:0,monthlyHours:0,history:[],shifts:[],breaks:[],dateStarted:'2026-11-01'} as Employee;
  const records=new Map<string,Record<string,any>>();
  const root='artifacts/'+PRODUCTION_CLOCK_NAMESPACE+'/public/data/', workerPath=root+'employees/'+employeeId;
  records.set(workerPath,structuredClone(worker));
  const collection=(path:string):any=>({doc:(id:string)=>doc(path+'/'+id)});
  const doc=(path:string):any=>({path,collection:(name:string)=>collection(path+'/'+name)});
  let failReceipt=false;
  const db={collection,runTransaction:async(fn:any)=>{
    const changes:Array<()=>void>=[];
    const result=await fn({get:async(ref:any)=>({exists:records.has(ref.path),id:ref.path.split('/').at(-1),data:()=>structuredClone(records.get(ref.path))}),
      update:(ref:any,data:any)=>changes.push(()=>records.set(ref.path,{...records.get(ref.path),...data})),
      set:(ref:any,data:any)=>changes.push(()=>records.set(ref.path,data)),
      delete:(ref:any)=>changes.push(()=>records.delete(ref.path)),
      create:(ref:any,data:any)=>{if(failReceipt)throw new Error('simulated write failure');changes.push(()=>records.set(ref.path,data));}});
    changes.forEach(apply=>apply());return result;
  }} as unknown as Firestore;
  const processEvent=(e:ProductionClockEvent,date=new Date('2026-11-05T16:00:00.000Z'))=>processProductionClockEvent(db,device,credential,e,date);
  await test('receipt write failure aborts employee update',async()=>{
    failReceipt=true;await assert.rejects(()=>processEvent(first));failReceipt=false;
    assert.equal(records.get(workerPath)!.status,'Out');assert.equal(records.size,1);
  });
  await test('IN/OUT commits exactly nine hours with two receipts',async()=>{
    assert.equal((await processEvent(first)).result,'committed');assert.equal((await processEvent(second)).result,'committed');
    assert.equal(records.get(workerPath)!.history[0].hours,9);assert.equal(records.get(workerPath)!.clockRevision,2);assert.equal(records.size,4);
    assert.equal('personalCode' in records.get(root+'employeeViews/'+employeeId)!,false);
  });
  await test('lost acknowledgement replay succeeds even after lease and age window expire',async()=>{
    assert.equal((await processEvent(second,new Date('2027-02-01T00:00:00.000Z'))).result,'already_committed');
    assert.equal(records.get(workerPath)!.history[0].hours,9);
  });
  await test('validly signed reused ID with different fields is quarantined',async()=>{
    const altered={...first,action:'Out' as const};
    altered.signature=createHmac('sha256',Buffer.from(credential.signingKey,'base64')).update(clockSigningText(altered)).digest('base64');
    assert.equal((await processEvent(altered)).result,'rejected');assert.equal(records.size,4);
  });
  await test('unacknowledged conflicting device state cannot overwrite payroll',async()=>{
    const stale=await event('In','2026-11-05T16:00:00.000Z',1);
    assert.equal((await processEvent(stale)).result,'rejected');assert.equal(records.get(workerPath)!.clockRevision,2);
  });
  await test('changed PIN, expired lease and archived employee retain events for review',async()=>{
    const next=await event('In','2026-11-05T16:00:00.000Z',2);
    records.get(workerPath)!.personalCode='9999';assert.equal((await processEvent(next)).result,'rejected');
    records.get(workerPath)!.personalCode='5678';records.get(workerPath)!.isArchived=true;
    assert.equal((await processEvent(next)).result,'rejected');records.get(workerPath)!.isArchived=false;
    const late=await event('In','2026-11-14T16:00:00.000Z',2);
    assert.equal((await processEvent(late,new Date(late.occurredAt))).result,'rejected');assert.equal(records.size,4);
  });
  await test('offline restart projects queued IN/OUT once and preserves other employee streams',()=>{
    const state=emptyProductionState(deviceId);state.entries=[{worker:clockWorker(worker),credential:credential.envelope}];
    state.events=[{event:first,status:'pending'},{event:second,status:'pending'}];
    const restarted=JSON.parse(JSON.stringify(state));
    assert.equal(projectProductionWorker(restarted,employeeId).history[0].hours,9);
    restarted.events[0].status='needs_review';assert.throws(()=>projectProductionWorker(restarted,employeeId));
    assert.equal(state.entries[0].worker.status,'Out');
  });
  await test('approved personal Time Off and return preserve gross attendance and existing advances',async()=>{
    const saved=structuredClone(records);
    try {
      records.clear();
      records.set(workerPath,{...worker,advances:[{id:'existing-advance'}]});
      const tea=await event('Break','2026-11-05T08:00:00.000Z',1);
      const returned=await event('Return','2026-11-05T08:20:00.000Z',2);
      const out=await event('Out',second.occurredAt,3);
      const approvalPath='artifacts/'+PRODUCTION_CLOCK_NAMESPACE+'/private/clockApprovals/items/'+tea.id;
      assert.equal((await processEvent(first)).result,'committed');
      assert.equal((await processEvent(tea)).result,'rejected');
      assert.deepEqual(validateProductionEvent(tea,device),tea);
      assert.throws(()=>validateProductionEvent({...tea,reason:'   '},device));
      assert.throws(()=>validateProductionEvent({...tea,reason:'a'.repeat(201)},device));
      assert.equal(verifyClockSignature({...tea,reason:'Shop'},credential),false);
      records.set(approvalPath,{canonical:clockSigningText(tea),signature:tea.signature,deviceUid:device.firebaseUid,approvedBy:'fixture-supervisor'});
      assert.equal((await processEvent(tea)).result,'committed');
      assert.equal(records.has(approvalPath),false);
      assert.equal((await processEvent(tea)).result,'already_committed');
      assert.equal((await processEvent(returned)).result,'committed');
      assert.equal((await processEvent(out)).result,'committed');
      const employee=records.get(workerPath)!;
      assert.equal(employee.shifts[0].clockInDateTime,first.occurredAt);
      assert.equal(employee.breaks[0].returnedAtIso,returned.occurredAt);
      assert.equal(employee.history[0].hours,9);
      assert.equal(employee.breaks[0].reason,'Bank appointment');
      const shift=employee.shifts[0];
      const timeOff=reportPersonalTimeOff(shift.clockInDateTime,shift.clockOutDateTime,employee.breaks);
      assert.equal(Math.round(reportPaidHours(shift.hours,timeOff.hours)*60),460);
      assert.deepEqual(employee.advances,[{id:'existing-advance'}]);
    } finally {
      records.clear();
      for (const [path,record] of saved) records.set(path,record);
    }
  });
  await test('anonymous and revoked device identities are refused server-side',async()=>{
    let data:any={...device};
    const registry={collection:()=>({doc:()=>({get:async()=>({exists:true,data:()=>data})})})} as unknown as Firestore;
    const custom:any={verifyIdToken:async()=>({uid:device.firebaseUid,clocking_production:true,clocking_device_id:deviceId,firebase:{sign_in_provider:'custom'}})};
    assert.equal((await verifyProductionDevice('fake-token',deviceId,registry,custom)).firebaseUid,device.firebaseUid);
    data={...device,revoked:true};await assert.rejects(()=>verifyProductionDevice('fake-token',deviceId,registry,custom));
    data={...device};const anonymous:any={verifyIdToken:async()=>({uid:device.firebaseUid,firebase:{sign_in_provider:'anonymous'}})};
    await assert.rejects(()=>verifyProductionDevice('fake-token',deviceId,registry,anonymous));
  });
  await test('acknowledgement preserves new events queued during network delay and cannot roll back newer state',()=>{
    const state=emptyProductionState(deviceId);state.entries=[{worker:clockWorker(worker),credential:credential.envelope}];
    state.events=[{event:first,status:'pending'},{event:second,status:'pending'}];
    const inWorker=records.get(root+'clockEventReceipts/'+first.id)!.worker;
    const outWorker=records.get(root+'clockEventReceipts/'+second.id)!.worker;
    applyProductionReceipt(state,first.id,{result:'committed',eventId:first.id,worker:inWorker});
    assert.equal(state.events[1].status,'pending');assert.equal(projectProductionWorker(state,employeeId).history[0].hours,9);
    applyProductionReceipt(state,second.id,{result:'committed',eventId:second.id,worker:outWorker});
    applyProductionReceipt(state,first.id,{result:'already_committed',eventId:first.id,worker:inWorker});
    assert.equal(state.entries[0].worker.clockRevision,2);assert.equal(state.entries[0].worker.history[0].hours,9);
    assert.throws(()=>applyProductionReceipt(state,first.id,{result:'already_committed',eventId:randomUUID(),worker:inWorker}));
  });
  await test('roster never returns raw PIN or employee identity/financial fields',()=>{
    const safe=clockWorker({...worker,idNumber:'private-id',hourlyRate:'100',pin:'5678'});
    for(const field of ['personalCode','pin','clockPin','idNumber','hourlyRate','address'])assert.equal(field in safe,false);
    assert.equal('signingKey' in credential.envelope,false);assert.equal('pinBinding' in credential.envelope,false);
  });
  await test('HTTP route defaults closed and requires both server gates; limits body before Auth',async()=>{
    const priorEnabled=process.env.TSJ_ENABLE_PRODUCTION_CLOCKING, priorConfirmed=process.env.TSJ_CLOCK_PRODUCTION_SECURITY_CONFIRMED;
    const app=express();app.use('/api/clocking/production',productionClockRoutes());
    const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
    try {
      const address=server.address();assert.ok(address && typeof address==='object');
      const url=`http://127.0.0.1:${address.port}/api/clocking/production/replay`;
      delete process.env.TSJ_ENABLE_PRODUCTION_CLOCKING;delete process.env.TSJ_CLOCK_PRODUCTION_SECURITY_CONFIRMED;
      assert.equal((await fetch(url,{method:'POST'})).status,503);
      process.env.TSJ_ENABLE_PRODUCTION_CLOCKING='true';assert.equal((await fetch(url,{method:'POST'})).status,503);
      process.env.TSJ_CLOCK_PRODUCTION_SECURITY_CONFIRMED='REVIEWED_RULES_IAM_BACKUP';
      assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
      assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:'x'.repeat(9000)})})).status,413);
    } finally {
      if(priorEnabled===undefined)delete process.env.TSJ_ENABLE_PRODUCTION_CLOCKING;else process.env.TSJ_ENABLE_PRODUCTION_CLOCKING=priorEnabled;
      if(priorConfirmed===undefined)delete process.env.TSJ_CLOCK_PRODUCTION_SECURITY_CONFIRMED;else process.env.TSJ_CLOCK_PRODUCTION_SECURITY_CONFIRMED=priorConfirmed;
      await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
    }
  });
  console.log(`All ${passed} production Clocking candidate tests passed (fictional data; no Firebase access).`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
