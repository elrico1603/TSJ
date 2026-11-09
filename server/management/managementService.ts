import { randomUUID } from 'node:crypto';
import { timingSafeEqual } from 'node:crypto';
import type { Auth } from 'firebase-admin/auth';
import { cleanManagementProfile, type ManagementProfile } from '../../src/services/managementContract';
import { employeeView } from '../../src/services/employeeView';
import { ManagementStore, type StoredManagementRecord } from './managementStore';
import { canManage, checkUserMutation, effectiveManagementPermissions, indexKey, ManagementDenied,
  normalizeEmail,passwordDigest,passwordMatches,requireManagementPermission,validateProfile,type ManagementRecord } from './managementPolicy';

export class ManagementService {
  constructor(readonly store:ManagementStore,readonly auth:Pick<Auth,'verifyIdToken'|'createCustomToken'|'createUser'|'getUser'|'getUserByEmail'|'updateUser'>){}
  async actor(token:string):Promise<StoredManagementRecord>{
    let decoded;
    try{decoded=await this.auth.verifyIdToken(token,true);}catch{throw new ManagementDenied();}
    if(decoded.tsj_management!==true||decoded.tsj_namespace!==this.store.namespace||
      typeof decoded.tsj_user_id!=='string'||decoded.firebase?.sign_in_provider!=='custom')throw new ManagementDenied();
    const record=await this.store.read(decoded.tsj_user_id);
    if(!record||record.firebaseUid!==decoded.uid||record.version!==decoded.tsj_version||
      !record.profile.active||!record.profile.isApproved||record.profile.status!=='active')throw new ManagementDenied();
    await this.store.assertProjection(record);
    return record;
  }
  async verifyCredentials(identifier:unknown,password:unknown){
    if(typeof identifier!=='string'||identifier.length>254||typeof password!=='string'||password.length>128)throw new ManagementDenied();
    const alias=identifier.trim().toLowerCase();
    // Preserve an explicitly registered Frans identity; use the documented legacy alias only if absent.
    const exact=await this.store.resolve(alias);
    const record=exact||(['frans','frans@tsjoinery.co.za'].includes(alias)?await this.store.resolve('franz@tsjoinery.co.za'):null);
    if(!record||!record.profile.active||!record.profile.isApproved||record.profile.status!=='active'||
      !await passwordMatches(password,record.password))throw new ManagementDenied();
    await this.store.assertProjection(record);
    return record;
  }
  async login(identifier:unknown,password:unknown){
    const record=await this.verifyCredentials(identifier,password);
    const customToken=await this.auth.createCustomToken(record.firebaseUid,{tsj_management:true,
      tsj_namespace:this.store.namespace,tsj_user_id:record.id,tsj_version:record.version});
    return {customToken,user:this.store.view(record)};
  }
  async ensureIdentity(uid:string,email:string){
    try{const user=await this.auth.getUser(uid);if(normalizeEmail(user.email)!==email)throw new Error('Auth UID/email mismatch; no automatic rebinding.');}
    catch(error:any){if(error?.code!=='auth/user-not-found')throw error;await this.auth.createUser({uid,email});}
  }
  async checkEmailBinding(email:string,uid?:string){
    try{const user=await this.auth.getUserByEmail(email);if(user.uid!==uid)throw new Error('Email belongs to another Auth identity. Administrator review required.');}
    catch(error:any){if(error?.code!=='auth/user-not-found')throw error;}
  }
  async create(actor:StoredManagementRecord,input:Record<string,any>){
    requireManagementPermission(actor,'User Assignments','Create');
    const previous=await this.store.resolve(normalizeEmail(input.email));
    if(previous&&previous.profile.status!=='deleted')throw new Error('Email already registered.');
    const id=previous?.id||'usr-'+indexKey(normalizeEmail(input.email)).slice(0,32);
    const profile=validateProfile({...input,active:true,isApproved:true,status:'active',createdAt:new Date().toISOString()},id,true);
    if(Object.keys(profile.permissions||{}).length||Object.keys(profile.userPermissions||{}).length)requireManagementPermission(actor,'User Assignments','Edit');
    await this.checkEmailBinding(profile.email,previous?.firebaseUid);
    // Raw password is used only for a digest; never mirrored or returned.
    const record:ManagementRecord={id,firebaseUid:previous?.firebaseUid||'tsjm-'+randomUUID(),profile,password:await passwordDigest(input.pin),
      permissions:effectiveManagementPermissions(profile),owner:false,version:(previous?.version||0)+1,aliases:[]};
    const saved=await this.store.save(record,previous?.version??null,actor.id,a=>{if(a.version!==actor.version)throw new ManagementDenied();requireManagementPermission(a,'User Assignments','Create');},
      ()=>this.ensureIdentity(record.firebaseUid,profile.email));
    return this.store.view(saved);
  }
  async register(input:Record<string,any>){
    const id='usr-'+indexKey(normalizeEmail(input.email)).slice(0,32);
    const safe={name:input.name,email:input.email,role:String(input.role||'Employee'),pin:input.pin,
      active:false,isApproved:false,status:'pending',createdAt:new Date().toISOString()};
    const profile=validateProfile(safe,id);
    const password=await passwordDigest(input.pin);
    const existing=await this.store.resolve(profile.email);
    // Do not disclose existing accounts or permit requester-supplied grants/approval.
    if(!existing||existing.profile.status==='deleted'&&!existing.owner)await this.store.save({id:existing?.id||id,firebaseUid:existing?.firebaseUid||'tsjm-'+randomUUID(),profile:{...profile,id:existing?.id||id},password,
      permissions:{},owner:false,version:(existing?.version||0)+1,aliases:[]},existing?.version??null,'registration-request');
    return cleanManagementProfile(profile,existing?.id||id);
  }
  async update(actor:StoredManagementRecord,id:string,patch:Record<string,any>,operation:'update'|'approve'|'delete'|'reject'='update'){
    const previous=await this.store.read(id);if(!previous)throw new Error('User not registered.');
    if(operation==='approve'){
      requireManagementPermission(actor,'User Assignments','Approve');
      if(Object.keys(patch).length||previous.profile.isApproved||previous.profile.status!=='pending')throw new Error('Approval accepts only an unchanged pending request.');
    }
    else checkUserMutation(actor,previous,patch,operation==='delete'||operation==='reject'?'delete':'update');
    const change={...patch};
    if(operation==='approve')Object.assign(change,{active:true,isApproved:true,status:'active'});
    if(operation==='delete'||operation==='reject')Object.assign(change,{active:false,status:'deleted'});
    const profile=validateProfile({...previous.profile,...change},id);
    if(!previous.profile.isApproved && profile.isApproved)requireManagementPermission(actor,'User Assignments','Approve');
    if(change.createdAt && change.createdAt!==previous.profile.createdAt)throw new Error('Creation time is immutable.');
    if(previous.owner && (!profile.active||!profile.isApproved))throw new Error('Owner cannot be disabled.');
    if(profile.email!==previous.profile.email)await this.checkEmailBinding(profile.email,previous.firebaseUid);
    const password=typeof change.pin==='string'&&change.pin ? await passwordDigest(change.pin):previous.password;
    const record={...previous,profile,password,permissions:effectiveManagementPermissions(profile),version:previous.version+1};
    const saved=await this.store.save(record,previous.version,actor.id,a=>{
      if(a.version!==actor.version)throw new ManagementDenied();
      if(operation==='approve')requireManagementPermission(a,'User Assignments','Approve');
      else checkUserMutation(a,previous,patch,operation==='delete'||operation==='reject'?'delete':'update');
    },profile.active&&profile.isApproved?async()=>{
      if(profile.email!==previous.profile.email)await this.auth.updateUser(record.firebaseUid,{email:profile.email});
      await this.ensureIdentity(record.firebaseUid,profile.email);
    }:undefined);
    return this.store.view(saved);
  }
  async reauthenticate(actor:StoredManagementRecord,password:unknown){
    if(!canManage(actor,'Clocking','Approve')&&!canManage(actor,'User Assignments','Approve'))throw new ManagementDenied();
    if(typeof password!=='string'||!await passwordMatches(password,actor.password))throw new ManagementDenied();
    return {verified:true};
  }
  async writeDocument(actor:StoredManagementRecord,path:unknown,operation:unknown,data:unknown){
    if(typeof path!=='string'||path.length>500||path.split('/').some(p=>!p||p==='.'||p==='..')||
      !['set','update','delete'].includes(String(operation)))throw new Error('Invalid management document operation.');
    const namespace=this.store.namespace;
    if(path.split('/').length===2){
      const [kind,id]=path.split('/');
      if(!['roles','rolePermissions','userRoles','userPermissionOverrides','role_audit_logs'].includes(kind))throw new Error('Root collection not authorized.');
      path='artifacts/'+namespace+'/'+(['userPermissionOverrides','role_audit_logs'].includes(kind)?'private':'public')+'/'+(kind==='userPermissionOverrides'?'permissions':kind)+'/items/'+id;
    }
    const parts=String(path).split('/');
    if(parts.length!==2 && parts.length!==6)throw new Error('Unsupported document path.');
    const collection=parts.length===2?parts[0]:parts[4],id=parts.at(-1)!;
    if(parts.length===6 && (parts[0]!=='artifacts'||parts[1]!==namespace||
      !['private/users/active','private/permissions/items','private/role_audit_logs/items','public/roles/items','public/rolePermissions/items','public/userRoles/items'].includes(parts.slice(2,5).join('/'))))throw new Error('Namespace mismatch or unauthorized document path.');
    if(collection==='active'){
      if(parts.slice(2,5).join('/')!=='private/users/active')throw new Error('Invalid user path.');
      return operation==='delete'?this.update(actor,id,{},'delete'):this.update(actor,id,data as any);
    }
    if(!['roles','rolePermissions','userRoles','userPermissionOverrides','role_audit_logs'].includes(collection) &&
      !(collection==='items' && ['roles','rolePermissions','userRoles','role_audit_logs','permissions'].includes(parts[3])))throw new Error('Document collection is not authorized.');
    requireManagementPermission(actor,'User Assignments','Edit');
    if(operation!=='delete' && (!data||typeof data!=='object'||Array.isArray(data)||JSON.stringify(data).length>60000))throw new Error('Invalid RBAC payload.');
    if(collection==='userPermissionOverrides'||parts.slice(2,5).join('/')==='private/permissions/items'){
      const override=data as Record<string,any>;
      if(operation==='delete')throw new Error('Override deletion requires an explicit replacement.');
      const user=await this.store.read(String(override.userId||id));if(!user)throw new Error('Unknown override user.');
      if(actor.id===user.id)throw new Error('Self privilege changes require another manager.');
      const merged={...user.profile,deviceAccess:override.deviceAccess||user.profile.deviceAccess,
        deviceViewAccess:override.deviceViewAccess||user.profile.deviceViewAccess,
        userPermissions:effectiveManagementPermissions(user.profile,override)};
      await this.update(actor,user.id,merged);
      path='artifacts/'+namespace+'/private/permissions/items/'+user.id;
    }
    const ref=this.store.data.doc(String(path));
    if(operation==='delete')await ref.delete();
    else if(operation==='update')await ref.update(data as any);
    else await ref.set(data as any);
    return {saved:true};
  }
  async verifyEmployeePin(actor:StoredManagementRecord,id:string,pin:unknown){
    if(!canManage(actor,'Clocking','View')&&!canManage(actor,'Employer Registration','View'))throw new ManagementDenied();
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(id)||typeof pin!=='string'||!/^\d{4}$/.test(pin))throw new ManagementDenied();
    const snap=await this.store.root.collection('public').doc('data').collection('employees').doc(id).get();
    const e=snap.data(),expected=String(e?.personalCode||e?.pin||e?.clockPin||'');
    const suppliedBytes=Buffer.from(pin),expectedBytes=Buffer.from(expected);
    if(!snap.exists||e?.isArchived||e?.status==='Archived'||suppliedBytes.length!==expectedBytes.length||!timingSafeEqual(suppliedBytes,expectedBytes))throw new ManagementDenied();
    return {verified:true};
  }
  async writeEmployee(actor:StoredManagementRecord,path:string,operation:string,raw:unknown){
    const expectedPrefix='artifacts/'+this.store.namespace+'/public/data/employees/';
    if(typeof path!=='string'||!path.startsWith(expectedPrefix)||!/^[A-Za-z0-9_-]{1,128}$/.test(path.slice(expectedPrefix.length))||!['set','update','delete'].includes(operation))throw new Error('Invalid employee operation.');
    if(raw!==undefined && (!raw||typeof raw!=='object'||Array.isArray(raw)))throw new Error('Invalid employee data.');
    const input={...(raw as Record<string,any>||{})},id=path.slice(expectedPrefix.length);
    const expectedRevision=input._expectedClockRevision,reason=input._auditReason;
    delete input._expectedClockRevision;delete input._auditReason;
    const allowed=new Set(['id','name','surname','role','personalCode','pin','clockPin','status','isArchived','todayHours','yesterdayHours','weeklyHours','monthlyHours','history','shifts','breaks','advances','dateStarted','photo','address','idNumber','taxNumber','uifNumber','contactNumber','hourlyRate','archiveReason','archiveDate','shiftStartTime','currentBreakReason','lastClock','isClockedIn','employeeNumber','warnings','ppeIssuances','clockRevision']);
    if(Object.keys(input).some(k=>!allowed.has(k)))throw new Error('Unexpected employee field.');
    const ref=this.store.data.doc(path),view=this.store.root.collection('public').doc('data').collection('employeeViews').doc(id);
    const audit=this.store.root.collection('private').doc('audit').collection('logs').doc();
    return this.store.data.runTransaction(async tx=>{
      const actorAccess=await tx.get(this.store.access(actor.firebaseUid));
      if(actorAccess.data()?.active!==true||actorAccess.data()?.version!==actor.version)throw new ManagementDenied();
      const snap=await tx.get(ref),before=snap.data()||{};
      if(operation==='delete'){
        // Preserve payroll and event references: use the existing archive operation instead.
        throw new Error('Employee payroll records cannot be deleted. Archive the profile instead.');
      }
      const attendance=['status','shiftStartTime','history','shifts','breaks','todayHours','yesterdayHours','weeklyHours','monthlyHours','lastClock','currentBreakReason','isClockedIn'];
      const changed=attendance.filter(k=>k in input&&JSON.stringify(input[k])!==JSON.stringify(before[k]));
      const attendanceOnly=snap.exists&&Object.keys(input).every(k=>attendance.includes(k)||JSON.stringify(input[k])===JSON.stringify(before[k]));
      if(attendanceOnly)requireManagementPermission(actor,'Work Analytics','Edit');
      else if(snap.exists&&!canManage(actor,'Employer Registration','Edit')){
        requireManagementPermission(actor,'Archive Profiles','Edit');
        if(Object.keys(input).some(k=>!['isArchived','archiveReason','archiveDate','status'].includes(k)&&JSON.stringify(input[k])!==JSON.stringify(before[k])))throw new ManagementDenied();
      }else requireManagementPermission(actor,'Employer Registration',snap.exists?'Edit':'Create');
      let after={...before,...input};
      if(!snap.exists){
        if(operation==='update')throw new Error('Employee does not exist.');
        if((input.history||[]).length||(input.shifts||[]).length||input.status&&input.status!=='Out'||
          ['todayHours','weeklyHours','monthlyHours'].some(k=>input[k]&&input[k]!==0))throw new Error('New employee attendance must start empty.');
        after={...input,status:'Out',isArchived:false,todayHours:0,yesterdayHours:0,weeklyHours:0,monthlyHours:0,history:[],shifts:[],breaks:[],clockRevision:0};
      }else{
        const archiveOnly=changed.every(k=>k==='status')&&typeof input.isArchived==='boolean'&&input.isArchived!==before.isArchived;
        if(changed.length&&!archiveOnly){
          requireManagementPermission(actor,'Work Analytics','Edit');
          if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==(before.clockRevision||0)||typeof reason!=='string'||reason.trim().length<10)throw new Error('Attendance changes require current revision and an evidence-based reason.');
        }
        const clockChanged=changed.length>0||['isArchived','personalCode','pin','clockPin'].some(k=>k in input&&input[k]!==before[k]);
        after.clockRevision=(before.clockRevision||0)+(clockChanged?1:0);
        if('clockRevision' in input&&input.clockRevision!==(before.clockRevision||0))throw new Error('Client cannot set the attendance revision.');
      }
      if(typeof after.name!=='string'||!after.name.trim()||after.name.length>160||typeof after.surname!=='string'||after.surname.length>160||
        !['In','Out','Break','Archived'].includes(after.status)||!Array.isArray(after.history)||!Array.isArray(after.shifts)||!Array.isArray(after.breaks)||
        ['todayHours','weeklyHours','monthlyHours'].some(k=>!Number.isFinite(after[k])||after[k]<0)||
        after.history.some((h:any)=>typeof h.date!=='string'||!Number.isFinite(h.hours)||h.hours<0)||
        !/^\d{4}$/.test(String(after.personalCode||after.pin||after.clockPin||'')))throw new Error('Employee profile or attendance data is invalid.');
      if(snap.exists)tx.update(ref,after);else tx.create(ref,after);
      tx.set(view,employeeView({...after,id}));
      tx.create(audit,{event:'MANAGEMENT_EMPLOYEE_UPDATE',actorId:actor.id,employeeId:id,clockRevision:after.clockRevision,
        reason:typeof reason==='string'?reason.trim().slice(0,1000):'Authorized profile maintenance',
        attendanceBefore:Object.fromEntries(changed.map(k=>[k,before[k]??null])),
        attendanceAfter:Object.fromEntries(changed.map(k=>[k,after[k]??null])),timestamp:new Date().toISOString()});
      return {saved:true,id};
    });
  }
}
