import { randomUUID } from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import type { Firestore,DocumentReference } from 'firebase-admin/firestore';
import { cleanManagementProfile, managementNamespace, type ManagementAccess, type ManagementProfile } from '../../src/services/managementContract';
import { indexKey, loginAliases, ManagementDenied, type ManagementRecord } from './managementPolicy';

export type StoredManagementRecord=ManagementRecord & {projection:'ready'|'pending'};
export type MigrationProjectionGuard={version:string;state:'active'|'pending';override?:{id:string;version:string}};
export class ManagementStore {
  readonly root:DocumentReference; readonly realm:DocumentReference;
  constructor(readonly data:Firestore,readonly registry:Firestore,readonly namespace:string){
    managementNamespace(namespace);
    this.root=data.collection('artifacts').doc(namespace);
    this.realm=registry.collection('management_realms').doc(namespace);
  }
  user(id:string):DocumentReference{if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw new Error('Invalid user ID.');return this.realm.collection('users').doc(id);}
  profile(id:string,pending=false):DocumentReference{return this.root.collection('private').doc('users').collection(pending?'pending':'active').doc(id);}
  access(uid:string):DocumentReference{return this.root.collection('private').doc('security').collection('access').doc(uid);}
  async read(id:string):Promise<StoredManagementRecord|null>{const s=await this.user(id).get();return s.exists?s.data() as StoredManagementRecord:null;}
  async resolve(alias:string):Promise<StoredManagementRecord|null>{
    const s=await this.realm.collection('login_index').doc(indexKey(alias)).get();
    const ids=s.data()?.userIds;
    if(Array.isArray(ids)&&ids.length>1)throw new ManagementDenied();
    return Array.isArray(ids)&&ids.length===1?this.read(ids[0]):null;
  }
  acl(record:ManagementRecord):ManagementAccess{
    return {userId:record.id,firebaseUid:record.firebaseUid,version:record.version,
      active:record.profile.active===true&&record.profile.isApproved===true&&record.profile.status==='active',
      owner:record.owner,permissions:record.permissions};
  }
  view(record:ManagementRecord):ManagementProfile{
    return {...cleanManagementProfile(record.profile,record.id),userPermissions:record.permissions,managementOwner:record.owner};
  }
  async assertProjection(record:StoredManagementRecord){
    const digest=(record as StoredManagementRecord&{migrationDigest?:string}).migrationDigest;
    if(digest){const job=await this.realm.collection('migration_jobs').doc(digest).get();
      if(job.data()?.complete!==true)throw new Error('Management migration is not complete. Sign-in remains closed.');}
    const snap=await this.access(record.firebaseUid).get(), acl=snap.data();
    if(record.projection!=='ready'||!acl||acl.active!==true||acl.version!==record.version||acl.userId!==record.id)throw new Error('Account change is incomplete or access stopped. Administrator repair required.');
  }
  /** Projection fence: invalidate old Firestore access before modifying protected credentials.
   * All state is retained on failure. A failed registry transaction restores the authoritative prior projection.
   * A crash leaves the fence closed until the operator explicitly repairs it; never a stale active grant.
   */
  async save(next:ManagementRecord,expectedVersion:number|null,actorId:string,authorize?:(actor:StoredManagementRecord)=>void,
    ensureIdentity?:()=>Promise<void>,sourceGuard?:MigrationProjectionGuard):Promise<StoredManagementRecord>{
    const fence=randomUUID(), accessRef=this.access(next.firebaseUid);
    await this.data.runTransaction(async tx=>{
      const s=await tx.get(accessRef), current=s.data();
      if(current?.mutationId)throw new Error('Another account change is in progress.');
      if(expectedVersion!==null && current?.version!==expectedVersion)throw new Error('Account access changed. Refresh and retry.');
      tx.set(accessRef,{...this.acl(next),active:false,mutationId:fence});
    });
    const aliases=loginAliases(next.profile);
    try {
      await this.registry.runTransaction(async tx=>{
        const current=await tx.get(this.user(next.id));
        if(expectedVersion===null?current.exists:current.data()?.version!==expectedVersion)throw new Error('User already exists or changed. Refresh and retry.');
        if(authorize){const actor=await tx.get(this.user(actorId));if(!actor.exists)throw new Error('Actor no longer registered.');authorize(actor.data() as StoredManagementRecord);}
        const previous=current.data() as StoredManagementRecord|undefined;
        const keys=[...new Set([...(previous?.aliases||[]),...aliases])];
        const refs=keys.map(a=>this.realm.collection('login_index').doc(indexKey(a)));
        const indexes=[];for(const ref of refs)indexes.push(await tx.get(ref));
        for(let i=0;i<keys.length;i++){
          const ids=(indexes[i].data()?.userIds||[]).filter((id:string)=>id!==next.id);
          if(aliases.includes(keys[i]))ids.push(next.id);
          if(keys[i]===next.profile.email && ids.some((id:string)=>id!==next.id))throw new Error('Email already registered.');
          if(ids.length>100)throw new Error('Ambiguous login alias requires administrator review.');
        }
        tx.set(this.user(next.id),{...next,aliases,projection:'pending'});
        for(let i=0;i<keys.length;i++){
          const ids=(indexes[i].data()?.userIds||[]).filter((id:string)=>id!==next.id);
          if(aliases.includes(keys[i]))ids.push(next.id);
          tx.set(refs[i],{userIds:ids});
        }
      });
      if(ensureIdentity)await ensureIdentity();
      const saved=(await this.read(next.id))!;
      await this.project(saved,fence,actorId,sourceGuard);
      return {...saved,projection:'ready'};
    } catch(error){
      // A failed create remains fenced. Existing authoritative state is never discarded.
      const latest=await this.read(next.id).catch(()=>null);
      if(latest && latest.version===expectedVersion && latest.projection==='ready')await this.project(latest,fence,actorId).catch(()=>{});
      throw error;
    }
  }
  async project(record:StoredManagementRecord,fence:string,actorId:string,sourceGuard?:MigrationProjectionGuard){
    const accessRef=this.access(record.firebaseUid);
    const audit=this.root.collection('private').doc('audit').collection('logs').doc();
    await this.data.runTransaction(async tx=>{
      const s=await tx.get(accessRef);
      if(s.data()?.mutationId!==fence)throw new Error('Projection fence changed. Stop and repair.');
      if(sourceGuard){
        const source=await tx.get(this.profile(record.id,sourceGuard.state==='pending'));
        const version=source.updateTime?source.updateTime.seconds+':'+source.updateTime.nanoseconds:'';
        const ownProjection=source.exists&&source.data()?.pin===''&&
          isDeepStrictEqual(cleanManagementProfile(source.data()!,record.id),cleanManagementProfile(this.view(record),record.id));
        if(!source.exists||(version!==sourceGuard.version&&!ownProjection))throw new Error('Legacy profile changed before projection. Retained for operator review.');
        if(sourceGuard.override){
          const override=await tx.get(this.data.collection('userPermissionOverrides').doc(sourceGuard.override.id));
          const overrideVersion=override.updateTime?override.updateTime.seconds+':'+override.updateTime.nanoseconds:'';
          if(!override.exists||overrideVersion!==sourceGuard.override.version)throw new Error('Permissions changed before projection. Stop and review.');
        }
      }
      const profile=this.view(record),pending=!record.profile.isApproved;
      tx.set(accessRef,this.acl(record));
      if(record.profile.status==='deleted')tx.delete(this.profile(record.id,pending));
      else tx.set(this.profile(record.id,pending),profile);
      tx.delete(this.profile(record.id,!pending));
      tx.create(audit,{event:'MANAGEMENT_ACCOUNT_PROJECTED',actorId,userId:record.id,version:record.version,timestamp:new Date().toISOString()});
    });
    await this.registry.runTransaction(async tx=>{
      const s=await tx.get(this.user(record.id));
      if(s.data()?.version!==record.version)throw new Error('Authoritative record changed during projection.');
      tx.update(this.user(record.id),{projection:'ready'});
    });
  }
  /** Operator-only recovery from the protected source, never from a legacy/browser profile. */
  async repair(id:string,ensureIdentity:(record:StoredManagementRecord)=>Promise<void>,sourceGuard?:MigrationProjectionGuard){
    const record=await this.read(id);
    if(!record||record.projection!=='pending')throw new Error('No pending protected change to repair.');
    const fence=await this.data.runTransaction(async tx=>{
      const ref=this.access(record.firebaseUid),snap=await tx.get(ref),acl=snap.data();
      if(!acl||acl.userId!==record.id||acl.version!==record.version)throw new Error('Recovery binding/version mismatch. Stop for operator review.');
      const mutationId=acl.mutationId||randomUUID();
      tx.set(ref,{...this.acl(record),active:false,mutationId});return mutationId;
    });
    if(record.profile.active&&record.profile.isApproved)await ensureIdentity(record);
    await this.project(record,fence,'verified-operator-repair',sourceGuard);
  }
}
