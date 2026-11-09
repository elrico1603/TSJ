/** Operator-only cohort migration. No environment access or browser entry point. */
import {createHash} from 'node:crypto';
import {cleanManagementProfile,managementNamespace} from '../../src/services/managementContract';
import {effectiveManagementPermissions,normalizeEmail,passwordDigest,validateProfile,type ManagementRecord} from './managementPolicy';
import type {StoredManagementRecord} from './managementStore';
export type MigrationSource={id:string;state:'active'|'pending';version:string;data:Record<string,any>};
export type MigrationOverride={id:string;version:string;data:Record<string,any>};
export type MigrationChoice={email:string;sourceId:string;permissionSourceId:string|null;include:boolean};
export type MigrationManifest={schema:1;namespace:string;ownerEmail:string;
  sources:Array<Omit<MigrationSource,'data'>>;overrides:Array<Omit<MigrationOverride,'data'>>;choices:MigrationChoice[]};
export type MigratedRecord=ManagementRecord&{migrationDigest:string;migrationSourceVersion:string;migrationSourceState:'active'|'pending';migrationOverride?:{id:string;version:string}};
export type MigrationJob={digest:string;manifest:MigrationManifest;records:MigratedRecord[];
  retired:Array<{id:string;state:'active'|'pending';sourceVersion:string;canonicalId:string|null;profile:ReturnType<typeof cleanManagementProfile>;password:Awaited<ReturnType<typeof passwordDigest>>}>;
  complete:boolean};
