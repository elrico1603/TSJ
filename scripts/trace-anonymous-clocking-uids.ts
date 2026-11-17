/**
 * READ-ONLY identity attribution audit for the live clocking tablet.
 * Does not edit Firestore, Auth, rules, or tablet storage.
 */
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp, getServerFirestore } from '../server/firebaseAdmin';

const PROJECT='timbersmithapp';
const root='artifacts/timbersmith-terminal-v1/public/data';
const paths=[
  root+'/employees',
  root+'/clockingRecords',
  root+'/clockingLogs',
  root+'/clockLogs',
  root+'/attendance',
  root+'/syncLogs',
  'clockingRecords',
  'clockingLogs',
  'audit_logs'
];
const UID_PATTERN=/uid|auth|userId|createdBy|updatedBy|clockedBy|deviceId|actor|terminal|kiosk|recordedBy/i;
function findReferences(data:unknown,known:Set<string>,prefix='',level=0):{uid:string;field:string}[]{
  if(level>14||data===null||data===undefined)return [];
  if(typeof data==='string'){
    if(known.has(data.trim()))return [{uid:data.trim(),field:prefix}];
    return [];
  }
  if(Array.isArray(data)){
    return data.flatMap((item,i)=>findReferences(item,known,prefix+'['+i+']',level+1));
  }
  if(typeof data==='object'){
    return Object.entries(data).flatMap(([key,value])=>{
      if(UID_PATTERN.test(key)&&typeof value==='string'&&known.has(value.trim()))
        return [{uid:value.trim(),field:prefix?prefix+'.'+key:key}];
      return findReferences(value,known,prefix?prefix+'.'+key:key,level+1);
    });
  }
  return [];
}
async function main(){
  if(process.argv.length!==2)throw Error('READ-ONLY script takes no arguments.');
  const app=getFirebaseAdminApp();
  if(app.options.projectId!==PROJECT||process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)
    throw Error('Unexpected Firebase project or emulator. Nothing done.');
  const db=getServerFirestore(),auth=getAuth(app);
  const all:Awaited<ReturnType<typeof auth.listUsers>>['users']=[];
  let token:string|undefined;
  do{
    const page=await auth.listUsers(1000,token);
    all.push(...page.users);
    token=page.pageToken;
  }while(token);
  const anonymous=all.filter(u=>!u.email&&!u.phoneNumber&&u.providerData.length===0);
  const known=new Set(anonymous.map(u=>u.uid));
  const hits=new Map<string,{path:string;field:string}[]>();
  const inventory:{path:string;documents:number;truncated:boolean}[]=[];
  for(const path of paths){
    // A capped query protects Cloud costs. Never infer zero references from an incomplete query.
    const snapshot=await db.collection(path).limit(2500).get();
    const truncated=snapshot.size===2500;
    inventory.push({path,documents:snapshot.size,truncated});
    for(const doc of snapshot.docs){
      const data=doc.data();
      // Check the document ID as well as recursively checking explicitly stored UIDs.
      if(known.has(doc.id)){
        const prev=hits.get(doc.id)||[];
        prev.push({path:path+'/'+doc.id,field:'document ID'});
        hits.set(doc.id,prev);
      }
      const refs=findReferences(data,known);
      for(const {uid,field} of refs){
        const prev=hits.get(uid)||[];
        if(!prev.some(v=>v.path===path+'/'+doc.id&&v.field===field))
          prev.push({path:path+'/'+doc.id,field});
        hits.set(uid,prev);
      }
    }
  }
  console.log('=== READ-ONLY CLOCKING IDENTITY CROSSCHECK ===');
  console.log('AUTH ACCOUNTS:',all.length,'ANONYMOUS:',anonymous.length,'EMAIL/OTHER:',all.length-anonymous.length);
  for(const item of inventory)
    console.log('SCANNED:',item.path,'DOCUMENTS:',item.documents,'CAPPED:',item.truncated);
  console.log('ANONYMOUS UIDS FOUND IN SCANNED DATA:',hits.size);
  for(const [uid,where] of hits)
    console.log('FOUND UID:',uid,'REFERENCES:',JSON.stringify(where.slice(0,12)));
  const recently=anonymous.slice().sort((a,b)=>Date.parse(b.metadata.lastSignInTime||'')-Date.parse(a.metadata.lastSignInTime||'')).slice(0,12);
  console.log('LATEST 12 ANONYMOUS SIGN-INS (NOT PROOF OF TABLET IDENTITY):');
  for(const u of recently)
    console.log('CANDIDATE:',u.uid,'LAST SIGN-IN:',u.metadata.lastSignInTime,'CREATED:',u.metadata.creationTime);
  console.log('WARNING: No matching Firestore UID does NOT mean a user is safe to delete.');
  console.log('WARNING: Employee shift writes may not store authentication UID at all.');
  console.log('WARNING: Offline-only tablet records are not visible to this script.');
  console.log('NO ACCOUNT, RECORD, SECURITY RULE OR DEPLOYMENT WAS MODIFIED.');
}
main().catch(error=>{console.error('READ-ONLY AUDIT FAILED:',error instanceof Error?error.message:String(error));process.exitCode=1;});
