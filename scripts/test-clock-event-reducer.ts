/**
 * Run: npx tsx scripts/test-clock-event-reducer.ts
 * Uses only fictional employees and an in-memory journal event.
 */
import assert from 'node:assert/strict';
import { applyJournalClockEvent } from '../src/services/clockEventReducer';
import type { Employee } from '../src/types';
import type { ClockJournalEvent } from '../src/services/clockJournal';
const employee = (): Employee => ({
  id:'fictional-001',name:'Fictional',surname:'Employee',role:'Tester',
  personalCode:'',status:'Out',isArchived:false,todayHours:0,
  yesterdayHours:0,weeklyHours:0,monthlyHours:0,history:[],shifts:[],breaks:[],
  dateStarted:'2026-10-01'
});
const event = (action:'In'|'Out',occurredAt:string):ClockJournalEvent => ({
  id:'fictional-event-'+action+'-'+occurredAt,employeeId:'fictional-001',
  action,occurredAt,deviceId:'fictional-tablet',
  status:'pending',attempts:0,createdAt:occurredAt
});
const check = (testName:string, fn:()=>void) => { fn(); console.log('PASS '+testName); };
const first = employee();
const atIn=event('In','2026-10-30T06:00:00.000Z');
const afterIn = { ...first, ...applyJournalClockEvent(first,atIn) } as Employee;
check('clock-in records original event time',()=>{
  assert.equal(afterIn.status,'In');
  assert.equal(afterIn.shiftStartTime,atIn.occurredAt);
});
check('duplicate clock-in rejected',()=>{
  assert.throws(()=>applyJournalClockEvent(afterIn,atIn),/Already clocked in/);
});
const atOut=event('Out','2026-10-30T15:00:00.000Z');
const afterOut={...afterIn,...applyJournalClockEvent(afterIn,atOut)} as Employee;
check('clock-out calculates nine hours',()=>{
  assert.equal(afterOut.status,'Out');
  assert.equal(afterOut.shifts.length,1);
  assert.equal(afterOut.shifts[0].hours,9);
  assert.equal(afterOut.history[0].hours,9);
});
check('duplicate clock-out rejected',()=>{
  assert.throws(()=>applyJournalClockEvent(afterOut,atOut),/requires an open/);
});
check('clock-out before clock-in rejected',()=>{
  assert.throws(()=>applyJournalClockEvent(afterIn,event('Out','2026-10-30T05:00:00.000Z')),/Invalid shift duration/);
});
check('archived employee cannot clock',()=>{
  assert.throws(()=>applyJournalClockEvent({...first,isArchived:true},atIn),/Archived/);
});
check('stale open shift preserved for supervisor review',()=>{
  const old={...afterIn,shiftStartTime:'2026-10-27T06:00:00.000Z'};
  const result=applyJournalClockEvent(old,event('In','2026-10-30T06:00:00.000Z'));
  assert.equal(result.shifts?.length,1);
  assert.equal(result.shifts?.[0].requiresSupervisorReview,true);
  assert.equal(result.shiftStartTime,'2026-10-30T06:00:00.000Z');
});
check('open shift older than 24 hours cannot be silently closed',()=>{
  const old={...afterIn,shiftStartTime:'2026-10-27T06:00:00.000Z'};
  assert.throws(()=>applyJournalClockEvent(old,atOut),/supervisor review/);
});
check('South African midnight date assigned correctly even on UTC server',()=>{
  const midnightIn=event('In','2026-10-30T22:30:00.000Z');
  const result=applyJournalClockEvent(employee(),midnightIn);
  assert.equal(result.lastClock,'00:30');
  const out=applyJournalClockEvent({...employee(),...result} as Employee,event('Out','2026-10-31T07:30:00.000Z'));
  assert.equal(out.shifts?.[0].date,'2026-10-31');
  assert.equal(out.shifts?.[0].clockIn,'00:30');
  assert.equal(out.shifts?.[0].hours,9);
});
console.log('All 9 fictional clock-event reducer checks passed.');
