import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp, getServerFirestore } from '../server/firebaseAdmin';
import { LEGACY_TARGETS, LegacyUserMigration } from '../server/legacyUserMigration';

// Factory identity preparation: no Netlify or employee Clocking deployment.
// Do NOT include Stock, Sidwell, or Clocking in this cutover list.
const TARGETS=LEGACY_TARGETS.filter(t=>[
  'elrico@tsjoinery.co.za','frans@tsjoinery.co.za',
  'janah@tsjoinery.co.za','marietjie@tsjoinery.co.za'
].includes(t.email));
const ROOT='artifacts/timbersmith-terminal-v1';
const COLLECTIONS=[
  'authUserLinks',ROOT+'/private/users/active','userPermissionOverrides',
  'userRoles',ROOT+'/public/userRoles/items',ROOT+'/private/config/notifications_policies'
];
const checksum=(value:string)=>createHash('sha256').update(value).digest('hex');
async function assertRulesAreNotOpen(){
  const token=execFileSync('gcloud',['auth','print-access-token','--quiet'],{encoding:'utf8'}).trim();
  if(!token)throw Error('Cannot verify active Firestore rules; stop.');
  const api='https://firebaserules.googleapis.com/v1/';
  const read=async(relative:string)=>{
    const response=await fetch(api+relative,{headers:{Authorization:'Bearer '+token}});
    if(!response.ok)throw Error('Cannot verify Firestore rules: HTTP '+response.status);
    return response.json() as Promise<any>;
  };
  const release=await read('projects/timbersmithapp/releases/cloud.firestore');
  const name=String(release.rulesetName||'');
  if(!name.startsWith('projects/timbersmithapp/rulesets/'))throw Error('Unrecognized Firestore ruleset.');
  const ruleset=await read(name);
  const rules=(ruleset.source?.files||[]).map((f:any)=>String(f.content||'')).join('\n');
  if(!rules||/allow\s+(read\s*,\s*write|write\s*,\s*read|read|write)\s*:\s*if\s+true\s*;/i.test(rules))
    throw Error('Unsafe Firestore rules: production migration blocked.');
  // This detects obvious open rules; a separate complete rules review is required.
}
async function snapshot(){
  const db=getServerFirestore(),auth=getAuth(getFirebaseAdminApp());
  const collections=await Promise.all(COLLECTIONS.map(async path=>{
    const docs=await db.collection(path).get();
    return {path,records:docs.docs.map(d=>({id:d.id,data:d.data()}))};
  }));
  const identities=await Promise.all(TARGETS.map(async target=>{
    const u=await auth.getUser(target.uid);
    if(u.email?.trim().toLowerCase()!==target.email||u.disabled)
      throw Error('Firebase Auth mismatch for '+target.email);
    return {uid:u.uid,email:u.email,displayName:u.displayName,disabled:u.disabled};
  }));
  const audits=[];
  const migration=new LegacyUserMigration(db,auth);
  for(const target of TARGETS) audits.push(await migration.migrate(target,false));
  return {project:'timbersmithapp',createdAt:new Date().toISOString(),targets:TARGETS.map(t=>t.uid),
    collections,identities,audits};
}
async function main(){
  if(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST||
     getFirebaseAdminApp().options.projectId!=='timbersmithapp')
    throw Error('Expected live TimberSmith project without emulator overrides.');
  const args=process.argv.slice(2);
  const apply=args.includes('--apply');
  if(args.some(arg=>arg!=='--apply'&&!arg.startsWith('--backup=')))
    throw Error('Unsupported argument. Use no arguments for read-only preflight.');
  const backupArg=args.find(arg=>arg.startsWith('--backup='));
  if(apply && (!backupArg||backupArg.slice(9).length===0))
    throw Error('Approved cutover requires an explicit private --backup= path.');
  const current=await snapshot();
  const serialized=JSON.stringify(current,null,2);
  const digest=checksum(serialized);
  console.log('READ-ONLY IDENTITIES CHECKED:',current.identities.map(x=>x.email).join(', '));
  console.log('Protected and unchanged: Clocking Terminal, Sidwell, Stock.');
  if(!apply){
    const backupDir=join(homedir(),'TSJ-Backups','identity-cutover');
    mkdirSync(backupDir,{recursive:true,mode:0o700});
    const file=join(backupDir,'identity-'+Date.now()+'.json');
    writeFileSync(file,serialized,{flag:'wx',mode:0o600});
    chmodSync(file,0o600);
    console.log('PRIVATE BACKUP:',file);
    console.log('SHA256:',digest);
    console.log('READ ONLY: no user account, Clocking, or Firestore rules changed.');
    console.log('BACKUP CONTAINS SENSITIVE USER DATA. Do not send or share its contents.');
    console.log('A full managed Firestore export and rollback plan are still required before live cutover.');
    return;
  }
  if(process.env.TSJ_USER_CUTOVER_APPROVAL!=='I_REVIEWED_BACKUP_AND_SECURITY')
    throw Error('Explicit production cutover approval missing.');
  await assertRulesAreNotOpen();
  const file=resolve(backupArg!.slice(9));
  if(!existsSync(file))throw Error('Private backup missing.');
  const prior=JSON.parse(readFileSync(file,'utf8'));
  if(prior.project!=='timbersmithapp'||JSON.stringify(prior.targets)!==JSON.stringify(current.targets)||
     checksum(JSON.stringify(prior.collections))!==checksum(JSON.stringify(current.collections))||
     checksum(JSON.stringify(prior.identities))!==checksum(JSON.stringify(current.identities)))
    throw Error('Data changed since private backup. Run a fresh read-only preflight.');
  const migration=new LegacyUserMigration(getServerFirestore(),getAuth(getFirebaseAdminApp()));
  for(const target of TARGETS){
    await migration.migrate(target,true,{approvedProductionCutover:true});
    console.log('MIGRATED:',target.email);
  }
  console.log('Cutover identity migration complete. Confirm actual login and device permission gates.');
}
main().catch(error=>{
  console.error(error instanceof Error?error.message:'Identity cutover preflight failed');
  process.exitCode=1;
});
