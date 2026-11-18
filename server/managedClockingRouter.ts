/**
 * Isolated managed Clocking backend (not wired to the live UI).
 * Opt-in requires TSJ_CLOCKING_API_ENABLED=true and an approved identity migration.
 * It never creates, deletes, or renames employees.
 */
import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { firebaseIdentityService } from './firebaseIdentityService';
import { getServerFirestore } from './firebaseAdmin';
import { validateClockingUpdate } from './clockingMutationGuard';

export const EMPLOYEES_PATH='artifacts/timbersmith-terminal-v1/public/data/employees';
// Branch assignments are separate from employee records to guarantee that
// historical shifts, payroll fields and active Clocking state remain untouched.
export const ASSIGNMENTS_PATH='artifacts/timbersmith-terminal-v1/private/clocking/employee_branches';
const RECEIPTS_PATH='artifacts/timbersmith-terminal-v1/private/clocking/event_receipts';
const safeId=(x:unknown):x is string=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(x);
const allowed=(x:unknown)=>x===true||x==='allow';
function validEmployeePin(existing:Record<string,unknown>,submitted:string):boolean{
  if(!/^[0-9]{4}$/.test(submitted))return false;
  // Match the same primary field precedence as the legacy terminal, but
  // never accept shared fallback PINs or return the stored value.
  const secret=existing.personalCode||existing.pin||existing.clockPin;
  if(typeof secret!=='string'&&typeof secret!=='number')return false;
  const expected=String(secret);
  if(!/^[0-9]{4}$/.test(expected))return false;
  return timingSafeEqual(Buffer.from(expected),Buffer.from(submitted));
}


