import type { Firestore } from 'firebase-admin/firestore';

const ROOT='artifacts/timbersmith-terminal-v1/public/branches/items';
const BFN={id:'BR-002',branchCode:'BFN-01',branchName:'Bloemfontein',status:'active'};
const BRAND={id:'BR-001',branchCode:'Brandfort-001',branchName:'Brandfort',status:'active'};

export async function restoreApprovedBranches(db:Firestore,apply=false) {
  return db.runTransaction(async tx=>{
    const [root,mirror]=await Promise.all([tx.get(db.collection('branches')),tx.get(db.collection(ROOT))]);
    const records=[...root.docs,...mirror.docs];
    const matches=(doc:any,expected:typeof BFN)=>doc.id===expected.id &&
      Object.entries(expected).every(([key,value])=>doc.data()[key]===value);
    for(const snapshot of [root,mirror]){
      const brand=snapshot.docs.find(d=>d.id===BRAND.id);
      if(!brand || !matches(brand,BRAND))throw new Error('Brandfort differs from the approved configuration; no changes made.');
    }
    if(records.some(d=>d.id!==BRAND.id && d.data().branchCode===BRAND.branchCode))
      throw new Error('Conflicting Brandfort branch code.');
    const candidates=records.filter(d=>d.id===BFN.id||d.data().branchCode===BFN.branchCode||
      String(d.data().branchName||'').toLowerCase().startsWith('bloemfontein'));
    if(candidates.some(d=>!matches(d,BFN)))throw new Error('Conflicting Bloemfontein branch; no changes made.');
    const missing=[root,mirror].filter(s=>!s.docs.some(d=>d.id===BFN.id));
    const now=new Date().toISOString();
    if(apply)for(const s of missing)tx.create(db.collection(s===root?'branches':ROOT).doc(BFN.id),{...BFN,manager:'',telephone:'',email:'',physicalAddress:'',province:'Free State',country:'South Africa',createdAt:now,updatedAt:now});
    return {mode:apply?'apply':'read-only',brandfort:BRAND,bloemfontein:BFN,missingCopies:missing.length};
  });
}
