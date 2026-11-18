import assert from 'node:assert/strict';
import { validateClockingBranchAssignments } from '../server/clockingBranchManifest';
const live=[{id:'worker-a',name:'Worker A'},{id:'worker-b',name:'Worker B'}];
const good=[{employeeId:'worker-a',employeeName:'Worker A',branchId:'BR-001'},
  {employeeId:'worker-b',employeeName:'Worker B',branchId:'BR-002'}];
assert.equal(validateClockingBranchAssignments(good,live).errors.length,0);
assert.equal(validateClockingBranchAssignments(good,live).assignments.length,2);
console.log('PASS | explicitly reviewed assignments accepted');
const cases=[
  good.map(x=>({...x,branchId:null})),
  good.slice(0,1),
  [...good,good[0]],
  good.map(x=>({...x,employeeName:'Wrong Name'})),
  good.map(x=>({...x,branchId:'BR-003'})),
  [{employeeId:'not-real',employeeName:'Fake',branchId:'BR-001'},good[1]],
];
for(const rows of cases) {
  const result=validateClockingBranchAssignments(rows,live);
  assert.ok(result.errors.length>0);
  assert.equal(result.assignments.length,0);
}
console.log('PASS | incomplete, duplicate, wrong-name and invalid-branch input fails closed');
console.log('2/2 BRANCH ASSIGNMENT MANIFEST TEST GROUPS PASSED');
