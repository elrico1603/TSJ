import { getFirebaseAdminApp,getServerFirestore } from '../server/firebaseAdmin';
import { restoreApprovedBranches } from '../server/restoreApprovedBranches';
import { LegacyUserMigration,LEGACY_TARGETS } from '../server/legacyUserMigration';
import { getAuth } from 'firebase-admin/auth';

async function main(){
  const app=getFirebaseAdminApp();
  if(app.options.projectId!=='timbersmithapp'||process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)
    throw new Error('Expected live TimberSmith project without emulator overrides.');
  const args=process.argv.slice(2);
  if(args.length!==0 && (args.length!==1||args[0]!=='--apply-approved-branch'))
    throw new Error('Unexpected argument.');
  const db=getServerFirestore();
  const apply=args[0]==='--apply-approved-branch';
  console.log(JSON.stringify(await restoreApprovedBranches(db,apply),null,2));
  if(!apply){console.log('Read-only: no changes made.');return;}
  console.log('Approved branch restoration complete. Brandfort unchanged.');
  const migration=new LegacyUserMigration(db,getAuth(app));
  let failures=0;
  for(const target of LEGACY_TARGETS){
    try{console.log(JSON.stringify(await migration.migrate(target,false),null,2));}
    catch(error){failures++;console.error('Migration blocked for '+target.email+': '+(error instanceof Error?error.message:'Unknown error'));}
  }
  console.log('User migration remains READ ONLY. No user records or authentication accounts modified.');
  if(failures)process.exitCode=1;
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Branch restoration failed');process.exitCode=1;});