export const stableMigrationJson=(value:any):string=>JSON.stringify(sort(value));
function sort(value:any):any{return Array.isArray(value)?value.map(sort):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(k=>[k,sort(value[k])])):value;}
export const migrationDigest=(manifest:MigrationManifest)=>createHash('sha256').update(stableMigrationJson(manifest)).digest('hex');
export interface MigrationPort {
  namespace:string;
  readSources():Promise<MigrationSource[]>;
  readOverrides():Promise<MigrationOverride[]>;
  bindUid(email:string):Promise<string>;
  readJob(digest:string):Promise<MigrationJob|null>;
  stageJob(job:MigrationJob):Promise<void>;
  readUser(id:string):Promise<StoredManagementRecord|null>;
  saveUser(record:MigratedRecord):Promise<void>;
  repairUser(record:MigratedRecord):Promise<void>;
  assertProjection(record:StoredManagementRecord):Promise<void>;
  finishIfCommitted(job:MigrationJob):Promise<boolean>;
  /** Must transactionally recheck all sources/ACLs; retire old projections and write audit once. */
  finalize(job:MigrationJob):Promise<void>;
}
function sameVersions(actual:Array<{id:string;state?:string;version:string}>,expected:Array<{id:string;state?:string;version:string}>){
  const keys=(rows:typeof actual)=>rows.map(r=>[r.state||'',r.id,r.version].join('/')).sort();
  return stableMigrationJson(keys(actual))===stableMigrationJson(keys(expected));
}
function validateManifest(manifest:MigrationManifest,namespace:string){
  if(manifest.schema!==1||managementNamespace(manifest.namespace)!==namespace||!Array.isArray(manifest.sources)||
    !Array.isArray(manifest.overrides)||!Array.isArray(manifest.choices)||manifest.choices.length>100)throw new Error('Invalid migration manifest.');
  const ids=manifest.sources.map(s=>s.state+'/'+s.id),emails=manifest.choices.map(c=>normalizeEmail(c.email));
  if(new Set(ids).size!==ids.length||new Set(manifest.sources.map(s=>s.id)).size!==ids.length||new Set(emails).size!==emails.length||manifest.choices.some(c=>typeof c.include!=='boolean'))throw new Error('Duplicate or invalid migration choices.');
  if(!manifest.choices.some(c=>c.include&&c.email===normalizeEmail(manifest.ownerEmail)))throw new Error('Reviewed owner must be included.');
  if(manifest.sources.some(s=>!s.version||!/^[A-Za-z0-9_-]{1,128}$/.test(s.id)||!['active','pending'].includes(s.state))||
    manifest.overrides.some(o=>!o.version||!/^[A-Za-z0-9_@.+-]{1,254}$/.test(o.id)))throw new Error('Invalid source identifiers or versions.');
}
async function prepareJob(manifest:MigrationManifest,port:MigrationPort):Promise<MigrationJob>{
  const [sources,overrides]=await Promise.all([port.readSources(),port.readOverrides()]);
  if(!sameVersions(sources,manifest.sources)||!sameVersions(overrides,manifest.overrides))throw new Error('Source changed or a user was added. Refresh and review the manifest.');
  const digest=migrationDigest(manifest),records:MigratedRecord[]=[],retired:MigrationJob['retired']=[];
  const groups=[...new Set(sources.map(s=>normalizeEmail(s.data.email)))];
  if(groups.length!==manifest.choices.length||groups.some(email=>!manifest.choices.some(c=>c.email===email)))throw new Error('Every source email requires exactly one explicit choice.');
  // Complete validation of every choice before hashing, staging, Auth creation or projection writes.
  const validated=manifest.choices.map(choice=>{
    if(choice.email!==normalizeEmail(choice.email))throw new Error('Manifest email must be normalized.');
    const group=sources.filter(s=>normalizeEmail(s.data.email)===choice.email);
    const source=group.find(s=>s.id===choice.sourceId);if(!source)throw new Error('Selected credential/profile belongs to another identity.');
    const override=choice.permissionSourceId===null?undefined:overrides.find(o=>o.id===choice.permissionSourceId);
    if(choice.permissionSourceId!==null&&!override)throw new Error('Selected permission source is missing.');
    if(override&&((override.data.userId&&override.data.userId!==source.id)||
      (override.data.userEmail&&normalizeEmail(override.data.userEmail)!==choice.email)))throw new Error('Permission binding mismatch.');
    if(choice.include&&(source.state!=='active'||source.data.active===false||source.data.isApproved===false||
      source.data.status!==undefined&&source.data.status!=='active'))throw new Error('Cannot silently enable a pending or disabled account.');
    for(const item of group)if(typeof item.data.pin!=='string'||item.data.pin.trim().length<4)throw new Error('Invalid source credentials; no automatic reset.');
    const raw=source.data;
    const profile=validateProfile({...cleanManagementProfile(raw,source.id),
      name:raw.name||[raw.firstName,raw.lastName].filter(Boolean).join(' '),role:raw.role||'Employee',
      active:raw.active!==false,isApproved:raw.isApproved!==false,status:raw.active===false?'inactive':'active',
      ...(override?.data.deviceAccess?{deviceAccess:override.data.deviceAccess}:{}),
      ...(override?.data.deviceViewAccess?{deviceViewAccess:override.data.deviceViewAccess}:{})},source.id);
    return {choice,group,source,override,profile};
  });
  for(const {choice,group,source,override,profile} of validated){
    if(choice.include){
      const firebaseUid=await port.bindUid(choice.email);
      if(!/^[A-Za-z0-9_-]{1,128}$/.test(firebaseUid)||records.some(r=>r.firebaseUid===firebaseUid))throw new Error('Invalid or reused Auth UID.');
      records.push({id:source.id,firebaseUid,profile,password:await passwordDigest(source.data.pin),
        permissions:effectiveManagementPermissions(profile,override?.data),owner:choice.email===normalizeEmail(manifest.ownerEmail),version:1,aliases:[],migrationDigest:digest,
        migrationSourceVersion:source.version,migrationSourceState:source.state,...(override?{migrationOverride:{id:override.id,version:override.version}}:{})});
    }
    for(const item of group.filter(s=>!choice.include||s.id!==source.id))retired.push({id:item.id,state:item.state,sourceVersion:item.version,
      canonicalId:choice.include?source.id:null,profile:cleanManagementProfile(item.data,item.id),password:await passwordDigest(item.data.pin)});
  }
  return {digest,manifest,records,retired,complete:false};
}
export async function inspectManagementMigration(manifest:MigrationManifest,port:MigrationPort){
  validateManifest(manifest,port.namespace);
  const existing=await port.readJob(migrationDigest(manifest));
  const job=existing||await prepareJob(manifest,port);
  return {mode:'READ_ONLY_MANIFEST_CHECK',accounts:job.records.length,retired:job.retired.length,
    checkpointExists:!!existing,complete:job.complete,credentialValuesPrinted:false,writes:false};
}
/** A durable hashed checkpoint precedes all changes; retry never reimports public credentials. */
export async function runManagementMigration(manifest:MigrationManifest,port:MigrationPort){
  validateManifest(manifest,port.namespace);
  const digest=migrationDigest(manifest);
  let job=await port.readJob(digest);
  if(job&&(job.digest!==digest||stableMigrationJson(job.manifest)!==stableMigrationJson(manifest)))throw new Error('Checkpoint/manifest mismatch.');
  if(job?.complete)return {accounts:job.records.length,retired:job.retired.length,resumed:true,complete:true};
  const resumed=!!job;
  if(!job){job=await prepareJob(manifest,port);await port.stageJob(job);}
  if(await port.finishIfCommitted(job))return {accounts:job.records.length,retired:job.retired.length,resumed:true,complete:true};
  // Recheck on every retry. Only projections written by this exact migration may differ.
  const [current,overrides]=await Promise.all([port.readSources(),port.readOverrides()]);
  if(!sameVersions(overrides,manifest.overrides)||current.length!==manifest.sources.length)throw new Error('Migration sources changed. Stop for review.');
  for(const expected of manifest.sources){
    const source=current.find(s=>s.id===expected.id&&s.state===expected.state);
    if(!source)throw new Error('Source disappeared during migration.');
    if(source.version===expected.version)continue;
    const record=await port.readUser(source.id);
    const staged=job.records.find(r=>r.id===source.id);
    if(!record||!staged||(record as StoredManagementRecord&{migrationDigest?:string}).migrationDigest!==digest||record.version!==1||
      stableMigrationJson(record.profile)!==stableMigrationJson(staged.profile)||
      stableMigrationJson(cleanManagementProfile(source.data,source.id))!==stableMigrationJson({...staged.profile,userPermissions:staged.permissions}))throw new Error('Live profile changed outside this migration.');
  }
  for(const record of job.records){
    const currentUser=await port.readUser(record.id);
    if(!currentUser)await port.saveUser(record);
    else {
      if((currentUser as StoredManagementRecord&{migrationDigest?:string}).migrationDigest!==digest||currentUser.version!==record.version||
        currentUser.firebaseUid!==record.firebaseUid||stableMigrationJson(currentUser.password)!==stableMigrationJson(record.password)||
        stableMigrationJson(currentUser.profile)!==stableMigrationJson(record.profile)||stableMigrationJson(currentUser.permissions)!==stableMigrationJson(record.permissions))throw new Error('Protected account changed; never overwrite it from legacy data.');
      if(currentUser.projection==='pending')await port.repairUser(record);
      else await port.assertProjection(currentUser);
    }
  }
  await port.finalize(job);
  return {accounts:job.records.length,retired:job.retired.length,resumed,complete:true};
}
