import assert from 'node:assert/strict';
import { initializeApp,deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { commitClockingEvent,readBranchEmployees,EMPLOYEES_PATH,ASSIGNMENTS_PATH,type ClockingActor } from '../server/managedClockingRouter';

if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085')throw Error('Isolated emulator required');
const app=initializeApp({projectId:'demo-tsj-user-admin'},'clocking-integration-test');
const db=getFirestore(app);
const actor:ClockingActor={profileId:'clocking-test-user',email:'clocking@example.test',
  branchId:'BR-001',canView:true,canProcess:true};
const branchB:ClockingActor={...actor,profileId:'brandfort-actor',branchId:'BR-002'};
const shift={date:'2026-11-17',clockIn:'07:00',clockOut:'16:00',hours:9};
const base={name:'Test Worker',branchId:'BR-001',status:'In',isArchived:false,shifts:[shift],personalCode:'2419'};
const ref=db.collection(EMPLOYEES_PATH).doc('clocking-test-worker');
const legacy=db.collection(EMPLOYEES_PATH).doc('legacy-no-branch');
async function rejects(code:string,task:()=>Promise<unknown>) {
  await assert.rejects(task(),(e:any)=>e.message===code);
}
async function run(){
  let n=0;const pass=(message:string)=>{n++;console.log('PASS | '+message);};
  await ref.set({...base,pin:'never-expose-me',hourlyRate:120,idNumber:'secret-id'});
  await legacy.set({...base,branchId:null});
  await db.collection(ASSIGNMENTS_PATH).doc(ref.id)
    .set({employeeId:ref.id,branchId:'BR-001',active:true});
  await db.collection(ASSIGNMENTS_PATH).doc(legacy.id)
    .set({employeeId:legacy.id,branchId:'BR-001',active:false});
  const rows=await readBranchEmployees(db,actor);
  const ours=rows.find(row=>row.id==='clocking-test-worker');
  assert.ok(ours,'Our worker must be visible within its own branch');
  assert.equal(Object.prototype.hasOwnProperty.call(ours,'pin'),false);
  assert.equal(Object.prototype.hasOwnProperty.call(ours,'hourlyRate'),false);
  assert.equal((await readBranchEmployees(db,branchB)).some(row=>row.id==='clocking-test-worker'),false);
  pass('Employee list is isolated by verified branch');
  await rejects('CLOCKING_ACCESS_DENIED',()=>readBranchEmployees(db,{...actor,canView:false}));
  await rejects('CLOCKING_ACCESS_DENIED',()=>commitClockingEvent(db,{...actor,canProcess:false},
    {eventId:'blocked',employeeId:ref.id,personalPin:'2419',expectedStatus:'In',expectedShiftCount:1,update:{status:'Out'}}));
  pass('View and Process permissions fail closed');
  await rejects('CLOCKING_EMPLOYEE_PIN_INVALID',()=>commitClockingEvent(db,actor,
    {eventId:'wrong-pin',employeeId:ref.id,personalPin:'0000',
      expectedStatus:'In',expectedShiftCount:1,update:{status:'Out'}}));
  pass('Wrong and shared fallback PINs cannot authorize Clocking');

  const update={status:'Out',shiftStartTime:null,shifts:[shift,{date:'2026-11-18',clockIn:'07:00',clockOut:'16:00',hours:9}]};
  const command={eventId:'shift-test-1',employeeId:ref.id,expectedStatus:'In',
    expectedShiftCount:1,update};
  const first=await commitClockingEvent(db,actor,command);
  assert.equal(first.applied,true);
  assert.equal((await ref.get()).data()?.shifts.length,2);
  pass('Valid clock-out commits transactionally without touching old shift');
  const replay=await commitClockingEvent(db,actor,command);
  assert.equal(replay.alreadyProcessed,true);
  assert.equal((await ref.get()).data()?.shifts.length,2);
  pass('Retry is idempotent; no duplicate shift');
  await rejects('CLOCKING_STALE_EVENT_RELOAD_REQUIRED',()=>commitClockingEvent(db,actor,
    {...command,eventId:'shift-test-2'}));
  pass('Stale clocking intent cannot overwrite newer state');
  await rejects('CLOCKING_BRANCH_NOT_VERIFIED',()=>commitClockingEvent(db,branchB,
    {...command,eventId:'cross-branch',expectedStatus:'Out',expectedShiftCount:2}));
  await rejects('CLOCKING_BRANCH_NOT_VERIFIED',()=>commitClockingEvent(db,actor,
    {...command,eventId:'no-branch',employeeId:legacy.id}));
  pass('Cross-branch and unassigned employee writes denied');
  await db.collection(ASSIGNMENTS_PATH).doc(ref.id).update({active:false});
  assert.equal((await readBranchEmployees(db,actor)).some(row=>row.id===ref.id),false);
  await rejects('CLOCKING_BRANCH_NOT_VERIFIED',()=>commitClockingEvent(db,actor,
    {...command,eventId:'suspended-assignment',expectedStatus:'Out',expectedShiftCount:2}));
  await db.collection(ASSIGNMENTS_PATH).doc(ref.id).update({active:true});
  pass('Suspended branch assignment immediately revokes Clocking access');
  await rejects('CLOCKING_HISTORICAL_SHIFTS_MUST_BE_PRESERVED',()=>commitClockingEvent(db,actor,
    {...command,eventId:'delete-shift',expectedStatus:'Out',expectedShiftCount:2,
     update:{status:'Out',shifts:[shift]}}));
  pass('Historical shifts cannot be deleted');
  await rejects('CLOCKING_FORBIDDEN_FIELD',()=>commitClockingEvent(db,actor,
    {...command,eventId:'sensitive-field',expectedStatus:'Out',expectedShiftCount:2,
     update:{hourlyRate:1}}));
  pass('Clocking API cannot rewrite employee pay fields');
  assert.deepEqual((await ref.get()).data()?.shifts,update.shifts);
  pass('All negative tests left employee shifts unchanged');
  console.log(n+'/11 ISOLATED MANAGED CLOCKING TESTS PASSED');
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>deleteApp(app));
