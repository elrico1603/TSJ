import React, { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../firebase';
import type { Employee } from '../types';
import {
  queueClockEvent, listClockEvents, getUnconfirmedClockEvents, exportClockJournal, importClockJournal,
  type ClockJournalEvent
} from '../services/clockJournal';
import { syncClockJournal } from '../services/clockSync';
import { createSandboxFirestoreClockTransport } from '../services/clockFirestoreTransport';
import { isOwnerClockPilotProfile, isClockPilotSimulatedOffline, setClockPilotSimulatedOffline } from '../services/clockPilot';

const TEST_NAMESPACE = 'timbersmith-clock-test-local';
const TEST_EMPLOYEE_ID = 'fictional-clock-worker-001';
const TEST_DEVICE = 'fictional-local-test-tablet';
const isLocalhost = () => typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const testDataRoot = () => db.collection('artifacts').doc(TEST_NAMESPACE)
  .collection('public').doc('data');
const testEmployeeRef = () => testDataRoot().collection('employees').doc(TEST_EMPLOYEE_ID);
const testReceiptRef = (eventId: string) => testDataRoot().collection('clockEventReceipts').doc(eventId);

export function OfflineClockingSandbox({ employees, onLaunchOwnerPilot }: {
  employees: Employee[];
  onLaunchOwnerPilot: (employee: Employee) => Promise<void>;
}) {
  const [events,setEvents] = useState<ClockJournalEvent[]>([]);
  const [busy,setBusy] = useState(false);
  const [simulateOffline,setSimulateOffline] = useState(isClockPilotSimulatedOffline);
  const previousOffline = useRef(isClockPilotSimulatedOffline());
  const ownerProfile = employees.find(isOwnerClockPilotProfile);
  const [status,setStatus] = useState('Fictional test only. No production employee records are modified.');
  const [remoteState,setRemoteState] = useState('Not checked');
  const refresh = useCallback(async () => {
    const records = await listClockEvents();
    setEvents(records.filter(e=>e.employeeId === TEST_EMPLOYEE_ID));
  }, []);
  useEffect(() => { if (isLocalhost()) void refresh().catch(e=>setStatus(String(e))); }, [refresh]);
  useEffect(() => {
    setClockPilotSimulatedOffline(simulateOffline);
    if (previousOffline.current && !simulateOffline && isLocalhost()) {
      // Once the simulated Wi-Fi connection returns, replay the local queue.
      void run(syncNow);
    }
    previousOffline.current = simulateOffline;
  }, [simulateOffline]);
  if (!isLocalhost()) return null;

  async function run(task:()=>Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await task(); } catch(e) { setStatus('ERROR: '+(e instanceof Error?e.message:String(e))); }
    finally { await refresh().catch(console.error); setBusy(false); }
  }
  async function prepare() {
    const ref=testEmployeeRef();
    const snap=await ref.get();
    if (!snap.exists) {
      const fixture:Employee={
        id:TEST_EMPLOYEE_ID,name:'Fictional',surname:'Clocking Test',role:'Sandbox',
        personalCode:'',status:'Out',isArchived:false,todayHours:0,yesterdayHours:0,
        weeklyHours:0,monthlyHours:0,history:[],shifts:[],breaks:[],dateStarted:'2026-10-01'
      };
      await ref.set(fixture);
    }
    setStatus('Fictional Firestore employee ready in isolated test namespace.');
    await inspectRemote();
  }
  async function inspectRemote() {
    const snap=await testEmployeeRef().get({ source: 'server' });
    const e=snap.data() as Employee | undefined;
    setRemoteState(e ? `${e.status} / ${e.shifts?.length||0} completed shifts` : 'Test employee not initialized');
  }
  async function queue(action:'In'|'Out') {
    const saved=await queueClockEvent({
      employeeId:TEST_EMPLOYEE_ID,deviceId:TEST_DEVICE,
      action,occurredAt:new Date().toISOString()
    });
    setStatus(`${action.toUpperCase()} saved to tablet IndexedDB (ID: ${saved.id.slice(0,8)}). ${simulateOffline?'OFFLINE — pending sync.':'Use Sync to verify in test Firestore.'}`);
  }
  async function syncNow() {
    if (simulateOffline) {setStatus('Simulated Wi-Fi outage: records remain on this tablet.');return;}
    const result=await syncClockJournal(createSandboxFirestoreClockTransport(TEST_NAMESPACE));
    await inspectRemote();
    setStatus(`Sync: ${result.confirmed} confirmed, ${result.pending} pending, ${result.needsReview} review. Only fictional test namespace used.`);
  }
  async function verifyIdempotentReplay() {
    if (simulateOffline) throw new Error('Reconnect simulated Wi-Fi before verifying the server.');
    const confirmed = (await listClockEvents()).filter(
      e=>e.employeeId===TEST_EMPLOYEE_ID && e.status==='confirmed'
    );
    const event = confirmed[confirmed.length-1];
    if (!event) throw new Error('No previously confirmed fictional clock event to replay.');
    const beforeSnap = await testEmployeeRef().get({ source:'server' });
    if (!beforeSnap.exists) throw new Error('Fictional employee missing on Firestore server.');
    const before = beforeSnap.data() as Employee;
    const prior = JSON.stringify({
      status:before.status,shiftStartTime:before.shiftStartTime,
      history:before.history,shifts:before.shifts,
      todayHours:before.todayHours,weeklyHours:before.weeklyHours,monthlyHours:before.monthlyHours
    });
    // Deliberately send the same confirmed event ID a second time.
    const receipt = await createSandboxFirestoreClockTransport(TEST_NAMESPACE)(event);
    if (receipt.result !== 'already_committed' || receipt.eventId !== event.id)
      throw new Error('FAIL: server did not identify the duplicate event.');
    const savedReceipt = await testReceiptRef(event.id).get({ source:'server' });
    if (!savedReceipt.exists || savedReceipt.data()?.eventId !== event.id)
      throw new Error('FAIL: matching Firestore event receipt could not be verified.');
    const afterSnap = await testEmployeeRef().get({ source:'server' });
    if (!afterSnap.exists) throw new Error('Fictional employee disappeared during duplicate test.');
    const after = afterSnap.data() as Employee;
    const current = JSON.stringify({
      status:after.status,shiftStartTime:after.shiftStartTime,
      history:after.history,shifts:after.shifts,
      todayHours:after.todayHours,weeklyHours:after.weeklyHours,monthlyHours:after.monthlyHours
    });
    if (prior !== current) throw new Error('FAIL: duplicate replay changed shift data or hours.');
    await inspectRemote();
    setStatus('PASS: same event ID returned already_committed; Firestore receipt verified; shifts and hours unchanged.');
  }
  async function verifyLostAcknowledgementRecovery() {
    if (simulateOffline) throw new Error('Reconnect simulated Wi-Fi before this test.');
    // Do not mix this scenario with unfinished or quarantined events.
    const unfinished = await getUnconfirmedClockEvents();
    if (unfinished.length) throw new Error('Resolve existing pending or review events before the lost-response test.');
    const beforeSnap = await testEmployeeRef().get({ source:'server' });
    if (!beforeSnap.exists) throw new Error('Initialize fictional Firestore employee first.');
    const before = beforeSnap.data() as Employee;
    if (before.status !== 'In' && before.status !== 'Out')
      throw new Error('Fictional employee must be In or Out to run this test.');
    const event = await queueClockEvent({
      employeeId:TEST_EMPLOYEE_ID,deviceId:TEST_DEVICE,
      action:before.status==='In'?'Out':'In',occurredAt:new Date().toISOString()
    });
    const transport = createSandboxFirestoreClockTransport(TEST_NAMESPACE);
    let dropped = false;
    const failedSync = await syncClockJournal(async current => {
      const receipt = await transport(current);
      if (current.id===event.id && !dropped) {
        dropped=true;
        // Simulate a response lost AFTER Firestore committed the transaction.
        throw new Error('SIMULATED: Wi-Fi dropped after Firestore commit, before receipt reached tablet.');
      }
      return receipt;
    });
    if (!dropped || failedSync.pending!==1)
      throw new Error('FAIL: simulated lost response was not preserved as pending.');
    const savedReceipt = await testReceiptRef(event.id).get({ source:'server' });
    if (!savedReceipt.exists) throw new Error('FAIL: Firestore did not commit the original event.');
    const committedSnap = await testEmployeeRef().get({ source:'server' });
    const committed = committedSnap.data() as Employee;
    const committedState = JSON.stringify({
      status:committed.status,shiftStartTime:committed.shiftStartTime,
      history:committed.history,shifts:committed.shifts,
      todayHours:committed.todayHours,weeklyHours:committed.weeklyHours,monthlyHours:committed.monthlyHours
    });
    const replay = await transport(event);
    if (replay.result!=='already_committed' || replay.eventId!==event.id)
      throw new Error('FAIL: backend could not identify the retry as already committed.');
    const retrySync = await syncClockJournal(transport);
    if (retrySync.confirmed!==1) throw new Error('FAIL: tablet did not confirm the original pending event.');
    const afterSnap=await testEmployeeRef().get({ source:'server' });
    const after=afterSnap.data() as Employee;
    const finalState = JSON.stringify({
      status:after.status,shiftStartTime:after.shiftStartTime,
      history:after.history,shifts:after.shifts,
      todayHours:after.todayHours,weeklyHours:after.weeklyHours,monthlyHours:after.monthlyHours
    });
    if (committedState!==finalState) throw new Error('FAIL: duplicate replay changed shift data or hours.');
    await inspectRemote();
    setStatus('PASS: Firestore committed, Wi-Fi response was lost, tablet retained pending event, retry returned already_committed, and hours remained unchanged.');
  }
  const pending=events.filter(e=>e.status==='pending'||e.status==='syncing').length;
  const confirmed=events.filter(e=>e.status==='confirmed').length;
  const review=events.filter(e=>e.status==='needs_review').length;
  return (
    <section className="my-6 rounded-3xl border border-amber-500/40 bg-[#19191b] p-5 text-white space-y-4">
      <div>
        <h3 className="text-xl font-black">OFFLINE CLOCKING — LOCAL TEST SANDBOX</h3>
        <p className="text-xs text-amber-300 mt-1">
          Localhost only. Fictional employee and separate Firestore test namespace. Existing Clocking/PIN flow untouched.
        </p>
      </div>
      <div className="rounded-xl border border-sky-500/40 bg-sky-950/20 p-4 space-y-2">
        <p className="text-sm font-black text-sky-300">EXISTING OWNER PROFILE — REAL PIN FLOW PILOT</p>
        <p className="text-xs text-gray-300">
          Opens your existing photo and personal PIN screen. All pilot clock-ins and clock-outs are saved ONLY in
          the tablet journal and isolated test Firestore. Production employee hours remain untouched.
        </p>
        <button type="button"
          disabled={busy || !ownerProfile}
          onClick={()=>{ if(ownerProfile) void run(()=>onLaunchOwnerPilot(ownerProfile)); }}
          className="rounded-xl bg-sky-700 px-4 py-3 font-bold text-sm text-white disabled:opacity-40">
          Start Clocking Pilot — {ownerProfile ? ownerProfile.name+' '+ownerProfile.surname : 'Owner profile not loaded'}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-lg bg-white/10 px-3 py-2">Pending: {pending}</span>
        <span className="rounded-lg bg-emerald-900/40 px-3 py-2">Confirmed: {confirmed}</span>
        <span className="rounded-lg bg-red-900/40 px-3 py-2">Review: {review}</span>
        <span className="rounded-lg bg-white/10 px-3 py-2">Firestore: {remoteState}</span>
      </div>
      <p className="text-sm text-gray-200" role="status">{status}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy||simulateOffline}
          onClick={()=>void run(prepare)}
          className="rounded-lg bg-sky-700 px-3 py-2 font-bold text-sm disabled:opacity-40">1. Initialize fictional Firestore record</button>
        <button type="button" disabled={busy} onClick={()=>setSimulateOffline(x=>!x)}
          className={`rounded-lg px-3 py-2 font-bold text-sm ${simulateOffline?'bg-red-700':'bg-slate-600'}`}>
          {simulateOffline?'Simulated Wi-Fi: OFF':'Simulated Wi-Fi: ON'}
        </button>
        <button type="button" disabled={busy} onClick={()=>void run(()=>queue('In'))}
          className="rounded-lg bg-emerald-700 px-3 py-2 font-bold text-sm disabled:opacity-40">2. Fictional IN (save locally)</button>
        <button type="button" disabled={busy} onClick={()=>void run(()=>queue('Out'))}
          className="rounded-lg bg-orange-700 px-3 py-2 font-bold text-sm disabled:opacity-40">3. Fictional OUT (save locally)</button>
        <button type="button" disabled={busy||simulateOffline}
          onClick={()=>void run(syncNow)}
          className="rounded-lg bg-indigo-700 px-3 py-2 font-bold text-sm disabled:opacity-40">4. Sync to fictional Firestore</button>
        <button type="button" disabled={busy}
          onClick={()=>void run(async()=>{await exportClockJournal();setStatus('Local journal exported as a JSON recovery file.');})}
          className="rounded-lg bg-gray-700 px-3 py-2 font-bold text-sm disabled:opacity-40">Export TSJ recovery JSON</button>
        <label className="rounded-lg bg-gray-700 px-3 py-2 font-bold text-sm cursor-pointer">
          Import recovery JSON (quarantine)
          <input type="file" className="hidden" accept=".json,application/json" disabled={busy}
            onChange={e=>{const file=e.target.files?.[0]; if(file)void run(async()=>{
              const res=await importClockJournal(file);
              setStatus(`Imported ${res.imported} events for manual review; ${res.skipped} already present. No shifts changed.`);
            }); e.currentTarget.value='';}} />
        </label>
        <button type="button" disabled={busy}
          onClick={()=>void run(async()=>{await inspectRemote();setStatus('Read fictional Firestore status.');})}
          className="rounded-lg bg-gray-700 px-3 py-2 font-bold text-sm disabled:opacity-40">Verify Firestore state</button>
        <button type="button" disabled={busy||simulateOffline}
          onClick={()=>void run(verifyIdempotentReplay)}
          className="rounded-lg bg-emerald-800 px-3 py-2 font-bold text-sm disabled:opacity-40">5. Verify duplicate replay (no extra hours)</button>
        <button type="button" disabled={busy||simulateOffline}
          onClick={()=>void run(verifyLostAcknowledgementRecovery)}
          className="rounded-lg bg-violet-800 px-3 py-2 font-bold text-sm disabled:opacity-40">6. Test lost server response + safe retry</button>
      </div>
      <p className="text-xs text-gray-400">
        The Wi-Fi switch simulates a failed connection without disabling your real network.
        This screen tests recovery mechanics, not employee PIN authorization or production security.
      </p>
      <div className="max-h-56 overflow-auto text-xs font-mono space-y-1">
        {events.slice(-12).reverse().map(e=>
          <div key={e.id} className="flex flex-wrap gap-3 border-b border-white/10 py-2">
            <span>{new Date(e.occurredAt).toLocaleString()}</span>
            <span className="font-bold">{e.action}</span><span>{e.status}</span>
            <span>Attempts: {e.attempts}</span><span>{e.id.slice(0,12)}</span>
            {e.lastError&&<span className="text-amber-300">{e.lastError}</span>}
          </div>
        )}
      </div>
    </section>
  );
}
