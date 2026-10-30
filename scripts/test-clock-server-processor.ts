import assert from 'node:assert/strict';
import type { Firestore } from 'firebase-admin/firestore';
import { processVerifiedClockEvent } from '../server/clocking/clockEventProcessor';
const namespace='timbersmith-clock-test-processor';
const root='artifacts/'+namespace+'/public/data/';
const employeeId='fake-worker-001',deviceId='fake-tablet-001';
const identity={firebaseUid:'fake-verified-user',deviceId,permittedEmployeeIds:[employeeId]};
const now=new Date('2026-10-30T12:00:00.000Z');
const event=(id:string,action:'In'|'Out',time:string)=>({id,employeeId,deviceId,action,occurredAt:time});
const first=event('ad44f7a9-640b-466a-b8fb-ad67d743a001','In','2026-10-30T06:00:00.000Z');
const second=event('ad44f7a9-640b-466a-b8fb-ad67d743a002','Out','2026-10-30T09:00:00.000Z');
const records=new Map<string,Record<string,any>>();
const collection=(path:string):any=>({doc:(id:string)=>doc(path+'/'+id)});
const doc=(path:string):any=>({path,collection:(name:string)=>collection(path+'/'+name)});
const db={collection,runTransaction:async<T>(fn:(tx:any)=>Promise<T>)=>{
  const changes:Array<()=>void>=[];
  const tx={
    get:async(ref:{path:string})=>({exists:records.has(ref.path),
      id:ref.path.split('/').at(-1),data:()=>records.get(ref.path)}),
    update:(ref:{path:string},value:Record<string,any>)=>
      changes.push(()=>records.set(ref.path,{...records.get(ref.path),...value})),
    create:(ref:{path:string},value:Record<string,any>)=>
      changes.push(()=>records.set(ref.path,value))
  };
  const result=await fn(tx);
  changes.forEach(apply=>apply());
  return result;
}} as unknown as Firestore;
const workerPath=root+'employees/'+employeeId;
records.set(workerPath,{id:employeeId,name:'Test',surname:'Worker',role:'Test',personalCode:'',
  status:'Out',isArchived:false,todayHours:0,yesterdayHours:0,
  weeklyHours:0,monthlyHours:0,history:[],shifts:[],breaks:[],dateStarted:'2026-10-01'});
const process=(value:unknown)=>processVerifiedClockEvent(db,namespace,value,identity,now);
async function main(){
  assert.equal((await process(first)).result,'committed');
  assert.equal(records.get(workerPath)?.status,'In');
  assert.equal(records.get(root+'clockEventReceipts/'+first.id)?.eventId,first.id);
  console.log('PASS atomic clock IN and receipt');
  assert.equal((await process(first)).result,'already_committed');
  console.log('PASS duplicate IN ignored');
  assert.equal((await process(second)).result,'committed');
  assert.equal(records.get(workerPath)?.shifts[0].hours,3);
  console.log('PASS OUT calculated three hours');
  assert.equal((await process(second)).result,'already_committed');
  assert.equal(records.get(workerPath)?.shifts.length,1);
  console.log('PASS duplicate OUT does not increase hours');
  assert.equal((await process({...second,action:'In'})).result,'rejected');
  console.log('PASS reused ID with changed action refused');
  await assert.rejects(()=>processVerifiedClockEvent(db,'timbersmith-terminal-v1',first,identity,now));
  console.log('PASS real production namespace blocked');
  console.log('All 6 server transaction tests passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
