/** Operator migration, dry run by default. --inspect is read-only. --apply is a separately approved cutover action. */
import { randomUUID,createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Firestore } from 'firebase-admin/firestore';
import { GoogleAuth,OAuth2Client } from 'google-auth-library';
import { managementNamespace, cleanManagementProfile } from '../src/services/managementContract';
import { ManagementStore } from '../server/management/managementStore';
import { ManagementService } from '../server/management/managementService';
import { effectiveManagementPermissions,normalizeEmail,validateProfile,type ManagementRecord } from '../server/management/managementPolicy';
import {FirestoreMigrationPort,documentVersion} from '../server/management/firestoreMigrationPort';
import {runManagementMigration,inspectManagementMigration,type MigrationManifest} from '../server/management/managementMigration';
const arg=(key:string)=>process.argv.find(v=>v.startsWith('--'+key+'='))?.slice(key.length+3)||'';
const stable=(value:any):any=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const accessFlags=(value:any,prefix=''):string[]=>value&&typeof value==='object'
  ?Object.entries(value).flatMap(([key,entry])=>typeof entry==='boolean'?[prefix+key+'='+entry]:accessFlags(entry,prefix+key+'.')).sort():[];
async function main(){
  const namespace=managementNamespace(arg('namespace')||'timbersmith-terminal-v1');
  const owner=normalizeEmail(arg('owner-email'));
  const repair=arg('repair-user');
  if(!repair&&(!owner||!owner.includes('@')))throw new Error('Explicit reviewed owner email required.');
  const apply=process.argv.includes('--apply'),inspect=process.argv.includes('--inspect');
  if(!apply&&!inspect){console.log('DRY RUN: valid migration configuration. No credentials, Firebase access or writes.');return;}
  if(apply&&process.env.TSJ_MANAGEMENT_OWNER_REVIEWED!=='I_REVIEWED_IDENTITIES_AND_CUTOVER')throw new Error('Explicit owner review and separate cutover approval required.');
  if(apply&&!arg('manifest')&&!repair)throw new Error('A versioned reviewed manifest is required. Legacy bulk apply is disabled.');
  // Use the intended gcloud credential flow; never read or print credential files/tokens.
  process.env.GOOGLE_CLOUD_QUOTA_PROJECT='timbersmithapp';
  const getAccessToken=async()=>{
    const command=process.platform==='win32'?(process.env.ComSpec||'cmd.exe'):'gcloud';
    const args=process.platform==='win32'?['/d','/s','/c','gcloud auth print-access-token --account=elrico@tsjoinery.co.za --quiet']:
      ['auth','print-access-token','--account=elrico@tsjoinery.co.za','--quiet'];
    return {access_token:execFileSync(command,args,{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim(),expires_in:3000};
  };
  const app=initializeApp({projectId:'timbersmithapp',credential:{getAccessToken},
    serviceAccountId:'firebase-adminsdk-fbsvc@timbersmithapp.iam.gserviceaccount.com'},'tsj-management-migration-'+randomUUID());
  const oauth=new OAuth2Client();
  oauth.quotaProjectId='timbersmithapp';
  oauth.setCredentials({access_token:(await getAccessToken()).access_token,expiry_date:Date.now()+3000_000});
  oauth.refreshHandler=async()=>({access_token:(await getAccessToken()).access_token,expiry_date:Date.now()+3000_000});
  const operatorAuth=new GoogleAuth({authClient:oauth,projectId:'timbersmithapp'});
  const data=new Firestore({projectId:'timbersmithapp',databaseId:'(default)',auth:operatorAuth}),
    registry=new Firestore({projectId:'timbersmithapp',databaseId:'tsj-clock-registry',auth:operatorAuth}),auth=getAuth(app);
  const store=new ManagementStore(data,registry,namespace),service=new ManagementService(store,auth);
  if(arg('manifest')){
    const manifest=JSON.parse(readFileSync(arg('manifest'),'utf8')) as MigrationManifest;
    if(manifest.namespace!==namespace||normalizeEmail(manifest.ownerEmail)!==owner)throw new Error('Manifest target/owner mismatch.');
    const port=new FirestoreMigrationPort(store,service);
    console.log(JSON.stringify(apply?await runManagementMigration(manifest,port):await inspectManagementMigration(manifest,port)));
    return;
  }
  if(repair){
    const record=await store.read(repair);if(!record)throw new Error('Protected user not found.');
    const migration=(record as typeof record&{migrationDigest?:string}).migrationDigest;
    if(apply&&migration&&(await store.realm.collection('migration_jobs').doc(migration).get()).data()?.complete!==true)
      throw new Error('Resume the original cohort manifest; individual repair cannot bypass migration source guards.');
    console.log(JSON.stringify({mode:apply?'APPROVED_RECOVERY':'READ_ONLY_RECOVERY_INSPECTION',namespace,projection:record.projection,version:record.version}));
    if(apply)await store.repair(repair,r=>service.ensureIdentity(r.firebaseUid,r.profile.email));
    return;
  }
  const source=store.root.collection('private').doc('users');
  const [active,pending,overrides]=await Promise.all([source.collection('active').get(),source.collection('pending').get(),data.collection('userPermissionOverrides').get()]);
  const all=[...active.docs.map(d=>({doc:d,pending:false})),...pending.docs.map(d=>({doc:d,pending:true}))];
  if(process.argv.includes('--review-report')){
    if(apply)throw new Error('Review report is inspection-only.');
    const directory=new URL('../.local/',import.meta.url);mkdirSync(directory,{recursive:true});
    const report=all.map(({doc,pending})=>{
      const raw=doc.data(),email=normalizeEmail(raw.email),profile=cleanManagementProfile(raw,doc.id);
      return {id:doc.id,email,name:raw.name||'',role:raw.role||'',pending,active:raw.active,isApproved:raw.isApproved,
        createdAt:typeof raw.createdAt==='string'?raw.createdAt:null,
        credentialAgreement:all.filter(item=>normalizeEmail(item.doc.data().email)===email)
          .every(item=>String(item.doc.data().pin||'').trim()===String(raw.pin||'').trim()),
        duplicateEmailCount:all.filter(item=>normalizeEmail(item.doc.data().email)===email).length,
        profilePermissions:effectiveManagementPermissions(profile),
        overrideCandidates:overrides.docs.filter(d=>d.data().userId===doc.id||normalizeEmail(d.data().userEmail)===email)
          .map(d=>({id:d.id,userId:typeof d.data().userId==='string'?d.data().userId:'',
            updatedAt:typeof d.data().updatedAt==='string'?d.data().updatedAt:null,
            accessFingerprint:createHash('sha256').update(JSON.stringify(stable({
              deviceAccess:d.data().deviceAccess||raw.deviceAccess||null,
              deviceViewAccess:d.data().deviceViewAccess||raw.deviceViewAccess||null}))).digest('hex'),
            accessFlags:accessFlags({deviceAccess:d.data().deviceAccess||raw.deviceAccess||null,
              deviceViewAccess:d.data().deviceViewAccess||raw.deviceViewAccess||null}),
            effectivePermissions:effectiveManagementPermissions(profile,d.data())}))};
    });
    const target=new URL('management-migration-review.json',directory);
    writeFileSync(target,JSON.stringify({generatedAt:new Date().toISOString(),namespace,containsCredentials:false,
      sourceVersions:all.map(item=>({id:item.doc.id,state:item.pending?'pending':'active',version:documentVersion(item.doc)})),
      overrideVersions:overrides.docs.map(doc=>({id:doc.id,version:documentVersion(doc)})),
      warning:'Read-only candidates. Nothing selected, merged, deleted or migrated.',profiles:report},null,2));
    console.log('Local review report (excluded from Git): '+fileURLToPath(target));
  }
  const emails=new Set<string>(),records:ManagementRecord[]=[];
  let owners=0,missingPasswords=0,authBindings=0,conflictingOverrides=0,duplicateEmails=0,existingProtectedRecords=0;
  for(const item of all){
    const raw=item.doc.data(),email=normalizeEmail(raw.email);
    if(!email||emails.has(email)){duplicateEmails++;continue;}emails.add(email);
    if((await store.read(item.doc.id))){existingProtectedRecords++;continue;}
    const pin=typeof raw.pin==='string'?raw.pin:'';if(pin.trim().length<4){missingPasswords++;continue;}
    const profile=validateProfile({...cleanManagementProfile(raw,item.doc.id),pin,name:raw.name||[raw.firstName,raw.lastName].filter(Boolean).join(' '),
      role:raw.role||'Employee',active:!item.pending&&raw.active!==false,isApproved:!item.pending&&raw.isApproved!==false,
      status:item.pending?'pending':raw.active===false?'inactive':'active',createdAt:raw.createdAt||new Date().toISOString()},item.doc.id);
    let uid='tsjm-'+randomUUID();
    try{const identity=await auth.getUserByEmail(email);uid=identity.uid;authBindings++;}catch(error:any){if(error?.code!=='auth/user-not-found')throw error;}
    const isOwner=email===owner;if(isOwner){if(item.pending||!profile.active||!profile.isApproved)throw new Error('Reviewed owner must be active and approved.');owners++;}
    const matches=overrides.docs.filter(d=>d.data().userId===profile.id||normalizeEmail(d.data().userEmail)===email);
    if(matches.length>1){conflictingOverrides++;continue;}
    records.push({id:profile.id,firebaseUid:uid,profile,password:{scheme:'scrypt-v1',salt:'not-issued',hash:'not-issued'},
      permissions:effectiveManagementPermissions(profile,matches[0]?.data()),owner:isOwner,version:1,aliases:[]});
  }
  const blocked=owners!==1||missingPasswords>0||conflictingOverrides>0||duplicateEmails>0||existingProtectedRecords>0;
  console.log(JSON.stringify({mode:apply?'APPLY_APPROVED_CUTOVER':'READ_ONLY_INSPECTION',namespace,profiles:records.length,
    activeProfiles:active.size,pendingProfiles:pending.size,existingAuthBindings:authBindings,reviewedOwners:owners,
    missingPasswords,conflictingOverrides,duplicateEmails,existingProtectedRecords,migrationBlocked:blocked,
    sourcePasswordsPrinted:false,changesAlreadyMade:false}));
}
main().catch(error=>{console.error('Management migration stopped:',error instanceof Error?error.message:'Unknown migration error.');process.exitCode=1;});
