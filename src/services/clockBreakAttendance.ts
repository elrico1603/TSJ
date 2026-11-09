import type { BreakRecord, Employee } from '../types';

type State = Pick<Employee,'status'|'isArchived'|'shiftStartTime'|'breaks'>;
type Transition = {id:string;action:'Break'|'Return';occurredAt:string;reason?:string};
const siteTime = new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Johannesburg',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const siteDay = new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'});

/** Attendance only: the caller must verify the employee and existing supervisor approval. */
export function applyClockBreak(state:State,event:Transition):Partial<Employee> {
  const shift=state.shiftStartTime, start=Date.parse(shift||''), at=Date.parse(event.occurredAt);
  if(state.isArchived||state.status==='Archived'||!shift||!Number.isFinite(start)||!Number.isFinite(at)||at<=start||at-start>86400000)
    throw new Error('Break requires a valid open shift. Ask a supervisor to review.');
  const breaks=[...(state.breaks||[])];
  const shiftBreaks=breaks.filter(b=>b.shiftStartedAt===shift);
  const open=shiftBreaks.filter(b=>b.returnedAt===null);
  const last=shiftBreaks.at(-1);
  if(event.action==='Break') {
    const reason=event.reason?.trim();
    if(state.status!=='In'||open.length||!reason||reason.length>200||breaks.some(b=>b.id===event.id)) throw new Error('Cannot start this break.');
    clockBreakDuration(shift,event.occurredAt,breaks);
    breaks.push({id:event.id,date:siteDay.format(at),leftAt:siteTime.format(at),returnedAt:null,reason,
      kind:'personal-time-off',shiftStartedAt:shift,leftAtIso:event.occurredAt});
    return {status:'Break',breaks,currentBreakReason:reason,lastClock:siteTime.format(at)};
  }
  const current=open[0];
  if(state.status!=='Break'||open.length!==1||current.shiftStartedAt!==shift||current!==last||
    !current.leftAtIso||!Number.isFinite(Date.parse(current.leftAtIso))||at<=Date.parse(current.leftAtIso))
    throw new Error('Open break cannot be matched safely. Ask a supervisor to review.');
  breaks[breaks.indexOf(current)]={...current,returnedAt:siteTime.format(at),returnedAtIso:event.occurredAt};
  return {status:'In',breaks,currentBreakReason:null,lastClock:siteTime.format(at)};
}

/** Validate recorded breaks. Their elapsed time does not drive the fixed report deduction. */
export function clockBreakDuration(shift:string,clockOut:string,breaks:BreakRecord[]):number {
  let previous=Date.parse(shift), total=0;
  const end=Date.parse(clockOut);
  if(!Number.isFinite(previous)||!Number.isFinite(end)||end<=previous)throw new Error('Invalid shift timeline.');
  for(const record of breaks.filter(b=>b.shiftStartedAt===shift)){
    const left=Date.parse(record.leftAtIso||''),returned=Date.parse(record.returnedAtIso||'');
    if(!Number.isFinite(left)||!Number.isFinite(returned)||left<previous||returned<=left||returned>end)
      throw new Error('Incomplete or overlapping break. Ask a supervisor to review.');
    total+=returned-left;previous=returned;
  }
  return total;
}

export function reportPersonalTimeOff(shiftStart: string | undefined, shiftEnd: string | undefined, breaks: BreakRecord[]) {
  if (!shiftStart || !shiftEnd) return {hours:0, requiresReview:false};
  const personal = breaks.filter(record => record.kind === 'personal-time-off' && record.shiftStartedAt === shiftStart);
  if (!personal.length) return {hours:0, requiresReview:false};
  try {
    return {hours:clockBreakDuration(shiftStart,shiftEnd,personal) / 3600000, requiresReview:false};
  } catch {
    return {hours:0, requiresReview:true};
  }
}

export function reportPaidHours(clockedHours: number, personalTimeOffHours: number) {
  return Math.max(0, clockedHours - 1 - personalTimeOffHours);
}
