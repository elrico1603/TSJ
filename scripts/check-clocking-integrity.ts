/**
 * Clocking data preservation proof. READ ONLY.
 * Compares a private saved Clocking snapshot with current live employee docs
 * before/after identity cutover. Existing shifts must remain byte-equivalent
 * (after deterministic JSON normalization); new shifts may be appended.
 * No Auth, Firestore, rules, or local snapshot is ever changed.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getServerFirestore, getFirebaseAdminApp } from '../server/firebaseAdmin';

const PROJECT='timbersmithapp';
const ROOT='artifacts/timbersmith-terminal-v1/public/data';
function canonical(value:unknown):string{
  function ordered(input:any):any{
    if(Array.isArray(input))return input.map(ordered);
    if(input&&typeof input==='object'){
      if(typeof input.toJSON==='function')return ordered(input.toJSON());
      return Object.fromEntries(Object.keys(input).sort().map(key=>[key,ordered(input[key])]));
    }
    return input;
  }
  return JSON.stringify(ordered(value));
}
type SnapshotDoc={id:string;data:{shifts?:unknown[];[key:string]:unknown}};
function assertSnapshot(data:unknown):asserts data is {project:string;clocking:{path:string;documents:SnapshotDoc[]}[]}{
  if(!data||typeof data!=='object')throw Error('Invalid local snapshot.');
  const s=data as any;
  if(s.project!==PROJECT||!Array.isArray(s.clocking))throw Error('Wrong project or snapshot format.');
  for(const row of s.clocking){
    if(!row||typeof row.path!=='string'||!Array.isArray(row.documents))throw Error('Invalid collection snapshot.');
  }
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length!==1||!args[0].startsWith('--backup='))throw Error('Usage: npx tsx scripts/check-clocking-integrity.ts --backup=/home/elrico/TSJ-Backups/clocking-protection/clocking-readonly-....json');
  if(getFirebaseAdminApp().options.projectId!==PROJECT||process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)
    throw Error('Expected timbersmithapp production project (read only).');
  const backupPath=resolve(args[0].slice('--backup='.length));
  const snapshot:unknown=JSON.parse(readFileSync(backupPath,'utf8'));
  assertSnapshot(snapshot);
  const employeesPath=ROOT+'/employees';
  const old=snapshot.clocking.find(x=>x.path===employeesPath);
  if(!old)throw Error('Snapshot is missing employee records.');
  const current=await getServerFirestore().collection(employeesPath).get();
  const currentById=new Map(current.docs.map(doc=>[doc.id,doc.data()]));
  const problems:string[]=[];
  let oldShiftCount=0,newShiftCount=0,addedShifts=0;
  for(const previous of old.documents){
    const latest=currentById.get(previous.id);
    if(!latest){problems.push('MISSING EMPLOYEE DOCUMENT '+previous.id);continue;}
    if(!Array.isArray(previous.data?.shifts)||!Array.isArray(latest.shifts)){
      problems.push('MISSING SHIFTS ARRAY '+previous.id);continue;
    }
    const prevShifts=previous.data.shifts;
    oldShiftCount+=prevShifts.length;
    newShiftCount+=latest.shifts.length;
    // A user can append new shifts while production continues running.
    // Existing records are not permitted to be removed or silently rewritten.
    const remaining=new Map<string,number>();
    for(const shift of latest.shifts){
      const key=canonical(shift);remaining.set(key,(remaining.get(key)||0)+1);
    }
    for(const shift of prevShifts){
      const key=canonical(shift);
      const count=remaining.get(key)||0;
      if(count===0)problems.push('HISTORICAL SHIFT MISSING OR CHANGED FOR EMPLOYEE '+previous.id);
      else remaining.set(key,count-1);
    }
    addedShifts+=Math.max(0,latest.shifts.length-prevShifts.length);
  }
  console.log('CLOCKING INTEGRITY COMPARISON — READ ONLY');
  console.log('BACKUP EMPLOYEES:',old.documents.length);
  console.log('LIVE EMPLOYEES:',current.docs.length);
  console.log('BACKUP HISTORICAL SHIFTS:',oldShiftCount);
  console.log('LIVE SHIFTS FOR BACKED-UP EMPLOYEES:',newShiftCount);
  console.log('ADDED SHIFTS SINCE BACKUP:',addedShifts);
  console.log('MISSING/CHANGED HISTORICAL RECORDS:',problems.length);
  for(const message of problems.slice(0,20))console.error('BLOCKER:',message);
  if(problems.length){process.exitCode=2;console.error('BLOCKED: do not proceed with identity cutover.');}
  else console.log('PASS: all saved historical employee shifts were found unchanged in Firestore.');
  console.log('Local tablet offline-only records cannot be validated with this comparison.');
  console.log('NO AUTH, FIRESTORE DOCUMENT, SECURITY RULE, OR DEPLOYMENT WAS MODIFIED.');
}
main().catch(error=>{console.error('CLOCKING COMPARISON FAILED:',error instanceof Error?error.message:String(error));process.exitCode=1;});
