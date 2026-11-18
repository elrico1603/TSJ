/** Fake identities for LOCAL emulators only. */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { MANAGED_ADMIN_BASE_MODULES,MANAGED_PERMISSION_ACTIONS } from '../server/managedUserService';
if(process.env.TSJ_LOCAL_PC_TEST!=='true'||
  process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085'||
  process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099'||
  process.env.FIREBASE_PROJECT_ID!=='timbersmith-staging')
  throw Error('LOCAL SAFETY: emulator-only environment required.');
const app=initializeApp({projectId:'timbersmith-staging'});
const db=getFirestore(app), auth=getAuth(app),password='LocalTest123!';
async function seed(profileId:string,email:string,name:string,full:boolean){
  let user;
  try{user=await auth.getUserByEmail(email);}
  catch(e:any){if(e.code!=='auth/user-not-found')throw e;
    user=await auth.createUser({email,password,emailVerified:true});}
  const permissions:Record<string,Record<string,'allow'|'deny'>>={};
  for(const module of MANAGED_ADMIN_BASE_MODULES) {
    permissions[module]={};
    for(const action of MANAGED_PERMISSION_ACTIONS)
      permissions[module][action]=full?'allow':'deny';
  }
  await db.collection('authUserLinks').doc(user.uid).set({
    uid:user.uid,profileId,email,active:true});
  await db.collection('artifacts/timbersmith-terminal-v1/private/users/active').doc(profileId).set({
    id:profileId,firebaseUid:user.uid,email,name,role:full?'Administrator':'Employee',
    status:'active',active:true,isApproved:true,createdAt:new Date().toISOString(),
    branchId:'BR-001',branchName:'Brandfort',
    deviceAccess:{desktop:true,tablet:false,phone:false,terminal:false}});
  await db.collection('userPermissionOverrides').doc(profileId).set({
    userId:profileId,userEmail:email,permissions});
  console.log('READY | '+email+' | '+(full?'full access':'restricted'));
}
await seed('local-test-admin','admin@local.test','Local Test Admin',true);
await seed('local-test-limited','limited@local.test','Local Test Limited',false);
console.log('LOCAL PASSWORD for both: '+password);
process.exit(0);
