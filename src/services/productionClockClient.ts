import { getRegisteredClockKioskIdToken } from './clockKioskAuth';
import { unlockClockSigningKey, signProductionClockEvent } from './productionClockCrypto';
import { PRODUCTION_CLOCK_NAMESPACE, type ClockRosterEntry, type ProductionClockAction, type ProductionClockReceipt } from './productionClockContract';
import { projectProductionWorker, applyProductionReceipt, applyProductionAttendance } from './productionClockModel';
export { projectProductionWorker } from './productionClockModel';
import { productionStateStore, withProductionClockLock, type ProductionClockState } from './productionClockStore';
import { workerRequestSigningText, type WorkerRequest, type WorkerRequestDraft, type WorkerRequestFields } from './clockWorkerRequest';

const env = (import.meta as unknown as {env?:Record<string,string>}).env || {};
export const productionClockEnabled = env.VITE_ENABLE_PRODUCTION_CLOCKING === 'true';
export const productionClockDeviceId = env.VITE_CLOCK_DEVICE_ID || '';
const backend = env.VITE_CLOCK_API_ORIGIN || '';
export function productionClockConfigurationError():string|null {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(productionClockDeviceId)) return 'Administrator device configuration is required.';
  if (backend && (!/^https:\/\/[^/]+$/.test(backend) || new URL(backend).username || new URL(backend).password)) return 'Invalid Clocking backend configuration.';
  return null;
}
async function api(path:string, event?:unknown, supervisor?:{identifier:string;password:string}) {
  let tokenTimer:ReturnType<typeof setTimeout>;
  let token:string;
  try {
    token=await Promise.race([getRegisteredClockKioskIdToken(productionClockDeviceId,'production'),new Promise<string>((_resolve,reject)=>{
      tokenTimer=setTimeout(()=>reject(new Error('Kiosk authentication timed out. Original events remain pending.')),12000);
    })]);
  } finally {clearTimeout(tokenTimer!);}
  const response = await fetch(backend+'/api/clocking/production/'+path,{
    method:event ? 'POST':'GET',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(12000),
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,'X-Clock-Device-ID':productionClockDeviceId},
    ...(event ? {body:JSON.stringify({event,...supervisor})}:{})
  });
  if (response.status===401 || response.status===403) throw new ClockDeviceRefused();
  if ((path==='approve-time-off' || path==='worker-request') && response.status!==200) {
    const data=await response.json().catch(()=>null);
    const message=typeof data?.error==='string' ? data.error : 'The server did not confirm the request.';
    if (path==='worker-request' && response.status===422) throw new WorkerRequestRejected(message);
    throw new Error(message);
  }
  if (response.status!==200 && response.status!==409) throw new Error('Server has not confirmed Clocking. Original events remain on this device.');
  const data=await response.json();
  return {response,data};
}

export async function signWorkerRequest(id:string,authorization:Awaited<ReturnType<typeof verifyProductionPin>>,
  fields:WorkerRequestFields):Promise<WorkerRequest> {
  return withProductionClockLock(productionClockDeviceId,async()=>{
    const state=await productionStateStore(productionClockDeviceId);
    const entry=checkLease(state,id);
    if (Date.now()>authorization.until||authorization.credentialId!==entry.credential.id) throw new Error('Enter the employee PIN again.');
    const draft:WorkerRequestDraft={...fields,id:crypto.randomUUID(),employeeId:id,deviceId:state.deviceId,credentialId:entry.credential.id};
    const signature=await crypto.subtle.sign('HMAC',authorization.key,new TextEncoder().encode(workerRequestSigningText(draft)));
    return {...draft,signature:btoa(String.fromCharCode(...new Uint8Array(signature)))};
  });
}

