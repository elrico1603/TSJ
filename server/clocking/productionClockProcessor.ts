import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import type { Employee } from '../../src/types';
import { applyProductionAttendance } from '../../src/services/productionClockModel';
import { employeeView } from '../../src/services/employeeView';
import { clockWorker, clockSigningText, PRODUCTION_CLOCK_NAMESPACE,
  type ProductionClockEvent, type ProductionClockReceipt } from '../../src/services/productionClockContract';
import { existingClockPin, pinBinding, verifyClockSignature,
  type ProductionDevice, type StoredClockCredential } from './productionClockSecurity';

/** Caller supplies an Admin-verified device and its Admin-only credential. No request identity objects. */
export async function processProductionClockEvent(db: Firestore, device: ProductionDevice,
  credential: StoredClockCredential, event: ProductionClockEvent, now = new Date()): Promise<ProductionClockReceipt> {
  if (device.namespace !== PRODUCTION_CLOCK_NAMESPACE || !device.approved || device.revoked ||
      event.deviceId !== device.deviceId || !device.permittedEmployeeIds.includes(event.employeeId) ||
      !verifyClockSignature(event, credential)) throw new Error('Clock event authorization failed.');
  const root = db.collection('artifacts').doc(PRODUCTION_CLOCK_NAMESPACE).collection('public').doc('data');
  const receiptRef = root.collection('clockEventReceipts').doc(event.id);
  const employeeRef = root.collection('employees').doc(event.employeeId);
  const approvalRef = db.collection('artifacts').doc(PRODUCTION_CLOCK_NAMESPACE).collection('private').doc('clockApprovals').collection('items').doc(event.id);
  return db.runTransaction(async tx => {
    const previous = await tx.get(receiptRef);
    // Receipts are checked BEFORE age/lease/current employee state: ambiguous commits stay recoverable.
    if (previous.exists) {
      const old = previous.data()!;
      if (old.canonical !== clockSigningText(event) || old.signature !== event.signature ||
          old.verifiedFirebaseUid !== device.firebaseUid || !old.worker) {
        return {result:'rejected',eventId:event.id,reason:'Event ID collision; supervisor review required.'};
      }
      return {result:'already_committed',eventId:event.id,worker:old.worker};
    }
    const snap = await tx.get(employeeRef);
    const reject = (reason: string): ProductionClockReceipt => ({result:'rejected',eventId:event.id,reason});
    if (!snap.exists) return reject('Employee record missing; supervisor review required.');
    let approvedBy: string | undefined;
    if (event.action === 'Break') {
      const approval = (await tx.get(approvalRef)).data();
      if (!approval || approval.canonical !== clockSigningText(event) || approval.signature !== event.signature ||
          approval.deviceUid !== device.firebaseUid || typeof approval.approvedBy !== 'string' || !approval.approvedBy) {
        return reject('This break requires supervisor approval.');
      }
      approvedBy = approval.approvedBy;
    }
    const employee = {...snap.data(), id:snap.id} as Employee & {clockRevision?:number};
    const time = Date.parse(event.occurredAt), issued = Date.parse(credential.envelope.issuedAt), expires = Date.parse(credential.envelope.expiresAt);
    if (!Number.isFinite(time) || time < issued || time > expires || time > now.getTime() + 300000 ||
        now.getTime() - time > 45 * 86400000) return reject('Event time outside approved window; original event retained for review.');
    let update:Partial<Employee>;
    let worker:ReturnType<typeof clockWorker>;
    const clockRevision = (employee.clockRevision || 0) + 1;
    try {
      if ((employee.clockRevision || 0) !== event.expectedRevision) return reject('Attendance changed on another device; supervisor review required.');
      if (pinBinding(credential.signingKey, existingClockPin(employee as unknown as Record<string,unknown>)) !== credential.pinBinding) {
        return reject('Employee PIN changed after device provisioning; supervisor review required.');
      }
      // Unknown or malformed payroll state must never be silently reset to zero.
      if (!['In','Out','Break','Archived'].includes(employee.status) ||
          !Array.isArray(employee.history) || !Array.isArray(employee.shifts) ||
          employee.history.some(h => !Number.isFinite(h.hours) || h.hours < 0) ||
          !Number.isFinite(employee.weeklyHours) || !Number.isFinite(employee.monthlyHours) ||
          !Number.isSafeInteger(employee.clockRevision || 0) || (employee.clockRevision || 0) < 0) {
        return reject('Employee attendance data requires supervisor review.');
      }
      update = applyProductionAttendance(employee,event);
      worker = clockWorker({...employee,...update,clockRevision});
    } catch (error) {
      return reject(error instanceof Error ? error.message : 'Clocking requires supervisor review.');
    }
    // Infrastructure/write failures must abort the transaction, never become a successful rejection.
    const isClockedIn = update.status === 'In';
    tx.update(employeeRef, {...update,clockRevision,isClockedIn});
    tx.set(root.collection('employeeViews').doc(event.employeeId),employeeView({...employee,...update,id:event.employeeId,clockRevision,isClockedIn}));
    tx.create(receiptRef, {eventId:event.id, canonical:clockSigningText(event), signature:event.signature,
      verifiedFirebaseUid:device.firebaseUid,worker,processedAt:FieldValue.serverTimestamp(),result:'committed',
      ...(approvedBy ? {approvedBy} : {})});
    if (approvedBy) tx.delete(approvalRef);
    return {result:'committed',eventId:event.id,worker};
  });
}
