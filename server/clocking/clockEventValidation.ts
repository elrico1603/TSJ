/**
 * Server-side ingress validation for offline clock events.
 *
 * This is deliberately separate from the current browser-only test transport.
 * An authenticated, device-bound server route must supply a VERIFIED identity.
 * Never store employee PINs or client-supplied authentication claims in events.
 */
import type { ClockJournalEvent } from '../../src/services/clockJournal';

export type ClockEventPayload = Pick<
  ClockJournalEvent,'id'|'employeeId'|'deviceId'|'action'|'occurredAt'
>;

export type VerifiedKioskContext = Readonly<{
  firebaseUid: string; // Verified server-side with Firebase Admin Auth.
  deviceId: string;    // Resolved from an approved device registration, NOT request JSON.
  permittedEmployeeIds?: readonly string[];
}>;

const ID_PATTERN=/^[A-Za-z0-9_-]{8,128}$/;
const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_FUTURE_MS=5*60*1000;
const MAX_UNREVIEWED_AGE_MS=45*24*60*60*1000;

export class ClockValidationError extends Error {
  constructor(public readonly code:
    'unauthorized'|'invalid_event'|'time_requires_review'|'unsupported_action',
    message:string
  ) {super(message);this.name='ClockValidationError';}
}

/** Strict validation. Future/out-of-range timestamps require REVIEW, not invented times. */
export function validateAuthorizedClockEvent(
  incoming: unknown, identity: VerifiedKioskContext | null,
  now: Date = new Date()
): ClockEventPayload {
  if (!identity || !identity.firebaseUid || !identity.deviceId) {
    throw new ClockValidationError('unauthorized','No verified, registered kiosk identity.');
  }
  if (!incoming || typeof incoming!=='object' || Array.isArray(incoming)) {
    throw new ClockValidationError('invalid_event','Invalid event payload.');
  }
  const item=incoming as Record<string,unknown>;
  if (typeof item.id!=='string' || !UUID_PATTERN.test(item.id) ||
      typeof item.employeeId!=='string' || !ID_PATTERN.test(item.employeeId) ||
      typeof item.deviceId!=='string' || !ID_PATTERN.test(item.deviceId) ||
      typeof item.occurredAt!=='string') {
    throw new ClockValidationError('invalid_event','Clock event fields are missing or malformed.');
  }
  if (item.deviceId!==identity.deviceId ||
      (identity.permittedEmployeeIds &&
       !identity.permittedEmployeeIds.includes(item.employeeId))) {
    throw new ClockValidationError('unauthorized','Device is not permitted to clock this employee.');
  }
  if (item.action!=='In' && item.action!=='Out') {
    throw new ClockValidationError('unsupported_action','This endpoint supports only normal IN and OUT events.');
  }
  // ISO strings must carry an unambiguous UTC offset and round-trip exactly.
  const occurred=new Date(item.occurredAt);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item.occurredAt) ||
      !Number.isFinite(occurred.getTime()) ||
      occurred.toISOString()!==item.occurredAt) {
    throw new ClockValidationError('invalid_event','Clock time must be a valid UTC ISO timestamp.');
  }
  const ageMs=now.getTime()-occurred.getTime();
  if (!Number.isFinite(now.getTime()) || ageMs < -MAX_FUTURE_MS ||
      ageMs > MAX_UNREVIEWED_AGE_MS) {
    throw new ClockValidationError('time_requires_review',
      'Clock timestamp is outside the automatic acceptance window; supervisor review required.');
  }
  return {
    id:item.id,
    employeeId:item.employeeId,
    deviceId:item.deviceId,
    action:item.action,
    occurredAt:item.occurredAt
  };
}

/** Compare all immutable fields so reusing an event ID with new data is rejected. */
export function sameClockEvent(
  receipt: Record<string,unknown>, event:ClockEventPayload
): boolean {
  return receipt.eventId===event.id &&
    receipt.employeeId===event.employeeId &&
    receipt.deviceId===event.deviceId &&
    receipt.action===event.action &&
    receipt.occurredAt===event.occurredAt;
}
