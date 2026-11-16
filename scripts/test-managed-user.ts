import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { ManagedUserService, type CreateManagedUserInput } from '../server/managedUserService';
import { ManagedUserLifecycle } from '../server/managedUserLifecycle';
import { USER_PROFILES_COLLECTION } from '../server/firebaseIdentityService';

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085' ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') {
  throw new Error('STOP: both local emulators are required.');
}

const app = initializeApp({ projectId: 'demo-tsj-user-admin' }, 'managed-user-test');
const db = getFirestore(app), auth = getAuth(app);
const service = new ManagedUserService(db, auth);
const policies = db.collection('artifacts/timbersmith-terminal-v1/private/config/notifications_policies');

async function main() {
  let passed = 0;
  const pass = (name: string) => { passed++; console.log('PASS | ' + name); };
  await db.collection('roles').doc('TEST-KANBAN').set({roleName:'Kanban'});
  await db.collection('branches').doc('TEST-BFN').set({branchName:'Bloemfontein Test'});
  await policies.doc('LOW_STOCK').set({
    eventId:'LOW_STOCK', enabled:true, priority:'high',
    recipientUserIds:['other-test-recipient'], coalesceEnabled:true, coalesceWindowMinutes:60
  });
  const input: CreateManagedUserInput = {
    name:'Test User', email:'test-user@example.test',
    password:'EmulatorOnlyTest123!',
    roleId:'TEST-KANBAN', branchId:'TEST-BFN', department:'Warehouse',
    deviceAccess:{desktop:false,tablet:true,phone:false,terminal:false},
    deviceViewAccess:{tablet:{kanban:true}},
    permissions:{'Kanban Designer':{View:'allow',Edit:'allow'},'QR Scan Service':{View:'allow'}},
    notificationEventIds:['LOW_STOCK']
  };
  const created = await service.createUser(input, 'Test admin');
  assert.ok(created.success && created.uid);
  pass('Create User succeeds');
  const uid=created.uid;
  const authUser=await auth.getUser(uid);
  assert.equal(authUser.email,input.email);
  assert.equal(authUser.disabled,false);
  pass('Authentication created and enabled');
  const profileRef=db.collection(USER_PROFILES_COLLECTION).doc(uid);
  const overrideRef=db.collection('userPermissionOverrides').doc(uid);
  let profile=(await profileRef.get()).data()!;
  let override=(await overrideRef.get()).data()!;
  assert.equal(profile.name,input.name);
  assert.equal(profile.firebaseUid,uid);
  pass('Firestore profile created automatically');
  assert.equal('password' in profile,false);
  assert.equal('pin' in profile,false);
  pass('No plaintext credentials stored in new profile');
  const link=(await db.collection('authUserLinks').doc(uid).get()).data()!;
  assert.equal(link.profileId,uid);
  assert.equal(link.active,true);
  pass('Firebase UID linked');
  assert.equal(override.permissions['Kanban Designer'].View,'allow');
  assert.equal(override.permissions['QR Scan Service'].View,'allow');
  pass('Selected permissions saved');
  assert.equal(override.permissions['User Assignments'].View,'deny');
  assert.equal(override.permissions['Purchase Orders'].Approve,'deny');
  pass('Unselected permissions denied');
  assert.equal(profile.deviceAccess.tablet,true);
  assert.equal(profile.deviceAccess.desktop,false);
  assert.equal(override.deviceViewAccess.tablet.kanban,true);
  pass('Device access and views saved');
  assert.equal(profile.branchId,'TEST-BFN');
  assert.equal(profile.branchName,'Bloemfontein Test');
  pass('Branch saved');
  const low=(await policies.doc('LOW_STOCK').get()).data()!;
  assert.deepEqual(new Set(low.recipientUserIds),new Set(['other-test-recipient',uid]));
  assert.equal(low.priority,'high');
  assert.equal(low.coalesceWindowMinutes,60);
  pass('Notification recipient saved without altering others');
  await assert.rejects(service.createUser(input,'Test admin'));
  pass('Duplicate user rejected');
  await service.saveUserAccess(uid,{
    ...input, name:'Updated Test User',
    deviceAccess:{desktop:true,tablet:false,phone:false,terminal:false},
    deviceViewAccess:{desktop:{purchase_orders:true}},
    permissions:{'Purchase Orders':{View:'allow'}},
    notificationEventIds:['LEAVE_REQUEST_SUBMITTED']
  },'Test admin');
  profile=(await profileRef.get()).data()!;
  override=(await overrideRef.get()).data()!;
  assert.equal(profile.name,'Updated Test User');
  assert.equal(profile.deviceAccess.tablet,false);
  assert.equal(profile.deviceAccess.desktop,true);
  assert.equal(override.deviceViewAccess.tablet,undefined);
  pass('Name and device changes persist');
  assert.equal(override.permissions['Kanban Designer'].View,'deny');
  assert.equal(override.permissions['Purchase Orders'].View,'allow');
  pass('Permission changes persist');
  assert.equal(override.permissions['Purchase Orders'].Approve,'deny');
  pass('No unintended approval access');
  assert.deepEqual((await policies.doc('LOW_STOCK').get()).data()!.recipientUserIds,['other-test-recipient']);
  assert.ok((await policies.doc('LEAVE_REQUEST_SUBMITTED').get()).data()!.recipientUserIds.includes(uid));
  pass('Changed notification subscriptions persist');
  const lifecycle = new ManagedUserLifecycle(db, auth);
  await lifecycle.changePassword(uid, 'EmulatorChangedPassword123!', 'Test admin');
  pass('Change password succeeds');
  await lifecycle.setActive(uid,false,'Test admin');
  assert.equal((await auth.getUser(uid)).disabled,true);
  assert.equal((await profileRef.get()).data()!.active,false);
  assert.equal((await db.collection('authUserLinks').doc(uid).get()).data()!.active,false);
  pass('Suspension disables Auth and profile');
  await lifecycle.setActive(uid,true,'Test admin');
  assert.equal((await auth.getUser(uid)).disabled,false);
  assert.equal((await profileRef.get()).data()!.active,true);
  assert.equal((await db.collection('authUserLinks').doc(uid).get()).data()!.active,true);
  pass('Reactivation restores linked identity');
  await lifecycle.deleteUser(uid, 'Test admin');
  await assert.rejects(auth.getUser(uid));
  assert.equal((await profileRef.get()).exists,false);
  assert.equal((await overrideRef.get()).exists,false);
  assert.equal((await db.collection('authUserLinks').doc(uid).get()).data()!.active,false);
  assert.equal((await db.collection('managedUserArchive').doc(uid).get()).exists,true);
  assert.ok(!(await policies.doc('LEAVE_REQUEST_SUBMITTED').get()).data()!.recipientUserIds.includes(uid));
  pass('Delete removes Auth and access, preserves archive');
  assert.equal((await lifecycle.deleteUser(uid,'Test admin')).emailReusable,true);
  pass('Deletion can be safely retried');
  const recreated = await service.createUser(input,'Test admin');
  assert.notEqual(recreated.uid,uid);
  pass('Same email can be recreated with a new UID');
  await lifecycle.deleteUser(recreated.uid,'Test admin');
  console.log(passed+'/21 MANAGED USER INTEGRATION TESTS PASSED');
}
main().catch(error=>{console.error('MANAGED USER TEST FAILED:',error.message);process.exitCode=1}).finally(()=>deleteApp(app));
