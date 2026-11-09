import React, { useEffect, useRef, useState } from 'react';
import { ClockingTerminal, PhotoAvatar } from './ClockingTerminal';
import { ClockWorkerRequestForm } from './ClockWorkerRequestForm';
import { enrollRegisteredClockKiosk } from '../services/clockKioskAuth';
import { productionClockEnabled, productionClockDeviceId, productionClockConfigurationError, projectProductionWorker,
  recordProductionClock, refreshProductionRoster, syncProductionClock, verifyProductionPin } from '../services/productionClockClient';
import { exportProductionJournal, productionStateStore, withProductionClockLock,
  type ProductionClockState } from '../services/productionClockStore';
import type { Employee } from '../types';

/** Registered IN/OUT entry only. Does not mount legacy anonymous listeners or User Creation. */
export function ProductionClockingTerminal() {
  const [state,setState]=useState<ProductionClockState|null>(null);
  const [selected,setSelected]=useState<Employee|null>(null), [pin,setPin]=useState('');
  const [authorization,setAuthorization]=useState<Awaited<ReturnType<typeof verifyProductionPin>>|null>(null);
  const [message,setMessage]=useState('Loading saved Clocking…'), [busy,setBusy]=useState(false);
  const [token,setToken]=useState(''), [showEnrollment,setShowEnrollment]=useState(false);
  const [savedId,setSavedId]=useState<string|null>(null);
  const [pinError,setPinError]=useState(false);
  const [showTimeOff,setShowTimeOff]=useState(false);
  const [workerRequest,setWorkerRequest]=useState<'leave'|'advance'|null>(null);
  const working=useRef(false), selectionVersion=useRef(0);
  const nextRosterRefresh=useRef(0);
  const configError=productionClockEnabled ? productionClockConfigurationError() : 'Registered Clocking is not activated. Contact the administrator.';
  const reload=async()=>setState(await withProductionClockLock(productionClockDeviceId,()=>productionStateStore(productionClockDeviceId)));
  const networkPass=async(forceRoster=false)=>{
    if (working.current || !navigator.onLine || configError) return;
    working.current=true;
    try {
      await syncProductionClock();
      // Queue retries stay frequent; an idle tablet must not reread the whole roster every 15 seconds.
      if(forceRoster || Date.now()>=nextRosterRefresh.current) {
        nextRosterRefresh.current=Date.now()+60000;
        await refreshProductionRoster();
        nextRosterRefresh.current=Date.now()+15*60000;
        setMessage('Clocking connection checked.');
      }
    }
    catch(e){setMessage(e instanceof Error?e.message:'Connection unavailable. Saved events are retained.');}
    finally {working.current=false;await reload().catch(()=>{});}
  };
  useEffect(()=>{
    if (configError) return;
    let alive=true;
    reload().then(()=>{if(alive) void networkPass();}).catch(e=>setMessage(e.message));
    const timer=window.setInterval(()=>void networkPass(),15000);
    const refresh=()=>void networkPass(true);
    const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('tsj-production-clock'):null;
    if(channel)channel.onmessage=()=>void reload().catch(()=>{});
    window.addEventListener('online',refresh);
    void navigator.storage?.persist?.().catch(()=>{});
    return()=>{alive=false;window.clearInterval(timer);window.removeEventListener('online',refresh);channel?.close();};
  },[]);
  useEffect(()=>{
    if(!authorization)return;
    const timer=setTimeout(()=>{setAuthorization(null);setPin('');},Math.max(0,authorization.until-Date.now()));
    return()=>clearTimeout(timer);
  },[authorization]);
  function select(employee:Employee|null) {
    setShowTimeOff(false);
    setWorkerRequest(null);
    selectionVersion.current++;setSelected(employee);setAuthorization(null);setPin('');setSavedId(null);setPinError(false);
  }
  async function digit(value:string) {
    if(busy || !selected || pin.length>=4)return;
    const next=pin+value;setPin(next);
    if(next.length!==4)return;
    const version=selectionVersion.current;setBusy(true);setPinError(false);
    try {
      const auth=await verifyProductionPin(selected.id,next);
      if(version===selectionVersion.current)setAuthorization(auth);
    } catch(e){setPinError(true);setMessage(e instanceof Error?e.message:'PIN verification failed.');}
    finally{setPin('');setBusy(false);}
  }
  async function clock(action:'In'|'Out'|'Break'|'Return', approval?:{reason:string;identifier:string;password:string}) {
    if(!selected || !authorization || busy)return;
    // Consume the in-memory authorization before awaiting a save: rapid clicks cannot reuse it.
    const auth=authorization;setAuthorization(null);setBusy(true);
    try {
      const event=await recordProductionClock(selected.id,auth,action,approval);
      const label=event.action==='Break'?'TIME OFF':event.action==='Return'?'RETURN FROM TIME OFF':event.action.toUpperCase();
      setSavedId(event.id);setMessage(`${label} SAVED ON THIS DEVICE — waiting for server confirmation.`);
      setSelected(null);await reload().catch(()=>setMessage('CLOCKING SAVED ON DEVICE. Status refresh unavailable; preserve the journal.'));
      if(typeof BroadcastChannel!=='undefined') {const channel=new BroadcastChannel('tsj-production-clock');channel.postMessage('saved');channel.close();}
      void networkPass();
    } catch(e){setMessage(e instanceof Error?e.message:'Clocking was NOT saved. Inform your supervisor.');}
    finally{setBusy(false);}
  }
  const employees=(state?.entries || []).map(entry=>{
    try{return {...projectProductionWorker(state!,entry.worker.id),personalCode:'',dateStarted:'',yesterdayHours:0,breaks:[]} as Employee;}
    catch{return {...entry.worker,personalCode:'',dateStarted:'',yesterdayHours:0,breaks:[]} as Employee;}
  });
  const pending=state?.events.filter(e=>e.status==='pending').length || 0;
  const review=state?.events.filter(e=>e.status==='needs_review').length || 0;
  const saved=state?.events.find(e=>e.event.id===savedId);
  return <main className="min-h-screen bg-[#0c0c0e] text-white p-5 md:p-10 font-sans">
    <h1 className="text-2xl font-black uppercase mb-4">TS HUB Clocking Terminal</h1>
    <div role="status" className="rounded-2xl border border-amber-500/30 p-4 mb-5">
      <p>{configError || (saved?.status==='confirmed' ? 'Clocking confirmed by server.' : message)}</p>
      <p>{pending} saved on device, awaiting confirmation · {review} require supervisor review</p>
      {saved && <p className="font-bold mt-2">{saved.status==='confirmed'?'CLOCKING CONFIRMED BY SERVER':saved.status==='needs_review'?'CLOCKING RETAINED — SUPERVISOR REVIEW REQUIRED':'CLOCKING SAVED ON DEVICE — NOT YET CONFIRMED'}</p>}
      {state?.blocked && <p>Kiosk access stopped. Preserve the recovery file and contact the administrator.</p>}
      {state?.events.filter(e=>e.status==='needs_review').map(e=><p key={e.event.id} className="text-red-300">{e.reason}</p>)}
    </div>
    {!configError && <>
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={()=>void networkPass(true)} className="rounded-xl border p-3">Check connection</button>
        <button onClick={()=>void exportProductionJournal(productionClockDeviceId).catch(e=>setMessage(e.message))} className="rounded-xl border p-3">Save recovery copy</button>
        <button onClick={()=>setShowEnrollment(!showEnrollment)} className="rounded-xl border p-3">Administrator device setup</button>
      </div>
      {showEnrollment && <form className="border rounded-xl p-4 mb-6" onSubmit={async e=>{
        e.preventDefault();if(busy)return;setBusy(true);
        const secret=token;setToken('');
        try{
          if(state?.events.some(e=>e.status!=='confirmed'))throw new Error('Resolve or export pending events before changing device enrollment.');
          if(state?.blocked)throw new Error('Revoked devices require supervised recovery; local re-enrollment is blocked.');
          await enrollRegisteredClockKiosk(secret,productionClockDeviceId,'production');await networkPass(true);
        }catch(error){setMessage(error instanceof Error?error.message:'Enrollment failed.');}finally{setBusy(false);}
      }}>
        <p>Device: {productionClockDeviceId}. Enter the administrator-issued token only on this tablet.</p>
        <input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} className="bg-black border p-3 w-full mt-3" aria-label="Device enrollment token"/>
        <button disabled={busy || !token} className="border rounded p-3 mt-3">Enroll device</button>
      </form>}
      <ClockingTerminal employees={employees} setSelectedEmployee={select} setPendingAction={()=>{}} setView={()=>{}} clockingOnly/>
    </>}
    {selected && <div className="fixed inset-0 z-[200] bg-[#0c0c0c]/95 flex items-center justify-center p-4">
      <div className={`bg-[#151518] p-8 rounded-[3.5rem] border ${pinError?'border-red-500':'border-white/10'} text-center w-full max-w-md`}>
        <PhotoAvatar emp={selected} size={90} className="mx-auto mb-6 border-[#ff8c00]"/>
        <p className="text-2xl font-black uppercase">{selected.name} {selected.surname}</p>
        <p className="my-3 font-bold">{selected.status==='In'?'CLOCKED IN':selected.status==='Break'?'ON TIME OFF':'CLOCKED OUT'}</p>
        {workerRequest ? <ClockWorkerRequestForm key={workerRequest} kind={workerRequest} employeeId={selected.id} authorization={authorization}
          onClose={()=>setWorkerRequest(null)} onSaved={result=>{
            setMessage(result.notified ? `Request ${result.id} saved and sent for review.` : `Request ${result.id} saved. Ask a supervisor to check notification settings.`);
            select(null);
          }}/> : !authorization ? <>
          <h3 className="text-sm font-black uppercase text-[#ff8c00] mt-4">Employer Verification</h3>
          <p className="text-gray-400 text-xs uppercase mb-6">[ Enter Password / PIN ]</p>
          <div className="flex justify-center gap-3 h-12 mb-6">{[0,1,2,3].map(i=><div key={i} className={`w-6 h-8 rounded-lg ${pin.length>i?'bg-[#ff8c00]':'bg-black border border-white/10'}`}/>)}</div>
          <div className="grid grid-cols-3 gap-3">{[1,2,3,4,5,6,7,8,9].map(d=><button key={d} disabled={busy} onClick={()=>void digit(String(d))} className="p-5 bg-white/5 rounded-2xl text-xl font-black">{d}</button>)}
            <button disabled={busy} onClick={()=>setPin('')} className="p-5 bg-white/5 rounded-2xl text-xs uppercase">Clear</button>
            <button disabled={busy} onClick={()=>void digit('0')} className="p-5 bg-white/5 rounded-2xl text-xl font-black">0</button>
            <button disabled={busy} onClick={()=>select(null)} className="p-5 bg-red-500/10 rounded-2xl text-xs text-red-400 uppercase">Cancel</button>
          </div>{pinError && <p role="alert" className="mt-4 text-red-400">{message}</p>}
        </> : <>
          <button disabled={busy} onClick={()=>void clock(selected.status==='Break'?'Return':selected.status==='In'?'Out':'In')} className="w-full py-8 mt-6 rounded-3xl bg-[#ff8c00] text-black text-2xl font-black">{selected.status==='Break'?'RETURN FROM TIME OFF':selected.status==='In'?'CLOCK OUT':'CLOCK IN'}</button>
          {selected.status==='In' && !showTimeOff && (
            <button type="button" onClick={()=>setShowTimeOff(true)} className="mt-4 w-full border rounded p-3">TIME OFF</button>
          )}
          {!showTimeOff && <div className="mt-3 flex gap-2">
            <button type="button" onClick={()=>setWorkerRequest('leave')} className="flex-1 rounded border p-3">APPLY FOR LEAVE</button>
            <button type="button" onClick={()=>setWorkerRequest('advance')} className="flex-1 rounded border p-3">BORROW MONEY</button>
          </div>}
          {selected.status==='In' && showTimeOff && <form className="mt-4 space-y-2" onSubmit={e=>{
            e.preventDefault();
            const form=new FormData(e.currentTarget);
            const reason=String(form.get('reason')||'').trim();
            if(!reason)return;
            const identifier=String(form.get('supervisor')||'');
            const password=String(form.get('password')||'');
            e.currentTarget.reset();
            void clock('Break',{reason,identifier,password});
          }}>
            <input name="reason" aria-label="Reason for Time Off" placeholder="Reason for Time Off (e.g. bank)" required maxLength={200} className="w-full bg-black border rounded p-2"/>
            <input name="supervisor" aria-label="Supervisor username" placeholder="Supervisor username" required maxLength={254} autoComplete="off" className="w-full bg-black border rounded p-2"/>
            <input name="password" aria-label="Supervisor password" placeholder="Supervisor password" type="password" required maxLength={128} autoComplete="off" className="w-full bg-black border rounded p-2"/>
            <button disabled={busy} className="w-full border rounded p-3">APPROVE TIME OFF</button>
          </form>}
          <button onClick={()=>select(null)} className="p-4 mt-4">Cancel</button>
        </>}
      </div>
    </div>}
  </main>;
}
