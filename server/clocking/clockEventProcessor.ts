/**
 * Server-only Firestore transaction processor.
 *
 * IMPORTANT SECURITY GATE: this module is NOT an HTTP route and is restricted
 * to a fictional namespace. Deployment requires a separate Firebase Admin
 * token + registered-device verifier, endpoint hardening and Firestore rules.
 * Never accept VerifiedKioskContext from a request body.
 */
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { Employee } from '../../src/types';
import type { ClockJournalEvent } from '../../src/services/clockJournal';
import type { ClockSyncReceipt } from '../../src/services/clockSync';
import { applyJournalClockEvent } from '../../src/services/clockEventReducer';
import {
  validateAuthorizedClockEvent, sameClockEvent,
  type VerifiedKioskContext
} from './clockEventValidation';

export async function processVerifiedClockEvent(
  firestore:Firestore,
  namespace:string,
  rawEvent:unknown,
  verifiedIdentity:VerifiedKioskContext | null,
  now:Date = new Date()
):Promise<ClockSyncReceipt> {
  // Explicit safe allowlist; the existing production namespace can NEVER be
  // passed here until reviewed authorization and deployment are completed.
  if(!/^timbersmith-clock-test-[a-z0-9-]{3,40}$/.test(namespace)) {
    throw new Error('Clock event processor is restricted to test namespaces.');
  }
  const event=validateAuthorizedClockEvent(rawEvent,verifiedIdentity,now);
  const root=firestore.collection('artifacts').doc(namespace)
    .collection('public').doc('data');
  const receiptRef=root.collection('clockEventReceipts').doc(event.id);
  const employeeRef=root.collection('employees').doc(event.employeeId);
  const actorUid=verifiedIdentity!.firebaseUid;

  return firestore.runTransaction<ClockSyncReceipt>(async tx=>{
    // All reads before writes. Firestore may rerun this callback on contention.
    const previous=await tx.get(receiptRef);
    if(previous.exists) {
      if(!sameClockEvent(previous.data() || {},event)) {
        return {result:'rejected',eventId:event.id,reason:'Event ID collision: mismatched immutable fields.'};
      }
      return {result:'already_committed',eventId:event.id};
    }
    const employeeSnap=await tx.get(employeeRef);
    if(!employeeSnap.exists) {
      return {result:'rejected',eventId:event.id,reason:'Employee not registered in test namespace.'};
    }
    const employee={...employeeSnap.data(),id:employeeSnap.id} as Employee;
    // The server must check the latest employee status, not the possibly stale
    // status stored in the offline tablet's copy.
    const journalEvent:ClockJournalEvent={
      ...event,status:'syncing',createdAt:event.occurredAt,attempts:0
    };
    let update:Partial<Employee>;
    try {
      update=applyJournalClockEvent(employee,journalEvent);
    } catch(error) {
      return {result:'rejected',eventId:event.id,reason:
        error instanceof Error?error.message:'Clock action requires supervisor review.'};
    }
    tx.update(employeeRef,update);
    tx.create(receiptRef,{
      eventId:event.id,employeeId:event.employeeId,deviceId:event.deviceId,
      action:event.action,occurredAt:event.occurredAt,
      verifiedFirebaseUid:actorUid,processedAt:FieldValue.serverTimestamp(),
      result:'committed'
    });
    // Return only after the atomic transaction resolves.
    return {result:'committed',eventId:event.id};
  });
}
