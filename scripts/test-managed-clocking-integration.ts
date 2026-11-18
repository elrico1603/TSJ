import assert from 'node:assert/strict';
import { initializeApp,deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { commitClockingEvent,readBranchEmployees,EMPLOYEES_PATH,type ClockingActor } from '../server/managedClockingRouter';

if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085')throw Error('Isolated emulator required');
const app=initializeApp({projectId:'demo-tsj-user-admin'},'clocking-integration-test');
const db=getFirestore(app);
const actor:ClockingActor={profileId:'clocking-test-user',email:'clocking@example.test',
  branchId:'BR-001',canView:true,canProcess:true};
const branchB:ClockingActor={...actor,profileId:'brandfort-actor',branchId:'BR-002'};
const shift={date:'2026-11-17',clockIn:'07:00',clockOut:'16:00',hours:9};
const base={name:'Test Worker',branchId:'BR-001',status:'In',isArchived:false,shifts:[shift]};
const ref=db.collection(EMPLOYEES_PATH).doc('clocking-test-worker');
const legacy=db.collection(EMPLOYEES_PATH).doc('legacy-no-branch');
async function rejects(code:string,task:()=>Promise<unknown>) {
  await assert.rejects(task(),(e:any)=>e.message===code);
}
async function run(){
  let n=0;const pass=(message:string)=>{n++;console.log('PASS | '+message);};
  await ref.set({...base,pin:'never-expose-me',hourlyRate:120,idNumber:'secret-id'});
  await legacy.set({...base,branchId:null});
  const rows=await readBranchEmployees(db,actor);
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,'clocking-test-worker');
  assert.equal(Object.prototype.hasOwnProperty.call(rows[0],'pin'),false);
  assert.equal(Object.prototype.hasOwnProperty.call(rows[0],'hourlyRate'),false);
  assert.equal((await readBranchEmployees(db,branchB)).length,0);
  pass('Employee list is isolated by verified branch');
  await rejects('CLOCKING_ACCESS_DENIED',()=>readBranchEmployees(db,{...actor,canView:false}));
  await rejects('CLOCKING_ACCESS_DENIED',()=>commitClockingEvent(db,{...actor,canProcess:false},
    {eventId:'blocked',employeeId:ref.id,expectedStatus:'In',expectedShiftCount:1,update:{status:'Out'}}));
  pass('View and Process permissions fail closed');
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
  console.log(n+'/9 ISOLATED MANAGED CLOCKING TESTS PASSED');
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>deleteApp(app));
