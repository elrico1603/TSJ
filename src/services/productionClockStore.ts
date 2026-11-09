import type { ClockRosterEntry, ProductionClockEvent } from './productionClockContract';
export type StoredProductionEvent = {event:ProductionClockEvent;status:'pending'|'confirmed'|'needs_review';reason?:string};
export type ProductionClockState = {
  deviceId:string; entries:ClockRosterEntry[]; events:StoredProductionEvent[];
  attempts:Record<string,{count:number;lockedUntil:number}>; lastSeen:number; blocked?:boolean;
};
export function emptyProductionState(deviceId:string):ProductionClockState {
  return {deviceId,entries:[],events:[],attempts:{},lastSeen:0};
}
const DATABASE = 'tsj-production-clock-v1';
/** Separate from every sandbox journal. A transaction completing is the durability acknowledgement. */
export async function productionStateStore(deviceId:string, value?:ProductionClockState):Promise<ProductionClockState> {
  return new Promise((resolve,reject) => {
    let abandoned=false;
    const open = indexedDB.open(DATABASE,1);
    open.onupgradeneeded = () => open.result.createObjectStore('devices',{keyPath:'deviceId'});
    open.onerror = () => reject(new Error('Device storage unavailable. Clocking was not saved.'));
    open.onblocked = () => {abandoned=true;reject(new Error('Device storage blocked. Close other Clocking windows.'));};
    open.onsuccess = () => {
      const db = open.result;
      if(abandoned){db.close();return;}
      db.onversionchange=()=>db.close();
      let tx:IDBTransaction;
      try {tx = db.transaction('devices',value ? 'readwrite' : 'readonly',value ? {durability:'strict'} : undefined);}
      catch {db.close();reject(new Error('Approved durable browser storage is unavailable. Clocking was not saved.'));return;}
      let result = value;
      let req:IDBRequest;
      try {req = value ? tx.objectStore('devices').put(value) : tx.objectStore('devices').get(deviceId);}
      catch {tx.abort();db.close();reject(new Error('Device storage failed. Clocking was not saved.'));return;}
      req.onsuccess = () => {if (!value) result = req.result || emptyProductionState(deviceId);};
      tx.oncomplete = () => {db.close();resolve(result!);};
      tx.onabort = tx.onerror = () => {db.close();reject(new Error('Device storage failed. Clocking was not saved.'));};
    };
  });
}
export function withProductionClockLock<T>(deviceId:string, operation:()=>Promise<T>):Promise<T> {
  if (!navigator.locks) return Promise.reject(new Error('This browser cannot safely lock Clocking across tabs. Use the approved tablet browser.'));
  return navigator.locks.request('tsj-production-clock:'+deviceId,operation);
}
export async function exportProductionJournal(deviceId:string):Promise<void> {
  const state = await withProductionClockLock(deviceId,()=>productionStateStore(deviceId));
  // No encrypted PIN verifier, signing key, token or credentials in recovery exports.
  const blob = new Blob([JSON.stringify({format:'TSJ-PRODUCTION-CLOCK-RECOVERY',version:1,
    deviceId,exportedAt:new Date().toISOString(),events:state.events.filter(e=>e.status!=='confirmed')},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url;a.download='TSJ-Production-Clock-Recovery-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
