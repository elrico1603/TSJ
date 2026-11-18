/**
 * READ-ONLY preflight: verify each employee has a canonical branch ID before
 * considering managed Clocking cutover. Reports counts only; no PII output.
 * Never writes to Firestore, Firebase Auth or local files.
 */
import { getFirebaseAdminApp,getServerFirestore } from '../server/firebaseAdmin';
const EXPECTED_PROJECT='timbersmithapp';
const EMPLOYEES='artifacts/timbersmith-terminal-v1/public/data/employees';
const BRANCHES={'BR-001':'Brandfort','BR-002':'Bloemfontein'} as const;
async function main(){
  if(process.argv.length!==2)throw Error('No arguments accepted; read-only tool.');
  if(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST||
     getFirebaseAdminApp().options.projectId!==EXPECTED_PROJECT)
     throw Error('Unexpected Firebase environment/project; no data read.');
  const db=getServerFirestore();
  const [employees,rootBranches,mirrorBranches]=await Promise.all([
    db.collection(EMPLOYEES).get(),db.collection('branches').get(),
    db.collection('artifacts/timbersmith-terminal-v1/public/branches/items').get()
  ]);
  const counts:{[id:string]:number}={'BR-001':0,'BR-002':0,missing:0,unknown:0};
  for(const doc of employees.docs){
    const branch=doc.data().branchId;
    if(!branch)counts.missing++;
    else if(branch==='BR-001'||branch==='BR-002')counts[branch]++;
    else counts.unknown++;
  }
  const branchMismatch=Object.entries(BRANCHES).filter(([id,name])=>
    [rootBranches,mirrorBranches].some(s=>{
      const doc=s.docs.find(x=>x.id===id);
      return !doc || doc.data().branchName!==name || doc.data().status!=='active';
    }));
  console.log('CLOCKING BRANCH CUTOVER PREFLIGHT — READ ONLY');
  console.log('EMPLOYEES TOTAL:',employees.size);
  console.log('BRANDFORT (BR-001):',counts['BR-001']);
  console.log('BLOEMFONTEIN (BR-002):',counts['BR-002']);
  console.log('EMPLOYEES WITHOUT CANONICAL BRANCH:',counts.missing);
  console.log('EMPLOYEES WITH UNKNOWN BRANCH:',counts.unknown);
  console.log('BRANCH CONFIGURATION MISSING OR MISMATCHED:',branchMismatch.length);
  const safe=counts.missing===0&&counts.unknown===0&&branchMismatch.length===0;
  console.log(safe?'PASS: branch assignments match canonical configured branches.':
    'BLOCKED: review branch assignments before enabling managed Clocking API.');
  console.log('No branch, employee, clock record, identity or rule was changed.');
  if(!safe)process.exitCode=2;
}
main().catch(e=>{console.error('BRANCH PREFLIGHT FAILED:',e instanceof Error?e.message:String(e));process.exitCode=1;});
