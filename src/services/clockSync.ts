import { getUnconfirmedClockEvents, confirmClockEvent, markClockEventForReview, updateClockEvent } from './clockJournal';
import type { ClockJournalEvent, ClockEventScope } from './clockJournal';

/**
 * The transport must atomically commit the clock event and a unique receipt
 * keyed by event ID. A repeated ID must return already_committed.
 */
export type ClockSyncReceipt =
  | { result: 'committed' | 'already_committed'; eventId: string }
  | { result: 'rejected'; eventId: string; reason: string };
export type ClockSyncTransport = (event: ClockJournalEvent) => Promise<ClockSyncReceipt>;
export type ClockSyncSummary = { confirmed: number; pending: number; needsReview: number };

export interface ClockSyncStorage {
  markSending: (event: ClockJournalEvent) => Promise<void>;
  markConfirmed: (eventId: string, serverEventId: string) => Promise<void>;
  markReview: (eventId: string, reason: string) => Promise<void>;
  markPending: (eventId: string, reason: string) => Promise<void>;
}

const browserClockSyncStorage: ClockSyncStorage = {
  markSending: event => updateClockEvent(event.id, { status: 'syncing', attempts: event.attempts + 1 }),
  markConfirmed: (id, receiptId) => confirmClockEvent(id, receiptId),
  markReview: (id, reason) => markClockEventForReview(id, reason),
  markPending: (id, reason) => updateClockEvent(id, { status: 'pending', lastError: reason })
};

/**
 * Each employee is an independent ordered stream.
 * A PERMANENT rejection quarantines that employee's stream only: other
 * employees keep syncing. A network/unknown error stops the entire pass,
 * preserving the same IDs for retry when connectivity returns.
 */
export async function replayClockEvents(
  events: ClockJournalEvent[],
  transport: ClockSyncTransport,
  storage: ClockSyncStorage
): Promise<ClockSyncSummary> {
  const summary: ClockSyncSummary = { confirmed: 0, pending: 0, needsReview: 0 };
  const blockedEmployees = new Set<string>();
  const ordered = [...events].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  );
  for (let i = 0; i < ordered.length; i++) {
    const event = ordered[i];
    if (blockedEmployees.has(event.employeeId)) {
      summary.pending++;
      continue;
    }
    if (event.status === 'needs_review') {
      blockedEmployees.add(event.employeeId);
      summary.needsReview++;
      continue;
    }
    try {
      await storage.markSending(event);
      const receipt = await transport(event);
      if (receipt.eventId !== event.id) {
        await storage.markReview(event.id, 'Server acknowledgement event ID mismatch.');
        blockedEmployees.add(event.employeeId);
        summary.needsReview++;
        continue;
      }
      if (receipt.result === 'rejected') {
        await storage.markReview(event.id, receipt.reason || 'Server rejected clocking event.');
        blockedEmployees.add(event.employeeId);
        summary.needsReview++;
        continue;
      }
      if (receipt.result !== 'committed' && receipt.result !== 'already_committed') {
        throw new Error('Unexpected server acknowledgement.');
      }
      await storage.markConfirmed(event.id, receipt.eventId);
      summary.confirmed++;
    } catch (error) {
      // The server MAY have committed. Keep the original event ID unchanged.
      const message = error instanceof Error ? error.message : 'Unknown sync failure';
      await storage.markPending(event.id, message);
      summary.pending += ordered.length - i;
      break;
    }
  }
  return summary;
}

// A single global promise can accidentally reuse the wrong employee's
// transport. Lock only the exact device/employee stream being replayed.
const activeSyncByScope = new Map<string,Promise<ClockSyncSummary>>();
export function syncClockJournal(
  transport: ClockSyncTransport,
  scope: ClockEventScope
): Promise<ClockSyncSummary> {
  // Scope validation must reject missing identities even with zero records.
  if (!scope || typeof scope.employeeId!=='string' || !scope.employeeId.trim() ||
      typeof scope.deviceId!=='string' || !scope.deviceId.trim()) {
    return Promise.reject(new Error('Clock sync requires employee and device scope.'));
  }
  const key=JSON.stringify([scope.employeeId,scope.deviceId]);
  const active=activeSyncByScope.get(key);
  if (active) return active;
  const run=getUnconfirmedClockEvents(scope)
    .then(events=>replayClockEvents(events,transport,browserClockSyncStorage));
  const tracked=run.finally(()=>{
    if (activeSyncByScope.get(key)===tracked) activeSyncByScope.delete(key);
  });
  activeSyncByScope.set(key,tracked);
  return tracked;
}

/** Sync only after a properly authenticated transport has been supplied. */
export function startClockSync(
  transport: ClockSyncTransport,
  scope: ClockEventScope,
  intervalMs = 30000,
  canSync: () => boolean = () => true
): () => void {
  if (typeof window === 'undefined') return () => {};
  let disposed = false;
  const attempt = () => {
    if (!disposed && navigator.onLine && canSync()) void syncClockJournal(transport,scope).catch(console.error);
  };
  const timer = window.setInterval(attempt, Math.max(5000, intervalMs));
  window.addEventListener('online', attempt);
  attempt();
  return () => {
    disposed = true;
    window.clearInterval(timer);
    window.removeEventListener('online', attempt);
  };
}
