import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { ManagementStore } from '../server/management/managementStore';
import { ManagementService } from '../server/management/managementService';
import { passwordDigest,passwordMatches,effectiveManagementPermissions,type ManagementRecord } from '../server/management/managementPolicy';
import { employeeView } from '../src/services/employeeView';
import { managementWriteProxy } from '../src/services/secureManagementClient';
import express from 'express';
import { managementRoutes } from '../server/management/managementRoutes';

class MemoryFirestore {
  records=new Map<string,any>();failProjection=false;
  snapshot=(path:string)=>({id:path.split('/').at(-1),exists:this.records.has(path),data:()=>structuredClone(this.records.get(path))});
  doc=(path:string):any=>({id:path.split('/').at(-1),path,collection:(name:string)=>this.collection(path+'/'+name),get:async()=>this.snapshot(path),
    set:async(data:any)=>{this.records.set(path,structuredClone(data));},update:async(data:any)=>this.records.set(path,{...this.records.get(path),...structuredClone(data)}),delete:async()=>this.records.delete(path)});
  collection=(path:string):any=>({path,doc:(id=randomUUID())=>this.doc(path+'/'+id),add:async(data:any)=>{const ref=this.doc(path+'/'+randomUUID());await ref.set(data);return ref;}});
  runTransaction=async(fn:any)=>{
    const changes:Array<{method:string;path:string;data?:any}>=[];let writing=false;
    const add=(method:string,ref:any,data?:any)=>{writing=true;changes.push({method,path:ref.path,data:structuredClone(data)});};
    const result=await fn({get:async(ref:any)=>{assert.equal(writing,false,'Firestore reads must precede writes');return this.snapshot(ref.path);},
      set:(ref:any,data:any)=>add('set',ref,data),create:(ref:any,data:any)=>{if(this.records.has(ref.path))throw new Error('already exists');add('set',ref,data);},
      update:(ref:any,data:any)=>{if(!this.records.has(ref.path))throw new Error('missing document');add('update',ref,data);},delete:(ref:any)=>add('delete',ref)});
    if(this.failProjection&&changes.some(c=>c.path.includes('/private/users/active/')))throw new Error('Simulated projection outage');
    for(const c of changes){if(c.method==='delete')this.records.delete(c.path);else if(c.method==='update')this.records.set(c.path,{...this.records.get(c.path),...c.data});else this.records.set(c.path,c.data);}
    return result;
  };
}
let passed=0;
const test=async(name:string,run:()=>unknown|Promise<unknown>)=>{await run();passed++;console.log('PASS '+name);};
async function main(){
  const data=new MemoryFirestore(),registry=new MemoryFirestore(),namespace='timbersmith-management-test-fixtures';
  const store=new ManagementStore(data as unknown as Firestore,registry as unknown as Firestore,namespace);
  const identities=new Map<string,any>(),tokens=new Map<string,any>();
  const missing=()=>Object.assign(new Error('Not found'),{code:'auth/user-not-found'});
  const auth:any={
    verifyIdToken:async(token:string)=>{if(!tokens.has(token))throw new Error('Invalid token');return tokens.get(token);},
    createCustomToken:async(uid:string,claims:any)=>{const token=randomUUID();tokens.set(token,{uid,...claims,firebase:{sign_in_provider:'custom'}});return token;},
    getUser:async(uid:string)=>{if(!identities.has(uid))throw missing();return identities.get(uid);},
    getUserByEmail:async(email:string)=>{const value=[...identities.values()].find(v=>v.email===email);if(!value)throw missing();return value;},
    createUser:async(user:any)=>{if([...identities.values()].some(v=>v.email===user.email))throw new Error('Duplicate Auth email');identities.set(user.uid,user);return user;},
    updateUser:async(uid:string,patch:any)=>{const result={...identities.get(uid),...patch};identities.set(uid,result);return result;}
  };
  const service=new ManagementService(store,auth);
  const owner:ManagementRecord={id:'fictional-owner',firebaseUid:'fictional-owner-uid',owner:true,version:1,aliases:[],
    profile:{id:'fictional-owner',name:'Fictional Owner',email:'owner@example.invalid',role:'Employee',pin:'',active:true,isApproved:true,status:'active',createdAt:'2026-11-05T00:00:00.000Z'},
    password:await passwordDigest('fixture-owner-password'),permissions:{}};
  await store.save(owner,null,'operator',undefined,()=>service.ensureIdentity(owner.firebaseUid,owner.profile.email));
  let actor=(await store.read(owner.id))!;
  let created:any,pending:any;
  await test('salted digests verify trimmed existing credentials without storing plaintext',async()=>{
    const a=await passwordDigest(' 1234 '),b=await passwordDigest('1234');
    assert.notEqual(a.hash,b.hash);assert.equal(await passwordMatches('1234',a),true);assert.equal(await passwordMatches('0000',a),false);
    assert.equal(JSON.stringify(a).includes('1234'),false);
  });
  await test('owner sign-in issues a device-independent verified identity with sanitized profile',async()=>{
    const result=await service.login(' OWNER ','fixture-owner-password');
    assert.equal(result.user.pin,'');assert.equal(result.user.managementOwner,true);
    assert.equal((await service.actor(result.customToken)).id,owner.id);
    await assert.rejects(()=>service.login('owner','wrong-password'));
  });
  await test('create is confirmed in protected source and sanitized projection without changing the actor identity',async()=>{
    created=await service.create(actor,{name:'Fictional Staff',email:'staff@example.invalid',role:'Administrator',pin:'fixture-staff-password'});
    assert.equal(created.pin,'');assert.equal(created.managementOwner,false);
    const record=(await store.read(created.id))!;
    assert.equal(record.projection,'ready');assert.equal(record.profile.role,'Administrator');assert.deepEqual(record.permissions,{});
    assert.equal(JSON.stringify(record).includes('fixture-staff-password'),false);
    const mirror=data.records.get(store.profile(created.id).path);assert.equal(mirror.pin,'');assert.equal('password' in mirror,false);
    assert.equal((await store.read(owner.id))!.firebaseUid,owner.firebaseUid);
  });
  await test('duplicate and case-normalized creation cannot replace an existing account or password',async()=>{
    await assert.rejects(()=>service.create(actor,{name:'Impostor',email:' STAFF@EXAMPLE.INVALID ',role:'Administrator',pin:'different-password'}));
    assert.equal((await service.login('staff','fixture-staff-password')).user.id,created.id);
  });
  await test('role labels and anonymous/password Firebase identities cannot grant management authority',async()=>{
    const result=await service.login('staff','fixture-staff-password'),staff=await service.actor(result.customToken);
    await assert.rejects(()=>service.create(staff,{name:'Attack',email:'attack@example.invalid',role:'Administrator',pin:'attack-password'}));
    const claims=tokens.get(result.customToken);
    tokens.set('anonymous',{...claims,firebase:{sign_in_provider:'anonymous'}});tokens.set('password-provider',{...claims,firebase:{sign_in_provider:'password'}});
    await assert.rejects(()=>service.actor('anonymous'));await assert.rejects(()=>service.actor('password-provider'));
  });
  await test('Frans and Franz exact identities remain distinct before any legacy alias fallback',async()=>{
    const frans=await service.create(actor,{name:'Frans Fixture',email:'frans@tsjoinery.co.za',role:'Employee',pin:'fixture-frans-password'});
    const franz=await service.create(actor,{name:'Franz Fixture',email:'franz@tsjoinery.co.za',role:'Employee',pin:'fixture-franz-password'});
    assert.equal((await service.login('frans@tsjoinery.co.za','fixture-frans-password')).user.id,frans.id);
    assert.equal((await service.login('franz@tsjoinery.co.za','fixture-franz-password')).user.id,franz.id);
    await assert.rejects(()=>service.login('frans@tsjoinery.co.za','fixture-franz-password'));
    await service.create(actor,{name:'Other Frans Fixture',email:'frans@fixture.invalid',role:'Employee',pin:'fixture-other-password'});
    await assert.rejects(()=>service.login('frans','fixture-franz-password'));
  });
  await test('public registration ignores injected approval and grants; approval uses the original protected password',async()=>{
    pending=await service.register({name:'Pending Person',email:'pending@example.invalid',role:'Administrator',pin:'pending-password',
      active:true,isApproved:true,owner:true,userPermissions:{'User Assignments':{Edit:true}}});
    const stored=(await store.read(pending.id))!;assert.equal(stored.owner,false);assert.equal(stored.profile.isApproved,false);assert.deepEqual(stored.permissions,{});
    await assert.rejects(()=>service.update(actor,pending.id,{userPermissions:{'User Assignments':{Edit:true}}},'approve'));
    await assert.rejects(()=>service.login('pending','pending-password'));
    await service.update(actor,pending.id,{},'approve');assert.equal((await service.login('pending','pending-password')).user.id,pending.id);
  });
  await test('explicit denies override flat View allows and role metadata has no power',()=>{
    const profile={...created,permissions:{Inventory:true},userPermissions:{Inventory:{View:false}}};
    assert.equal(effectiveManagementPermissions(profile).Inventory.View,false);
    assert.equal(effectiveManagementPermissions(profile,{permissions:{Inventory:{View:'deny'}}}).Inventory.View,false);
  });
  await test('self-grants and non-owner reset/removal of the protected owner are refused',async()=>{
    const staff=(await store.read(created.id))!;
    await service.update(actor,staff.id,{userPermissions:{'User Assignments':{Edit:true,Delete:true}}});
    const signed=await service.login('staff','fixture-staff-password'),manager=await service.actor(signed.customToken);
    await assert.rejects(()=>service.update(manager,manager.id,{userPermissions:{'Clocking':{Approve:true}}}));
    await assert.rejects(()=>service.update(manager,owner.id,{pin:'taken-over-password'}));
    await assert.rejects(()=>service.update(manager,owner.id,{},'delete'));
  });
  await test('PIN changes invalidate old session versions and never appear in public projections',async()=>{
    const old=await service.login('pending','pending-password');
    await service.update(actor,pending.id,{pin:'replacement-password'});
    await assert.rejects(()=>service.actor(old.customToken));await assert.rejects(()=>service.login('pending','pending-password'));
    assert.equal((await service.login('pending','replacement-password')).user.pin,'');
  });
  await test('email edits update the bound identity and aliases without stealing another account',async()=>{
    await service.update(actor,pending.id,{email:'renamed@example.invalid'});
    assert.equal((await service.login('renamed','replacement-password')).user.email,'renamed@example.invalid');
    await assert.rejects(()=>service.login('pending@example.invalid','replacement-password'));
    await assert.rejects(()=>service.update(actor,pending.id,{email:owner.profile.email}));
  });
  await test('projection failure fences old access and retains the authoritative change for explicit repair',async()=>{
    const previous=(await store.read(created.id))!,signed=await service.login('staff','fixture-staff-password');
    data.failProjection=true;await assert.rejects(()=>service.update(actor,created.id,{department:'Updated department'}));data.failProjection=false;
    const record=(await store.read(created.id))!,acl=data.records.get(store.access(record.firebaseUid).path);
    assert.equal(record.version,previous.version+1);assert.equal(record.projection,'pending');assert.equal(acl.active,false);
    await assert.rejects(()=>service.actor(signed.customToken));await assert.rejects(()=>service.login('staff','fixture-staff-password'));
    await store.repair(record.id,r=>service.ensureIdentity(r.firebaseUid,r.profile.email));assert.equal((await service.login('staff','fixture-staff-password')).user.department,'Updated department');
    // Crash after the projection transaction but before marking the protected source ready.
    registry.records.set(store.user(record.id).path,{...(await store.read(record.id)),projection:'pending'});
    await assert.rejects(()=>service.login('staff','fixture-staff-password'));
    await store.repair(record.id,r=>service.ensureIdentity(r.firebaseUid,r.profile.email));
    assert.equal((await service.login('staff','fixture-staff-password')).user.id,record.id);
  });
  await test('deactivation revokes access; delete retains protected history but removes visible profiles',async()=>{
    const before=await service.login('renamed','replacement-password');
    await service.update(actor,pending.id,{active:false});await assert.rejects(()=>service.actor(before.customToken));await assert.rejects(()=>service.login('renamed','replacement-password'));
    await service.update(actor,pending.id,{},'delete');assert.ok(await store.read(pending.id));assert.equal(data.records.has(store.profile(pending.id).path),false);
  });
  await test('rejected/deleted registration can be resubmitted without inheriting privileged permissions',async()=>{
    const next=await service.register({name:'Another Request',email:'renamed@example.invalid',role:'Administrator',pin:'new-request-password'});
    const record=(await store.read(next.id))!;assert.equal(record.profile.isApproved,false);assert.deepEqual(record.permissions,{});
    await service.update(actor,next.id,{},'reject');assert.equal(data.records.has(store.profile(next.id,true).path),false);
  });
  await test('legacy RBAC paths are realm-scoped and cannot write payroll, ACLs or another namespace',async()=>{
    await service.writeDocument(actor,'roles/fictional-role','set',{id:'fictional-role',roleName:'Test Role'});
    assert.equal(data.records.has('roles/fictional-role'),false);
    assert.ok(data.records.has('artifacts/'+namespace+'/public/roles/items/fictional-role'));
    await assert.rejects(()=>service.writeDocument(actor,'artifacts/timbersmith-terminal-v1/private/users/active/someone','update',{active:true}));
    await assert.rejects(()=>service.writeDocument(actor,'artifacts/'+namespace+'/private/security/access/uid','set',{owner:true}));
    await service.writeDocument(actor,'userPermissionOverrides/'+created.id,'set',{userId:created.id,permissions:{Inventory:{View:'allow',Edit:'deny'}}});
    const record=(await store.read(created.id))!;assert.equal(record.permissions.Inventory.View,true);assert.equal(record.permissions.Inventory.Edit,false);
  });
  await test('compatibility proxy preserves refs but routes scoped writes and add acknowledgements through the backend',async()=>{
    const calls:any[]=[];const proxy=managementWriteProxy(data,async(...args)=>{calls.push(args);return {saved:true};});
    await proxy.collection('roles').doc('test-role').set({roleName:'Fixture'});
    const ref=await proxy.collection('artifacts').doc(namespace).collection('public').doc('data').collection('employees').add({name:'Fixture'});
    assert.ok(ref.id);assert.equal(calls.length,2);assert.match(calls[0][0],/^artifacts\/timbersmith-terminal-v1\/public\/roles\/items\//);
    assert.match(calls[1][0],/\/employees\//);assert.equal(data.records.has(calls[1][0]),false);
  });
  await test('employee views strip credentials, identity numbers and contact details',()=>{
    const safe=employeeView({name:'Fixture',personalCode:'1234',pin:'private',clockPin:'private',idNumber:'private',address:'private',clockRevision:3});
    assert.deepEqual(safe,{name:'Fixture',clockRevision:3});
  });
  await test('employee edits and payroll corrections are revision checked, audited and cannot delete payroll',async()=>{
    const prefix='artifacts/'+namespace+'/public/data/employees/worker-one';
    await service.writeEmployee(actor,prefix,'set',{name:'Fixture',surname:'Worker',personalCode:'5678',status:'Out'});
    await service.writeEmployee(actor,prefix,'update',{address:'new address'});assert.equal(data.records.get(prefix).clockRevision,0);
    await assert.rejects(()=>service.writeEmployee(actor,prefix,'update',{history:[{date:'2026-11-05',hours:8}]}));
    await service.writeEmployee(actor,prefix,'update',{history:[{date:'2026-11-05',hours:8}],weeklyHours:8,monthlyHours:8,_expectedClockRevision:0,_auditReason:'Verified paper attendance sheet'});
    assert.equal(data.records.get(prefix).clockRevision,1);
    await assert.rejects(()=>service.writeEmployee(actor,prefix,'update',{history:[],_expectedClockRevision:0,_auditReason:'Stale correction must be refused'}));
    await assert.rejects(()=>service.writeEmployee(actor,prefix,'delete',undefined));
    assert.equal(data.records.get(prefix).history[0].hours,8);
    const record=(await store.read(created.id))!;
    const analyst={...record,permissions:{'Work Analytics':{Edit:true}}};
    await service.writeEmployee(analyst,prefix,'update',{todayHours:2,_expectedClockRevision:1,_auditReason:'Verified attendance correction'});
    await assert.rejects(()=>service.writeEmployee(analyst,prefix,'update',{personalCode:'1111'}));
    const audits=[...data.records.values()].filter(r=>r.event==='MANAGEMENT_EMPLOYEE_UPDATE'&&r.attendanceAfter?.todayHours===2);
    assert.equal(audits[0].attendanceBefore.todayHours,0);
  });
  await test('HTTP management routes remain closed by default without touching Firebase',async()=>{
    const previous=process.env.TSJ_ENABLE_SECURE_MANAGEMENT;delete process.env.TSJ_ENABLE_SECURE_MANAGEMENT;
    const app=express();app.use('/api/management',managementRoutes());
    const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
    try{const address=server.address();assert.ok(address&&typeof address==='object');
      assert.equal((await fetch(`http://127.0.0.1:${address.port}/api/management/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,503);
    }finally{if(previous===undefined)delete process.env.TSJ_ENABLE_SECURE_MANAGEMENT;else process.env.TSJ_ENABLE_SECURE_MANAGEMENT=previous;await new Promise<void>(resolve=>server.close(()=>resolve()));}
  });
  console.log(`All ${passed} secure-management checks passed. Fictional stores and Auth; no Firebase data access.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
