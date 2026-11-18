/**
 * Generates a PRIVATE local review file from live factory employees.
 * Reads Firestore only. Writes ONLY an owner-readable JSON template in
 * ~/TSJ-Backups/clocking-protection; never uploads branch assignments.
 */
import { mkdirSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { getFirebaseAdminApp,getServerFirestore } from '../server/firebaseAdmin';
import { validateClockingBranchAssignments } from '../server/clockingBranchManifest';
const EMPLOYEES='artifacts/timbersmith-terminal-v1/public/data/employees';
async function run(){
  if(process.argv.length!==2||process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST||
    getFirebaseAdminApp().options.projectId!=='timbersmithapp')
    throw Error('Production read-only template generator accepts no arguments.');
  const db=getServerFirestore();
  const [employeeDocs,existingAssignments]=await Promise.all([
    db.collection(EMPLOYEES).get(),
    db.collection('artifacts/timbersmith-terminal-v1/private/clocking/employee_branches').get()
  ]);
  if(existingAssignments.size>0)throw Error('Assignments already exist; do not generate a new unreviewed manifest.');
  const current=employeeDocs.docs.map(d=>({id:d.id,name:[d.data().name,d.data().surname].filter(Boolean).join(' ').trim()}));
  const rows=current.map(e=>({employeeId:e.id,employeeName:e.name,branchId:null}));
  const validation=validateClockingBranchAssignments(rows,current);
  if(validation.errors.length!==current.length)throw Error('Unexpected template shape.');
  const dir=join(homedir(),'TSJ-Backups','clocking-protection');
  mkdirSync(dir,{recursive:true,mode:0o700});
  const file=join(dir,'clocking-branch-review-'+Date.now()+'.json');
  writeFileSync(file,JSON.stringify({projectId:'timbersmithapp',createdAt:new Date().toISOString(),
    reviewed:false,assignments:rows},null,2),{flag:'wx',mode:0o600});
  console.log('PRIVATE BRANCH REVIEW TEMPLATE:',file);
  console.log('EMPLOYEES:',rows.length);
  console.log('CONFIRMED ASSIGNMENTS: 0 — requires explicit human branch confirmation.');
  console.log('BR-001 = Brandfort; BR-002 = Bloemfontein');
  console.log('No production Firestore data, employee shifts, users or rules changed.');
}
run().catch(e=>{console.error('BRANCH REVIEW TEMPLATE FAILED:',e instanceof Error?e.message:String(e));process.exitCode=1;});
