import { db } from '../firebase';
import type { Employee } from '../types';
import { applyJournalClockEvent } from './clockEventReducer';
import type { ClockJournalEvent } from './clockJournal';
import type { ClockSyncReceipt, ClockSyncTransport } from './clockSync';

/**
 * TEST-ONLY Firestore transport. This checks transaction/idempotency behavior.
 *
 * SECURITY GATE: Never call against the production APP_ID_PATH. Existing app
 * sessions use anonymous Firebase auth and current project rules are too open
 * for trusted payroll clocking. A protected backend or properly authorized
 * Firebase identity must replace this adapter for production deployment.
 *
 * Pass a dedicated test namespace containing ONLY fictional employees.
 */
export function createSandboxFirestoreClockTransport(testNamespace: string): ClockSyncTransport {
  if (!/^timbersmith-clock-test-[a-z0-9-]{3,40}$/.test(testNamespace)) {
    throw new Error('Clock replay may only run against an explicitly named fictional test namespace.');
  }
  const root = db.collection('artifacts').doc(testNamespace).collection('public').doc('data');
  return async (event: ClockJournalEvent): Promise<ClockSyncReceipt> => {
    if (!event.id || !event.employeeId || !event.deviceId ||
        !Number.isFinite(Date.parse(event.occurredAt)) ||
        (event.action !== 'In' && event.action !== 'Out' && event.action !== 'Break')) {
      return { result:'rejected', eventId:event.id, reason:'Malformed clock journal event.' };
    }
    const receiptRef = root.collection('clockEventReceipts').doc(event.id);
    const employeeRef = root.collection('employees').doc(event.employeeId);
    try {
      return await db.runTransaction(async transaction => {
        // Read all documents before any writes. Firestore may rerun this callback.
        const receiptSnap = await transaction.get(receiptRef);
        if (receiptSnap.exists) {
          const previous = receiptSnap.data();
          const identical = previous?.employeeId === event.employeeId &&
            previous?.deviceId === event.deviceId &&
            previous?.action === event.action &&
            previous?.occurredAt === event.occurredAt;
          if (!identical) {
            return { result:'rejected',eventId:event.id,reason:'Event ID already belongs to a different clocking.' };
          }
          return { result:'already_committed',eventId:event.id };
        }
        const employeeSnap = await transaction.get(employeeRef);
        if (!employeeSnap.exists) {
          return { result:'rejected',eventId:event.id,reason:'Employee not found in fictional test namespace.' };
        }
        const employee = { ...employeeSnap.data(),id:employeeSnap.id } as Employee;
        let update: Partial<Employee>;
        try {
          update = applyJournalClockEvent(employee,event);
        } catch (error) {
          return {
            result:'rejected',eventId:event.id,
            reason:error instanceof Error ? error.message : 'Clock event could not be applied.'
          };
        }
        transaction.update(employeeRef, update);
        transaction.set(receiptRef, {
          eventId:event.id,employeeId:event.employeeId,deviceId:event.deviceId,
          action:event.action,occurredAt:event.occurredAt,
          processedAt:new Date().toISOString(),result:'committed'
        });
        return { result:'committed',eventId:event.id };
      });
    } catch (error) {
      // Network or transaction errors are AMBIGUOUS. Leave the journal pending
      // and retry the same ID; the receipt distinguishes already-committed.
      throw error;
    }
  };
}
