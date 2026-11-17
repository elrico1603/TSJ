import assert from 'node:assert/strict';
import { LegacyUserMigration, LEGACY_TARGETS } from '../server/legacyUserMigration';

const target = LEGACY_TARGETS.find(t=>t.email==='frans@tsjoinery.co.za')!;
async function main(){
  const auth = {app:{options:{projectId:'timbersmithapp'}}} as any;
  const db = {} as any;
  const migrator = new LegacyUserMigration(db,auth);
  await assert.rejects(migrator.migrate(target,true),/explicit cutover approval/);
  console.log('PASS | No production apply without explicit option or environment approval');
  const original=process.env.TSJ_USER_CUTOVER_APPROVAL;
  process.env.TSJ_USER_CUTOVER_APPROVAL='I_REVIEWED_BACKUP_AND_SECURITY';
  try{
    await assert.rejects(migrator.migrate(target,true),/explicit cutover approval/);
    console.log('PASS | Environment variable alone cannot authorize production writes');
    const unknown={...target,uid:'not-the-allowlisted-uid'};
    await assert.rejects(migrator.migrate(unknown,true,{approvedProductionCutover:true}),/explicit cutover approval/);
    console.log('PASS | Unknown identity cannot use production migration pathway');
  }finally{
    if(original===undefined)delete process.env.TSJ_USER_CUTOVER_APPROVAL;
    else process.env.TSJ_USER_CUTOVER_APPROVAL=original;
  }
  console.log('3/3 PRODUCTION MIGRATION GUARD TESTS PASSED');
}
main().catch(error=>{console.error(error);process.exitCode=1});
