import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp, getServerFirestore } from '../server/firebaseAdmin';
import { LegacyUserMigration, LEGACY_TARGETS } from '../server/legacyUserMigration';

async function main() {
  const app = getFirebaseAdminApp();
  if (app.options.projectId !== 'timbersmithapp')
    throw new Error('Expected TimberSmith project for read-only migration audit.');
  const migration = new LegacyUserMigration(getServerFirestore(), getAuth(app));
  let failures=0;
  for (const target of LEGACY_TARGETS) {
    try {
      const report=await migration.migrate(target,false);
      console.log(JSON.stringify(report,null,2));
    } catch(error) {
      failures++;
      console.error('Migration blocked for '+target.email+': '+(error instanceof Error?error.message:'Unknown error'));
    }
  }
  console.log('READ-ONLY AUDIT COMPLETE. No live data changed.');
  if(failures) process.exitCode=1;
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Audit failed');process.exitCode=1;});
