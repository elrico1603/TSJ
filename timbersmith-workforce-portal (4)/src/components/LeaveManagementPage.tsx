import React, { useState, useEffect } from 'react';
import { Employee, LeaveRequest, LeaveStatus } from '../types';
import { leaveService } from '../services/leaveService';
import { Icon } from './Icon';
import { PhotoAvatar } from './ClockingTerminal';
import { LeaveApplicationModal } from './LeaveApplicationModal';

interface LeaveManagementPageProps {
  employees: Employee[];
  userRole?: string;
  userEmail?: string;
}

export const LeaveManagementPage: React.FC<LeaveManagementPageProps> = ({
  employees,
  userRole,
  userEmail
}) => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState<LeaveStatus | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [actionComments, setActionComments] = useState<string>('');
  const [actionType, setActionType] = useState<'Approved' | 'Rejected' | null>(null);
  const [selectedAttachment, setSelectedAttachment] = useState<{ url: string; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'manager' | 'employee'>('manager');
  const [requestToDelete, setRequestToDelete] = useState<LeaveRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const canManageLeave = !userRole || ['Admin', 'HR', 'Manager', 'Supervisor'].includes(userRole) || userRole !== 'Artisan';

  useEffect(() => {
    const unsubscribe = leaveService.subscribeLeaveRequests(requests => {
      setLeaveRequests(requests);
    });
    return () => unsubscribe();
  }, []);

  const handleDeleteConfirm = async () => {
    if (!requestToDelete) return;
    setIsDeleting(true);
    try {
      await leaveService.deleteLeaveRequest(requestToDelete.id);
      setLeaveRequests(prev => prev.filter(r => r.id !== requestToDelete.id));
      setRequestToDelete(null);
      setToastMessage('Leave request deleted successfully.');
      setTimeout(() => {
        setToastMessage(null);
      }, 3500);
    } catch (err) {
      console.error('Error deleting leave request:', err);
      alert('Failed to delete leave request.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleApproveReject = async () => {
    if (!selectedRequest || !actionType) return;
    try {
      const reviewer = userEmail === 'frans@tsjoinery.co.za' ? 'Frans' : userEmail === 'janah@tsjoinery.co.za' ? 'Janah' : 'Manager';
      await leaveService.updateLeaveStatus(selectedRequest.id, actionType, actionComments, reviewer);
      alert(`Leave Request ${selectedRequest.id} has been ${actionType.toUpperCase()} successfully.`);
      setSelectedRequest(null);
      setActionType(null);
      setActionComments('');
    } catch (err) {
      console.error('Error updating leave request:', err);
      alert('Failed to update leave request.');
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const pendingRequests = leaveRequests.filter(r => r.status === 'Pending');
  const approvedRequests = leaveRequests.filter(r => r.status === 'Approved');
  const rejectedRequests = leaveRequests.filter(r => r.status === 'Rejected');
  
  const onLeaveToday = leaveRequests.filter(
    r => r.status === 'Approved' && r.startDate <= todayStr && r.endDate >= todayStr
  );

  const filteredRequests = leaveRequests.filter(r => {
    if (filterStatus !== 'All' && r.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = `${r.employeeName} ${r.employeeSurname}`.toLowerCase().includes(q);
      const matchId = r.id.toLowerCase().includes(q);
      const matchType = r.leaveType.toLowerCase().includes(q);
      return matchName || matchId || matchType;
    }
    return true;
  });

  return (
    <div className="animate-in fade-in duration-300 font-sans italic text-white space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#121212] p-8 rounded-[2.5rem] border border-white/5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500 border border-amber-500/30">
              <Icon name="calendar" size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter text-white font-sans">
                Leave Management
              </h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">
                TS Joinery Clocking & Attendance System
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-black/40 p-1.5 rounded-2xl border border-white/10 flex items-center gap-1">
            <button
              onClick={() => setActiveTab('manager')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'manager'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Manager Approvals ({pendingRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('employee')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'employee'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Employee Roster & History
            </button>
          </div>

          <button
            onClick={() => setShowApplyModal(true)}
            className="px-6 py-3.5 bg-[#ff8c00] hover:bg-[#e07b00] text-black font-black uppercase tracking-wider text-xs rounded-2xl shadow-lg shadow-[#ff8c00]/20 transition-all flex items-center gap-2 active:scale-95"
          >
            <Icon name="plus" size={18} />
            <span>Apply For Leave</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 font-sans">
        <div className="bg-[#151515] p-6 rounded-[2rem] border border-amber-500/30 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-[10px] font-black uppercase text-amber-400 tracking-widest">Pending Approval</p>
            <p className="text-4xl font-mono font-black text-white mt-1">{pendingRequests.length}</p>
          </div>
          <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-400">
            <Icon name="clock" size={28} />
          </div>
        </div>

        <div className="bg-[#151515] p-6 rounded-[2rem] border border-emerald-500/30 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">Approved Requests</p>
            <p className="text-4xl font-mono font-black text-white mt-1">{approvedRequests.length}</p>
          </div>
          <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400">
            <Icon name="check-circle" size={28} />
          </div>
        </div>

        <div className="bg-[#151515] p-6 rounded-[2rem] border border-red-500/30 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-[10px] font-black uppercase text-red-400 tracking-widest">Rejected Requests</p>
            <p className="text-4xl font-mono font-black text-white mt-1">{rejectedRequests.length}</p>
          </div>
          <div className="p-4 bg-red-500/10 rounded-2xl text-red-400">
            <Icon name="x-circle" size={28} />
          </div>
        </div>

        <div className="bg-[#151515] p-6 rounded-[2rem] border border-purple-500/30 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-[10px] font-black uppercase text-purple-400 tracking-widest">On Leave Today</p>
            <p className="text-4xl font-mono font-black text-white mt-1">{onLeaveToday.length}</p>
          </div>
          <div className="p-4 bg-purple-500/10 rounded-2xl text-purple-400">
            <Icon name="plane-takeoff" size={28} />
          </div>
        </div>
      </div>

      {activeTab === 'manager' ? (
        /* Manager Approvals View */
        <div className="bg-[#151515] border border-white/5 rounded-[2.5rem] p-6 space-y-6">
          {/* Controls: Search & Status Filters */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-black/40 p-4 rounded-2xl border border-white/5">
            <div className="relative w-full md:w-80">
              <Icon name="search" size={18} className="absolute left-3.5 top-3.5 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search employee, leave ID, or type..."
                className="w-full bg-[#1c1c1c] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-amber-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
              {(['All', 'Pending', 'Approved', 'Rejected'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    filterStatus === st
                      ? 'bg-white text-black font-black'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {st} {st === 'Pending' && pendingRequests.length > 0 && `(${pendingRequests.length})`}
                </button>
              ))}
            </div>
          </div>

          {/* Leave Requests Table/Cards */}
          <div className="space-y-4">
            {filteredRequests.length === 0 ? (
              <div className="text-center py-20 bg-black/20 rounded-3xl border border-white/5">
                <Icon name="calendar" size={48} className="text-gray-700 mx-auto" />
                <p className="text-gray-500 uppercase font-black text-sm tracking-wider mt-4">
                  No leave requests found
                </p>
                <p className="text-xs text-gray-600 mt-1">Try adjusting your status filter or search parameters.</p>
              </div>
            ) : (
              filteredRequests.map(req => {
                const emp = employees.find(e => e.id === req.employeeId);
                return (
                  <div
                    key={req.id}
                    className="bg-black/30 border border-white/10 hover:border-white/20 p-6 rounded-3xl transition-all space-y-4"
                  >
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <PhotoAvatar emp={{ name: req.employeeName, photo: emp?.photo }} size={56} />
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-black uppercase text-white font-sans">
                              {req.employeeName} {req.employeeSurname}
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-md bg-white/10 font-mono text-[10px] font-bold text-amber-400 border border-white/10">
                              {req.id}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 uppercase mt-0.5 font-sans">
                            {req.employeeRole} • Code: {req.personalCode || 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end md:self-center">
                        <span
                          className={`px-4 py-1.5 rounded-full font-black text-xs uppercase tracking-wider border ${
                            req.status === 'Approved'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : req.status === 'Rejected'
                              ? 'bg-red-500/20 text-red-400 border-red-500/40'
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse'
                          }`}
                        >
                          {req.status}
                        </span>

                        {(req.status === 'Pending' || (req.status as string) === 'Open') && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedRequest(req);
                                setActionType('Approved');
                              }}
                              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-wider text-xs shadow-md transition-all flex items-center gap-1.5"
                            >
                              <Icon name="check" size={14} />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRequest(req);
                                setActionType('Rejected');
                              }}
                              className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-black uppercase tracking-wider text-xs shadow-md transition-all flex items-center gap-1.5"
                            >
                              <Icon name="x" size={14} />
                              <span>Reject</span>
                            </button>
                          </div>
                        )}

                        {canManageLeave && (
                          <button
                            onClick={() => setRequestToDelete(req)}
                            title="Delete Leave Request"
                            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 transition-all flex items-center justify-center active:scale-95"
                          >
                            <Icon name="trash-2" size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Details Box */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-2xl bg-black/50 border border-white/5 text-xs font-sans">
                      <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Leave Type</p>
                        <p className="font-bold text-amber-400 mt-0.5">{req.leaveType}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Dates & Days</p>
                        <p className="font-bold text-white mt-0.5 font-mono">
                          {req.startDate} to {req.endDate} ({req.totalDays} Days)
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Submitted On</p>
                        <p className="font-bold text-gray-300 mt-0.5 font-mono">
                          {new Date(req.submittedAt).toLocaleDateString()} {new Date(req.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Attachment</p>
                        {req.attachmentName && req.attachmentUrl ? (
                          <button
                            onClick={() => setSelectedAttachment({ url: req.attachmentUrl!, name: req.attachmentName! })}
                            className="mt-0.5 text-xs font-black text-blue-400 hover:underline flex items-center gap-1.5"
                          >
                            <Icon name="paperclip" size={13} />
                            <span className="truncate max-w-[150px]">{req.attachmentName}</span>
                          </button>
                        ) : (
                          <p className="text-gray-600 mt-0.5 italic">None</p>
                        )}
                      </div>
                    </div>

                    {/* Reason & Comments */}
                    <div className="space-y-2 text-xs font-sans">
                      <p className="text-gray-300 leading-relaxed bg-white/2 p-3.5 rounded-xl border border-white/5">
                        <strong className="text-amber-400 uppercase tracking-wider mr-2 text-[10px]">Reason:</strong>
                        {req.reason}
                      </p>

                      {req.comments && (
                        <p className="text-gray-400 leading-relaxed bg-purple-500/5 p-3.5 rounded-xl border border-purple-500/20">
                          <strong className="text-purple-400 uppercase tracking-wider mr-2 text-[10px]">
                            Manager Note ({req.reviewedBy || 'Manager'}):
                          </strong>
                          {req.comments}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Employee Roster & Balance View */
        <div className="bg-[#151515] border border-white/5 rounded-[2.5rem] p-6 space-y-6">
          <h3 className="text-xl font-black uppercase text-white font-sans">
            Employee Leave Balances & Roster Summary
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {employees.filter(e => !e.isArchived).map(emp => {
              const balance = leaveService.getLeaveBalanceForEmployee(emp.id);
              const empRequests = leaveRequests.filter(r => r.employeeId === emp.id);

              return (
                <div
                  key={emp.id}
                  className="bg-black/40 border border-white/10 p-6 rounded-3xl space-y-4 hover:border-amber-500/50 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <PhotoAvatar emp={emp} size={50} />
                    <div>
                      <p className="font-black text-white text-base">{emp.name} {emp.surname}</p>
                      <p className="text-xs text-amber-400 uppercase font-bold">{emp.role}</p>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-b border-white/5 py-3 text-xs font-sans">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Annual Leave (15 Days Max)</span>
                      <span className="font-mono font-bold text-white">
                        {balance.annualLeaveUsed} Used / {Math.max(0, balance.annualLeaveTotal - balance.annualLeaveUsed)} Remaining
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full rounded-full" 
                        style={{ width: `${Math.min(100, (balance.annualLeaveUsed / balance.annualLeaveTotal) * 100)}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-gray-400">Sick Leave (12 Days Max)</span>
                      <span className="font-mono font-bold text-emerald-400">{balance.sickLeaveUsed} Days Used</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Family Responsibility (3 Days)</span>
                      <span className="font-mono font-bold text-blue-400">{balance.familyLeaveUsed} Days Used</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-500 font-bold uppercase flex justify-between">
                    <span>Total Applications: {empRequests.length}</span>
                    <button
                      onClick={() => {
                        setSearchQuery(`${emp.name} ${emp.surname}`);
                        setActiveTab('manager');
                      }}
                      className="text-amber-400 hover:underline"
                    >
                      View Applications
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Approval / Rejection Modal */}
      {selectedRequest && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#181818] border border-white/10 rounded-3xl p-6 space-y-4 text-white font-sans">
            <h3 className="text-xl font-black uppercase italic">
              {actionType} Leave Request {selectedRequest.id}
            </h3>
            <p className="text-xs text-gray-400">
              Employee: <strong className="text-white">{selectedRequest.employeeName} {selectedRequest.employeeSurname}</strong> ({selectedRequest.leaveType}, {selectedRequest.totalDays} Days)
            </p>

            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1 uppercase">
                Manager Comments / Review Notes
              </label>
              <textarea
                rows={3}
                value={actionComments}
                onChange={e => setActionComments(e.target.value)}
                placeholder="Optional notes for the employee..."
                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-amber-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setActionType(null);
                }}
                className="px-4 py-2 rounded-xl bg-white/5 text-xs font-bold uppercase text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveReject}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase text-black ${
                  actionType === 'Approved' ? 'bg-emerald-500' : 'bg-red-500 text-white'
                }`}
              >
                Confirm {actionType}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Preview Modal */}
      {selectedAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#181818] border border-white/10 p-6 rounded-3xl max-w-2xl w-full text-white font-sans space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-black text-sm uppercase">{selectedAttachment.name}</h4>
              <button onClick={() => setSelectedAttachment(null)} className="text-gray-400 hover:text-white">
                <Icon name="x" size={20} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-xl bg-black/50 p-2 border border-white/5 flex items-center justify-center">
              {selectedAttachment.url.startsWith('data:image/') || selectedAttachment.url.startsWith('http') ? (
                <img src={selectedAttachment.url} alt="Attachment" className="max-w-full h-auto object-contain" />
              ) : (
                <div className="p-8 text-center space-y-3">
                  <Icon name="file-text" size={48} className="text-amber-400 mx-auto" />
                  <p className="text-xs text-gray-300">Document attached ({selectedAttachment.name})</p>
                  <a
                    href={selectedAttachment.url}
                    download={selectedAttachment.name}
                    className="inline-block px-4 py-2 bg-amber-500 text-black font-black text-xs rounded-xl uppercase"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      <LeaveApplicationModal
        isOpen={showApplyModal}
        onClose={() => setShowApplyModal(false)}
        employees={employees}
        onSuccess={() => {}}
      />

      {/* Delete Confirmation Modal */}
      {requestToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#181818] border border-white/10 rounded-3xl p-6 space-y-6 text-white font-sans shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/10 rounded-2xl text-red-500 border border-red-500/20">
                <Icon name="trash-2" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-white font-sans">
                  Delete Leave Request
                </h3>
                <p className="text-xs text-gray-400 font-mono font-bold mt-0.5">
                  {requestToDelete.id} • {requestToDelete.employeeName} {requestToDelete.employeeSurname}
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-300 font-sans leading-relaxed bg-black/40 p-4 rounded-2xl border border-white/5">
              Are you sure you want to permanently delete this leave request?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                disabled={isDeleting}
                onClick={() => setRequestToDelete(null)}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-black uppercase text-gray-300 transition-all"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-wider text-xs shadow-lg shadow-red-600/20 transition-all flex items-center gap-2"
              >
                {isDeleting ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Icon name="trash-2" size={14} />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-black px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-wider shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 font-sans">
          <Icon name="check-circle" size={20} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
