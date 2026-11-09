import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { AdvanceRecord, Employee, LeaveRequest } from '../../src/types';
import type { UserNotification } from '../../src/types/notification';
import { countWorkingDays, workerLeaveTypes, workerRequestSigningText, type WorkerRequest } from '../../src/services/clockWorkerRequest';
import { PRODUCTION_CLOCK_NAMESPACE } from '../../src/services/productionClockContract';
import { employeeView } from '../../src/services/employeeView';
import { existingClockPin, pinBinding, type ProductionDevice, type StoredClockCredential } from './productionClockSecurity';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeId = /^[A-Za-z0-9_-]{1,128}$/;
const dateOnly = (value:unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().startsWith(value);
export class WorkerRequestRefused extends Error {}

export function validateWorkerRequest(raw:unknown, device:ProductionDevice):WorkerRequest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new WorkerRequestRefused('Invalid request.');
  const request=raw as WorkerRequest;
  if (typeof request.id!=='string'||!uuid.test(request.id)||typeof request.credentialId!=='string'||!uuid.test(request.credentialId)||
      request.deviceId!==device.deviceId||!device.permittedEmployeeIds.includes(request.employeeId)||
      typeof request.signature!=='string'||!/^([A-Za-z0-9+/]{43})=$/.test(request.signature)||
      typeof request.reason!=='string'||!request.reason.trim()||request.reason.length>500) throw new WorkerRequestRefused('Invalid request.');
  const shared={id:request.id,employeeId:request.employeeId,deviceId:request.deviceId,credentialId:request.credentialId,
    signature:request.signature,reason:request.reason};
  if (request.kind==='leave') {
    if (!workerLeaveTypes.includes(request.leaveType)||!dateOnly(request.startDate)||!dateOnly(request.endDate)||
        Date.parse(request.endDate)-Date.parse(request.startDate)>366*86400000||!countWorkingDays(request.startDate,request.endDate)) {
      throw new WorkerRequestRefused('Select a valid leave type and date range.');
    }
    const {attachmentUrl,attachmentName}=request;
    if (attachmentUrl!==undefined || attachmentName!==undefined) {
      if (typeof attachmentUrl!=='string'||attachmentUrl.length>820000||
          !/^data:(?:application\/pdf|image\/(?:png|jpeg|webp));base64,[A-Za-z0-9+/]+={0,2}$/.test(attachmentUrl)||
          typeof attachmentName!=='string'||!attachmentName.trim()||attachmentName.length>200) {
        throw new WorkerRequestRefused('Use a PDF or image attachment up to 600 KB.');
      }
    }
    return {...shared,kind:'leave',leaveType:request.leaveType,startDate:request.startDate,endDate:request.endDate,
      ...(attachmentUrl ? {attachmentUrl,attachmentName} : {})};
  }
  if (request.kind!=='advance'||!Number.isFinite(request.baseAmount)||request.baseAmount<=0||
      !Number.isSafeInteger(Math.round(request.baseAmount*100))||
      Math.abs(request.baseAmount*100-Math.round(request.baseAmount*100))>0.00001||
      !['Cash','Immediate Payment'].includes(request.method)||![1,2,3].includes(request.months)) {
    throw new WorkerRequestRefused('Enter a valid amount, payment method and repayment term.');
  }
  return {...shared,kind:'advance',baseAmount:request.baseAmount,method:request.method,months:request.months};
}

