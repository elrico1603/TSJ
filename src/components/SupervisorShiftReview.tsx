import React, { useState } from 'react';
import { db, APP_ID_PATH } from '../firebase';
import type { Employee, ShiftRecord } from '../types';

type Props = { employees: Employee[]; supervisor: string; onSaved: (employee: Employee) => void };
const validIso = (value: string) => !!value && !Number.isNaN(new Date(value).getTime());
const localDay = (iso: string) => {
  const d = new Date(iso);
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
};

export function SupervisorShiftReview({ employees, supervisor, onSaved }: Props) {
  const [selection, setSelection] = useState<{ employeeId: string; index: number } | null>(null);
  const [outTime, setOutTime] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = employees.filter(e => !e.isArchived && e.status !== 'Archived')
    .flatMap(e => (e.shifts || []).map((shift, index) => ({ employee: e, shift, index }))
      .filter(x => x.shift.requiresSupervisorReview === true));
  const selected = pending.find(x => x.employee.id === selection?.employeeId && x.index === selection?.index);

  async function approve() {
    if (!selected || saving) return;
    // This client-side guard prevents accidental writes from local and preview builds.
    // Server-side Firestore rules must separately enforce supervisor authorization.
    if (typeof window === 'undefined' || window.location.hostname !== 'timbersmith-terminal.netlify.app') {
      setError('Corrections are disabled in test and preview builds.'); return;
    }
    const original = selected.shift;
    if (!original.clockInDateTime || !validIso(original.clockInDateTime) || !validIso(outTime)) {
      setError('A valid original clock-in and verified clock-out time are required.'); return;
    }
    if (!reason.trim() || reason.trim().length < 10) {
      setError('Provide an evidence-based reason of at least 10 characters.'); return;
    }
    const start = new Date(original.clockInDateTime);
    const finish = new Date(outTime);
    const duration = finish.getTime() - start.getTime();
    if (duration <= 0 || duration > 24 * 60 * 60 * 1000) {
      setError('Clock-out must be after clock-in and no more than 24 hours later.'); return;
    }
    if (!window.confirm('Approve this correction? The original record will be preserved in the audit log.')) return;
    setSaving(true); setError('');
    try {
      const ref = db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data')
        .collection('employees').doc(selected.employee.id);
      const auditRef = db.collection('artifacts').doc(APP_ID_PATH).collection('private').doc('audit')
        .collection('logs').doc();
      const updated = await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new Error('Employee record not found.');
        const current = snap.data() as Employee;
        if (current.isArchived || current.status === 'Archived') throw new Error('Archived employee records cannot be corrected.');
        const currentShift = (current.shifts || [])[selected.index];
        if (!currentShift?.requiresSupervisorReview ||
            currentShift.clockInDateTime !== original.clockInDateTime ||
            currentShift.clockOut !== original.clockOut ||
            currentShift.hours !== original.hours ||
            currentShift.date !== original.date) {
          throw new Error('Shift has changed. Refresh and review again.');
        }
        const hours = Math.round(duration / 36000) / 100;
        const day = currentShift.date || localDay(currentShift.clockInDateTime!);
        const corrected: ShiftRecord = {
          ...currentShift,
          clockOut: finish.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),
          clockOutDateTime: finish.toISOString(),
          hours,
          requiresSupervisorReview: false,
          closedBy: supervisor,
          notes: (currentShift.notes || '') + ' | Supervisor correction: ' + reason.trim()
        };
        const shifts = [...current.shifts];
        shifts[selected.index] = corrected;
        const history = [...(current.history || [])];
        const existing = history.findIndex(h => h.date === day);
        if (existing >= 0) history[existing] = { ...history[existing], hours: Math.round((history[existing].hours + hours - (currentShift.hours || 0)) * 100) / 100 };
        else history.push({ date: day, hours });
        // The transaction updates both the shift and its daily summary atomically.
        tx.update(ref, { shifts, history });
        tx.set(auditRef, {
          event: 'SUPERVISOR_SHIFT_CORRECTION', actor: supervisor,
          employeeId: current.id, employeeName: current.name + ' ' + current.surname,
          originalShift: currentShift, correctedShift: corrected,
          reason: reason.trim(), timestamp: new Date().toISOString()
        });
        return { ...current, shifts, history };
      });
      onSaved(updated);
      setSelection(null); setOutTime(''); setReason('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Correction could not be saved.'); }
    finally { setSaving(false); }
  }

  return <section className="my-6 rounded-2xl border border-amber-500/30 bg-[#161616] p-5 text-white">
    <h3 className="text-lg font-bold text-amber-400">Supervisor Review — Incomplete Shifts ({pending.length})</h3>
    <p className="mt-1 text-sm text-gray-400">Clocking continues normally. Corrections require verified evidence and create a permanent audit entry.</p>
    {pending.length === 0 && <p className="mt-4 text-sm">No flagged shifts for active employees.</p>}
    <div className="mt-4 space-y-2">{pending.map(({employee,shift,index}) => <button key={employee.id+'-'+index}
      onClick={() => {setSelection({employeeId:employee.id,index});setOutTime('');setReason('');setError('');}}
      className="block w-full rounded-lg border border-white/10 p-3 text-left hover:border-amber-400">
      <b>{employee.name} {employee.surname}</b> — {shift.date} | IN: {shift.clockIn} | OUT: {shift.clockOut} | {shift.hours} hrs
    </button>)}</div>
    {selected && <div className="mt-5 space-y-3 rounded-xl border border-white/20 p-4">
      <h4 className="font-bold">Review: {selected.employee.name} {selected.employee.surname} — {selected.shift.date}</h4>
      <p className="text-sm text-gray-300">Original IN: {selected.shift.clockInDateTime || 'Unavailable'}; original OUT: {selected.shift.clockOut}. Original data is retained in the audit log.</p>
      <label className="block text-sm">Verified clock-out date and time (local)
        <input type="datetime-local" className="mt-1 block w-full rounded bg-black p-2 text-white"
          value={outTime ? (() => {const d = new Date(outTime); const n = new Date(d.getTime()-d.getTimezoneOffset()*60000);return n.toISOString().slice(0,16);})() : ''}
          onChange={e => setOutTime(e.target.value ? new Date(e.target.value).toISOString() : '')}/>
      </label>
      <label className="block text-sm">Evidence / reason for correction
        <textarea value={reason} onChange={e=>setReason(e.target.value)}
          className="mt-1 block w-full rounded bg-black p-2 text-white" rows={3} placeholder="Source of confirmed time and reason for correction" />
      </label>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2"><button disabled={saving} onClick={approve} className="rounded bg-amber-500 px-4 py-2 font-bold text-black disabled:opacity-50">{saving?'Saving...':'Approve verified correction'}</button>
      <button onClick={()=>setSelection(null)} className="rounded border border-white/20 px-4 py-2">Cancel</button></div>
    </div>}
  </section>;
}
