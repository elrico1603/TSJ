/** Test entry only. Bundled into .local; never imported by the app or deployed. */
import {verifyProductionPin,recordProductionClock,projectProductionWorker,productionClockDeviceId,refreshProductionRoster,syncProductionClock,signWorkerRequest,submitWorkerRequest} from '../../src/services/productionClockClient';
import type {WorkerRequest} from '../../src/services/clockWorkerRequest';
import {productionStateStore,withProductionClockLock,emptyProductionState,exportProductionJournal} from '../../src/services/productionClockStore';
import {enrollRegisteredClockKiosk} from '../../src/services/clockKioskAuth';
import firebase from 'firebase/compat/app';
import {firebaseConfig} from '../../src/firebase';
const env=(import.meta as unknown as {env:Record<string,string>}).env;
let emulatorAttached=false;
function emulatorAuth(){
  if(!env.VITE_TEST_AUTH_EMULATOR||emulatorAttached)return;
  if(firebaseConfig.projectId!=='demo-tsj-clock-test'||!/^http:\/\/127\.0\.0\.1:\d+$/.test(env.VITE_TEST_AUTH_EMULATOR))throw new Error('Unsafe emulator target.');
  const app=firebase.apps.find(app=>app.name==='tsj-clock-kiosk-auth')||firebase.initializeApp(firebaseConfig,'tsj-clock-kiosk-auth');
  app.auth().useEmulator(env.VITE_TEST_AUTH_EMULATOR);emulatorAttached=true;
}
let fixturePin='',employeeId='';
let lastRequest:WorkerRequest|undefined;
const load=()=>withProductionClockLock(productionClockDeviceId,()=>productionStateStore(productionClockDeviceId));
const api={
  async seed(entry:any,pin:string){fixturePin=pin;employeeId=entry.worker.id;
    const state=emptyProductionState(productionClockDeviceId);state.entries=[entry];state.lastSeen=Date.now();
    await withProductionClockLock(productionClockDeviceId,()=>productionStateStore(productionClockDeviceId,state));},
  configure(id:string,pin:string){employeeId=id;fixturePin=pin;emulatorAuth();},
  async enroll(token:string,id:string,pin:string){employeeId=id;fixturePin=pin;emulatorAuth();
    await enrollRegisteredClockKiosk(token,productionClockDeviceId,'production');await refreshProductionRoster();},
  async sync(){try{await syncProductionClock();return {ok:true};}catch{return {ok:false};}},
  async workerRequest(kind:'leave'|'advance'){
    const auth=await verifyProductionPin(employeeId,fixturePin);
    lastRequest=await signWorkerRequest(employeeId,auth,kind==='leave'
      ? {kind,leaveType:'Annual Leave',startDate:'2026-11-09',endDate:'2026-11-10',reason:'Fixture leave'}
      : {kind,baseAmount:100,method:'Immediate Payment',months:2,reason:'Fixture advance'});
    return submitWorkerRequest(lastRequest);
  },
  async retryWorkerRequest(){return submitWorkerRequest(lastRequest!);},
  async tamperWorkerRequest(){
    try{await submitWorkerRequest({...lastRequest!,reason:'Altered reason'});return false;}
    catch{return true;}
  },
  async wrongPin(){try{await verifyProductionPin(employeeId,'0001');return {rejected:false};}catch{return {rejected:true};}},
  async submit(action:'In'|'Out'|'Break'|'Return', supervisorPassword?:string){
    const approval=action==='Break'?{reason:'Bank appointment',identifier:'owner@fixture.invalid',password:supervisorPassword||'owner-fixture-password'}:undefined;
    try{const auth=await verifyProductionPin(employeeId,fixturePin);const event=await recordProductionClock(employeeId,auth,action,approval);
      return {saved:true,id:event.id,keyExtractable:auth.key.extractable};}
    catch(error){return {saved:false,error:error instanceof Error?error.message:'Failed'};}
  },
  async summary(){const state=await load(),worker=projectProductionWorker(state,employeeId);
    return {ids:state.events.map(e=>e.event.id),statuses:state.events.map(e=>e.status),actions:state.events.map(e=>e.event.action),
      status:worker.status,revision:worker.clockRevision,attempts:state.attempts[employeeId]?.count||0,
      encryptedCredential:typeof state.entries[0]?.credential.encryptedKey==='string',online:navigator.onLine};},
  async storageFailure(){
    const auth=await verifyProductionPin(employeeId,fixturePin),original=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(){throw new DOMException('Fixture write failure','QuotaExceededError');};
    try{await recordProductionClock(employeeId,auth,'Out');return {rejected:false};}
    catch(error){return {rejected:true,error:error instanceof Error?error.message:'Failed'};}
    finally{IDBObjectStore.prototype.put=original;}
  },
  async recovery(){let captured:Blob|undefined;
    const originalURL=URL.createObjectURL,originalClick=HTMLAnchorElement.prototype.click;
    URL.createObjectURL=(blob:Blob)=>{captured=blob;return 'blob:fictional-export';};HTMLAnchorElement.prototype.click=()=>{};
    try{await exportProductionJournal(productionClockDeviceId);return JSON.parse(await captured!.text());}
    finally{URL.createObjectURL=originalURL;HTMLAnchorElement.prototype.click=originalClick;}
  },
  async block(){await withProductionClockLock(productionClockDeviceId,async()=>{const state=await productionStateStore(productionClockDeviceId);state.blocked=true;await productionStateStore(productionClockDeviceId,state);});}
};
(window as any).clockBrowserTest=api;
(window as any).clockHarnessLoaded=true;
