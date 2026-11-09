import assert from 'node:assert/strict';
import {runManagementMigration,stableMigrationJson,type MigrationJob,type MigrationManifest,type MigrationPort,type MigrationSource,type MigrationOverride,type MigratedRecord} from '../server/management/managementMigration';
import type {StoredManagementRecord} from '../server/management/managementStore';
import {passwordMatches} from '../server/management/managementPolicy';
import {MemoryManagementFirestore} from './fixtures/memory-management-firestore';
import {FirestoreMigrationPort} from '../server/management/firestoreMigrationPort';
import {ManagementStore} from '../server/management/managementStore';
import {ManagementService} from '../server/management/managementService';
import type {Firestore} from 'firebase-admin/firestore';
class FixturePort implements MigrationPort {
  namespace='timbersmith-management-test-migrate';sources:MigrationSource[]=[];overrides:MigrationOverride[]=[];
  job:MigrationJob|null=null;users=new Map<string,StoredManagementRecord>();receipt=false;writes=0;counter=0;
  fail:'pending'|'projected'|'receipt'|null=null;beforeSave:(()=>void)|null=null;
  readSources=async()=>structuredClone(this.sources);readOverrides=async()=>structuredClone(this.overrides);
  bindUid=async(email:string)=>'fixture-'+email.split('@')[0];
  readJob=async()=>structuredClone(this.job);
  stageJob=async(job:MigrationJob)=>{if(job.records.some(r=>this.users.has(r.id)))throw new Error('Protected account exists');this.job=structuredClone(job);this.writes++;};
  readUser=async(id:string)=>structuredClone(this.users.get(id)||null);
  project(record:MigratedRecord){
    const source=this.sources.find(s=>s.id===record.id)!;
    if(source.version!==record.migrationSourceVersion&&stableMigrationJson(source.data)!==stableMigrationJson({...record.profile,userPermissions:record.permissions,managementOwner:record.owner}))throw new Error('Source guard');
    source.data={...record.profile,userPermissions:record.permissions,managementOwner:record.owner};source.version='projected-'+(++this.counter);
    this.users.set(record.id,{...structuredClone(record),projection:'ready'});this.writes++;
  }
  saveUser=async(record:MigratedRecord)=>{
    this.beforeSave?.();this.users.set(record.id,{...structuredClone(record),projection:'pending'});this.writes++;
    if(this.fail==='pending'){this.fail=null;throw new Error('Simulated outage before projection');}
    this.project(record);if(this.fail==='projected'){this.fail=null;throw new Error('Simulated lost acknowledgement');}
  };
  repairUser=async(record:MigratedRecord)=>this.project(record);
  assertProjection=async(record:StoredManagementRecord)=>{assert.equal(record.projection,'ready');};
  finishIfCommitted=async()=>{if(!this.receipt)return false;this.job!.complete=true;return true;};
  finalize=async(job:MigrationJob)=>{
    this.sources=this.sources.filter(s=>!job.retired.some(r=>r.id===s.id&&r.state===s.state));this.receipt=true;this.writes++;
    if(this.fail==='receipt'){this.fail=null;throw new Error('Simulated lost final checkpoint');}
    this.job!.complete=true;
  };
}
function fixture(){
  const port=new FixturePort();
  const profile=(id:string,email:string,pin:string)=>({id,name:id,email,role:'Employee',pin,active:true,isApproved:true,status:'active',createdAt:'2026-01-01'});
  port.sources=[['owner','owner@example.invalid','fixture-owner'],['old-staff','staff@example.invalid','superseded-fixture'],
    ['staff','staff@example.invalid','current-fixture'],['unused','unused@example.invalid','unused-fixture']].map(([id,email,pin])=>({id,state:'active',version:'original-'+id,data:profile(id,email,pin)}));
  port.overrides=[{id:'staff-permissions',version:'override-v1',data:{userId:'staff',userEmail:'staff@example.invalid',permissions:{Inventory:{View:'allow',Edit:'deny'}},deviceAccess:{desktop:true,tablet:false}}}];
  const manifest:MigrationManifest={schema:1,namespace:port.namespace,ownerEmail:'owner@example.invalid',sources:port.sources.map(({data,...s})=>s),
    overrides:port.overrides.map(({data,...o})=>o),choices:[{email:'owner@example.invalid',sourceId:'owner',permissionSourceId:null,include:true},
      {email:'staff@example.invalid',sourceId:'staff',permissionSourceId:'staff-permissions',include:true},{email:'unused@example.invalid',sourceId:'unused',permissionSourceId:null,include:false}]};
  return {port,manifest};
}
let passed=0;
const test=async(name:string,run:()=>Promise<void>)=>{await run();console.log('PASS '+name);passed++;};
async function main(){
  await test('selected current PIN and ID survive; duplicate and unused source credentials are protected, never plaintext',async()=>{
    const {port,manifest}=fixture();const result=await runManagementMigration(manifest,port);
    assert.equal(result.accounts,2);assert.equal(result.retired,2);assert.deepEqual(port.sources.map(s=>s.id),['owner','staff']);
    const staff=port.users.get('staff')!;assert.equal(await passwordMatches('current-fixture',staff.password),true);assert.equal(await passwordMatches('superseded-fixture',staff.password),false);
    assert.equal(staff.permissions.Inventory.View,true);assert.equal(staff.permissions.Inventory.Edit,false);assert.equal(staff.profile.deviceAccess.tablet,false);
    assert.equal(stableMigrationJson(port.job).includes('current-fixture'),false);assert.equal(stableMigrationJson(port.job).includes('superseded-fixture'),false);
    assert.equal(port.job!.retired.find(r=>r.id==='old-staff')!.canonicalId,'staff');assert.equal(port.users.has('unused'),false);
  });
  await test('completed operation is idempotent and never resets a password or rewrites new users',async()=>{
    const {port,manifest}=fixture();await runManagementMigration(manifest,port);const writes=port.writes;
    port.sources.push({id:'later-user',state:'active',version:'later',data:{}});await runManagementMigration(manifest,port);assert.equal(port.writes,writes);
  });
  for(const failure of ['pending','projected','receipt'] as const)await test('resume after '+failure+' failure preserves the staged salted digest and completes once',async()=>{
    const {port,manifest}=fixture();port.fail=failure;await assert.rejects(()=>runManagementMigration(manifest,port));
    const digest=port.job!.records[0].password.hash;const result=await runManagementMigration(manifest,port);
    assert.equal(result.complete,true);assert.equal(result.resumed,true);assert.equal(port.users.get('owner')!.password.hash,digest);assert.equal(port.users.size,2);
  });
  await test('a newly added user blocks the stale manifest before staging or account writes',async()=>{
    const {port,manifest}=fixture();port.sources.push({id:'new-user',state:'active',version:'new',data:{}});
    await assert.rejects(()=>runManagementMigration(manifest,port),/Source changed/);assert.equal(port.writes,0);
  });
  await test('permission edits after an interrupted start block replay',async()=>{
    const {port,manifest}=fixture();port.fail='pending';await assert.rejects(()=>runManagementMigration(manifest,port));
    port.overrides[0].version='changed';await assert.rejects(()=>runManagementMigration(manifest,port),/sources changed/);
  });
  await test('a PIN edited immediately before projection is retained and never overwritten',async()=>{
    const {port,manifest}=fixture();port.beforeSave=()=>{port.sources[0].version='edited-concurrently';port.sources[0].data.pin='new-live-fixture';};
    await assert.rejects(()=>runManagementMigration(manifest,port),/Source guard/);assert.equal(port.sources[0].data.pin,'new-live-fixture');assert.equal(port.receipt,false);
  });
  await test('cross-account credential selection is refused before any writes',async()=>{
    const {port,manifest}=fixture();manifest.choices[1].sourceId='owner';await assert.rejects(()=>runManagementMigration(manifest,port));assert.equal(port.writes,0);
  });
  await test('permission records bound to another user cannot supply grants',async()=>{
    const {port,manifest}=fixture();port.overrides[0].data.userId='another-user';await assert.rejects(()=>runManagementMigration(manifest,port),/binding mismatch/);assert.equal(port.writes,0);
  });
  await test('owner exclusion is refused before any writes',async()=>{
    const {port,manifest}=fixture();manifest.choices[0].include=false;await assert.rejects(()=>runManagementMigration(manifest,port),/owner/);assert.equal(port.writes,0);
  });
  await test('a pre-existing protected account is never overwritten by legacy data',async()=>{
    const {port,manifest}=fixture();port.users.set('staff',{} as StoredManagementRecord);await assert.rejects(()=>runManagementMigration(manifest,port),/already|exists/i);assert.equal(port.writes,0);
  });
  await test('one Auth UID cannot be bound to two management accounts',async()=>{
    const {port,manifest}=fixture();port.bindUid=async()=> 'same-uid';await assert.rejects(()=>runManagementMigration(manifest,port),/reused Auth UID/);assert.equal(port.writes,0);
  });
  await test('real Firestore adapter, store and login enforce cohort completion, atomic retirement and restart recovery',async()=>{
    const fixtureData=fixture(),data=new MemoryManagementFirestore(),registry=new MemoryManagementFirestore();
    const store=new ManagementStore(data as unknown as Firestore,registry as unknown as Firestore,fixtureData.port.namespace);
    for(const source of fixtureData.port.sources)await store.profile(source.id).set(source.data);
    for(const override of fixtureData.port.overrides)await data.collection('userPermissionOverrides').doc(override.id).set(override.data);
    const identities=new Map<string,any>();
    const missing=()=>Object.assign(new Error('missing'),{code:'auth/user-not-found'});
    const auth:any={getUserByEmail:async(email:string)=>{const u=[...identities.values()].find(u=>u.email===email);if(!u)throw missing();return u;},
      getUser:async(uid:string)=>{const u=identities.get(uid);if(!u)throw missing();return u;},
      createUser:async(user:any)=>{identities.set(user.uid,user);return user;},createCustomToken:async()=> 'fictional-token'};
    const service=new ManagementService(store,auth),port=new FirestoreMigrationPort(store,service);
    const sources=await port.readSources(),overrides=await port.readOverrides();
    const manifest={...fixtureData.manifest,sources:sources.map(({data,...s})=>s),overrides:overrides.map(({data,...s})=>s)};
    data.failProjection=true;await assert.rejects(()=>runManagementMigration(manifest,port));data.failProjection=false;
    await assert.rejects(()=>service.login('owner','fixture-owner'),/migration is not complete/);
    await runManagementMigration(manifest,port);
    assert.equal((await service.login('owner','fixture-owner')).user.id,'owner');
    assert.equal((await service.login('staff','current-fixture')).user.id,'staff');
    await assert.rejects(()=>service.login('unused','unused-fixture'));
    assert.equal(data.records.has(store.profile('old-staff').path),false);assert.equal(data.records.has(store.profile('unused').path),false);
    assert.equal((await port.readSources()).length,2);assert.equal((await registry.collection(store.realm.path+'/migration_jobs').get()).size,1);
    await runManagementMigration(manifest,port);assert.equal(identities.size,2);
  });
  await test('real projection transaction preserves a concurrently edited PIN and fails closed',async()=>{
    const data=new MemoryManagementFirestore(),registry=new MemoryManagementFirestore(),ns='timbersmith-management-test-race';
    const store=new ManagementStore(data as unknown as Firestore,registry as unknown as Firestore,ns);
    const base=fixture().port.sources[0];await store.profile(base.id).set(base.data);
    const original=data.snapshot(store.profile(base.id).path).updateTime;
    const record:any={id:base.id,firebaseUid:'race-uid',profile:{...base.data,pin:''},password:{scheme:'scrypt-v1',salt:'fixture',hash:'fixture'},owner:true,version:1,permissions:{},aliases:[]};
    await store.profile(base.id).update({pin:'edited-live-fixture'});
    await assert.rejects(()=>store.save(record,null,'operator',undefined,undefined,{state:'active',version:original.seconds+':'+original.nanoseconds}),/Legacy profile changed/);
    assert.equal(data.records.get(store.profile(base.id).path).pin,'edited-live-fixture');
    assert.equal(data.records.get(store.access(record.firebaseUid).path).active,false);
  });
  console.log(`All ${passed} isolated migration checks passed. No Google/Firebase access.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
