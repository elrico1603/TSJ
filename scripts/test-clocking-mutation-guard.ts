import assert from 'node:assert/strict';
import { validateClockingUpdate } from '../server/clockingMutationGuard';
const initial={status:'In',isArchived:false,shifts:[{date:'2026-11-17',clockIn:'07:00',clockOut:'16:00',hours:9}]};
const same={...initial,shifts:[{hours:9,date:'2026-11-17',clockOut:'16:00',clockIn:'07:00'},{date:'2026-11-18',clockIn:'07:00',clockOut:'16:00',hours:9}]};
assert.equal(validateClockingUpdate(initial,{status:'Out',shifts:same.shifts}).shifts,same.shifts);
console.log('PASS | new shift may append without altering earlier shifts');
for(const candidate of [
  {shifts:[]},
  {shifts:[{...initial.shifts[0],hours:0}]},
  {shifts:[...initial.shifts,{date:'2026-11-18'},{date:'2026-11-19'}]}
])assert.throws(()=>validateClockingUpdate(initial,candidate));
console.log('PASS | removing, rewriting or bulk replacing shifts denied');
assert.throws(()=>validateClockingUpdate(initial,{pin:'9999'}));
assert.throws(()=>validateClockingUpdate(initial,{hourlyRate:999}));
assert.throws(()=>validateClockingUpdate(initial,{isArchived:true}));
console.log('PASS | sensitive user and employee fields cannot be changed through Clocking');
assert.throws(()=>validateClockingUpdate({...initial,isArchived:true},{status:'In'}));
console.log('PASS | archived worker cannot be clocked');
assert.throws(()=>validateClockingUpdate({...initial,shifts:undefined},{status:'In'}));
console.log('PASS | missing historical shifts array fails closed');
assert.throws(()=>validateClockingUpdate(initial,{status:'Archived'}));
assert.throws(()=>validateClockingUpdate(initial,{monthlyHours:-5}));
console.log('PASS | invalid states/hours fail closed');
console.log('6/6 CLOCKING MUTATION SAFEGUARD TESTS PASSED');
