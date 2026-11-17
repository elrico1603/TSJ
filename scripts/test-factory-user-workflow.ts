import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { ManagedUserService } from '../server/managedUserService';
import { ManagedUserLifecycle } from '../server/managedUserLifecycle';
import { resolveRecipients } from '../src/services/recipientResolver';
import { notificationEventRegistry } from '../src/services/notificationEventRegistry';
import type { AppUser } from '../src/auth';

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085' ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099')
  throw new Error('Only isolated demo Firebase emulators are permitted');
const app=initializeApp({projectId:'demo-tsj-user-admin'},'factory-workflow-test');
const db=getFirestore(app), auth=getAuth(app);
const service=new ManagedUserService(db,auth), lifecycle=new ManagedUserLifecycle(db,auth);
const users=db.collection('artifacts/timbersmith-terminal-v1/private/users/active');
const policies=db.collection('artifacts/timbersmith-terminal-v1/private/config/notifications_policies');
let passed=0;
function pass(name:string){passed++;console.log('PASS | '+name)}
const adminPermissions={'User Assignments':{View:'allow',Edit:'allow'},'Notifications':{View:'allow',Edit:'allow'},'Leave Management':{View:'allow',Approve:'allow'}};
const kanbanPermissions={'Kanban Designer':{View:'allow',Edit:'allow'},'Inventory':{View:'allow'},'Stock Requests':{View:'allow'}};
const fullDevices={desktop:true,tablet:true,phone:true,terminal:false};
const tabletDevices={desktop:false,tablet:true,phone:false,terminal:false};
async function create(name:string,email:string,branchId:string,roleId:string,permissions:any,deviceAccess:any,notificationEventIds:string[]){
  return service.createUser({name,email,password:'OnlyEmulator12345!',branchId,roleId,permissions,deviceAccess,notificationEventIds},'demo-factory-admin');
}
async function main(){
  for(const role of [{id:'ROLE-25068',roleName:'Administrator'},{id:'ROLE-13491',roleName:'Kanban'}])
    await db.doc('roles/'+role.id).set({...role,active:true});
  for(const branch of [{id:'BR-001',branchName:'Brandfort',branchCode:'Brandfort-001'},{id:'BR-002',branchName:'Bloemfontein',branchCode:'BFN-01'}])
    await db.doc('branches/'+branch.id).set({...branch,active:true});

  const frans=await create('Frans Posthumus','frans-factory@example.test','BR-002','ROLE-25068',adminPermissions,fullDevices,['LEAVE_REQUEST_SUBMITTED','LOW_STOCK']);
  const janah=await create('Janah Posthumus','janah-factory@example.test','BR-002','ROLE-25068',adminPermissions,fullDevices,['LEAVE_REQUEST_SUBMITTED']);
  const stock=await create('Stock Operator','stock-factory@example.test','BR-001','ROLE-13491',kanbanPermissions,tabletDevices,['LOW_STOCK']);
  assert.equal((await users.doc(frans.profileId).get()).data()?.branchId,'BR-002');
  assert.equal((await users.doc(stock.profileId).get()).data()?.branchId,'BR-001');
  pass('Different staff retain separate configured branches');

  const stockAccess=(await db.doc('userPermissionOverrides/'+stock.profileId).get()).data()!;
  assert.equal(stockAccess.deviceAccess.tablet,true);
  assert.equal(stockAccess.deviceAccess.phone,false);
  assert.equal(stockAccess.permissions['Kanban Designer'].View,'allow');
  assert.equal(stockAccess.permissions['User Assignments'].View,'deny');
  pass('Tablet-only worker cannot inherit admin permissions');

  const leave=(await policies.doc('LEAVE_REQUEST_SUBMITTED').get()).data()!;
  assert.deepEqual(new Set(leave.recipientUserIds),new Set([frans.profileId,janah.profileId]));
  const low=(await policies.doc('LOW_STOCK').get()).data()!;
  assert.deepEqual(new Set(low.recipientUserIds),new Set([frans.profileId,stock.profileId]));
  pass('Each notification event has its own explicit recipient list');

  await service.saveUserAccess(stock.uid,{
    name:'Stock Operator',roleId:'ROLE-13491',branchId:'BR-001',permissions:kanbanPermissions,
    deviceAccess:{...tabletDevices,phone:true},deviceViewAccess:{phone:{kanban:true}}
  },'demo-factory-admin');
  const saved=(await db.doc('userPermissionOverrides/'+stock.profileId).get()).data()!;
  assert.equal(saved.deviceAccess.phone,true);
  assert.equal(saved.deviceViewAccess.phone.kanban,true);
  assert.deepEqual(new Set((await policies.doc('LOW_STOCK').get()).data()?.recipientUserIds),new Set([frans.profileId,stock.profileId]));
  pass('Phone permissions persist and editing access does not clear notifications');

  await lifecycle.setActive(frans.uid,false,'demo-factory-admin');
  assert.equal((await db.doc('authUserLinks/'+frans.uid).get()).data()?.active,false);
  assert.equal((await auth.getUser(frans.uid)).disabled,true);
  pass('Suspending administrator revokes live access');
  await lifecycle.setActive(frans.uid,true,'demo-factory-admin');
  assert.equal((await auth.getUser(frans.uid)).disabled,false);
  pass('Reactivate restores the same account without recreating it');

  await lifecycle.deleteUser(janah.uid,'demo-factory-admin');
  assert.equal((await users.doc(janah.profileId).get()).exists,false);
  assert.deepEqual((await policies.doc('LEAVE_REQUEST_SUBMITTED').get()).data()?.recipientUserIds,[frans.profileId]);
  assert.equal((await users.doc(stock.profileId).get()).exists,true);
  pass('Deletion keeps other recipients and another branch intact');
  const newJanah=await create('Janah Posthumus','janah-factory@example.test','BR-002','ROLE-25068',adminPermissions,fullDevices,[]);
  assert.notEqual(newJanah.uid,janah.uid);
  assert.equal((await users.doc(newJanah.profileId).get()).data()?.branchId,'BR-002');
  pass('Deleted test email may be recreated without changing other users');
  await db.doc('userPermissionOverrides/'+newJanah.profileId).update({permissions:{...adminPermissions,'Gemini AI Hub':{View:'deny'}}});
  const grants=(await db.doc('userPermissionOverrides/'+newJanah.profileId).get()).data()!.permissions;
  assert.equal(grants['Gemini AI Hub'].View,'deny');
  pass('New module can remain explicitly denied until a user is granted access');
  console.log(passed+'/9 FACTORY USER WORKFLOW TESTS PASSED');
}
main().catch(error=>{console.error('FACTORY TEST FAILED:',error);process.exitCode=1}).finally(()=>deleteApp(app));
