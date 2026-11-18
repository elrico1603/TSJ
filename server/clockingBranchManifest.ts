/**
 * Pure validation for reviewed Clocking employee -> branch manifests.
 * Never guesses a branch or modifies employee records.
 */
export const APPROVED_BRANCHES = ['BR-001','BR-002'] as const;
export type BranchId = typeof APPROVED_BRANCHES[number];
export interface AssignmentRow {
  employeeId: string;
  employeeName: string;
  branchId: BranchId | null;
}
export function validateClockingBranchAssignments(
  rows: unknown,
  current: ReadonlyArray<{id:string;name:string}>,
): {assignments: ReadonlyArray<{employeeId:string;branchId:BranchId}>;errors:string[]} {
  const errors:string[]=[];
  if(!Array.isArray(rows))return {assignments:[],errors:['Assignment manifest must be an array.']};
  if(!Array.isArray(current)||current.length===0)return {assignments:[],errors:['No live employees to verify.']};
  const known=new Map(current.map(e=>[e.id,e.name.trim()]));
  if(known.size!==current.length)errors.push('Duplicate live employee IDs.');
  const seen=new Set<string>();
  const assignments:{employeeId:string;branchId:BranchId}[]=[];
  for(const row of rows){
    if(!row||typeof row!=='object'||Array.isArray(row)){errors.push('Invalid assignment row.');continue;}
    const r=row as Partial<AssignmentRow>;
    if(typeof r.employeeId!=='string'||!known.has(r.employeeId)){
      errors.push('Unknown employee document ID.');continue;
    }
    if(seen.has(r.employeeId)){errors.push('Duplicate employee assignment: '+r.employeeId);continue;}
    seen.add(r.employeeId);
    if(typeof r.employeeName!=='string'||r.employeeName.trim()!==known.get(r.employeeId))
      errors.push('Employee name does not match current Firestore record: '+r.employeeId);
    if(r.branchId!=='BR-001'&&r.branchId!=='BR-002')
      errors.push('Branch not confirmed for employee: '+r.employeeId);
    else assignments.push({employeeId:r.employeeId,branchId:r.branchId});
  }
  for(const id of known.keys())if(!seen.has(id))errors.push('Employee omitted from manifest: '+id);
  return {assignments:errors.length?[]:assignments,errors};
}
