import assert from 'node:assert/strict';
import { initializeApp,deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeBranchAssignments,moveEmployeeBranch,previewBranchAssignments } from '../server/clockingBranchAssignments';
import { EMPLOYEES_PATH,ASSIGNMENTS_PATH,readBranchEmployees,type ClockingActor } from '../server/managedClockingRouter';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085')
  throw Error('Isolated Firestore emulator required.');
const app=initializeApp({projectId:'demo-tsj-user-admin'},'branch-transfer-test'),db=getFirestore(app);
const employee1=db.collection(EMPLOYEES_PATH).doc('transfer-worker-a');
const employee2=db.collection(EMPLOYEES_PATH).doc('transfer-worker-b');
const branchPaths=['branches','artifacts/timbersmith-terminal-v1/public/branches/items'];
const firstShift={date:'2026-11-17',clockIn:'08:00',clockOut:'17:00',hours:9};
const actor=(branchId:string):ClockingActor=>({profileId:'test-clock-admin',email:'test@example.test',branchId,canView:true,canProcess:true});
async function run(){
  let n=0;const pass=(m:string)=>{++n;console.log('PASS | '+m);};
  for(const collection of branchPaths){
    await db.collection(collection).doc('BR-001').set({branchName:'Brandfort',status:'active'});
    await db.collection(collection).doc('BR-002').set({branchName:'Bloemfontein',status:'active'});
  }
  await employee1.set({name:'First',surname:'Worker',status:'Out',shifts:[firstShift],hourlyRate:150});
  await employee2.set({name:'Second',surname:'Worker',status:'In',shifts:[firstShift],hourlyRate:180});
  // Clear the earlier suite's synthetic assignments INSIDE THE EMULATOR ONLY.
  // This script refuses to execute against production.
  const oldAssignments=await db.collection(ASSIGNMENTS_PATH).get();
  for(const doc of oldAssignments.docs)await doc.ref.delete();
  const beforeA=(await employee1.get()).data(),beforeB=(await employee2.get()).data();
  const workers=await db.collection(EMPLOYEES_PATH).get();
  const approved=workers.docs.map(d=>({
    employeeId:d.id,
    employeeName:[d.data().name,d.data().surname].filter(Boolean).join(' ').trim(),
    branchId:'BR-001'
  }));
  const preview=await previewBranchAssignments(db,approved);
  assert.equal(preview.ready,true,JSON.stringify(preview.errors));
  assert.equal((await db.collection(ASSIGNMENTS_PATH).get()).size,0);
  pass('Branch assignment preview is read-only and validates all employees');
  const result=await initializeBranchAssignments(db,approved,'branch-admin');
  assert.equal(result.assigned,workers.size);
  assert.equal((await readBranchEmployees(db,actor('BR-001'))).some(x=>x.id===employee1.id),true);
  assert.equal((await readBranchEmployees(db,actor('BR-002'))).some(x=>x.id===employee1.id),false);
  pass('All initially approved Brandfort assignments become branch-isolated');
  await assert.rejects(initializeBranchAssignments(db,approved,'branch-admin'));
  pass('Repeated initialization cannot overwrite assignments');
  const moved=await moveEmployeeBranch(db,employee1.id,'BR-001','BR-002','branch-admin');
  assert.equal(moved.to,'BR-002');
  assert.equal((await readBranchEmployees(db,actor('BR-001'))).some(x=>x.id===employee1.id),false);
  assert.equal((await readBranchEmployees(db,actor('BR-002'))).some(x=>x.id===employee1.id),true);
  pass('Employee can transfer from Brandfort to Bloemfontein without recreation');
  await assert.rejects(moveEmployeeBranch(db,employee1.id,'BR-001','BR-002','branch-admin'));
  await assert.rejects(moveEmployeeBranch(db,employee1.id,'BR-002','BR-003' as any,'branch-admin'));
  pass('Stale transfer and nonexistent branches are denied');
  assert.deepEqual((await employee1.get()).data(),beforeA);
  assert.deepEqual((await employee2.get()).data(),beforeB);
  pass('Employee records, existing shifts, salary and PIN fields stay unchanged');
  console.log(n+'/6 CLOCKING BRANCH TRANSFER TESTS PASSED');
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>deleteApp(app));
