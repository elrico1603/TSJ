import type { Firestore, Transaction } from 'firebase-admin/firestore';
const ROOT='artifacts/timbersmith-terminal-v1/public';

export async function resolveManagedConfiguration(db:Firestore,tx:Transaction,roleId:string,branchId:string) {
  const [rootRole,legacyRole,rootBranches,legacyBranches]=await Promise.all([
    tx.get(db.collection('roles').doc(roleId)),
    tx.get(db.collection(ROOT+'/roles/items').doc(roleId)),
    tx.get(db.collection('branches')),
    tx.get(db.collection(ROOT+'/branches/items'))
  ]);
  const roles=[rootRole,legacyRole].filter(s=>s.exists).map(s=>s.data()!);
  const roleNames=[...new Set(roles.map(r=>r.roleName).filter(n=>typeof n==='string'&&n.trim()))];
  if(!roles.length || roleNames.length!==1 || roles.some(r=>r.status==='archived'||r.active===false))
    throw new Error('Role missing, inactive or conflicting: '+roleId);
  const records=[...rootBranches.docs,...legacyBranches.docs];
  const matching=records.filter(s=>s.id===branchId||s.data().branchCode===branchId);
  const ids=[...new Set(matching.map(s=>s.id))];
  if(ids.length!==1) throw new Error('Branch missing or ambiguous: '+branchId);
  const canonicalId=ids[0];
  const branches=records.filter(s=>s.id===canonicalId);
  const names=[...new Set(branches.map(s=>s.data().branchName).filter(n=>typeof n==='string'&&n.trim()))];
  if(names.length!==1 || branches.some(s=>s.data().status==='archived'||s.data().active===false))
    throw new Error('Branch inactive or conflicting: '+branchId);
  return {roleId,roleName:String(roleNames[0]),branchId:canonicalId,branchName:String(names[0]),
    roleSource:rootRole.exists?'root':'legacy',branchSource:rootBranches.docs.some(s=>s.id===canonicalId)?'root':'legacy'};
}
