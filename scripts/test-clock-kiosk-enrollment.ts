/**
 * End-to-end fictional enrollment tests. In-memory Firestore + token issuer.
 * No cloud credentials, browser sessions or real employee records.
 */
import assert from 'node:assert/strict';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import {
  validateClockTestEnrollment, issueClockTestKioskEnrollment
} from '../server/clocking/clockTestKioskEnrollment';

const namespace='timbersmith-clock-test-local';
const employeeId='pilot-fictional-worker-001';
const deviceId='fictional-tablet-001';

function mockEnvironment(employeeExists=true) {
  const registrations=new Map<string,Record<string,unknown>>();
  let claimPayload:Record<string,unknown>|undefined;
  const testData={
    collection:()=>({doc:()=>({collection:()=>({doc:()=>({
      collection:()=>({doc:()=>({get:async()=>({
        exists:employeeExists,
        data:()=>({status:'Out',isArchived:false})
      })})})
    })})})})
  } as unknown as Firestore;
  const registry={
    collection:(name:string)=>({
      doc:(id:string)=>({
        create:async(value:Record<string,unknown>)=>{
          if (name!=='clocking_kiosk_devices' || registrations.has(id)) {
            throw new Error('Existing or invalid registry record.');
          }
          registrations.set(id,value);
        }
      })
    })
  } as unknown as Firestore;
  const issuer={
    createCustomToken:async(uid:string,claims:Record<string,unknown>)=>{
      assert.ok(uid.startsWith('tsj-clock-test-'));
      claimPayload=claims;
      return 'fake-one-time-custom-token';
    }
  } as unknown as Pick<Auth,'createCustomToken'>;
  return {testData,registry,issuer,registrations,getClaims:()=>claimPayload};
}

const test=async(title:string,work:()=>Promise<void>|void)=>{
  await work();console.log('PASS '+title);
};
async function main(){
  await test('reject production namespaces and missing IDs',()=>{
    assert.throws(()=>validateClockTestEnrollment({
      namespace:'timbersmith-terminal-v1',deviceId,employeeId
    }));
    assert.throws(()=>validateClockTestEnrollment({namespace,deviceId:'',employeeId}));
  });
  await test('test device receives signed device and worker identity only',async()=>{
    const e=mockEnvironment();
    const result=await issueClockTestKioskEnrollment(e.testData,e.registry,e.issuer,{
      namespace,deviceId,employeeId
    });
    assert.equal(result.deviceId,deviceId);
    assert.equal(result.customToken,'fake-one-time-custom-token');
    assert.deepEqual(e.getClaims(),{
      clocking_kiosk:true,clocking_device_id:deviceId,
      clocking_namespace:namespace,clocking_employee_ids:[employeeId]
    });
    const reg=e.registrations.get(deviceId);
    assert.equal(reg?.approved,true);
    assert.equal(reg?.enabledNamespace,namespace);
    assert.deepEqual(reg?.permittedEmployeeIds,[employeeId]);
    assert.equal('personalCode' in reg!,false);
  });
  await test('unknown fictional employee cannot be enrolled',async()=>{
    const e=mockEnvironment(false);
    await assert.rejects(()=>issueClockTestKioskEnrollment(
      e.testData,e.registry,e.issuer,{namespace,deviceId,employeeId}
    ),/fictional test employee/);
    assert.equal(e.registrations.size,0);
  });
  await test('same registered device cannot be silently overwritten',async()=>{
    const e=mockEnvironment();
    const input={namespace,deviceId,employeeId};
    await issueClockTestKioskEnrollment(e.testData,e.registry,e.issuer,input);
    await assert.rejects(()=>issueClockTestKioskEnrollment(
      e.testData,e.registry,e.issuer,input
    ),/Existing or invalid registry/);
    assert.equal(e.registrations.size,1);
  });
  await test('privileged registration does not expose employee PINs',async()=>{
    const e=mockEnvironment();
    const result=await issueClockTestKioskEnrollment(
      e.testData,e.registry,e.issuer,{namespace,deviceId,employeeId}
    );
    assert.equal(JSON.stringify(e.registrations.get(deviceId)).includes('pin'),false);
    assert.equal(JSON.stringify(result).includes('personalCode'),false);
  });
  console.log('All 5 test-kiosk enrollment checks passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
