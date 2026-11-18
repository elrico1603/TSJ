/**
 * READ ONLY: inspect legacy employee branch/location hints before preparing
 * an explicit Clocking branch map. No employee / shift / Firestore mutation.
 * Only selected non-financial, non-credential fields are printed.
 */
import { getFirebaseAdminApp,getServerFirestore } from '../server/firebaseAdmin';
const EMPLOYEES='artifacts/timbersmith-terminal-v1/public/data/employees';
const FIELDS=['branchId','branch','branchName','location','workLocation',
  'physicalLocation','factory','site','worksite','department','companyBranch'] as const;
async function main(){
  if(process.argv.length!==2||process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST||
     getFirebaseAdminApp().options.projectId!=='timbersmithapp')
     throw Error('Read-only production employee branch audit; no flags accepted.');
  const rows=await getServerFirestore().collection(EMPLOYEES).get();
  console.log('CLOCKING EMPLOYEE BRANCH HINTS — READ ONLY');
  for(const row of rows.docs){
    const data=row.data();
    const display=String(data.name||'').trim()+' '+String(data.surname||'').trim();
    const hints=FIELDS.filter(field=>Object.prototype.hasOwnProperty.call(data,field))
      .map(field=>field+'='+JSON.stringify(data[field]).slice(0,100));
    console.log('EMPLOYEE:',row.id,'| NAME:',display.trim()||'(unnamed)',
      '| HINTS:',hints.join(', ')||'none',
      '| SHIFTS:',Array.isArray(data.shifts)?data.shifts.length:'missing');
  }
  console.log('TOTAL:',rows.size);
  console.log('No employees, shifts, identity links or Firestore permissions were changed.');
  console.log('Branch assignments must be expressly confirmed, not guessed from names.');
}
main().catch(e=>{console.error('READ-ONLY AUDIT FAILED:',e instanceof Error?e.message:String(e));process.exitCode=1;});
