import { applyJournalClockEvent } from './clockEventReducer';
import type { ClockWorker, ProductionClockEvent, ProductionClockReceipt } from './productionClockContract';
import type { ProductionClockState } from './productionClockStore';
import { applyClockBreak, clockBreakDuration } from './clockBreakAttendance';

export function applyProductionAttendance(worker: Parameters<typeof applyJournalClockEvent>[0] & Pick<ClockWorker,'breaks'>, event: Omit<ProductionClockEvent,'signature'>) {
  if (worker.id !== event.employeeId) throw new Error('Clocking employee mismatch.');
  if (event.action === 'Break' || event.action === 'Return') {
    return applyClockBreak({...worker,breaks:worker.breaks || []},{...event,action:event.action});
  }
  if (event.action === 'Out' && worker.shiftStartTime) {
    // Reports already deduct the standard tea/lunch hour once per day.
    clockBreakDuration(worker.shiftStartTime,event.occurredAt,worker.breaks || []);
  }
  return applyJournalClockEvent(worker,{...event,action:event.action,status:'pending',createdAt:event.occurredAt,attempts:0});
}

export function projectProductionWorker(state:ProductionClockState, id:string):ClockWorker {
  const entry=state.entries.find(e=>e.worker.id===id);
  if (!entry) throw new Error('Employee not provisioned on this tablet.');
  let worker={...entry.worker};
  for (const queued of state.events.filter(e=>e.event.employeeId===id && e.status!=='confirmed')) {
    if (queued.status==='needs_review') throw new Error('This employee has an event awaiting supervisor review.');
    const event=queued.event;
    if (worker.clockRevision!==event.expectedRevision) throw new Error('Queued attendance state requires supervisor review.');
    const update=applyProductionAttendance(worker,event);
    worker={...worker,...update,clockRevision:worker.clockRevision+1};
  }
  return worker;
}

/** Apply a receipt to the LATEST stored state, preserving events added while the network was busy. */
export function applyProductionReceipt(state:ProductionClockState, eventId:string, receipt:ProductionClockReceipt):void {
  const item=state.events.find(e=>e.event.id===eventId);
  if (!item || receipt.eventId!==eventId) throw new Error('Invalid server acknowledgement.');
  if (item.status==='confirmed') return;
  if (receipt.result==='rejected') {
    item.status='needs_review';item.reason=String(receipt.reason).slice(0,500);return;
  }
  if (!['committed','already_committed'].includes(receipt.result) || !receipt.worker ||
      receipt.worker.id!==item.event.employeeId || receipt.worker.clockRevision!==item.event.expectedRevision+1) throw new Error('Invalid attendance acknowledgement.');
  const entry=state.entries.find(e=>e.worker.id===item.event.employeeId);
  if (!entry) throw new Error('Local roster missing; original event retained.');
  if (receipt.worker.clockRevision>entry.worker.clockRevision) entry.worker=receipt.worker;
  item.status='confirmed';delete item.reason;
}
