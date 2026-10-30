import { getUnconfirmedClockEvents, confirmClockEvent, markClockEventForReview, updateClockEvent } from './clockJournal';
import type { ClockJournalEvent } from './clockJournal';

/**
 * Offline clocking transport. The server endpoint MUST atomically persist an
 * event keyed by its ID and return that same ID only after commit. Retries
 * must return the previous acknowledgement, never create a second clocking.
 * This module is intentionally not connected to live Clocking until the
 * authenticated backend endpoint and PIN authorization are reviewed.
 */
export type ClockSyncReceipt =
  | { result: 'committed' | 'already_committed'; eventId: string }
  | { result: 'rejected'; eventId: string; reason: string };
export type ClockSyncTransport = (event: ClockJournalEvent) => Promise<ClockSyncReceipt>;
export type ClockSyncSummary = { confirmed: number; pending: number; needsReview: number };
let activeSync: Promise<ClockSyncSummary> | null = null;

export function syncClockJournal(transport: ClockSyncTransport): Promise<ClockSyncSummary> {
  if (activeSync) return activeSync;
  activeSync = performSync(transport).finally(() => { activeSync = null; });
  return activeSync;
}
async function performSync(transport: ClockSyncTransport): Promise<ClockSyncSummary> {
  const summary: ClockSyncSummary = { confirmed: 0, pending: 0, needsReview: 0 };
  const events = await getUnconfirmedClockEvents();
  // Process sequentially to preserve event order for each employee.
  for (const event of events) {
    if (event.status === 'needs_review') {
      summary.needsReview++;
      // Never automatically replay events rejected by the server.
      continue;
    }
    try {
      await updateClockEvent(event.id, { status: 'syncing', attempts: event.attempts + 1 });
      const receipt = await transport(event);
      if (receipt.eventId !== event.id) {
        await markClockEventForReview(event.id, 'Server acknowledgement event ID mismatch.');
        summary.needsReview++;
        continue;
      }
      if (receipt.result === 'rejected') {
        await markClockEventForReview(event.id, receipt.reason || 'Server rejected clocking event.');
        summary.needsReview++;
        continue;
      }
      if (receipt.result !== 'committed' && receipt.result !== 'already_committed') {
        throw new Error('Unexpected server acknowledgement.');
      }
      await confirmClockEvent(event.id, receipt.eventId);
      summary.confirmed++;
    } catch (error) {
      // A timeout is ambiguous: the server might have committed the event.
      // Keep the SAME event ID for retry; never synthesize another clocking.
      const message = error instanceof Error ? error.message : 'Unknown sync failure';
      await updateClockEvent(event.id, { status: 'pending', lastError: message });
      summary.pending++;
      // Stop: later events may depend on this employee's prior clock state.
      break;
    }
  }
  return summary;
}

/** Starts retries only when an authenticated server transport is supplied. */
export function startClockSync(transport: ClockSyncTransport, intervalMs = 30000): () => void {
  if (typeof window === 'undefined') return () => {};
  let disposed = false;
  const attempt = () => { if (!disposed && navigator.onLine) void syncClockJournal(transport).catch(console.error); };
  const timer = window.setInterval(attempt, Math.max(5000, intervalMs));
  window.addEventListener('online', attempt);
  attempt();
  return () => { disposed = true; window.clearInterval(timer); window.removeEventListener('online', attempt); };
}
