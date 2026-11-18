/**
 * Clocking mutation guard — data-preserving, server-side only.
 *
 * Protects the historical employee shifts array when the future managed
 * Clocking API is introduced. It never deletes/replaces old entries and
 * rejects stale or out-of-order writes. No frontend use until cutover.
 */
export interface ClockingEmployeeState {
  shifts?: unknown[];
  status?: string;
  isArchived?: boolean;
  [key:string]:unknown;
}
export type ClockingUpdate = Record<string,unknown>;
const ALLOWED = new Set([
  'status','lastClock','currentBreakReason','breaks','shiftStartTime',
  'shifts','todayHours','weeklyHours','monthlyHours','history'
]);
function normalized(value:unknown):string{
  function sort(x:any):any {
    if(Array.isArray(x))return x.map(sort);
    if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(key=>[key,sort(x[key])]));
    return x;
  }
  return JSON.stringify(sort(value));
}
export function validateClockingUpdate(existing:ClockingEmployeeState,update:ClockingUpdate):ClockingUpdate {
  if(!existing || typeof existing!=='object'||existing.isArchived===true||existing.status==='Archived')
    throw new Error('CLOCKING_EMPLOYEE_UNAVAILABLE');
  if(!update||typeof update!=='object'||Array.isArray(update)||Object.keys(update).length===0)
    throw new Error('CLOCKING_INVALID_UPDATE');
  for(const key of Object.keys(update)) if(!ALLOWED.has(key))throw new Error('CLOCKING_FORBIDDEN_FIELD');
  if(!Array.isArray(existing.shifts))throw new Error('CLOCKING_EXISTING_SHIFTS_REQUIRED');
  if(Object.prototype.hasOwnProperty.call(update,'shifts')){
    const next=update.shifts;
    if(!Array.isArray(next)||next.length<existing.shifts.length)
      throw new Error('CLOCKING_HISTORICAL_SHIFTS_MUST_BE_PRESERVED');
    for(let i=0;i<existing.shifts.length;i++)
      if(normalized(existing.shifts[i])!==normalized(next[i]))
        throw new Error('CLOCKING_HISTORICAL_SHIFTS_MUST_BE_PRESERVED');
    if(next.length>existing.shifts.length+1)
      throw new Error('CLOCKING_MAX_ONE_SHIFT_PER_EVENT');
  }
  if(update.status!==undefined&&!['In','Out','Break'].includes(String(update.status)))
    throw new Error('CLOCKING_INVALID_STATUS');
  for(const key of ['todayHours','weeklyHours','monthlyHours']){
    if(update[key]!==undefined && (typeof update[key]!=='number'||!Number.isFinite(update[key] as number)||Number(update[key])<0))
      throw new Error('CLOCKING_INVALID_HOURS');
  }
  return update;
}
