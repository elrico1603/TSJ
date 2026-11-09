/**
 * Pure isolation tests: no browser, no IndexedDB, no Firebase or real employees.
 * Each clocking transport must see only its assigned employee AND device.
 */
import assert from 'node:assert/strict';
import { selectClockEventsForSync } from '../src/services/clockJournal';
import type { ClockJournalEvent } from '../src/services/clockJournal';
import { replayClockEvents } from '../src/services/clockSync';

const fictionalWorker='fictional-worker-001';
const pilotWorker='pilot-owner-worker-001';
const fictionalDevice='fictional-tablet-001';
const pilotDevice='pilot-tablet-001';
const createdAt='2026-10-30T07:00:00.000Z';
const make=(id:string,employeeId:string,deviceId:string,status:ClockJournalEvent['status']='pending'):ClockJournalEvent=>({
  id,employeeId,deviceId,status,action:'In',occurredAt:createdAt,createdAt,attempts:0
});
const fixture:ClockJournalEvent[]=[
  make('fictional-event-001',fictionalWorker,fictionalDevice),
  make('pilot-event-001',pilotWorker,pilotDevice),
  make('foreign-device-event-001',pilotWorker,fictionalDevice),
  make('confirmed-event-001',pilotWorker,pilotDevice,'confirmed'),
  make('review-event-001',pilotWorker,pilotDevice,'needs_review')
];
const t=async(name:string,fn:()=>void|Promise<void>)=>{await fn();console.log('PASS '+name);};
async function main(){
  await t('fictional transport cannot access owner pilot events',()=>{
    const found=selectClockEventsForSync(fixture,{employeeId:fictionalWorker,deviceId:fictionalDevice});
    assert.deepEqual(found.map(e=>e.id),['fictional-event-001']);
  });
  await t('owner pilot transport cannot access fictional worker events',()=>{
    const found=selectClockEventsForSync(fixture,{employeeId:pilotWorker,deviceId:pilotDevice});
    assert.deepEqual(found.map(e=>e.id),['pilot-event-001','review-event-001']);
  });
  await t('same employee on a different kiosk cannot be replayed',()=>{
    const found=selectClockEventsForSync(fixture,{employeeId:pilotWorker,deviceId:fictionalDevice});
    assert.deepEqual(found.map(e=>e.id),['foreign-device-event-001']);
  });
  await t('confirmed records are excluded from replay',()=>{
    assert.equal(selectClockEventsForSync(fixture,{employeeId:pilotWorker,deviceId:pilotDevice})
      .some(e=>e.id==='confirmed-event-001'),false);
  });
  await t('needs_review records stay visible to block later events on same stream',()=>{
    const found=selectClockEventsForSync(fixture,{employeeId:pilotWorker,deviceId:pilotDevice});
    assert.equal(found.some(e=>e.id==='review-event-001'),true);
  });
  await t('missing employee scope never silently syncs all workers',()=>{
    assert.throws(()=>selectClockEventsForSync(fixture,{employeeId:'',deviceId:pilotDevice}));
  });
  await t('missing device scope never silently syncs all tablets',()=>{
    assert.throws(()=>selectClockEventsForSync(fixture,{employeeId:pilotWorker,deviceId:''}));
  });
  await t('scoped replay sends only the correct kiosk events',async()=>{
    const scoped=selectClockEventsForSync(fixture,{employeeId:fictionalWorker,deviceId:fictionalDevice});
    const sent:string[]=[];
    const result=await replayClockEvents(scoped,async event=>{
      sent.push(event.id);
      return {result:'committed',eventId:event.id};
    },{
      markSending:async()=>{},markConfirmed:async()=>{},
      markPending:async()=>{},markReview:async()=>{}
    });
    assert.deepEqual(sent,['fictional-event-001']);
    assert.equal(result.confirmed,1);
  });
  console.log('All 8 device/employee journal-isolation checks passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
