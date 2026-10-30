/**
 * TimberSmith offline clocking journal (foundation).
 * IMPORTANT: This is not wired into the production clocking flow yet.
 * Never mark a record synced until the backend confirms its event ID.
 * PINs, credentials and employee personal details must never be journaled.
 */
export type ClockJournalStatus = 'pending' | 'syncing' | 'confirmed' | 'needs_review';
export type ClockJournalEvent = {
  id: string;
  employeeId: string;
  action: 'In' | 'Out' | 'Break';
  occurredAt: string;
  deviceId: string;
  status: ClockJournalStatus;
  attempts: number;
  createdAt: string;
  confirmedAt?: string;
  lastError?: string;
};
const DB_NAME = 'tsj-clocking-journal-v1';
const STORE = 'events';
const VERSION = 1;
function openJournal(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable: clocking cannot be safely queued.'));
  return new Promise((resolve,reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {keyPath:'id'});
        store.createIndex('status','status',{unique:false});
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open clock journal.'));
    req.onblocked = () => reject(new Error('Clock journal blocked by another browser tab.'));
  });
}
function withStore<T>(mode: IDBTransactionMode, run:(store:IDBObjectStore,resolve:(value:T)=>void,reject:(reason:unknown)=>void)=>void):Promise<T> {
  return openJournal().then(db=>new Promise<T>((resolve,reject)=>{
    const tx=db.transaction(STORE,mode);
    const store=tx.objectStore(STORE);
    let value:T;
    let assigned=false;
    tx.oncomplete=()=>{db.close(); if(assigned)resolve(value);else reject(new Error('Journal operation did not complete.'));};
    tx.onerror=()=>{db.close();reject(tx.error || new Error('Journal transaction failed.'));};
    tx.onabort=()=>{db.close();reject(tx.error || new Error('Journal transaction aborted.'));};
    try {run(store,v=>{value=v;assigned=true;},reject);} catch(e){try{tx.abort();}catch{} reject(e);}
  }));
}
export async function queueClockEvent(input:Pick<ClockJournalEvent,'employeeId'|'action'|'deviceId'|'occurredAt'>):Promise<ClockJournalEvent>{
  if(!input.employeeId || !input.deviceId || !Number.isFinite(Date.parse(input.occurredAt)))throw new Error('Invalid clock journal event.');
  if(typeof crypto==='undefined' || !crypto.randomUUID)throw new Error('Secure event IDs unavailable.');
  const event:ClockJournalEvent={...input,id:crypto.randomUUID(),status:'pending',attempts:0,createdAt:new Date().toISOString()};
  return withStore('readwrite',(store,resolve,reject)=>{const req=store.add(event);req.onsuccess=()=>resolve(event);req.onerror=()=>reject(req.error);});
}
export function listClockEvents():Promise<ClockJournalEvent[]> {
  return withStore('readonly',(store,resolve,reject)=>{const req=store.getAll();req.onsuccess=()=>resolve(req.result as ClockJournalEvent[]);req.onerror=()=>reject(req.error);});
}
export async function updateClockEvent(id:string, patch:Partial<Pick<ClockJournalEvent,'status'|'attempts'|'confirmedAt'|'lastError'>>):Promise<void> {
  return withStore('readwrite',(store,resolve,reject)=>{
    const req=store.get(id);
    req.onsuccess=()=>{
      const previous=req.result as ClockJournalEvent|undefined;
      if(!previous){reject(new Error('Clock journal event missing.'));return;}
      if(previous.status==='confirmed' && patch.status && patch.status!=='confirmed'){reject(new Error('Confirmed events cannot be reopened.'));return;}
      const put=store.put({...previous,...patch,id:previous.id,employeeId:previous.employeeId,action:previous.action,occurredAt:previous.occurredAt,deviceId:previous.deviceId});
      put.onsuccess=()=>resolve(undefined);
      put.onerror=()=>reject(put.error);
    };
    req.onerror=()=>reject(req.error);
  });
}
export async function exportClockJournal():Promise<void>{
  const events=await listClockEvents();
  const payload={format:'TSJ-CLOCK-JOURNAL',version:1,exportedAt:new Date().toISOString(),events};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download='TSJ-Clock-Journal-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

/**
 * Returns only events requiring server reconciliation. A 'syncing' record is
 * included because the tablet may have crashed after sending it.
 * The server must deduplicate by event ID before acknowledging.
 */
export async function getUnconfirmedClockEvents():Promise<ClockJournalEvent[]> {
  const events=await listClockEvents();
  return events.filter(e=>e.status!=='confirmed')
    .sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
}

/**
 * Confirm an event only after a server acknowledgement for the exact ID.
 * Never infer confirmation from network connectivity alone.
 */
export async function confirmClockEvent(id:string, acknowledgedEventId:string):Promise<void> {
  if(!id || id!==acknowledgedEventId)throw new Error('Server acknowledgement does not match journal event.');
  await updateClockEvent(id,{status:'confirmed',confirmedAt:new Date().toISOString(),lastError:undefined});
}

/** Keep failed events recoverable, including after an ambiguous timeout. */
export async function markClockEventForReview(id:string, reason:string):Promise<void> {
  if(!reason.trim())throw new Error('A failure reason is required.');
  await updateClockEvent(id,{status:'needs_review',lastError:reason.trim()});
}
