import assert from 'node:assert/strict';
import {createAuthenticatedClockTestTransport} from '../src/services/clockTestApiTransport';
import type {ClockJournalEvent} from '../src/services/clockJournal';

const device='fictional-device-001';
const event: ClockJournalEvent={
  id:'13cde297-fd76-40dd-acd8-62077f8296e0',
  employeeId:'fictional-worker-001',deviceId:device,
  action:'In',occurredAt:'2026-10-30T06:00:00.000Z',
  createdAt:'2026-10-30T06:00:00.000Z',
  status:'pending',attempts:0
};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{'Content-Type':'application/json'}
});
const transport=(payload:unknown,status=200)=>
  createAuthenticatedClockTestTransport(async()=> 'fictional-token',
    device,{fetchImpl:async()=>json(payload,status)});
const test=async(name:string,fn:()=>Promise<void>|void)=>{
  await fn();console.log('PASS '+name);
};
async function main(){
  await test('sends only immutable event fields, never PINs or history',async()=>{
    const t=createAuthenticatedClockTestTransport(async()=> 'fictional-token',
      device,{fetchImpl:async(url,init)=>{
        assert.equal(url,'/api/clocking/test-replay');
        assert.equal(init?.method,'POST');
        const headers=init?.headers as Record<string,string>;
        assert.equal(headers['X-Clock-Device-ID'],device);
        assert.equal(headers.Authorization,'Bearer fictional-token');
        const body=JSON.parse(String(init?.body));
        assert.deepEqual(Object.keys(body.event).sort(),
          ['action','deviceId','employeeId','id','occurredAt'].sort());
        assert.equal(JSON.stringify(body).includes('personalCode'),false);
        return json({result:'committed',eventId:event.id});
      }});
    assert.equal((await t(event)).result,'committed');
  });
  await test('already committed duplicate becomes valid acknowledgement',async()=>{
    assert.equal((await transport({result:'already_committed',eventId:event.id})(event)).result,
      'already_committed');
  });
  await test('server 409 rejects with review reason',async()=>{
    const result=await transport({result:'rejected',eventId:event.id,reason:'Out of order'},409)(event);
    assert.equal(result.result,'rejected');
  });
  await test('server 422 flags human review',async()=>{
    const result=await transport({error:'Timestamp requires supervisor review'},422)(event);
    assert.equal(result.result,'rejected');
  });
  await test('network server unavailable stays retryable',async()=>{
    await assert.rejects(()=>transport({error:'Unavailable'},503)(event),/unavailable/);
  });
  await test('unauthorized kiosk remains pending for re-authentication',async()=>{
    await assert.rejects(()=>transport({error:'Unauthorized'},401)(event),/authorization refused/);
  });
  await test('mismatched event ID never accepted',async()=>{
    await assert.rejects(()=>transport({result:'committed',eventId:'other'})(event),/invalid or mismatched/);
  });
  await test('cannot process events belonging to another device',async()=>{
    await assert.rejects(()=>transport({result:'committed',eventId:event.id})({...event,deviceId:'another-device'}),/different kiosk/);
  });
  await test('missing kiosk token cannot send an event',async()=>{
    const t=createAuthenticatedClockTestTransport(async()=>'',device,{fetchImpl:async()=>{
      throw new Error('Fetch must not run when token missing');
    }});
    await assert.rejects(()=>t(event),/authentication is unavailable/);
  });
  await test('unexpected HTTP status and receipt mismatch never confirm',async()=>{
    await assert.rejects(()=>transport({result:'committed',eventId:event.id},409)(event),/status and receipt disagree/);
  });
  console.log('All 10 authenticated clock transport tests passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