export async function submitWorkerRequest(request:WorkerRequest):Promise<{id:string;notified:number}> {
  if (!navigator.onLine) throw new Error('Connect to the internet to submit this request.');
  const {data}=await api('worker-request',request);
  const expectedId=(request.kind==='leave'?'LV-':'ADV-')+request.id;
  if (data.id!==expectedId||!Number.isInteger(data.notified)||data.notified<0) throw new Error('Request not confirmed. Retry the same request.');
  return {id:data.id,notified:data.notified};
}
class ClockDeviceRefused extends Error {constructor(){super('Kiosk authorization refused. New Clocking is stopped; preserve the journal.');}}
export class WorkerRequestRejected extends Error {}
function checkLease(state:ProductionClockState, id:string) {
  const entry=state.entries.find(e=>e.worker.id===id), now=Date.now();
  if (state.blocked) throw new Error('Kiosk access requires administrator review.');
  if (!entry || entry.credential.deviceId!==state.deviceId || entry.credential.employeeId!==id ||
      now < Date.parse(entry.credential.issuedAt) || now > Date.parse(entry.credential.expiresAt) || now < state.lastSeen-300000) {
    throw new Error('Offline Clocking approval expired or device time changed. Contact your supervisor.');
  }
  return entry;
}
export async function verifyProductionPin(id:string,pin:string):Promise<{key:CryptoKey;credentialId:string;until:number}> {
  return withProductionClockLock(productionClockDeviceId,async()=>{
    const state=await productionStateStore(productionClockDeviceId);
    const entry=checkLease(state,id), now=Date.now(), attempts=Object.hasOwn(state.attempts,id) ? state.attempts[id] : {count:0,lockedUntil:0};
    if (attempts.lockedUntil>now) throw new Error('Too many PIN attempts. Wait before trying again.');
    // Persist the attempt BEFORE expensive verification; interruption cannot bypass the counter.
    attempts.count++; if (attempts.count>=5) attempts.lockedUntil=now+5*60000;
    state.attempts={...state.attempts,[id]:attempts};state.lastSeen=Math.max(state.lastSeen,now);
    await productionStateStore(state.deviceId,state);
    let key:CryptoKey;
    try {key=await unlockClockSigningKey(entry.credential,pin);}
    catch {throw new Error('PIN verification failed.');}
    state.attempts={...state.attempts,[id]:{count:0,lockedUntil:0}};
    await productionStateStore(state.deviceId,state);
    return {key,credentialId:entry.credential.id,until:now+60000};
  });
}
export async function recordProductionClock(id:string,authorization:Awaited<ReturnType<typeof verifyProductionPin>>,action:ProductionClockAction,
  approval?:{reason:string;identifier:string;password:string}) {
  return withProductionClockLock(productionClockDeviceId,async()=>{
    const state=await productionStateStore(productionClockDeviceId), entry=checkLease(state,id);
    if (Date.now()>authorization.until || authorization.credentialId!==entry.credential.id) throw new Error('Please enter your PIN again.');
    const worker=projectProductionWorker(state,id);
    if (action==='In' && worker.status!=='Out' || action==='Out' && worker.status!=='In') {
      throw new Error('Attendance changed. Select your profile and enter your PIN again.');
    }
    const draft={id:crypto.randomUUID(),employeeId:id,deviceId:state.deviceId,credentialId:entry.credential.id,
      action,...(action==='Break' && approval ? {reason:approval.reason.trim()} : {}),
      occurredAt:new Date().toISOString(),expectedRevision:worker.clockRevision};
    applyProductionAttendance(worker,draft);
    const event=await signProductionClockEvent(draft,authorization.key);
    if (action==='Break') {
      if (!approval || !navigator.onLine) throw new Error('Connect to the internet for supervisor approval.');
      const {data}=await api('approve-time-off',event,{identifier:approval.identifier,password:approval.password});
      if (data.approvedEventId!==event.id) throw new Error('Supervisor approval was not confirmed.');
    }
    state.events.push({event,status:'pending'});state.lastSeen=Math.max(state.lastSeen,Date.now());
    await productionStateStore(state.deviceId,state);
    return event;
  });
}
/** Sync all provisioned streams on restart, while blocking only rejected employees. */
export async function syncProductionClock():Promise<ProductionClockState> {
  const load=()=>withProductionClockLock(productionClockDeviceId,()=>productionStateStore(productionClockDeviceId));
  const snapshot=await load(), blocked=new Set<string>();
  if(snapshot.blocked)return snapshot;
  // No lock is held over a network request: offline clocking must not wait for a backlog to drain.
  for (const item of snapshot.events.filter(e=>e.status!=='confirmed')) {
      if (item.status==='needs_review') {blocked.add(item.event.employeeId);continue;}
      if (blocked.has(item.event.employeeId)) continue;
      try {
        const current=await load();
        if(current.blocked)return current;
        if(current.events.find(e=>e.event.id===item.event.id)?.status==='confirmed')continue;
        const {response,data}=await api('replay',item.event);
        const receipt=data as ProductionClockReceipt;
        if (receipt.eventId!==item.event.id ||
            response.status===409 && receipt.result!=='rejected' ||
            response.status===200 && !['committed','already_committed'].includes(receipt.result)) throw new Error('Invalid server receipt.');
        await withProductionClockLock(productionClockDeviceId,async()=>{
          const latest=await productionStateStore(productionClockDeviceId);
          applyProductionReceipt(latest,item.event.id,receipt);
          await productionStateStore(latest.deviceId,latest);
        });
        if(receipt.result==='rejected')blocked.add(item.event.employeeId);
      } catch (error) {
        if (error instanceof ClockDeviceRefused) await withProductionClockLock(productionClockDeviceId,async()=>{
          const latest=await productionStateStore(productionClockDeviceId);latest.blocked=true;await productionStateStore(latest.deviceId,latest);
        });
        throw error;
      }
  }
  return load();
}
export async function refreshProductionRoster():Promise<void> {
  // Fetch outside the journal lock, then merge into the latest state atomically.
  let data:any;
  try {({data}=await api('bootstrap'));}
  catch(error){
    if(error instanceof ClockDeviceRefused)await withProductionClockLock(productionClockDeviceId,async()=>{
      const state=await productionStateStore(productionClockDeviceId);state.blocked=true;await productionStateStore(state.deviceId,state);
    });
    throw error;
  }
  await withProductionClockLock(productionClockDeviceId,async()=>{
      const state=await productionStateStore(productionClockDeviceId);
      if (data.deviceId!==state.deviceId || data.namespace!==PRODUCTION_CLOCK_NAMESPACE || !Array.isArray(data.entries)) throw new Error('Invalid kiosk roster.');
      const entries=data.entries as ClockRosterEntry[];
      if (entries.length>100 || entries.some(e=>!e.worker?.id || e.credential?.deviceId!==state.deviceId ||
          e.credential.employeeId!==e.worker.id || !Number.isFinite(Date.parse(e.credential.expiresAt)))) throw new Error('Invalid kiosk roster.');
      // Never advance a base snapshot past an event whose server acknowledgement may have been lost.
      const pendingIds=new Set(state.events.filter(e=>e.status!=='confirmed').map(e=>e.event.employeeId));
      state.entries=[...entries.filter(e=>!pendingIds.has(e.worker.id)).map(entry=>{
        const previous=state.entries.find(e=>e.worker.id===entry.worker.id);
        return previous && previous.worker.clockRevision>entry.worker.clockRevision ? {...entry,worker:previous.worker} : entry;
      }),...state.entries.filter(e=>pendingIds.has(e.worker.id))];
      state.lastSeen=Math.max(state.lastSeen,Date.now());
      await productionStateStore(state.deviceId,state);
  });
}
