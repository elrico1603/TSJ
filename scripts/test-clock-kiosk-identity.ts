import assert from 'node:assert/strict';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { verifyRegisteredClockKiosk } from '../server/clocking/clockKioskIdentity';

const deviceId='test-kiosk-001';
const baseRegistration={
  firebaseUid:'test-firebase-uid',
  approved:true,
  revoked:false,
  enabledNamespace:'timbersmith-clock-test-server',
  permittedEmployeeIds:['fictional-employee-01']
};
const baseToken={
  uid:'test-firebase-uid',clocking_kiosk:true,clocking_device_id:deviceId,
  firebase:{sign_in_provider:'custom'}
} as unknown as DecodedIdToken;
function makeEnvironment(
  registration:Record<string,unknown>|null=baseRegistration,
  token:DecodedIdToken=baseToken
){
  const firestore={
    collection:()=>({doc:()=>({get:async()=>({
      exists:registration!==null,data:()=>registration||undefined
    })})})
  } as unknown as Firestore;
  const auth={
    verifyIdToken:async()=>token
  } as unknown as Pick<Auth,'verifyIdToken'>;
  return {firestore,auth};
}
async function check(label:string,work:()=>Promise<void>){
  await work();console.log('PASS '+label);
}
async function main(){
  await check('registered kiosk with custom claim accepted',async()=>{
    const e=makeEnvironment();
    const result=await verifyRegisteredClockKiosk('fictional-token',deviceId,e.firestore,e.auth);
    assert.equal(result.firebaseUid,'test-firebase-uid');
    assert.equal(result.deviceId,deviceId);
    assert.equal(result.namespace,'timbersmith-clock-test-server');
    assert.deepEqual(result.permittedEmployeeIds,['fictional-employee-01']);
  });
  await check('missing ID token rejected',async()=>{
    const e=makeEnvironment();
    await assert.rejects(()=>verifyRegisteredClockKiosk('',deviceId,e.firestore,e.auth));
  });
  await check('anonymous auth refused',async()=>{
    const e=makeEnvironment(baseRegistration,{...baseToken,
      firebase:{sign_in_provider:'anonymous'}
    } as unknown as DecodedIdToken);
    await assert.rejects(()=>verifyRegisteredClockKiosk('fictional-token',deviceId,e.firestore,e.auth));
  });
  await check('signed token bound to a different device is refused',async()=>{
    const e=makeEnvironment(baseRegistration,{...baseToken,
      clocking_device_id:'other-approved-device'
    } as unknown as DecodedIdToken);
    await assert.rejects(()=>verifyRegisteredClockKiosk('fictional-token',deviceId,e.firestore,e.auth));
  });
  await check('ordinary email-login identity cannot impersonate kiosk',async()=>{
    const e=makeEnvironment(baseRegistration,{...baseToken,
      firebase:{sign_in_provider:'password'}
    } as unknown as DecodedIdToken);
    await assert.rejects(()=>verifyRegisteredClockKiosk('fictional-token',deviceId,e.firestore,e.auth));
  });
  await check('missing kiosk custom claim refused',async()=>{
    const e=makeEnvironment(baseRegistration,{...baseToken,
      clocking_kiosk:false
    } as unknown as DecodedIdToken);
    await assert.rejects(()=>verifyRegisteredClockKiosk('fictional-token',deviceId,e.firestore,e.auth));
  });
  await check('unapproved registration refused',async()=>{
    const e=makeEnvironment({...baseRegistration,approved:false});
    await assert.rejects(()=>verifyRegisteredClockKiosk('fictional-token',deviceId,e.firestore,e.auth));
  });
  await check('revoked registration refused',async()=>{
    const e=makeEnvironment({...baseRegistration,revoked:true});
    await assert.rejects(()=>verifyRegisteredClockKiosk('fictional-token',deviceId,e.firestore,e.auth));
  });
  await check('different UID refused',async()=>{
    const e=makeEnvironment({...baseRegistration,firebaseUid:'someone-else'});
    await assert.rejects(()=>verifyRegisteredClockKiosk('fictional-token',deviceId,e.firestore,e.auth));
  });
  await check('production namespace refused',async()=>{
    const e=makeEnvironment({...baseRegistration,enabledNamespace:'timbersmith-terminal-v1'});
    await assert.rejects(()=>verifyRegisteredClockKiosk('fictional-token',deviceId,e.firestore,e.auth));
  });
  await check('empty permitted employee list refused',async()=>{
    const e=makeEnvironment({...baseRegistration,permittedEmployeeIds:[]});
    await assert.rejects(()=>verifyRegisteredClockKiosk('fictional-token',deviceId,e.firestore,e.auth));
  });
  await check('unregistered device refused',async()=>{
    const e=makeEnvironment(null);
    await assert.rejects(()=>verifyRegisteredClockKiosk('fictional-token',deviceId,e.firestore,e.auth));
  });
  console.log('All 12 kiosk identity tests passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
