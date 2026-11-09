import assert from 'node:assert/strict';
import type {Firestore} from 'firebase-admin/firestore';
import type {Auth} from 'firebase-admin/auth';
import {revokeClockTestKiosk} from '../server/clocking/clockTestKioskRevocation';
const id='fictional-device-001';
function setup(initial:Record<string,unknown>|null){
  const data=initial?{...initial}:null;
  const updates:Array<Record<string,unknown>>=[];
  const authCalls:string[]=[];
  const registry={
    collection:()=>({doc:()=>({
      get:async()=>({exists:data!==null,data:()=>data}),
      update:async(patch:Record<string,unknown>)=>{
        updates.push(patch);Object.assign(data!,patch);
      }
    })})
  } as unknown as Firestore;
  const auth={
    updateUser:async(uid:string,patch:Record<string,unknown>)=>{
      assert.equal(patch.disabled,true);authCalls.push('disable:'+uid);return {} as any;
    },
    revokeRefreshTokens:async(uid:string)=>{
      authCalls.push('revoke:'+uid);
    }
  } as unknown as Pick<Auth,'updateUser'|'revokeRefreshTokens'>;
  return {registry,auth,updates,authCalls};
}
const test=async(label:string,fn:()=>Promise<void>)=>{
  await fn();console.log('PASS '+label);
};
async function main(){
  const valid={firebaseUid:'tsj-clock-test-fake-uid',approved:true,
    revoked:false,enabledNamespace:'timbersmith-clock-test-local'};
  await test('revocation blocks registry before disabling Auth credentials',async()=>{
    const s=setup(valid);
    const result=await revokeClockTestKiosk(s.registry,s.auth,id);
    assert.equal(result,'revoked');
    assert.equal(s.updates[0].revoked,true);
    assert.equal(s.updates[0].approved,false);
    assert.deepEqual(s.authCalls,[
      'disable:tsj-clock-test-fake-uid','revoke:tsj-clock-test-fake-uid'
    ]);
  });
  await test('already revoked registration is not mutated again',async()=>{
    const s=setup({...valid,revoked:true});
    assert.equal(await revokeClockTestKiosk(s.registry,s.auth,id),'already_revoked');
    assert.equal(s.updates.length,0);
    assert.equal(s.authCalls.length,0);
  });
  await test('existing ordinary TimberSmith user is never disabled',async()=>{
    const s=setup({...valid,firebaseUid:'usr-admin-person'});
    await assert.rejects(()=>revokeClockTestKiosk(s.registry,s.auth,id),/non-test identity/);
    assert.equal(s.updates.length,0);
    assert.equal(s.authCalls.length,0);
  });
  await test('non-test namespace cannot be revoked by test tool',async()=>{
    const s=setup({...valid,enabledNamespace:'timbersmith-terminal-v1'});
    await assert.rejects(()=>revokeClockTestKiosk(s.registry,s.auth,id),/non-test identity/);
    assert.equal(s.authCalls.length,0);
  });
  await test('unregistered device cannot be revoked',async()=>{
    const s=setup(null);
    await assert.rejects(()=>revokeClockTestKiosk(s.registry,s.auth,id),/not registered/);
  });
  console.log('All 5 test-kiosk revocation checks passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
