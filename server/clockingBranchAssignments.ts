/**
 * Safe employee branch assignment service.
 *
 * Uses its own Firestore collection. Never updates employee documents:
 * shifts, history, pay and PIN values remain untouched.
 * All changes are transactional, with explicit branch and employee ID checks.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { ASSIGNMENTS_PATH, EMPLOYEES_PATH } from './managedClockingRouter';
import { validateClockingBranchAssignments, type BranchId } from './clockingBranchManifest';

const VALID_BRANCHES:ReadonlySet<string>=new Set(['BR-001','BR-002']);
const BRANCH_ROOT='branches';
const BRANCH_MIRROR='artifacts/timbersmith-terminal-v1/public/branches/items';
const AUDIT='artifacts/timbersmith-terminal-v1/private/clocking/branch_assignment_audit';

async function requireVerifiedBranch(db:Firestore,id:string){
  if(!VALID_BRANCHES.has(id))throw Error('Invalid Clocking branch.');
  const [primary,mirror]=await Promise.all([
    db.collection(BRANCH_ROOT).doc(id).get(),
    db.collection(BRANCH_MIRROR).doc(id).get()
  ]);
  const expected=id==='BR-001'?'Brandfort':'Bloemfontein';
  if(!primary.exists||!mirror.exists||primary.data()?.status!=='active'||
     mirror.data()?.status!=='active'||primary.data()?.branchName!==expected||
     mirror.data()?.branchName!==expected)
    throw Error('Clocking branch is missing or inactive.');
}

/** Produce a non-mutating review of the requested assignments. */
export async function previewBranchAssignments(db:Firestore,rows:unknown) {
  const snapshot=await db.collection(EMPLOYEES_PATH).get();
  const current=snapshot.docs.map(doc=>({
    id:doc.id,name:[doc.data().name,doc.data().surname].filter(Boolean).join(' ').trim()
  }));
  const checked=validateClockingBranchAssignments(rows,current);
  if(checked.errors.length)return {ready:false,errors:checked.errors,assignments:[]};
  for(const branch of [...new Set(checked.assignments.map(a=>a.branchId))])
    await requireVerifiedBranch(db,branch);
  const existing=await db.collection(ASSIGNMENTS_PATH).get();
  if(existing.size>0)return {ready:false,errors:['Branch assignments already exist. Use controlled transfer instead.'],assignments:[]};
  return {ready:true,errors:[],assignments:checked.assignments};
}

/**
 * Initialize once after explicit review and an independent Firestore backup.
 * Intentionally cannot overwrite existing assignments.
 */
export async function initializeBranchAssignments(
  db:Firestore,rows:unknown,actorProfileId:string
) {
  if(!actorProfileId||actorProfileId.includes('/'))throw Error('Invalid actor.');
  const preview=await previewBranchAssignments(db,rows);
  if(!preview.ready)throw Error('Clocking branch assignments were not validated: '+preview.errors.join(' '));
  await db.runTransaction(async tx=>{
    const refs=preview.assignments.map(a=>db.collection(ASSIGNMENTS_PATH).doc(a.employeeId));
    const employeeRefs=preview.assignments.map(a=>db.collection(EMPLOYEES_PATH).doc(a.employeeId));
    const [existing,employees]=await Promise.all([
      Promise.all(refs.map(r=>tx.get(r))),
      Promise.all(employeeRefs.map(r=>tx.get(r)))
    ]);
    if(existing.some(s=>s.exists)||employees.some(s=>!s.exists))
      throw Error('Assignments or employee records changed during review.');
    for(let i=0;i<preview.assignments.length;i++){
      const assignment=preview.assignments[i],employee=employees[i].data()!;
      if(employee.branchId && employee.branchId!==assignment.branchId)
        throw Error('Employee has conflicting existing branch; no assignments made.');
    }
    const now=new Date().toISOString();
    preview.assignments.forEach((a,i)=>tx.create(refs[i],{
      employeeId:a.employeeId,branchId:a.branchId,active:true,
      createdAt:now,updatedAt:now,updatedBy:actorProfileId
    }));
    tx.create(db.collection(AUDIT).doc(),{
      action:'INITIALIZE_CLOCKING_BRANCHES',employeeIds:preview.assignments.map(a=>a.employeeId),
      branches:[...new Set(preview.assignments.map(a=>a.branchId))],
      actorProfileId,at:now
    });
  });
  return {assigned:preview.assignments.length};
}

/** Move one worker between branches without moving or rewriting any shifts. */
export async function moveEmployeeBranch(
  db:Firestore,employeeId:string,expectedBranchId:BranchId,
  destinationBranchId:BranchId,actorProfileId:string
) {
  if(!/^[a-zA-Z0-9_-]{1,128}$/.test(employeeId)||
     !/^[a-zA-Z0-9_-]{1,128}$/.test(actorProfileId)||
     !VALID_BRANCHES.has(expectedBranchId)||!VALID_BRANCHES.has(destinationBranchId)||
     expectedBranchId===destinationBranchId)
    throw Error('Invalid employee branch transfer.');
  await requireVerifiedBranch(db,destinationBranchId);
  return db.runTransaction(async tx=>{
    const ref=db.collection(ASSIGNMENTS_PATH).doc(employeeId);
    const employeeRef=db.collection(EMPLOYEES_PATH).doc(employeeId);
    const [assignment,employee]=await Promise.all([tx.get(ref),tx.get(employeeRef)]);
    if(!employee.exists||!assignment.exists||
       assignment.data()?.employeeId!==employeeId||
       assignment.data()?.active!==true||
       assignment.data()?.branchId!==expectedBranchId)
      throw Error('Branch transfer requires current active assignment.');
    if(employee.data()?.branchId && employee.data()?.branchId!==expectedBranchId)
      throw Error('Employee contains a conflicting canonical branch.');
    const now=new Date().toISOString();
    tx.update(ref,{branchId:destinationBranchId,updatedAt:now,updatedBy:actorProfileId});
    tx.create(db.collection(AUDIT).doc(),{
      action:'TRANSFER_CLOCKING_EMPLOYEE',employeeId,from:expectedBranchId,
      to:destinationBranchId,actorProfileId,at:now
    });
    return {employeeId,from:expectedBranchId,to:destinationBranchId};
  });
}
