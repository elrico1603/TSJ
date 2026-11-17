/**
 * Factory Clocking preflight. READ ONLY against production Firebase:
 * - inventory Auth anonymous/email identities (never delete);
 * - record which identities have explicit links/profile references;
 * - create private local snapshots of employee shifts and clocking records;
 * - report only anonymous counts and evidence, not sensitive employee details.
 *
 * It cannot prove which anonymous account is on the physical tablet:
 * that requires reading auth.currentUser.uid from that same tablet.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp, getServerFirestore } from '../server/firebaseAdmin';

const PROJECT='timbersmithapp';
const ROOT='artifacts/timbersmith-terminal-v1/public/data';
const SNAPSHOT_COLLECTIONS=[
  ROOT+'/employees',
  ROOT+'/clockingRecords'
] as const;
const WATCH_EMAILS=['clocking@tsjoinery.co.za','sidwell@tsjoinery.co.za','stock@tsjoinery.co.za'];
type AuthIdentity={uid:string;email:string|null;providers:string[];anonymous:boolean;disabled:boolean;createdAt:string;lastSignInAt:string};
function sha(v:string){return createHash('sha256').update(v).digest('hex');}
async function main(){
  if(process.argv.length!==2)throw Error('This script is READ ONLY. No command-line apply/delete flags are accepted.');
  const app=getFirebaseAdminApp();
  if(app.options.projectId!==PROJECT||process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)
    throw Error('Must run against the live timbersmithapp project without emulator overrides.');
  const auth=getAuth(app),db=getServerFirestore();
  const accounts:AuthIdentity[]=[];
  let pageToken:string|undefined;
  do{
    const page=await auth.listUsers(1000,pageToken);
    for(const u of page.users){
      const providers=u.providerData.map(p=>p.providerId);
      accounts.push({
        uid:u.uid,email:u.email||null,providers,
        anonymous:!u.email&&!u.phoneNumber&&providers.length===0,
        disabled:u.disabled===true,
        createdAt:u.metadata.creationTime||'',
        lastSignInAt:u.metadata.lastSignInTime||''
      });
    }
    pageToken=page.pageToken;
  }while(pageToken);
  const [links,profiles,employeeSnapshots,clockingSnapshots]=await Promise.all([
    db.collection('authUserLinks').get(),
    db.collection('artifacts/timbersmith-terminal-v1/private/users/active').get(),
    db.collection(SNAPSHOT_COLLECTIONS[0]).get(),
    db.collection(SNAPSHOT_COLLECTIONS[1]).get()
  ]);
  const records=[
    {path:SNAPSHOT_COLLECTIONS[0],documents:employeeSnapshots.docs.map(d=>({id:d.id,data:d.data()}))},
    {path:SNAPSHOT_COLLECTIONS[1],documents:clockingSnapshots.docs.map(d=>({id:d.id,data:d.data()}))}
  ];
  const linkRecords=links.docs.map(d=>({id:d.id,data:d.data()}));
  const profileRecords=profiles.docs.map(d=>({id:d.id,data:d.data()}));
  const anonymous=accounts.filter(u=>u.anonymous);
  const linkedAnonymous=anonymous.filter(u=>linkRecords.some(l=>l.id===u.uid||l.data?.uid===u.uid)||
      profileRecords.some(p=>p.data?.firebaseUid===u.uid));
  const watch=WATCH_EMAILS.map(email=>{
    const matches=accounts.filter(u=>u.email?.toLowerCase()===email);
    return {email,count:matches.length,accounts:matches.map(u=>({
      uid:u.uid,disabled:u.disabled,
      linked:linkRecords.some(l=>l.id===u.uid||l.data?.uid===u.uid),
      profile:profileRecords.some(p=>p.data?.firebaseUid===u.uid)
    }))};
  });
  const staff=employeeSnapshots.docs;
  const totalShifts=staff.reduce((n,d)=>n+(Array.isArray(d.data().shifts)?d.data().shifts.length:0),0);
  const missingShiftArray=staff.filter(d=>!Array.isArray(d.data().shifts)).length;
  const anonReferences=anonymous.filter(u=>
    employeeSnapshots.docs.some(d=>JSON.stringify(d.data()).includes(u.uid))||
    clockingSnapshots.docs.some(d=>JSON.stringify(d.data()).includes(u.uid)));
  const snapshot={
    project:PROJECT,readOnly:true,createdAt:new Date().toISOString(),
    auth:accounts,links:linkRecords,profiles:profileRecords,
    clocking:records,counts:{auth:accounts.length,anonymous:anonymous.length,
      anonymousWithIdentityLink:linkedAnonymous.length,
      anonymousReferencedInClockingData:anonReferences.length,
      employees:staff.length,embeddedShifts:totalShifts,
      employeesWithoutShiftsArray:missingShiftArray,clockingRecords:clockingSnapshots.size},
    watch
  };
  const dest=join(homedir(),'TSJ-Backups','clocking-protection');
  mkdirSync(dest,{recursive:true,mode:0o700});
  const file=join(dest,'clocking-readonly-'+Date.now()+'.json');
  const serialized=JSON.stringify(snapshot,null,2);
  writeFileSync(file,serialized,{flag:'wx',mode:0o600});
  chmodSync(file,0o600);
  console.log('CLOCKING PROTECTION READ-ONLY AUDIT');
  console.log('EMPLOYEES:',staff.length);
  console.log('EMBEDDED SHIFT RECORDS:',totalShifts);
  console.log('EMPLOYEES WITHOUT SHIFTS ARRAY:',missingShiftArray);
  console.log('SEPARATE CLOCKING RECORDS:',clockingSnapshots.size);
  console.log('FIREBASE AUTH ACCOUNTS:',accounts.length);
  console.log('ANONYMOUS AUTH CANDIDATES:',anonymous.length);
  console.log('ANONYMOUS WITH EXPLICIT PROFILE/LINK:',linkedAnonymous.length);
  console.log('ANONYMOUS UID REFERENCED IN CLOCK DATA:',anonReferences.length);
  for(const w of watch){
    console.log('PROTECTED EMAIL:',w.email,'AUTH ACCOUNTS:',w.count,
      'LINKED:',w.accounts.filter(a=>a.linked).length,
      'PROFILE MATCH:',w.accounts.filter(a=>a.profile).length);
  }
  console.log('PRIVATE CLOCKING BACKUP:',file);
  console.log('SHA256:',sha(serialized));
  console.log('Do not share the backup file: it contains private employee data and Firebase identifiers.');
  console.log('READ ONLY COMPLETE; NO LOGIN, CLOCKING OR FIRESTORE SECURITY RULES ALTERED.');
  console.log('NOTE: A matching Auth UID does not prove a particular account is used by the installed tablet.');
  console.log('NOTE: Locally queued/offline tablet records are NOT included in this Firestore snapshot.');
}
main().catch(e=>{console.error('CLOCKING PREFLIGHT FAILED:',e instanceof Error?e.message:String(e));process.exitCode=1;});
