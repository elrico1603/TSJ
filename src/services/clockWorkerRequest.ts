import type { LeaveType } from '../types';
import { PRODUCTION_CLOCK_NAMESPACE } from './productionClockContract';

export const workerLeaveTypes: LeaveType[] = [
  'Annual Leave','Sick Leave','Family Responsibility','Maternity / Paternity','Unpaid Leave','Study Leave'
];
export type WorkerRequestFields =
  | {kind:'leave'; leaveType:LeaveType; startDate:string; endDate:string; reason:string; attachmentUrl?:string; attachmentName?:string}
  | {kind:'advance'; baseAmount:number; method:'Cash'|'Immediate Payment'; months:number; reason:string};
export type WorkerRequestDraft = WorkerRequestFields & {
  id:string; employeeId:string; deviceId:string; credentialId:string;
};
export type WorkerRequest = WorkerRequestDraft & {signature:string};

export function workerRequestSigningText(request:WorkerRequestDraft) {
  const fields = 'leaveType' in request
    ? [request.leaveType,request.startDate,request.endDate,request.reason,request.attachmentUrl||'',request.attachmentName||'']
    : [request.baseAmount,request.method,request.months,request.reason];
  return JSON.stringify(['worker-request-v1',PRODUCTION_CLOCK_NAMESPACE,request.id,request.employeeId,
    request.deviceId,request.credentialId,request.kind,...fields]);
}

export function countWorkingDays(startDate:string,endDate:string) {
  const start = new Date(startDate), end = new Date(endDate);
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || +start > +end) return 0;
  let days = 0;
  for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate()+1)) {
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) days++;
  }
  return days;
}
