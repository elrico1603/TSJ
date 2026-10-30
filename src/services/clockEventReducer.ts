import type { Employee, ShiftRecord } from '../types';
import type { ClockJournalEvent } from './clockJournal';

/**
 * Deterministic attendance reducer for replaying an offline event.
 * No Firebase calls, no PINs, and no dependence on current wall-clock time.
 * The caller must verify authorization and record an atomic event receipt.
 */
export function applyJournalClockEvent(employee: Employee, event: ClockJournalEvent): Partial<Employee> {
  if (employee.id !== event.employeeId) throw new Error('Clocking employee mismatch.');
  if (employee.isArchived || employee.status === 'Archived') throw new Error('Archived employees cannot clock.');
  if (event.action === 'Break') throw new Error('Offline break workflow requires separate approval and context.');
  const timestamp = new Date(event.occurredAt);
  if (Number.isNaN(timestamp.getTime())) throw new Error('Clocking time is invalid.');
  const displayTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const localDate = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  if (event.action === 'In') {
    const previousStart = employee.shiftStartTime ? new Date(employee.shiftStartTime) : null;
    const elapsed = previousStart ? timestamp.getTime() - previousStart.getTime() : 0;
    const stale = employee.status === 'In' && previousStart && Number.isFinite(elapsed) && elapsed > 24 * 60 * 60 * 1000;
    if (employee.status === 'In' && !stale) throw new Error('Already clocked in; duplicate clock-in refused.');
    if (employee.status === 'Break') throw new Error('Employee is on break. Use the existing time-off return workflow.');
    const shifts = [...(employee.shifts || [])];
    if (stale && previousStart) {
      shifts.push({
        date: localDate(previousStart), clockIn: displayTime(previousStart), clockOut: '--:--',
        hours: 0, clockInDateTime: previousStart.toISOString(),
        isStaleRecovery: true, requiresSupervisorReview: true,
        notes: 'Prior open shift isolated during offline journal replay; supervisor review required.'
      });
    }
    return {
      status: 'In', lastClock: displayTime(timestamp), shiftStartTime: timestamp.toISOString(),
      currentBreakReason: null, ...(stale ? { shifts } : {})
    };
  }
  if (employee.status !== 'In' || !employee.shiftStartTime) throw new Error('Clock-out requires an open, valid clock-in.');
  const start = new Date(employee.shiftStartTime);
  const durationMs = timestamp.getTime() - start.getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 24 * 60 * 60 * 1000) {
    throw new Error('Invalid shift duration: requires supervisor review.');
  }
  const hours = Math.round(durationMs / 36000) / 100;
  const date = localDate(start);
  const history = [...(employee.history || [])];
  const historyIndex = history.findIndex(item => item.date === date);
  if (historyIndex >= 0) history[historyIndex] = { ...history[historyIndex], hours: Math.round((history[historyIndex].hours + hours) * 100) / 100 };
  else history.push({ date, hours });
  const shift: ShiftRecord = {
    date, clockIn: displayTime(start), clockOut: displayTime(timestamp), hours,
    clockInDateTime: start.toISOString(), clockOutDateTime: timestamp.toISOString(),
    isOvernight: localDate(timestamp) !== date, closedBy: 'Self Terminal'
  };
  const today = localDate(timestamp);
  return {
    status: 'Out', lastClock: displayTime(timestamp), shiftStartTime: null,
    shifts: [...(employee.shifts || []), shift], history,
    todayHours: history.find(h => h.date === today)?.hours || 0,
    weeklyHours: Math.round(((employee.weeklyHours || 0) + hours) * 100) / 100,
    monthlyHours: Math.round(((employee.monthlyHours || 0) + hours) * 100) / 100
  };
}
