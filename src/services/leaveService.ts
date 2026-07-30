import { db, APP_ID_PATH } from '../firebase';
import { LeaveRequest, LeaveType, LeaveStatus, LeaveBalance, Employee } from '../types';
import { notificationService } from './notificationService';

const LEAVE_STORAGE_KEY = 'tsj_leave_requests_v1';
const LEAVE_BALANCES_KEY = 'tsj_leave_balances_v1';

// Pre-populate realistic initial leave records so managers and employees immediately see active leave states
const DEFAULT_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: 'LV-2026-0001',
    employeeId: '1',
    employeeName: 'Sipho',
    employeeSurname: 'Mabena',
    employeeRole: 'Artisan',
    personalCode: '1001',
    leaveType: 'Annual Leave',
    startDate: '2026-08-01',
    endDate: '2026-08-03',
    totalDays: 3,
    reason: 'Family gathering in Limpopo and personal travel.',
    attachmentUrl: null,
    attachmentName: null,
    status: 'Pending',
    submittedAt: '2026-07-23T08:30:00.000Z',
    annualLeaveBalanceBefore: 15,
    annualLeaveBalanceAfter: 12,
    fiscalYear: 2026
  },
  {
    id: 'LV-2026-0002',
    employeeId: '2',
    employeeName: 'Jabu',
    employeeSurname: 'Khumalo',
    employeeRole: 'Supervisor',
    personalCode: '1002',
    leaveType: 'Sick Leave',
    startDate: '2026-07-20',
    endDate: '2026-07-21',
    totalDays: 2,
    reason: 'Severe flu and fever. Doctor certificate attached.',
    attachmentUrl: 'data:application/pdf;base64,JVBERi0xLjQKJ...',
    attachmentName: 'Medical_Certificate_Dr_Nkosi.pdf',
    status: 'Approved',
    comments: 'Medical certificate verified. Rest well.',
    submittedAt: '2026-07-19T14:10:00.000Z',
    reviewedBy: 'Frans',
    reviewedAt: '2026-07-19T15:30:00.000Z',
    annualLeaveBalanceBefore: 12,
    annualLeaveBalanceAfter: 12,
    fiscalYear: 2026
  },
  {
    id: 'LV-2026-0003',
    employeeId: '3',
    employeeName: 'Pieter',
    employeeSurname: 'van der Merwe',
    employeeRole: 'Artisan',
    personalCode: '1003',
    leaveType: 'Family Responsibility',
    startDate: '2026-07-24',
    endDate: '2026-07-24',
    totalDays: 1,
    reason: 'Attending to urgent family medical appointment.',
    attachmentUrl: null,
    attachmentName: null,
    status: 'Approved',
    comments: 'Approved by management.',
    submittedAt: '2026-07-22T09:15:00.000Z',
    reviewedBy: 'Janah',
    reviewedAt: '2026-07-22T10:00:00.000Z',
    annualLeaveBalanceBefore: 10,
    annualLeaveBalanceAfter: 10,
    fiscalYear: 2026
  }
];

