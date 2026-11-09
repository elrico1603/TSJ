import type { Employee } from '../types';

export const PRODUCTION_CLOCK_NAMESPACE = 'timbersmith-terminal-v1';
export const CLOCK_LEASE_MS = 7 * 24 * 60 * 60 * 1000;
export const CLOCK_PIN_ITERATIONS = 600000;
export type ProductionClockAction = 'In' | 'Out' | 'Break' | 'Return';
export type ProductionClockEvent = {
  id: string; employeeId: string; deviceId: string; credentialId: string;
  action: ProductionClockAction; reason?: string; occurredAt: string; expectedRevision: number; signature: string;
};
export type ClockCredentialEnvelope = {
  id: string; deviceId: string; employeeId: string; issuedAt: string; expiresAt: string;
  salt: string; iv: string; encryptedKey: string;
};
export type ClockWorker = Pick<Employee,
  'id' | 'name' | 'surname' | 'role' | 'employeeNumber' | 'status' | 'isArchived' |
  'shiftStartTime' | 'lastClock' | 'todayHours' | 'weeklyHours' | 'monthlyHours' |
  'history' | 'shifts' | 'currentBreakReason'> & { clockRevision: number; breaks?: Employee['breaks'] };
export type ClockRosterEntry = { worker: ClockWorker; credential: ClockCredentialEnvelope };
export type ProductionClockReceipt = {
  result: 'committed' | 'already_committed'; eventId: string; worker: ClockWorker;
} | { result: 'rejected'; eventId: string; reason: string };

// Fixed ordered tuples: never sign arbitrary object property order or extra fields.
export function clockSigningText(event: Omit<ProductionClockEvent, 'signature'>): string {
  return JSON.stringify([1, PRODUCTION_CLOCK_NAMESPACE, event.id, event.employeeId,
    event.deviceId, event.credentialId, event.action, event.occurredAt, event.expectedRevision,
    ...(event.action === 'Break' ? [event.reason] : [])]);
}
export function credentialBinding(c: Pick<ClockCredentialEnvelope,
  'id' | 'deviceId' | 'employeeId' | 'issuedAt' | 'expiresAt'>): string {
  return JSON.stringify([1, PRODUCTION_CLOCK_NAMESPACE, c.id, c.deviceId,
    c.employeeId, c.issuedAt, c.expiresAt]);
}

/** Explicit allowlist: never copy employee PINs, identity numbers or financial details. */
export function clockWorker(employee: Employee & { clockRevision?: number }): ClockWorker {
  return {
    id: employee.id, name: employee.name || '', surname: employee.surname || '',
    role: employee.role || '', employeeNumber: employee.employeeNumber || '',
    status: employee.status, isArchived: employee.isArchived === true,
    shiftStartTime: employee.shiftStartTime || null, lastClock: employee.lastClock || '',
    currentBreakReason: employee.currentBreakReason || null,
    breaks: (employee.breaks || []).filter(b => b.shiftStartedAt && b.shiftStartedAt === employee.shiftStartTime)
      .map(b => ({id:b.id,date:b.date,leftAt:b.leftAt,returnedAt:b.returnedAt,reason:b.reason,
        ...(b.kind ? {kind:b.kind} : {}),
        shiftStartedAt:b.shiftStartedAt!,...(b.leftAtIso ? {leftAtIso:b.leftAtIso} : {}),
        ...(b.returnedAtIso ? {returnedAtIso:b.returnedAtIso} : {})})),
    todayHours: employee.todayHours || 0, weeklyHours: employee.weeklyHours || 0,
    monthlyHours: employee.monthlyHours || 0,
    history: (employee.history || []).map(h => ({date: h.date, hours: h.hours})),
    shifts: (employee.shifts || []).map(s => ({
      date:s.date, clockIn:s.clockIn, clockOut:s.clockOut, hours:s.hours,
      ...(s.clockInDateTime ? {clockInDateTime:s.clockInDateTime} : {}),
      ...(s.clockOutDateTime ? {clockOutDateTime:s.clockOutDateTime} : {}),
      ...(s.isStaleRecovery ? {isStaleRecovery:true} : {}),
      ...(s.requiresSupervisorReview ? {requiresSupervisorReview:true} : {})
    })),
    clockRevision: employee.clockRevision || 0
  };
}
