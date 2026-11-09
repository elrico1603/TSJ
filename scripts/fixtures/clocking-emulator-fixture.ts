import assert from 'node:assert/strict';
import {getAuth} from 'firebase-admin/auth';
import {getFirebaseAdminApp,getServerFirestore} from '../../server/firebaseAdmin';
import {getClockKioskRegistryFirestore} from '../../server/clocking/clockKioskRegistry';
import {createClockCredential,PRODUCTION_DEVICES} from '../../server/clocking/productionClockSecurity';
import {PRODUCTION_CLOCK_NAMESPACE} from '../../src/services/productionClockContract';
import {ManagementStore} from '../../server/management/managementStore';
import {ManagementService} from '../../server/management/managementService';
import {FirestoreMigrationPort} from '../../server/management/firestoreMigrationPort';
import {runManagementMigration,type MigrationManifest} from '../../server/management/managementMigration';
export async function prepareClockEmulatorFixture(deviceId:string,employeeId:string,pin:string){
  if(process.env.GOOGLE_CLOUD_PROJECT_ID!=='demo-tsj-clock-test'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18080'||
    process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:19099'||getFirebaseAdminApp().options.projectId!=='demo-tsj-clock-test')throw new Error('Refusing non-demo or non-loopback integration target.');
  const data=getServerFirestore(),registry=getClockKioskRegistryFirestore(),auth=getAuth(getFirebaseAdminApp());
  const root=data.collection('artifacts').doc(PRODUCTION_CLOCK_NAMESPACE),employees=root.collection('public').doc('data').collection('employees');
  await employees.doc(employeeId).create({name:'Fictional',surname:'Emulator Worker',role:'Employee',personalCode:pin,status:'Out',isArchived:false,
    clockRevision:0,history:[],shifts:[],breaks:[],todayHours:0,yesterdayHours:0,weeklyHours:0,monthlyHours:0,dateStarted:'2026-11-01'});
  const uid='fixture-kiosk-'+deviceId;
  await auth.createUser({uid});
  const registration=registry.collection(PRODUCTION_DEVICES).doc(deviceId);
  await registration.create({deviceId,firebaseUid:uid,approved:true,revoked:false,namespace:PRODUCTION_CLOCK_NAMESPACE,permittedEmployeeIds:[employeeId]});
  const credential=createClockCredential(deviceId,employeeId,pin);
  await registration.collection('credentials').doc(employeeId).create(credential);
  await registration.collection('credentialHistory').doc(credential.envelope.id).create(credential);
  const enrollmentToken=await auth.createCustomToken(uid,{clocking_production:true,clocking_device_id:deviceId});
  const store=new ManagementStore(data,registry,PRODUCTION_CLOCK_NAMESPACE),service=new ManagementService(store,auth),port=new FirestoreMigrationPort(store,service);
  const profile=(id:string,email:string,password:string)=>({id,name:id,email,pin:password,role:'Employee',active:true,isApproved:true,status:'active',createdAt:'2026-11-01'});
  await store.profile('fixture-owner').create(profile('fixture-owner','owner@fixture.invalid','owner-fixture-password'));
  await store.profile('fixture-staff-old').create(profile('fixture-staff-old','staff@fixture.invalid','old-fixture-password'));
  await store.profile('fixture-staff').create(profile('fixture-staff','staff@fixture.invalid','staff-fixture-password'));
  await store.profile('fixture-unused').create(profile('fixture-unused','unused@fixture.invalid','unused-fixture-password'));
  const sources=await port.readSources(),overrides=await port.readOverrides();
  const manifest:MigrationManifest={schema:1,namespace:PRODUCTION_CLOCK_NAMESPACE,ownerEmail:'owner@fixture.invalid',
    sources:sources.map(({data,...s})=>s),overrides:overrides.map(({data,...o})=>o),choices:[
      {email:'owner@fixture.invalid',sourceId:'fixture-owner',permissionSourceId:null,include:true},
      {email:'staff@fixture.invalid',sourceId:'fixture-staff',permissionSourceId:null,include:true},
      {email:'unused@fixture.invalid',sourceId:'fixture-unused',permissionSourceId:null,include:false}]};
  const migration=await runManagementMigration(manifest,port);assert.equal(migration.accounts,2);assert.equal(migration.retired,2);
  for (const eventId of ['LEAVE_REQUEST_SUBMITTED','BORROW_MONEY_REQUESTED']) {
    await root.collection('private').doc('config').collection('notifications_policies').doc(eventId)
      .set({eventId,enabled:true,priority:'high',recipientUserIds:['fixture-owner','fixture-staff','fixture-unused','fixture-owner']});
  }
  const unauthenticated=await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/demo-tsj-clock-test/databases/(default)/documents/${employees.doc(employeeId).path}`);
  assert.equal(unauthenticated.status,403,'Real emulator rules must deny anonymous raw employee/PIN reads');
  return {enrollmentToken,async verifyWorkerRequests(leaveId:string,advanceId:string){
    const leaves=await root.collection('public').doc('leave_requests').collection('items').get();
    assert.equal(leaves.size,1);
    const leave=leaves.docs[0].data();
    assert.equal(leave.id,leaveId);assert.equal(leave.totalDays,2);assert.equal('personalCode' in leave,false);
    const advances=(await employees.doc(employeeId).get()).data()?.advances;
    assert.equal(advances.length,1);assert.equal(advances[0].id,advanceId);assert.equal(advances[0].amount,175);
    for (const userId of ['fixture-owner','fixture-staff','fixture-unused']) {
      const notes=await root.collection('users').doc(userId).collection('notifications').get();
      assert.equal(notes.size,userId==='fixture-unused'?0:2);
      if (userId!=='fixture-unused') assert.deepEqual(notes.docs.map(note=>note.id).sort(),[advanceId,leaveId].sort());
    }
  },async verifyCommitted(ids:string[],revision:number){
    const employee=await employees.doc(employeeId).get(),receipts=await root.collection('public').doc('data').collection('clockEventReceipts').get();
    assert.equal(employee.data()?.clockRevision,revision);assert.equal(receipts.size,revision);
    assert.deepEqual(receipts.docs.map(d=>d.id).sort(),ids.slice(0,revision).sort());
    return employee.data();
  },async verifyManagement(origin:string){
    const login=await fetch(origin+'api/management/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:'owner@fixture.invalid',password:'owner-fixture-password'})});
    assert.equal(login.status,200);const result=await login.json() as any;assert.equal(result.user.pin,'');
    const signed=await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo-fixture-key`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:result.customToken,returnSecureToken:true})});
    assert.equal(signed.status,200);const signedBody=await signed.json() as any;
    const session=await fetch(origin+'api/management/session',{headers:{Authorization:'Bearer '+signedBody.idToken}});
    assert.equal(session.status,200);assert.equal(((await session.json()) as any).user.id,'fixture-owner');
    const unused=await fetch(origin+'api/management/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:'unused@fixture.invalid',password:'unused-fixture-password'})});
    assert.equal(unused.status,401);assert.equal((await port.readSources()).length,2);
  }};
}