export function clockingApiEnabled(){
  return process.env.TSJ_CLOCKING_API_ENABLED==='true' &&
    process.env.TSJ_CLOCKING_RULES_VERIFIED==='I_VERIFIED_CLOCKING_ACCESS';
}
export interface ClockingActor {profileId:string;email:string;branchId:string;canView:boolean;canProcess:boolean;}
export async function verifyClockingActor(token:string,database:Firestore):Promise<ClockingActor> {
  const identity=await firebaseIdentityService.resolveToken(token);
  const [profile,override]=await Promise.all([
    database.doc('artifacts/timbersmith-terminal-v1/private/users/active/'+identity.profileId).get(),
    database.doc('userPermissionOverrides/'+identity.profileId).get()
  ]);
  const user=profile.data(), access=override.data();
  if(!user||!access||user.active!==true||user.isApproved!==true||
     user.firebaseUid!==identity.uid||access.userId!==identity.profileId||
     access.userEmail!==identity.email||!safeId(user.branchId)||
     access.branchId!==user.branchId||access.deviceAccess?.terminal!==true)
     throw new Error('CLOCKING_ACCESS_DENIED');
  return {profileId:identity.profileId,email:identity.email,branchId:user.branchId,
    canView:allowed(access.permissions?.Clocking?.View),
    canProcess:allowed(access.permissions?.Clocking?.Process)};
}
export async function readBranchEmployees(db:Firestore,actor:ClockingActor) {
  if(!actor.canView)throw new Error('CLOCKING_ACCESS_DENIED');
  // Legacy factory employee documents have no branchId. We therefore use an
  // explicit mapping collection instead of rewriting any employee record.
  const assigned=await db.collection(ASSIGNMENTS_PATH)
    .where('branchId','==',actor.branchId).get();
  if(assigned.size>300)throw new Error('CLOCKING_ASSIGNMENT_LIMIT');
  const mappings=assigned.docs.filter(d=>d.data().active===true && d.data().employeeId===d.id);
  if(!mappings.length)return [];
  const employees=await db.getAll(...mappings.map(d=>db.collection(EMPLOYEES_PATH).doc(d.id)));
  // Only operational fields; never return PINs, personal codes, national
  // IDs, wages, tax details or internal employee credentials to a client.
  const visible=['name','surname','role','status','isArchived','lastClock',
    'shiftStartTime','shifts','history','breaks','todayHours',
    'yesterdayHours','weeklyHours','monthlyHours','currentBreakReason'] as const;
  return employees.filter(doc=>doc.exists).map(d=>{
    const data=d.data()!,result:Record<string,unknown>={id:d.id};
    for(const field of visible)if(data[field]!==undefined)result[field]=data[field];
    return result;
  });
}
export interface ClockingCommand {
  eventId:string;
  employeeId:string;
  personalPin:string;
  expectedStatus:string;
  expectedShiftCount:number;
  update:Record<string,unknown>;
}
export async function commitClockingEvent(db:Firestore,actor:ClockingActor,input:ClockingCommand) {
  if(!actor.canProcess||!actor.canView)throw new Error('CLOCKING_ACCESS_DENIED');
  if(!safeId(input?.eventId)||!safeId(input?.employeeId)||
     typeof input.personalPin!=='string'||!/^[0-9]{4}$/.test(input.personalPin)||
     !['In','Out','Break'].includes(input?.expectedStatus)||
     !Number.isSafeInteger(input?.expectedShiftCount)||input.expectedShiftCount<0||
     !input?.update||typeof input.update!=='object'||Array.isArray(input.update))
     throw new Error('CLOCKING_INVALID_COMMAND');
  const ref=db.collection(EMPLOYEES_PATH).doc(input.employeeId);
  const receipt=db.collection(RECEIPTS_PATH).doc(actor.profileId+'_'+input.eventId);
  return db.runTransaction(async tx=>{
    // All reads happen before any write, preserving Firestore transaction ordering.
    const assignmentRef=db.collection(ASSIGNMENTS_PATH).doc(input.employeeId);
    const [duplicate,current,assignment]=await Promise.all([
      tx.get(receipt),tx.get(ref),tx.get(assignmentRef)
    ]);
    if(duplicate.exists) {
      const result=duplicate.data();
      if(result?.employeeId!==input.employeeId||result?.actorProfileId!==actor.profileId)
        throw new Error('CLOCKING_EVENT_ID_COLLISION');
      return {applied:false,alreadyProcessed:true,employeeId:input.employeeId};
    }
    if(!current.exists)throw new Error('CLOCKING_EMPLOYEE_NOT_FOUND');
    const existing=current.data()!;
    if(!validEmployeePin(existing,input.personalPin))
      throw new Error('CLOCKING_EMPLOYEE_PIN_INVALID');
    // Fail closed until explicit, independently reviewed branch assignments
    // exist. Do not touch the legacy employee document to add branchId.
    const assigned=assignment.data();
    if(!assignment.exists || assigned?.active!==true ||
       assigned?.employeeId!==input.employeeId ||
       assigned?.branchId!==actor.branchId ||
       (existing.branchId && existing.branchId!==actor.branchId))
      throw new Error('CLOCKING_BRANCH_NOT_VERIFIED');
    if(existing.status!==input.expectedStatus ||
       !Array.isArray(existing.shifts) ||
       existing.shifts.length!==input.expectedShiftCount)
      throw new Error('CLOCKING_STALE_EVENT_RELOAD_REQUIRED');
    const updates=validateClockingUpdate(existing,input.update);
    tx.update(ref,updates);
    tx.create(receipt,{actorProfileId:actor.profileId,employeeId:input.employeeId,
      branchId:actor.branchId,eventId:input.eventId,createdAt:new Date().toISOString(),
      previousShiftCount:input.expectedShiftCount});
    return {applied:true,alreadyProcessed:false,employeeId:input.employeeId};
  });
}
export function createClockingRouter() {
  const router=Router();
  router.use((_req,res,next)=>{
    res.setHeader('Cache-Control','no-store');
    if(!clockingApiEnabled())return res.status(503).json({error:'Clocking cutover is not enabled.'});
    next();
  });
  async function actor(req:any) {
    const match=/^Bearer (\S+)$/.exec(req.headers.authorization||'');
    if(!match||match[1].length>8192)throw new Error('CLOCKING_ACCESS_DENIED');
    return verifyClockingActor(match[1],getServerFirestore());
  }
  function fail(res:any,error:unknown){
    const message=error instanceof Error?error.message:'CLOCKING_UNAVAILABLE';
    const status=message==='CLOCKING_ACCESS_DENIED'?403:
      message==='CLOCKING_EMPLOYEE_NOT_FOUND'?404:
      message==='CLOCKING_STALE_EVENT_RELOAD_REQUIRED'||message==='CLOCKING_BRANCH_NOT_VERIFIED'?409:
      message==='CLOCKING_INVALID_COMMAND'?400:
      message==='CLOCKING_EMPLOYEE_PIN_INVALID'?403:503;
    return res.status(status).json({error:message.startsWith('CLOCKING_')?message:'CLOCKING_UNAVAILABLE'});
  }
  router.get('/employees',async(req,res)=>{
    try{return res.json({employees:await readBranchEmployees(getServerFirestore(),await actor(req))});}
    catch(e){return fail(res,e);}
  });
  router.post('/events',async(req,res)=>{
    try{return res.json(await commitClockingEvent(getServerFirestore(),await actor(req),req.body));}
    catch(e){return fail(res,e);}
  });
  return router;
}