export const leaveService = {
  calculateWorkingDays(startDateStr: string, endDateStr: string): number {
    if (!startDateStr || !endDateStr) return 0;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const dayOfWeek = cur.getDay();
      // 0 = Sunday, 6 = Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  },

  getLocalLeaveRequests(): LeaveRequest[] {
    try {
      const stored = localStorage.getItem(LEAVE_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse local leave requests:', e);
    }
    localStorage.setItem(LEAVE_STORAGE_KEY, JSON.stringify(DEFAULT_LEAVE_REQUESTS));
    return DEFAULT_LEAVE_REQUESTS;
  },

  saveLocalLeaveRequests(list: LeaveRequest[]) {
    try {
      localStorage.setItem(LEAVE_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save local leave requests:', e);
    }
  },

  generateUniqueLeaveId(existingList: LeaveRequest[]): string {
    const year = new Date().getFullYear();
    const count = existingList.length + 1;
    const padded = String(count).padStart(4, '0');
    return `LV-${year}-${padded}`;
  },

  async submitLeaveRequest(data: {
    employee: Employee;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
  }): Promise<{ request: LeaveRequest; mailtoLink: string }> {
    const currentList = this.getLocalLeaveRequests();
    const uniqueId = this.generateUniqueLeaveId(currentList);
    const workingDays = this.calculateWorkingDays(data.startDate, data.endDate);

    const newRequest: LeaveRequest = {
      id: uniqueId,
      employeeId: data.employee.id,
      employeeName: data.employee.name,
      employeeSurname: data.employee.surname,
      employeeRole: data.employee.role,
      personalCode: data.employee.personalCode,
      leaveType: data.leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      totalDays: workingDays,
      reason: data.reason,
      attachmentUrl: data.attachmentUrl || null,
      attachmentName: data.attachmentName || null,
      status: 'Pending',
      submittedAt: new Date().toISOString(),
      annualLeaveBalanceBefore: 15,
      annualLeaveBalanceAfter: Math.max(0, 15 - workingDays),
      fiscalYear: new Date().getFullYear()
    };

    // 1. Local storage
    const updated = [newRequest, ...currentList];
    this.saveLocalLeaveRequests(updated);

    // 2. Firebase persistence
    if (db && APP_ID_PATH) {
      try {
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('leave_requests')
          .collection('items')
          .doc(uniqueId)
          .set(newRequest);
      } catch (err) {
        console.warn('Unable to persist leave request in Firebase:', err);
      }
    }

    // 3. Global Notification Centre alert
    await notificationService.addNotification({
      category: 'leave_request',
      categoryLabel: 'Leave Requests',
      title: `Leave Application: ${newRequest.employeeName} ${newRequest.employeeSurname}`,
      description: `${newRequest.employeeName} (${newRequest.employeeRole}) applied for ${newRequest.totalDays} day(s) ${newRequest.leaveType} (${newRequest.startDate} to ${newRequest.endDate}). Reason: ${newRequest.reason}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      priority: 'high',
      relatedPage: 'leave_management',
      targetEmails: ['frans@tsjoinery.co.za', 'janah@tsjoinery.co.za'],
      targetRoles: ['Admin', 'Supervisor', 'HR'],
      metadata: { leaveRequestId: uniqueId, employeeId: data.employee.id }
    });

    // 4. Create mailto link for direct manager email dispatch
    const mailToRecipients = ['frans@tsjoinery.co.za', 'janah@tsjoinery.co.za'].join(',');
    const emailSubject = encodeURIComponent(`[Leave Request ${uniqueId}] ${newRequest.employeeName} ${newRequest.employeeSurname} - ${newRequest.leaveType}`);
    const emailBody = encodeURIComponent(
      `NEW LEAVE REQUEST SUBMITTED\n` +
      `========================================\n` +
      `Request ID: ${uniqueId}\n` +
      `Employee Name: ${newRequest.employeeName} ${newRequest.employeeSurname}\n` +
      `Role: ${newRequest.employeeRole}\n` +
      `Personal Code: ${newRequest.personalCode || 'N/A'}\n` +
      `Leave Type: ${newRequest.leaveType}\n` +
      `Start Date: ${newRequest.startDate}\n` +
      `End Date: ${newRequest.endDate}\n` +
      `Total Working Days: ${newRequest.totalDays} Day(s)\n` +
      `Status: PENDING APPROVAL\n\n` +
      `Reason for Leave:\n${newRequest.reason}\n\n` +
      `Attachment Attached: ${newRequest.attachmentName ? newRequest.attachmentName : 'None'}\n` +
      `========================================\n` +
      `Action Required: Log into TS Joinery PWA to Approve or Reject this request.`
    );
    const mailtoLink = `mailto:${mailToRecipients}?subject=${emailSubject}&body=${emailBody}`;

    return { request: newRequest, mailtoLink };
  },

  async updateLeaveStatus(
    leaveRequestId: string,
    status: LeaveStatus,
    comments?: string,
    reviewerName?: string
  ): Promise<LeaveRequest | null> {
    const current = this.getLocalLeaveRequests();
    let targetReq: LeaveRequest | null = null;

    const updated = current.map(req => {
      if (req.id === leaveRequestId) {
        targetReq = {
          ...req,
          status,
          comments: comments || req.comments || '',
          reviewedBy: reviewerName || 'Manager',
          reviewedAt: new Date().toISOString()
        };
        return targetReq;
      }
      return req;
    });

    if (!targetReq) return null;

    this.saveLocalLeaveRequests(updated);

    // Sync to Firebase
    if (db && APP_ID_PATH) {
      try {
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('leave_requests')
          .collection('items')
          .doc(leaveRequestId)
          .update(targetReq);
      } catch (e) {
        console.warn('Firebase leave status update warn:', e);
      }
    }

    // Add status update notification
    await notificationService.addNotification({
      category: 'leave_request',
      categoryLabel: 'Leave Requests',
      title: `Leave Request ${status}: ${targetReq.employeeName} ${targetReq.employeeSurname}`,
      description: `Leave Request ${leaveRequestId} for ${targetReq.employeeName} was ${status.toUpperCase()} by ${reviewerName || 'Manager'}.${comments ? ' Comment: ' + comments : ''}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      priority: status === 'Approved' ? 'medium' : 'high',
      relatedPage: 'leave_management',
      targetEmails: ['frans@tsjoinery.co.za', 'janah@tsjoinery.co.za'],
      targetRoles: ['Admin', 'HR', 'Supervisor'],
      metadata: { leaveRequestId, status }
    });

    return targetReq;
  },

  async deleteLeaveRequest(leaveRequestId: string): Promise<boolean> {
    const current = this.getLocalLeaveRequests();
    const updated = current.filter(req => req.id !== leaveRequestId);
    this.saveLocalLeaveRequests(updated);

    if (db && APP_ID_PATH) {
      try {
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('leave_requests')
          .collection('items')
          .doc(leaveRequestId)
          .delete();
      } catch (err) {
        console.warn('Firebase leave delete error:', err);
      }
    }
    return true;
  },

  subscribeLeaveRequests(callback: (requests: LeaveRequest[]) => void) {
    callback(this.getLocalLeaveRequests());

    if (db && APP_ID_PATH) {
      try {
        const unsubscribe = db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('leave_requests')
          .collection('items')
          .onSnapshot(
            snapshot => {
              if (snapshot && !snapshot.empty) {
                const firebaseItems: LeaveRequest[] = [];
                snapshot.forEach(doc => {
                  firebaseItems.push(doc.data() as LeaveRequest);
                });
                firebaseItems.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
                this.saveLocalLeaveRequests(firebaseItems);
                callback(firebaseItems);
              }
            },
            err => {
              console.warn('Firebase leave subscription error:', err);
              callback(this.getLocalLeaveRequests());
            }
          );
        return unsubscribe;
      } catch (e) {
        console.warn('Unable to subscribe to Firebase leave requests:', e);
      }
    }

    return () => {};
  },

  getApprovedLeaveForDate(employeeId: string, dateStr: string, requestsList?: LeaveRequest[]): LeaveRequest | null {
    const list = requestsList || this.getLocalLeaveRequests();
    const approved = list.filter(
      r => r.employeeId === employeeId && r.status === 'Approved'
    );

    const matched = approved.find(r => {
      const start = r.startDate;
      const end = r.endDate;
      return dateStr >= start && dateStr <= end;
    });

    return matched || null;
  },

  getLeaveBalanceForEmployee(employeeId: string): LeaveBalance {
    const requests = this.getLocalLeaveRequests().filter(
      r => r.employeeId === employeeId && r.status === 'Approved'
    );

    let annualUsed = 0;
    let sickUsed = 0;
    let familyUsed = 0;

    requests.forEach(r => {
      if (r.leaveType === 'Annual Leave') annualUsed += r.totalDays;
      else if (r.leaveType === 'Sick Leave') sickUsed += r.totalDays;
      else if (r.leaveType === 'Family Responsibility') familyUsed += r.totalDays;
    });

    return {
      employeeId,
      annualLeaveTotal: 15,
      annualLeaveUsed: annualUsed,
      sickLeaveTotal: 12,
      sickLeaveUsed: sickUsed,
      familyLeaveTotal: 3,
      familyLeaveUsed: familyUsed
    };
  }
};
