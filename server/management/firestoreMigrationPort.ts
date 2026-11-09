import {indexKey} from './managementPolicy';
import {cleanManagementProfile} from '../../src/services/managementContract';
import {employeeView} from '../../src/services/employeeView';
import {ManagementService} from './managementService';
import {ManagementStore,type StoredManagementRecord} from './managementStore';
import {stableMigrationJson,type MigrationPort,type MigrationJob,type MigrationSource,type MigratedRecord} from './managementMigration';
export const documentVersion=(snapshot:{updateTime?:{seconds:number;nanoseconds:number}})=>
  snapshot.updateTime?snapshot.updateTime.seconds+':'+snapshot.updateTime.nanoseconds:'';
export class FirestoreMigrationPort implements MigrationPort {
  readonly namespace:string;
  constructor(readonly store:ManagementStore,readonly service:ManagementService){this.namespace=store.namespace;}
  job(digest:string){return this.store.realm.collection('migration_jobs').doc(digest);}
  receipt(digest:string){return this.store.root.collection('private').doc('audit').collection('logs').doc('management-migration-'+digest);}
  async readSources():Promise<MigrationSource[]>{
    const result:MigrationSource[]=[];
    for(const state of ['active','pending'] as const){const snap=await this.store.root.collection('private').doc('users').collection(state).get();
      for(const d of snap.docs)result.push({id:d.id,state,version:documentVersion(d),data:d.data()});}
    return result;
  }
  async readOverrides(){const snap=await this.store.data.collection('userPermissionOverrides').get();
    return snap.docs.map(d=>({id:d.id,version:documentVersion(d),data:d.data()}));}
  async bindUid(email:string){
    try{const u=await this.service.auth.getUserByEmail(email);if(u.disabled)throw new Error('Auth identity is disabled; owner review required.');return u.uid;}
    catch(error:any){if(error?.code!=='auth/user-not-found')throw error;return 'tsjm-'+indexKey(this.namespace+':'+email).slice(0,40);}
  }
  async readJob(digest:string){const snap=await this.job(digest).get();return snap.exists?snap.data() as MigrationJob:null;}
  async stageJob(job:MigrationJob){
    if(Buffer.byteLength(JSON.stringify(job))>800000)throw new Error('Cohort too large; review a partitioned migration.');
    await this.store.registry.runTransaction(async tx=>{
      const previous=await tx.get(this.job(job.digest));
      if(previous.exists)throw new Error('Migration already staged; retry with its existing checkpoint.');
      for(const record of job.records)if((await tx.get(this.store.user(record.id))).exists)throw new Error('Protected user already exists; stop before any migration writes.');
      tx.create(this.job(job.digest),job);
    });
  }
  readUser(id:string){return this.store.read(id);}
  async saveUser(record:MigratedRecord){await this.store.save(record,null,'verified-migration-operator',undefined,
    ()=>this.service.ensureIdentity(record.firebaseUid,record.profile.email),{version:record.migrationSourceVersion,state:record.migrationSourceState,override:record.migrationOverride});}
  async repairUser(record:MigratedRecord){await this.store.repair(record.id,
    r=>this.service.ensureIdentity(r.firebaseUid,r.profile.email),{version:record.migrationSourceVersion,state:record.migrationSourceState,override:record.migrationOverride});}
  async assertProjection(record:StoredManagementRecord){const access=await this.store.access(record.firebaseUid).get();
    if(record.projection!=='ready'||stableMigrationJson(access.data())!==stableMigrationJson(this.store.acl(record)))throw new Error('Projection incomplete or changed.');}
  async finishIfCommitted(job:MigrationJob){
    const receipt=await this.receipt(job.digest).get();if(!receipt.exists)return false;
    if(receipt.data()?.migrationDigest!==job.digest)throw new Error('Migration receipt mismatch.');
    await this.job(job.digest).update({complete:true});return true;
  }
  async finalize(job:MigrationJob){
    if(job.manifest.sources.length>200)throw new Error('Too many legacy records for one reviewed transaction.');
    await this.store.data.runTransaction(async tx=>{
      const receipt=await tx.get(this.receipt(job.digest));
      if(receipt.exists){if(receipt.data()?.migrationDigest!==job.digest)throw new Error('Receipt collision.');return;}
      const current:MigrationSource[]=[];
      for(const state of ['active','pending'] as const){const snap=await tx.get(this.store.root.collection('private').doc('users').collection(state));
        for(const d of snap.docs)current.push({id:d.id,state,version:documentVersion(d),data:d.data()});}
      if(current.length!==job.manifest.sources.length)throw new Error('A user was added/removed before retirement. Stop and review.');
      const overrides=await tx.get(this.store.data.collection('userPermissionOverrides'));
      const actualOverrideVersions=overrides.docs.map(d=>d.id+'/'+documentVersion(d)).sort();
      if(stableMigrationJson(actualOverrideVersions)!==stableMigrationJson(job.manifest.overrides.map(d=>d.id+'/'+d.version).sort()))throw new Error('Permissions changed before retirement.');
      for(const source of current){
        const expected=job.manifest.sources.find(s=>s.id===source.id&&s.state===source.state);
        if(!expected)throw new Error('Unreviewed source record.');
        const record=job.records.find(r=>r.id===source.id);
        if(record){
          if(stableMigrationJson(cleanManagementProfile(source.data,source.id))!==stableMigrationJson(cleanManagementProfile(this.store.view(record),record.id)))throw new Error('Projected profile changed before retirement.');
        }else if(source.version!==expected.version)throw new Error('Legacy record changed; do not discard it.');
      }
      for(const record of job.records){const access=await tx.get(this.store.access(record.firebaseUid));
        if(stableMigrationJson(access.data())!==stableMigrationJson(this.store.acl(record)))throw new Error('Account access changed before retirement.');}
      const employees=await tx.get(this.store.root.collection('public').doc('data').collection('employees'));
      const metadata:Array<{kind:string;documents:Array<{id:string;data:Record<string,any>}>}>=[];
      for(const kind of ['roles','rolePermissions']){
        const source=await tx.get(this.store.data.collection(kind));
        const scoped=await tx.get(this.store.root.collection('public').doc(kind).collection('items'));
        const existing=new Set(scoped.docs.map(d=>d.id));
        metadata.push({kind,documents:source.docs.filter(d=>!existing.has(d.id)).map(d=>({id:d.id,data:d.data()}))});
      }
      if(job.retired.length+employees.size+metadata.reduce((n,m)=>n+m.documents.length,0)+job.records.length*2+1>450)
        throw new Error('Projection cohort is too large for one transaction; partition it before cutover.');
      // All reads precede writes. Old IDs, sanitized profiles and salted credential digests
      // are preserved in the protected checkpoint; historical business references are not rewritten.
      for(const retired of job.retired)tx.delete(this.store.profile(retired.id,retired.state==='pending'));
      for(const employee of employees.docs)tx.set(this.store.root.collection('public').doc('data').collection('employeeViews').doc(employee.id),employeeView({...employee.data(),id:employee.id}));
      for(const item of metadata){
        const allowed=item.kind==='roles'?['id','roleName','description','status','createdAt','updatedAt','isSystemDefault']:['roleId','roleName','permissions','updatedAt','updatedBy'];
        for(const document of item.documents)tx.set(this.store.root.collection('public').doc(item.kind).collection('items').doc(document.id),
          Object.fromEntries(allowed.filter(key=>document.data[key]!==undefined).map(key=>[key,document.data[key]])));
      }
      for(const record of job.records){
        tx.set(this.store.root.collection('private').doc('permissions').collection('items').doc(record.id),{
          userId:record.id,userEmail:record.profile.email,permissions:record.permissions,
          ...(record.profile.deviceAccess?{deviceAccess:record.profile.deviceAccess}:{}),
          ...(record.profile.deviceViewAccess?{deviceViewAccess:record.profile.deviceViewAccess}:{})});
        tx.set(this.store.root.collection('public').doc('userRoles').collection('items').doc(record.id),{
          userId:record.id,userName:record.profile.name,userEmail:record.profile.email,roleId:record.profile.roleId||'',roleName:record.profile.role});
      }
      tx.create(this.receipt(job.digest),{event:'MANAGEMENT_MIGRATION_COMMITTED',migrationDigest:job.digest,
        accounts:job.records.length,retired:job.retired.length,actorId:'verified-migration-operator',timestamp:new Date().toISOString()});
    });
    await this.job(job.digest).update({complete:true});
  }
}