export async function saveWorkerRequest(db:Firestore, device:ProductionDevice, credential:StoredClockCredential, request:WorkerRequest) {
  const canonical=workerRequestSigningText(request);
  const expected=createHmac('sha256',Buffer.from(credential.signingKey,'base64')).update(canonical).digest();
  const supplied=Buffer.from(request.signature,'base64');
  if (credential.envelope.employeeId!==request.employeeId||credential.envelope.deviceId!==device.deviceId||
      credential.envelope.id!==request.credentialId||supplied.length!==expected.length||!timingSafeEqual(supplied,expected)) {
    throw new WorkerRequestRefused('Employee verification failed.');
  }
  const root=db.collection('artifacts').doc(PRODUCTION_CLOCK_NAMESPACE);
  const data=root.collection('public').doc('data');
  const employeeRef=data.collection('employees').doc(request.employeeId);
  const receiptRef=root.collection('private').doc('workerRequests').collection('receipts').doc(request.id);
  const eventId=request.kind==='leave'?'LEAVE_REQUEST_SUBMITTED':'BORROW_MONEY_REQUESTED';
  const policyRef=root.collection('private').doc('config').collection('notifications_policies').doc(eventId);
  const now=new Date(), timestamp=now.toISOString();
  return db.runTransaction(async tx=>{
    const existing=(await tx.get(receiptRef)).data();
    if (existing) {
      if (existing.signature!==request.signature||existing.deviceUid!==device.firebaseUid) throw new WorkerRequestRefused('Request ID already used.');
      return {id:existing.id as string,notified:existing.notified as number};
    }
    const raw=(await tx.get(employeeRef)).data();
    const expires=Date.parse(credential.envelope.expiresAt), issued=Date.parse(credential.envelope.issuedAt);
    if (!raw||raw.isArchived||raw.status==='Archived'||!Number.isFinite(expires)||!Number.isFinite(issued)||+now<issued||+now>expires||
        pinBinding(credential.signingKey,existingClockPin(raw))!==credential.pinBinding) throw new WorkerRequestRefused('Employee verification expired.');
    const employee={...raw,id:request.employeeId} as Employee;
    const policy=(await tx.get(policyRef)).data();
    const ids:unknown[]=policy?.enabled===true && Array.isArray(policy.recipientUserIds)?policy.recipientUserIds:[];
    if (ids.length>100) throw new WorkerRequestRefused('Notification policy needs administrator review.');
    const recipients:string[]=[];
    for (const id of new Set(ids)) {
      if (typeof id!=='string'||!safeId.test(id)) continue;
      const profile=(await tx.get(root.collection('private').doc('users').collection('active').doc(id))).data();
      if (profile?.active===true && profile.isApproved===true && profile.status==='active') recipients.push(id);
    }
    const isLeave=request.kind==='leave';
    const id=(isLeave?'LV-':'ADV-')+request.id;
    if (request.kind==='leave') {
      const totalDays=countWorkingDays(request.startDate,request.endDate);
      const leave:LeaveRequest={id,employeeId:employee.id,employeeName:employee.name,employeeSurname:employee.surname,employeeRole:employee.role,
        leaveType:request.leaveType,startDate:request.startDate,endDate:request.endDate,totalDays,reason:request.reason,
        attachmentUrl:request.attachmentUrl||null,attachmentName:request.attachmentName||null,status:'Pending',submittedAt:timestamp,
        annualLeaveBalanceBefore:15,annualLeaveBalanceAfter:Math.max(0,15-totalDays),fiscalYear:now.getFullYear()};
      tx.create(root.collection('public').doc('leave_requests').collection('items').doc(id),leave);
    } else {
      const fee=request.method==='Immediate Payment'?75:0;
      const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
      const advance:AdvanceRecord={id,date,baseAmount:request.baseAmount,fee,amount:request.baseAmount+fee,method:request.method,
        months:request.months,reason:request.reason,status:'Pending Approval',paidInFull:false,timestamp};
      const advances=[...(employee.advances||[]),advance];
      tx.update(employeeRef,{advances});
      tx.set(data.collection('employeeViews').doc(employee.id),employeeView({...employee,advances}));
    }
    const priority=policy?.priority;
    for (const recipientUserId of recipients) {
      const notification:UserNotification={notificationId:id,eventId,groupId:isLeave?'leave':'money_borrowing',
        title:isLeave?'Leave application':'Borrow Money request',description:`${employee.name} ${employee.surname} submitted a request for review.`,
        priority:['critical','high','normal','info','silent'].includes(priority)?priority:'high',recipientUserId,createdAt:timestamp,isRead:false,
        relatedPage:isLeave?'leave_management':'admin',entityId:id,entityType:request.kind,metadata:{employeeId:employee.id}};
      tx.create(root.collection('users').doc(recipientUserId).collection('notifications').doc(id),notification);
    }
    tx.create(receiptRef,{id,deviceUid:device.firebaseUid,signature:request.signature,notified:recipients.length});
    return {id,notified:recipients.length};
  });
}
