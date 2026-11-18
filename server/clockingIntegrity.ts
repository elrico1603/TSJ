/** Data-only Clocking history comparator. No writes or external dependencies. */
export type SavedEmployee = {id:string;data:{shifts?:unknown[]}};
export type CurrentEmployee = {id:string;data:{shifts?:unknown[]}};
function canonical(value:unknown):string{
  function ordered(input:any):any{
    if(Array.isArray(input))return input.map(ordered);
    if(input&&typeof input==='object'){
      if(typeof input.toJSON==='function')return ordered(input.toJSON());
      return Object.fromEntries(Object.keys(input).sort().map(key=>[key,ordered(input[key])]));
    }
    return input;
  }
  return JSON.stringify(ordered(value));
}
export function verifyClockingHistory(saved:SavedEmployee[],current:CurrentEmployee[]){
  const currentById=new Map(current.map(item=>[item.id,item.data]));
  const problems:string[]=[];let priorShifts=0,liveShifts=0,addedShifts=0;
  for(const previous of saved){
    const latest=currentById.get(previous.id);
    if(!latest){problems.push('MISSING EMPLOYEE DOCUMENT '+previous.id);continue;}
    if(!Array.isArray(previous.data?.shifts)||!Array.isArray(latest.shifts)){
      problems.push('MISSING SHIFTS ARRAY '+previous.id);continue;
    }
    const old=previous.data.shifts;priorShifts+=old.length;liveShifts+=latest.shifts.length;
    const remaining=new Map<string,number>();
    for(const shift of latest.shifts){
      const key=canonical(shift);remaining.set(key,(remaining.get(key)||0)+1);
    }
    for(const shift of old){
      const key=canonical(shift),count=remaining.get(key)||0;
      if(count===0)problems.push('HISTORICAL SHIFT MISSING OR CHANGED FOR EMPLOYEE '+previous.id);
      else remaining.set(key,count-1);
    }
    addedShifts+=Math.max(0,latest.shifts.length-old.length);
  }
  return {problems,priorShifts,liveShifts,addedShifts,oldEmployees:saved.length,liveEmployees:current.length};
}
