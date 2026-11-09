import React, { useState } from 'react';

const initial = {
  employee: 'TEST EMPLOYEE (fictional)',
  date: '2026-09-28',
  clockIn: '2026-09-28T07:02:00+02:00',
  clockOut: '--:--',
  hours: 0,
  requiresSupervisorReview: true
};
type Shift = typeof initial;
type Audit = { actor: string; reason: string; before: Shift; after: Shift; timestamp: string };
const localValue = (date: string) => {
  const d = new Date(date);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0,16);
};

export function SupervisorReviewSandbox() {
  const [shift, setShift] = useState<Shift>(initial);
  const [out, setOut] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [audit, setAudit] = useState<Audit[]>([]);
  const [busy, setBusy] = useState(false);
  const approve = () => {
    if (busy) return;
    setError('');
    if (!shift.requiresSupervisorReview) { setError('Already approved — duplicate approval rejected.'); return; }
    if (!out || !Number.isFinite(new Date(out).getTime())) { setError('Valid clock-out required.'); return; }
    if (reason.trim().length < 10) { setError('Evidence / reason must be at least 10 characters.'); return; }
    const duration = new Date(out).getTime() - new Date(shift.clockIn).getTime();
    if (duration <= 0 || duration > 86400000) { setError('Clock-out must be after clock-in and within 24 hours.'); return; }
    setBusy(true);
    const next: Shift = { ...shift, clockOut: new Date(out).toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'}), hours: Math.round(duration / 36000)/100, requiresSupervisorReview: false };
    setAudit(prev => [...prev, {actor:'Sandbox Supervisor', reason:reason.trim(), before:{...shift}, after:{...next}, timestamp:new Date().toISOString()}]);
    setShift(next);
    setBusy(false);
  };
  return <section className="my-5 rounded-2xl border border-sky-500/50 bg-[#101c27] p-5 text-white">
    <h3 className="text-lg font-bold text-sky-300">Supervisor Review — ISOLATED SANDBOX</h3>
    <p className="text-sm text-sky-200">Fictional employee. In-memory simulation only: no Firebase reads, writes or production changes.</p>
    <p className="mt-3 font-semibold">{shift.employee} | {shift.date} | IN 07:02 | OUT {shift.clockOut} | {shift.hours.toFixed(2)} hours</p>
    <label className="mt-3 block text-sm">Verified clock-out date/time
      <input className="mt-1 block w-full rounded bg-black p-2 text-white" type="datetime-local" value={out ? localValue(out) : ''} onChange={e => setOut(e.target.value ? new Date(e.target.value).toISOString() : '')}/>
    </label>
    <label className="mt-3 block text-sm">Evidence / reason
      <textarea className="mt-1 block w-full rounded bg-black p-2 text-white" rows={2} value={reason} onChange={e=>setReason(e.target.value)}/>
    </label>
    {error && <p role="alert" className="mt-2 text-red-400">{error}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className="rounded bg-sky-400 px-4 py-2 font-bold text-black" onClick={approve}>Approve sandbox correction</button>
      <button type="button" className="rounded border border-white/30 px-4 py-2" onClick={() => {setShift(initial);setOut('');setReason('');setError('');setAudit([]);}}>Reset fictional data</button>
    </div>
    <p className="mt-3 text-sm">Audit entries: {audit.length} | Review pending: {shift.requiresSupervisorReview ? 'Yes' : 'No'}</p>
    {audit.map((a,i)=><pre key={i} className="mt-2 overflow-x-auto rounded bg-black/60 p-3 text-xs">{JSON.stringify(a,null,2)}</pre>)}
  </section>;
}
