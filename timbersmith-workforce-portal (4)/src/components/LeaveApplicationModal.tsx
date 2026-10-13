import React, { useState, useEffect } from 'react';
import { Employee, LeaveType } from '../types';
import { leaveService } from '../services/leaveService';
import { Icon } from './Icon';

interface LeaveApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  initialEmployee?: Employee | null;
  onSuccess: () => void;
}

const LEAVE_TYPES: LeaveType[] = [
  'Annual Leave',
  'Sick Leave',
  'Family Responsibility',
  'Maternity / Paternity',
  'Unpaid Leave',
  'Study Leave'
];

export const LeaveApplicationModal: React.FC<LeaveApplicationModalProps> = ({
  isOpen,
  onClose,
  employees,
  initialEmployee,
  onSuccess
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [leaveType, setLeaveType] = useState<LeaveType>('Annual Leave');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [emailAlertLink, setEmailAlertLink] = useState<string | null>(null);

  useEffect(() => {
    if (initialEmployee) {
      setSelectedEmpId(initialEmployee.id);
    } else if (employees.length > 0 && !selectedEmpId) {
      setSelectedEmpId(employees[0].id);
    }
  }, [initialEmployee, employees]);

  if (!isOpen) return null;

  const currentEmp = employees.find(e => e.id === selectedEmpId) || initialEmployee || employees[0];
  const calculatedDays = leaveService.calculateWorkingDays(startDate, endDate);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit. Please attach a smaller image or document.');
        return;
      }
      setAttachmentName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachmentUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmp) {
      alert('Please select an employee.');
      return;
    }
    if (!startDate || !endDate) {
      alert('Please select valid start and end dates.');
      return;
    }
    if (calculatedDays <= 0) {
      alert('End date cannot be earlier than start date.');
      return;
    }
    if (!reason.trim()) {
      alert('Please enter a reason for the leave application.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { request, mailtoLink } = await leaveService.submitLeaveRequest({
        employee: currentEmp,
        leaveType,
        startDate,
        endDate,
        reason: reason.trim(),
        attachmentUrl,
        attachmentName
      });

      setEmailAlertLink(mailtoLink);
      alert(`Leave Request ${request.id} submitted successfully! Status: PENDING.\nAn email alert has been generated for Frans and Janah.`);
      
      // Trigger mailto link window
      window.open(mailtoLink, '_blank');

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to submit leave request:', err);
      alert('Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#121212] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh] font-sans italic text-white relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-amber-500/10 rounded-2xl text-amber-500 border border-amber-500/30">
              <Icon name="calendar" size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-white font-sans">
                Apply For Leave
              </h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                TS Joinery Clocking & Attendance Module
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Employee Selection / Auto-fill info */}
          <div className="bg-black/40 p-5 rounded-2xl border border-white/5 space-y-4">
            <label className="text-xs font-black uppercase tracking-wider text-gray-400 block">
              Employee Information (Auto-filled)
            </label>

            {initialEmployee ? (
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
                <div>
                  <p className="text-lg font-black uppercase text-white">
                    {initialEmployee.name} {initialEmployee.surname}
                  </p>
                  <p className="text-xs font-bold text-[#ff8c00] uppercase mt-0.5">
                    {initialEmployee.role} • Personal Code: {initialEmployee.personalCode}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase">
                  Active
                </span>
              </div>
            ) : (
              <div>
                <select
                  value={selectedEmpId}
                  onChange={e => setSelectedEmpId(e.target.value)}
                  className="w-full bg-[#1c1c1c] border border-white/10 rounded-xl p-3.5 text-sm font-bold text-white focus:border-[#ff8c00] outline-none"
                >
                  {employees.filter(e => !e.isArchived).map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.surname} ({emp.role} - Code: {emp.personalCode})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Leave Type */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-gray-400 block mb-2">
              Select Leave Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {LEAVE_TYPES.map(type => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setLeaveType(type)}
                  className={`p-3.5 rounded-xl text-xs font-black uppercase tracking-wider text-left transition-all border ${
                    leaveType === type
                      ? 'bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20'
                      : 'bg-white/5 text-gray-300 border-white/5 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Dates & Auto-Calculation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-gray-400 block mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-[#1c1c1c] border border-white/10 rounded-xl p-3.5 text-sm font-mono text-white focus:border-amber-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-gray-400 block mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-[#1c1c1c] border border-white/10 rounded-xl p-3.5 text-sm font-mono text-white focus:border-amber-500 outline-none"
                required
              />
            </div>
          </div>

          {/* Calculation Badge */}
          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon name="clock" size={20} className="text-amber-400" />
              <div>
                <p className="text-xs font-black uppercase text-amber-400">Calculated Leave Duration</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Excludes weekend non-working days</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black font-mono text-white">{calculatedDays}</span>
              <span className="text-xs font-bold text-amber-400 ml-1 uppercase">Days</span>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-gray-400 block mb-2">
              Reason For Leave <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Provide a concise description or medical reason for this leave application..."
              className="w-full bg-[#1c1c1c] border border-white/10 rounded-xl p-4 text-sm font-sans text-white placeholder-gray-600 focus:border-amber-500 outline-none resize-none"
              required
            />
          </div>

          {/* Optional Attachment Upload */}
          <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Icon name="paperclip" size={16} className="text-amber-400" />
              Upload Attachment (Optional: Doctor's Certificate / Document)
            </label>

            <div className="flex items-center gap-4">
              <label className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-black uppercase tracking-wider text-white cursor-pointer transition-all flex items-center gap-2">
                <Icon name="file-down" size={16} />
                <span>Select File</span>
                <input
                  type="file"
                  accept="image/*,application/pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {attachmentName ? (
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30 truncate max-w-xs">
                  <Icon name="check-circle" size={14} />
                  <span className="truncate">{attachmentName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentName(null);
                      setAttachmentUrl(null);
                    }}
                    className="text-gray-400 hover:text-red-400 ml-1"
                  >
                    <Icon name="x" size={12} />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-gray-500 font-sans italic">No file selected</span>
              )}
            </div>
          </div>

          {/* Email Notification Alert Info */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center gap-3">
            <Icon name="mail" size={20} className="text-blue-400 shrink-0" />
            <p className="text-xs text-gray-300 font-sans">
              Submitting this application will automatically dispatch an email notification to 
              <strong className="text-white ml-1 font-mono">frans@tsjoinery.co.za</strong> and <strong className="text-white font-mono">janah@tsjoinery.co.za</strong>.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-wider text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || calculatedDays <= 0}
              className="px-8 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider text-xs shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>Submitting...</span>
              ) : (
                <>
                  <Icon name="send" size={16} />
                  <span>Submit Leave Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
