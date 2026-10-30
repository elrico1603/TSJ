/**
 * Pure tests of multi-employee offline replay behavior.
 * Run: npx tsx scripts/test-clock-sync.ts
 * No Firebase connection, real employees, or PINs used.
 */
import assert from 'node:assert/strict';
import { replayClockEvents } from '../src/services/clockSync';
import type { ClockSyncStorage, ClockSyncReceipt } from '../src/services/clockSync';
import type { ClockJournalEvent } from '../src/services/clockJournal';

const events = (specs: Array<[string,'In'|'Out',string]>): ClockJournalEvent[] =>
  specs.map(([employeeId,action,id],i)=>({
    id, employeeId, action, occurredAt:new Date(Date.UTC(2026,9,30,6,i)).toISOString(),
    deviceId:'fictional-tablet',createdAt:new Date(Date.UTC(2026,9,30,6,i)).toISOString(),
    status:'pending',attempts:0
  }));

function makeMemoryStore() {
  const state = new Map<string,string>();
  const calls: string[] = [];
  const storage: ClockSyncStorage = {
    markSending:async event=>{state.set(event.id,'syncing');calls.push('send:'+event.id);},
    markConfirmed:async(id,serverId)=>{assert.equal(id,serverId);state.set(id,'confirmed');calls.push('confirmed:'+id);},
    markReview:async(id)=>{state.set(id,'needs_review');calls.push('review:'+id);},
    markPending:async(id)=>{state.set(id,'pending');calls.push('pending:'+id);}
  };
  return {storage,state,calls};
}
async function check(name:string,fn:()=>Promise<void>) {await fn();console.log('PASS '+name);}
async function main() {
  await check('one rejected worker cannot block another employee',async()=>{
    const fixture=events([['A','In','a1'],['B','In','b1'],['A','Out','a2'],['B','Out','b2']]);
    const memory=makeMemoryStore();
    const visited:string[]=[];
    const result=await replayClockEvents(fixture,async e=>{
      visited.push(e.id);
      if(e.id==='a1')return {result:'rejected',eventId:e.id,reason:'Fictional review required'};
      return {result:'committed',eventId:e.id};
    },memory.storage);
    assert.deepEqual(visited,['a1','b1','b2']);
    assert.deepEqual(result,{confirmed:2,pending:1,needsReview:1});
    assert.equal(memory.state.get('a1'),'needs_review');
    assert.equal(memory.state.get('a2'),undefined);
  });
  await check('network outage keeps IDs pending and halts pass',async()=>{
    const fixture=events([['A','In','a1'],['B','In','b1']]);
    const memory=makeMemoryStore();
    const result=await replayClockEvents(fixture,async()=>{throw new Error('fictional Wi-Fi outage');},memory.storage);
    assert.deepEqual(result,{confirmed:0,pending:2,needsReview:0});
    assert.equal(memory.state.get('a1'),'pending');
    assert.equal(memory.state.get('b1'),undefined);
  });
  await check('already_committed receipt confirms original ID',async()=>{
    const fixture=events([['A','In','a1']]);
    const memory=makeMemoryStore();
    const result=await replayClockEvents(fixture,async e=>({result:'already_committed',eventId:e.id}),memory.storage);
    assert.deepEqual(result,{confirmed:1,pending:0,needsReview:0});
    assert.equal(memory.state.get('a1'),'confirmed');
  });
  await check('wrong server event ID quarantines only that employee',async()=>{
    const fixture=events([['A','In','a1'],['B','In','b1']]);
    const memory=makeMemoryStore();
    const result=await replayClockEvents(fixture,async e=>({result:'committed',eventId:e.id==='a1'?'wrong':e.id}),memory.storage);
    assert.deepEqual(result,{confirmed:1,pending:0,needsReview:1});
    assert.equal(memory.state.get('a1'),'needs_review');
    assert.equal(memory.state.get('b1'),'confirmed');
  });
  await check('reviewed event blocks its employee but not others',async()=>{
    const fixture=events([['A','In','a1'],['B','In','b1'],['A','Out','a2']]);
    fixture[0].status='needs_review';
    const memory=makeMemoryStore();
    const result=await replayClockEvents(fixture,async e=>({result:'committed',eventId:e.id}),memory.storage);
    assert.deepEqual(result,{confirmed:1,pending:1,needsReview:1});
    assert.equal(memory.state.get('a2'),undefined);
    assert.equal(memory.state.get('b1'),'confirmed');
  });
  console.log('All 5 fictional clock-sync reliability checks passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
