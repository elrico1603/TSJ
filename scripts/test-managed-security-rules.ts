import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp as initClient, deleteApp as deleteClient } from 'firebase/app';
import { getAuth as clientAuth, connectAuthEmulator, signInWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { getFirestore as clientDb, connectFirestoreEmulator, doc, getDocFromServer, setDoc, collection, getDocsFromServer, terminate } from 'firebase/firestore';

const projectId='demo-tsj-user-admin';
if(process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085' ||
   process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Only isolated emulators permitted.');
const admin=initializeApp({projectId},'rules-admin');
const db=getFirestore(admin), auth=getAuth(admin);
const profiles='artifacts/timbersmith-terminal-v1/private/users/active';
const policies='artifacts/timbersmith-terminal-v1/private/config/notifications_policies';
const clients: ReturnType<typeof initClient>[]=[];
async function session(email?:string) {
  const app=initClient({projectId,apiKey:'demo-key',authDomain:projectId+'.firebaseapp.com'},'rules-client-'+clients.length);
  clients.push(app);
  const a=clientAuth(app);
  connectAuthEmulator(a,'http://127.0.0.1:9099',{disableWarnings:true});
  const d=clientDb(app);
  connectFirestoreEmulator(d,'127.0.0.1',8085);
  if(email) await signInWithEmailAndPassword(a,email,'EmulatorTestOnly123!');
  return {a,d};
}
async function seed(id:string,email:string,permissions:Record<string,unknown>) {
  const user=await auth.createUser({email,password:'EmulatorTestOnly123!'});
  await db.doc('authUserLinks/'+user.uid).set({uid:user.uid,profileId:id,email,active:true});
  await db.doc(profiles+'/'+id).set({id,email,firebaseUid:user.uid,active:true,isApproved:true,status:'active'});
  await db.doc('userPermissionOverrides/'+id).set({userId:id,userEmail:email,permissions});
  return user.uid;
}
async function main() {
  let n=0;
  const pass=(s:string)=>{n++;console.log('PASS | '+s)};
  const denied=async(p:Promise<unknown>)=>{await assert.rejects(p,(e:any)=>e.code==='permission-denied');};
  const userEmail='limited-rules@example.test',adminEmail='admin-rules@example.test';
  const uid=await seed('limited-rules',userEmail,{'Kanban Designer':{View:'allow'}});
  await seed('admin-rules',adminEmail,{'User Assignments':{View:'allow'},Notifications:{View:'allow'}});
  await db.doc(policies+'/LOW_STOCK').set({enabled:true,recipientUserIds:['limited-rules']});
  const inbox='artifacts/timbersmith-terminal-v1/users';
  await db.doc(inbox+'/limited-rules/notifications/notification-one')
    .set({notificationId:'notification-one',recipientUserId:'limited-rules',isRead:false});
  await db.doc(inbox+'/admin-rules/notifications/notification-two')
    .set({notificationId:'notification-two',recipientUserId:'admin-rules',isRead:false});
  const guest=await session();
  await denied(getDocFromServer(doc(guest.d,profiles+'/limited-rules')));
  pass('Unauthenticated profile reads denied');
  await signInAnonymously(guest.a);
  await denied(getDocsFromServer(collection(guest.d,profiles)));
  pass('Anonymous user listing denied');
  await denied(getDocsFromServer(collection(guest.d,inbox+'/limited-rules/notifications')));
  pass('Anonymous cannot read notification inbox');
  await db.doc('artifacts/timbersmith-terminal-v1/public/data/employees/worker-emulator')
    .set({branchId:'BR-001',name:'Test Worker',shifts:[]});
  const limited=await session(userEmail);
  assert.equal((await getDocFromServer(doc(limited.d,'authUserLinks/'+uid))).exists(),true);
  assert.equal((await getDocFromServer(doc(limited.d,profiles+'/limited-rules'))).exists(),true);
  pass('Linked user can read own identity and profile');
  await denied(getDocFromServer(doc(limited.d,'artifacts/timbersmith-terminal-v1/public/data/employees/worker-emulator')));
  pass('Client cannot bypass secure Clocking backend to read employee credentials');
  assert.equal((await getDocsFromServer(collection(limited.d,inbox+'/limited-rules/notifications'))).size,1);
  await denied(getDocsFromServer(collection(limited.d,inbox+'/admin-rules/notifications')));
  await denied(setDoc(doc(limited.d,inbox+'/limited-rules/notifications/notification-one'),{isRead:true},{merge:true}));
  pass('Inbox read is isolated and browser writes are blocked');
  await denied(getDocFromServer(doc(limited.d,profiles+'/admin-rules')));
  await denied(getDocsFromServer(collection(limited.d,profiles)));
  pass('Limited user cannot read other profiles or list users');
  await denied(setDoc(doc(limited.d,'userPermissionOverrides/limited-rules'),{permissions:{'User Assignments':{View:'allow'}}},{merge:true}));
  await denied(setDoc(doc(limited.d,'authUserLinks/'+uid),{profileId:'admin-rules'},{merge:true}));
  pass('Self-escalation and identity reassignment denied');
  await denied(setDoc(doc(limited.d,profiles+'/limited-rules'),{active:true},{merge:true}));
  pass('Client profile mutation denied');
  await denied(getDocFromServer(doc(limited.d,policies+'/LOW_STOCK')));
  pass('Notification policy read requires explicit permission');
  const manager=await session(adminEmail);
  assert.ok((await getDocsFromServer(collection(manager.d,profiles))).size>=2);
  assert.equal((await getDocFromServer(doc(manager.d,policies+'/LOW_STOCK'))).exists(),true);
  pass('Explicit admin read permissions enforced');
  assert.equal((await getDocsFromServer(collection(manager.d,inbox+'/admin-rules/notifications'))).size,1);
  await denied(getDocsFromServer(collection(manager.d,inbox+'/limited-rules/notifications')));
  pass('Administrator cannot read other user inbox');
  await denied(setDoc(doc(manager.d,policies+'/LOW_STOCK'),{enabled:false},{merge:true}));
  await denied(setDoc(doc(manager.d,profiles+'/limited-rules'),{active:false},{merge:true}));
  pass('Even admin client writes require protected backend');
  await db.doc('authUserLinks/'+uid).update({active:false});
  await denied(getDocFromServer(doc(limited.d,profiles+'/limited-rules')));
  pass('Suspension revokes access on existing client token');
  await db.doc('authUserLinks/'+uid).update({active:true});
  await db.doc(profiles+'/limited-rules').update({firebaseUid:'mismatched-uid'});
  await denied(getDocFromServer(doc(limited.d,profiles+'/limited-rules')));
  pass('Mismatched UID fails closed');
  await db.doc(profiles+'/limited-rules').update({firebaseUid:uid,isApproved:false});
  await denied(getDocFromServer(doc(limited.d,profiles+'/limited-rules')));
  pass('Unapproved profile denied');
  console.log(n+'/16 SECURITY RULES TESTS PASSED');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  for(const c of clients){await terminate(clientDb(c));await deleteClient(c);}
  await deleteApp(admin);
});
