import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { LegacyUserMigration } from '../server/legacyUserMigration';
import { restoreApprovedBranches } from '../server/restoreApprovedBranches';
import { resolveManagedConfiguration } from '../server/managedConfiguration';
import { ManagedNotificationPolicies } from '../server/managedNotificationPolicies';
import { ManagedUserLifecycle } from '../server/managedUserLifecycle';
import { ManagedUserService } from '../server/managedUserService';
import { USER_PROFILES_COLLECTION } from '../server/firebaseIdentityService';

if (process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085' ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')
  throw new Error('Only demo emulators are allowed.');
const app=initializeApp({projectId:'demo-tsj-user-admin'},'extra-managed-tests');
const db=getFirestore(app),auth=getAuth(app);
const email='stable-id-fixture@example.test',id='legacy-stable-id-fixture';
const policyPath='artifacts/timbersmith-terminal-v1/private/config/notifications_policies';
const auditActor='fixture-admin';
async function main(){
  let n=0;const pass=(s:string)=>{n++;console.log('PASS | '+s)};
  const user=await auth.createUser({email,password:'EmulatorFixtureOnly123!'});
  const uid=user.uid;
  const profile=db.collection(USER_PROFILES_COLLECTION).doc(id);
  await profile.set({id,email,firebaseUid:uid,active:true,isApproved:true,status:'active',name:'Stable ID Fixture'});
  await db.doc('authUserLinks/'+uid).set({uid,profileId:id,email,active:true});
  await db.doc('userPermissionOverrides/'+id).set({userId:id,userEmail:email,permissions:{}});
  await db.doc('userRoles/'+id).set({userId:id,userEmail:email,roleId:'FIXTURE-ROLE'});
  await db.doc('artifacts/timbersmith-terminal-v1/public/userRoles/items/'+id).set({userId:id,userEmail:email,roleId:'FIXTURE-ROLE'});
  const policyService=new ManagedNotificationPolicies(db);
  const policy={eventId:'LOW_STOCK',enabled:true,priority:'high',recipientUserIds:[id],coalesceEnabled:true,coalesceWindowMinutes:30};
  const saved=await policyService.save(policy,auditActor);
  assert.equal(saved.policy.updatedByUserId,auditActor);
  assert.deepEqual((await db.doc(policyPath+'/LOW_STOCK').get()).data()!.recipientUserIds,[id]);
  pass('Server confirms notification policy and actor');
  await assert.rejects(policyService.save({...policy,recipientUserIds:['missing-fixture']},auditActor));
  assert.deepEqual((await db.doc(policyPath+'/LOW_STOCK').get()).data()!.recipientUserIds,[id]);
  pass('Invalid notification recipients cannot modify existing policy');
  const lifecycle=new ManagedUserLifecycle(db,auth);
  const deleted=await lifecycle.deleteUser(uid,auditActor);
  assert.equal(deleted.emailReusable,true);
  await assert.rejects(auth.getUser(uid));
  assert.equal((await profile.get()).exists,false);
  assert.equal((await db.doc('userPermissionOverrides/'+id).get()).exists,false);
  assert.equal((await db.doc('userRoles/'+id).get()).exists,false);
  assert.equal((await db.doc('managedUserArchive/'+uid).get()).data()!.id,id);
  assert.deepEqual((await db.doc(policyPath+'/LOW_STOCK').get()).data()!.recipientUserIds,[]);
  pass('Linked non-UID profile is deleted and history retained');
  assert.equal((await lifecycle.deleteUser(uid,auditActor)).emailReusable,true);
  pass('Deletion retry verifies the archived identity');
  await db.doc('roles/FIXTURE-ROLE').set({roleName:'Fixture'});
  await db.doc('branches/FIXTURE-BRANCH').set({branchName:'Fixture Branch'});
  const recreated=await new ManagedUserService(db,auth).createUser({
    email,name:'Recreated Fixture',password:'EmulatorFixtureOnly456!',roleId:'FIXTURE-ROLE',branchId:'FIXTURE-BRANCH',
    deviceAccess:{desktop:true,tablet:false,phone:false,terminal:false},permissions:{},notificationEventIds:[]
  },auditActor);
  assert.notEqual(recreated.uid,uid);
  pass('Deleted stable-profile email may be registered again');
  await policyService.reset('LOW_STOCK',auditActor);
  assert.equal((await db.doc(policyPath+'/LOW_STOCK').get()).exists,false);
  pass('Server-confirmed notification policy reset');
  const legacy='artifacts/timbersmith-terminal-v1/public';
  await db.doc(legacy+'/roles/items/LEGACY-TEST-ROLE').set({roleName:'Legacy Test Role',status:'active'});
  await db.doc(legacy+'/branches/items/LEGACY-TEST-BRANCH').set({branchName:'Legacy Test Branch',branchCode:'LEGACY-TEST-CODE',status:'active'});
  const resolved=await db.runTransaction(tx=>resolveManagedConfiguration(db,tx,'LEGACY-TEST-ROLE','LEGACY-TEST-CODE'));
  assert.equal(resolved.roleSource,'legacy');
  assert.equal(resolved.branchSource,'legacy');
  assert.equal(resolved.branchId,'LEGACY-TEST-BRANCH');
  pass('Existing legacy role and branch code resolve to canonical ID');
  await db.doc('branches/AMBIGUOUS-TEST-BRANCH').set({branchName:'Other Test Branch',branchCode:'LEGACY-TEST-CODE'});
  await assert.rejects(db.runTransaction(tx=>resolveManagedConfiguration(db,tx,'LEGACY-TEST-ROLE','LEGACY-TEST-CODE')));
  pass('Ambiguous branch codes are rejected');
  const brand={id:'BR-001',branchName:'Brandfort',branchCode:'Brandfort-001',status:'active',manager:'Existing Manager'};
  const brandRoot=db.doc('branches/BR-001'),brandMirror=db.doc(legacy+'/branches/items/BR-001');
  await brandRoot.set(brand);await brandMirror.set(brand);
  const plan=await restoreApprovedBranches(db,false);
  assert.equal(plan.missingCopies,2);
  assert.equal((await db.doc('branches/BR-002').get()).exists,false);
  pass('Approved branch dry run makes no writes');
  await restoreApprovedBranches(db,true);
  const bfnRoot=db.doc('branches/BR-002'),bfnMirror=db.doc(legacy+'/branches/items/BR-002');
  const bfn=(await bfnRoot.get()).data()!;
  assert.equal(bfn.branchCode,'BFN-01');
  assert.equal(bfn.branchName,'Bloemfontein');
  assert.deepEqual((await bfnMirror.get()).data(),bfn);
  assert.deepEqual((await brandRoot.get()).data(),brand);
  assert.deepEqual((await brandMirror.get()).data(),brand);
  pass('Bloemfontein restored in both collections and Brandfort unchanged');
  const resolvedBfn=await db.runTransaction(tx=>resolveManagedConfiguration(db,tx,'FIXTURE-ROLE','BFN-01'));
  assert.equal(resolvedBfn.branchId,'BR-002');
  const resolvedBrand=await db.runTransaction(tx=>resolveManagedConfiguration(db,tx,'FIXTURE-ROLE','BR-001'));
  assert.equal(resolvedBrand.branchName,'Brandfort');
  pass('Existing branch references resolve to the correct distinct branches');
  assert.equal((await restoreApprovedBranches(db,true)).missingCopies,0);
  assert.deepEqual((await bfnRoot.get()).data(),bfn);
  pass('Branch restoration is idempotent');
  const migrationEmail='role-history-fixture@example.test',migrationId='role-history-profile';
  const migrationAccount=await auth.createUser({email:migrationEmail,password:'EmulatorMigrationFixture123!'});
  const migrationTarget={uid:migrationAccount.uid,email:migrationEmail,profileId:migrationId,
    knownDuplicateIds:[],knownRoleOnlyIds:['old-role-history-1','old-role-history-2'],preferredRoleId:'FIXTURE-ROLE'};
  const retainedPermissions={'Kanban Designer':{View:'allow',Edit:'deny'}};
  await db.doc(USER_PROFILES_COLLECTION+'/'+migrationId).set({
    id:migrationId,email:migrationEmail,name:'History Fixture',active:true,isApproved:true,
    role:'Old Role',roleId:'LEGACY-TEST-ROLE',branchId:'BFN-01'
  });
  await db.doc('userPermissionOverrides/'+migrationId).set({userId:migrationId,userEmail:migrationEmail,permissions:retainedPermissions,deviceAccess:{desktop:true,phone:false,tablet:false,terminal:false}});
  for(const path of ['userRoles',legacy+'/userRoles/items']){
    await db.doc(path+'/'+migrationId).set({userId:migrationId,userEmail:migrationEmail,roleId:'FIXTURE-ROLE'});
    for(const historyId of migrationTarget.knownRoleOnlyIds) await db.doc(path+'/'+historyId).set({
      userId:historyId,userEmail:migrationEmail,roleId:'LEGACY-TEST-ROLE'
    });
  }
  const migration=new LegacyUserMigration(db,auth);
  const audit=await migration.migrate(migrationTarget,false);
  assert.equal(audit.branchId,'BR-002');assert.equal(audit.roleId,'FIXTURE-ROLE');
  assert.equal(audit.roleDocuments.length,3);
  assert.equal((await db.doc('userRoles/old-role-history-1').get()).exists,true);
  pass('Audited historical role-only IDs are accepted in dry run');
  await migration.migrate(migrationTarget,true);
  assert.equal((await db.doc(USER_PROFILES_COLLECTION+'/'+migrationId).get()).data()!.branchId,'BR-002');
  assert.equal((await db.doc(USER_PROFILES_COLLECTION+'/'+migrationId).get()).data()!.roleId,'FIXTURE-ROLE');
  assert.deepEqual((await db.doc('userPermissionOverrides/'+migrationId).get()).data()!.permissions,retainedPermissions);
  for(const historyId of migrationTarget.knownRoleOnlyIds){
    assert.equal((await db.doc('userRoles/'+historyId).get()).exists,false);
    assert.equal((await db.doc(legacy+'/userRoles/items/'+historyId).get()).exists,false);
    assert.equal((await db.doc('managedUserMigrationArchive/'+migrationAccount.uid+'-role-'+historyId).get()).exists,true);
  }
  pass('Role consolidation archives stale assignments and preserves explicit permissions');
  await bfnRoot.update({branchCode:'CONFLICTING-CODE'});
  await assert.rejects(restoreApprovedBranches(db,true));
  assert.equal((await bfnRoot.get()).data()!.branchCode,'CONFLICTING-CODE');
  assert.deepEqual((await brandRoot.get()).data(),brand);
  pass('Conflicting existing branch is not overwritten');
  console.log(n+'/15 EXTRA MANAGED USER TESTS PASSED');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>deleteApp(app));
