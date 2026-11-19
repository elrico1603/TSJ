import { getServerFirestore, getFirebaseAdminApp } from '../server/firebaseAdmin';
import { LEGACY_TARGETS } from '../server/legacyUserMigration';
import { USER_PROFILES_COLLECTION } from '../server/firebaseIdentityService';

const ROOT='artifacts/timbersmith-terminal-v1/public';
async function main(){
  if(getFirebaseAdminApp().options.projectId!=='timbersmithapp')throw new Error('Expected production TimberSmith project.');
  const db=getServerFirestore();
  const paths=['roles',ROOT+'/roles/items','branches',ROOT+'/branches/items','userRoles',ROOT+'/userRoles/items',USER_PROFILES_COLLECTION];
  const snapshots=await Promise.all(paths.map(path=>db.collection(path).get()));
  const data=Object.fromEntries(paths.map((path,i)=>[path,snapshots[i].docs]));
  const targets=new Set(LEGACY_TARGETS.map(t=>t.email));
  const knownIds=new Set(LEGACY_TARGETS.flatMap(t=>[t.profileId,...t.knownDuplicateIds]));
  const email=(v:unknown)=>typeof v==='string'?v.trim().toLowerCase():'';
  const fields=(d:Record<string,any>,keys:string[])=>Object.fromEntries(keys.filter(k=>d[k]!==undefined).map(k=>[k,d[k]]));
  for(const path of paths){
    const docs=data[path];
    let keys:string[];
    let selected=docs;
    if(path==='roles'||path.endsWith('/roles/items')) keys=['id','roleName','status','active'];
    else if(path==='branches'||path.endsWith('/branches/items')) keys=['id','branchCode','branchName','status','active'];
    else if(path===USER_PROFILES_COLLECTION){
      keys=['id','email','name','role','roleId','branchId','branchName','active','isApproved','firebaseUid'];
      selected=docs.filter(d=>knownIds.has(d.id)||targets.has(email(d.data().email)));
    }else{
      keys=['userId','userEmail','userName','roleId','roleName'];
      selected=docs.filter(d=>knownIds.has(d.id)||knownIds.has(String(d.data().userId))||
        targets.has(email(d.id))||targets.has(email(d.data().userEmail)));
    }
    console.log('\n=== '+path+' ('+selected.length+' matching / '+docs.length+' total) ===');
    for(const doc of selected) console.log(JSON.stringify({documentId:doc.id,...fields(doc.data(),keys)}));
  }
  console.log('\nREAD ONLY. No passwords, PINs, tokens or employee records included.');
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Configuration audit failed');process.exitCode=1;});
