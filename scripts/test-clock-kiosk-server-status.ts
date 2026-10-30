import assert from 'node:assert/strict';
import { verifyProtectedTestKioskWithServer } from '../src/services/clockRegisteredKioskSync';

const deviceId='test-tablet-001';
const good={registered:true,deviceId,namespace:'timbersmith-clock-test-local',
  permittedEmployeeCount:1};
const asResponse=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{'Content-Type':'application/json'}
});
const test=async(label:string,run:()=>Promise<void>)=>{await run();console.log('PASS '+label);};
async function main(){
  await test('server verifies signed kiosk registration and bound namespace',async()=>{
    const result=await verifyProtectedTestKioskWithServer(deviceId,
      async()=> 'fictional-id-token',
      async(url,init)=>{
        assert.equal(url,'/api/clocking/test-device-status');
        assert.equal(init?.method,'GET');
        assert.equal(init?.credentials,'omit');
        const headers=init?.headers as Record<string,string>;
        assert.equal(headers.Authorization,'Bearer fictional-id-token');
        assert.equal(headers['X-Clock-Device-ID'],deviceId);
        return asResponse(good);
      });
    assert.equal(result.deviceId,deviceId);
    assert.equal(result.namespace,'timbersmith-clock-test-local');
    assert.equal(result.permittedEmployeeCount,1);
  });
  await test('different server device ID must never count as verified',async()=>{
    await assert.rejects(()=>verifyProtectedTestKioskWithServer(deviceId,
      async()=> 'fictional-id-token',
      async()=>asResponse({...good,deviceId:'someone-else-001'})),
    /did not confirm/);
  });
  await test('production namespace cannot pass the test probe',async()=>{
    await assert.rejects(()=>verifyProtectedTestKioskWithServer(deviceId,
      async()=> 'fictional-id-token',
      async()=>asResponse({...good,namespace:'timbersmith-terminal-v1'})),
    /did not confirm/);
  });
  await test('zero assigned employees must fail',async()=>{
    await assert.rejects(()=>verifyProtectedTestKioskWithServer(deviceId,
      async()=> 'fictional-id-token',
      async()=>asResponse({...good,permittedEmployeeCount:0})),
    /did not confirm/);
  });
  await test('invalid kiosk token cannot become registered',async()=>{
    await assert.rejects(()=>verifyProtectedTestKioskWithServer(deviceId,
      async()=> 'fictional-id-token',
      async()=>asResponse({registered:false,error:'Unauthorized'},403)),
    /refused/);
  });
  await test('missing server endpoint cannot become registered',async()=>{
    await assert.rejects(()=>verifyProtectedTestKioskWithServer(deviceId,
      async()=> 'fictional-id-token',
      async()=>asResponse({error:'Not Found'},404)),
    /unavailable/);
  });
  await test('missing credentials never trigger request',async()=>{
    let called=false;
    await assert.rejects(()=>verifyProtectedTestKioskWithServer(deviceId,
      async()=> '',async()=>{called=true;return asResponse(good)}),
    /not enrolled/);
    assert.equal(called,false);
  });
  console.log('All 7 protected kiosk server status tests passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
