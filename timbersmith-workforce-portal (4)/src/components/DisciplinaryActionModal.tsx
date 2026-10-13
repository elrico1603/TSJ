import React, { useState } from 'react';
import { Employee } from '../types';
import { 
  WarningLevel, 
  OffenseCategory, 
  DisciplinaryWarning 
} from '../types/employee';
import { disciplinaryAndPPEService } from '../services/disciplinaryAndPPEService';
import { PhotoAvatar } from './ClockingTerminal';
import { 
  AlertTriangle, 
  ShieldAlert, 
  Upload, 
  Calendar, 
  FileText, 
  X, 
  CheckCircle2, 
  Clock, 
  User, 
  Paperclip,
  ExternalLink,
  History
} from 'lucide-react';

interface DisciplinaryActionModalProps {
  employees: Employee[];
  selectedEmployee?: Employee | null;
  currentUser?: any;
  onClose: () => void;
  onWarningSaved: (updatedEmployee: Employee, warning: DisciplinaryWarning) => void;
  announce: (txt: string) => void;
}

export const DisciplinaryActionModal: React.FC<DisciplinaryActionModalProps> = ({
  employees,
  selectedEmployee: initialEmp,
  currentUser,
  onClose,
  onWarningSaved,
  announce
}) => {
  const activeEmployees = employees.filter(e => !e.isArchived);
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    initialEmp ? initialEmp.id : (activeEmployees[0]?.id || '')
  );

  const currentEmp = employees.find(e => e.id === selectedEmpId) || initialEmp || activeEmployees[0];

  const [activeTab, setActiveTab] = useState<'log_new' | 'history'>('log_new');
  const [warningLevel, setWarningLevel] = useState<WarningLevel>('Written Warning');
  const [offenseCategory, setOffenseCategory] = useState<OffenseCategory>('Safety Violation');
  const [detailedReason, setDetailedReason] = useState<string>('');
  const [incidentNotes, setIncidentNotes] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expiryPeriod, setExpiryPeriod] = useState<string>('6 Months');
  const [uploadedDocUrl, setUploadedDocUrl] = useState<string>('');
  const [uploadedDocName, setUploadedDocName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [selectedDocPreview, setSelectedDocPreview] = useState<{ url: string; name: string } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      announce("File too large. Maximum allowed size is 10MB.");
      return;
    }

    setUploadedDocName(file.name);
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      setUploadedDocUrl(result);
      announce(`Document "${file.name}" attached successfully.`);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmp) {
      announce("Please select an employee.");
      return;
    }
    if (!detailedReason.trim()) {
      announce("Please provide detailed reason and notes for this disciplinary action.");
      return;
    }

    try {
      setIsSubmitting(true);
      const issuedBy = currentUser?.name || currentUser?.email || 'Authorized Supervisor';
      
      const { updatedEmployee, warning } = await disciplinaryAndPPEService.logDisciplinaryWarning(
        currentEmp,
        {
          warningLevel,
          offenseCategory,
          detailedReason,
          incidentNotes,
          issueDate,
          expiryPeriod,
          documentUrl: uploadedDocUrl,
          documentName: uploadedDocName,
          issuedBy
        }
      );

      announce(`${warningLevel} logged successfully for ${currentEmp.name} ${currentEmp.surname}.`);
      onWarningSaved(updatedEmployee, warning);
      setActiveTab('history');
      setDetailedReason('');
      setIncidentNotes('');
      setUploadedDocUrl('');
      setUploadedDocName('');
    } catch (err) {
      console.error("Failed to log warning:", err);
      announce("An error occurred while saving the disciplinary record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const warningHistory = currentEmp?.warnings || [];

  return (
    <div className="fixed inset-0 z-[1500] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-6 animate-in fade-in font-sans">
      <div className="bg-[#151517] rounded-[2.5rem] border border-white/10 w-full max-w-4xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-[#1c1c20] border-b border-white/10 p-6 sm:p-8 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-white tracking-tight">
                Disciplinary & Warning System
              </h2>
              <p className="text-xs text-gray-400 font-medium">
                Log formal workplace notices, safety violations & disciplinary hearings
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Navigation Tabs & Target Selector */}
        <div className="bg-[#18181c] px-6 py-4 border-b border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <label className="text-xs font-black uppercase text-gray-400 shrink-0">Artisan:</label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="bg-black/60 border border-white/10 text-white rounded-xl px-4 py-2 text-sm font-bold focus:border-red-500 outline-none w-full sm:w-auto"
            >
              {activeEmployees.map(emp => (
                <option key={emp.id} value={emp.id} className="bg-[#1a1a1a] text-white">
                  {emp.name} {emp.surname} ({emp.role})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab('log_new')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'log_new' 
                  ? 'bg-red-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Log Warning
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'history' 
                  ? 'bg-white/15 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Warning History ({warningHistory.length})
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 custom-scrollbar">
          {activeTab === 'log_new' ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Target Artisan Card Info */}
              {currentEmp && (
                <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <PhotoAvatar emp={currentEmp} size={54} />
                    <div>
                      <h4 className="font-bold text-white text-base">{currentEmp.name} {currentEmp.surname}</h4>
                      <p className="text-xs text-gray-400 font-medium">{currentEmp.role} • ID: {currentEmp.idNumber || currentEmp.personalCode || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono uppercase bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-full font-bold">
                      {warningHistory.filter(w => w.status === 'Active').length} Active Warnings
                    </span>
                  </div>
                </div>
              )}

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Warning Level */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">
                    Warning Severity Level *
                  </label>
                  <select
                    value={warningLevel}
                    onChange={(e) => setWarningLevel(e.target.value as WarningLevel)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-bold focus:border-red-500 outline-none"
                  >
                    <option value="Verbal Warning" className="bg-[#1a1a1a]">Verbal Warning (First Notice)</option>
                    <option value="Written Warning" className="bg-[#1a1a1a]">Written Warning (Formal Notice)</option>
                    <option value="Final Written Warning" className="bg-[#1a1a1a]">Final Written Warning (Critical Notice)</option>
                    <option value="Suspension / Hearing" className="bg-[#1a1a1a]">Suspension / Disciplinary Hearing</option>
                  </select>
                </div>

                {/* Offense Category */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">
                    Offense Category *
                  </label>
                  <select
                    value={offenseCategory}
                    onChange={(e) => setOffenseCategory(e.target.value as OffenseCategory)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-bold focus:border-red-500 outline-none"
                  >
                    <option value="Attendance" className="bg-[#1a1a1a]">Attendance / Absenteeism / Late Arrival</option>
                    <option value="Safety Violation" className="bg-[#1a1a1a]">Safety Violation / PPE Non-Compliance</option>
                    <option value="Performance" className="bg-[#1a1a1a]">Poor Workmanship / Performance</option>
                    <option value="Misconduct" className="bg-[#1a1a1a]">General Misconduct / Rule Breach</option>
                    <option value="Insubordination" className="bg-[#1a1a1a]">Insubordination / Disrespect</option>
                    <option value="Negligence" className="bg-[#1a1a1a]">Gross Negligence / Machine Misuse</option>
                    <option value="Damage to Property" className="bg-[#1a1a1a]">Damage to Materials or Machinery</option>
                    <option value="Other" className="bg-[#1a1a1a]">Other Workshop Infraction</option>
                  </select>
                </div>

                {/* Issue Date */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">
                    Date of Infraction / Notice *
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-bold focus:border-red-500 outline-none"
                  />
                </div>

                {/* Expiry Period */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">
                    Validity & Expiry Period
                  </label>
                  <select
                    value={expiryPeriod}
                    onChange={(e) => setExpiryPeriod(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-bold focus:border-red-500 outline-none"
                  >
                    <option value="3 Months" className="bg-[#1a1a1a]">Valid for 3 Months</option>
                    <option value="6 Months" className="bg-[#1a1a1a]">Valid for 6 Months (Standard)</option>
                    <option value="12 Months" className="bg-[#1a1a1a]">Valid for 12 Months (Serious)</option>
                    <option value="Permanent" className="bg-[#1a1a1a]">Permanent Record</option>
                  </select>
                </div>
              </div>

              {/* Detailed Reason */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">
                  Detailed Reason & Incident Description *
                </label>
                <textarea
                  required
                  rows={4}
                  value={detailedReason}
                  onChange={(e) => setDetailedReason(e.target.value)}
                  placeholder="State the specific facts of the incident, timestamp, safety breach, or conduct violation clearly..."
                  className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-red-500 outline-none font-medium leading-relaxed"
                />
              </div>

              {/* Corrective Action / Incident Notes */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">
                  Corrective Action Expected & Additional Supervisor Notes
                </label>
                <textarea
                  rows={2}
                  value={incidentNotes}
                  onChange={(e) => setIncidentNotes(e.target.value)}
                  placeholder="e.g. Employee must wear safety goggles at all times; Retraining scheduled for Friday..."
                  className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-red-500 outline-none font-medium leading-relaxed"
                />
              </div>

              {/* Document Upload (Photo/PDF of Signed Notice) */}
              <div className="p-5 bg-black/40 border border-white/10 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-red-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-white">
                      Physical Warning Document / Signed Form (Photo or PDF)
                    </span>
                  </div>
                  {uploadedDocName && (
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> File Attached
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <label className="w-full sm:w-auto cursor-pointer px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 border border-white/10 active:scale-95">
                    <Upload className="w-4 h-4" />
                    <span>Upload Signed Document</span>
                    <input 
                      type="file" 
                      accept="image/*,application/pdf" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                  </label>

                  {uploadedDocName ? (
                    <div className="flex items-center gap-2 text-xs font-mono text-gray-300 bg-white/5 px-3 py-2 rounded-lg border border-white/5 max-w-full truncate">
                      <FileText className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="truncate">{uploadedDocName}</span>
                      <button
                        type="button"
                        onClick={() => { setUploadedDocName(''); setUploadedDocUrl(''); }}
                        className="text-gray-500 hover:text-red-400 ml-2"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Attach photo of signed physical warning sheet or PDF document for compliance filing.
                    </p>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold uppercase text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 flex items-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>{isSubmitting ? 'Recording...' : 'Commit Disciplinary Action'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Warning History Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase text-gray-300">
                  Disciplinary File: {currentEmp?.name} {currentEmp?.surname}
                </h3>
                <span className="text-xs text-gray-500 font-mono">
                  {warningHistory.length} Total Notices
                </span>
              </div>

              {warningHistory.map((warn) => {
                const isFinal = warn.warningLevel.includes('Final') || warn.warningLevel.includes('Suspension');
                return (
                  <div 
                    key={warn.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      isFinal 
                        ? 'bg-red-500/5 border-red-500/30' 
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                          isFinal ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {warn.warningLevel}
                        </span>
                        <span className="text-xs font-bold text-gray-300 uppercase">
                          {warn.offenseCategory}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 font-mono">
                        <span>Issued: {warn.issueDate}</span>
                        <span>•</span>
                        <span>Expires: {warn.expiryDate}</span>
                      </div>
                    </div>

                    <p className="text-sm text-gray-200 font-medium mb-3 leading-relaxed">
                      {warn.detailedReason}
                    </p>

                    {warn.incidentNotes && (
                      <p className="text-xs text-gray-400 italic mb-3 bg-black/20 p-2.5 rounded-lg">
                        Note: {warn.incidentNotes}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs text-gray-500">
                      <span>Issued By: <strong className="text-gray-300">{warn.issuedBy}</strong></span>
                      {warn.documentUrl && (
                        <button
                          onClick={() => setSelectedDocPreview({ url: warn.documentUrl!, name: warn.documentName || 'Warning Document' })}
                          className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1.5 underline"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          View Attached Notice ({warn.documentName || 'Document'})
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {warningHistory.length === 0 && (
                <div className="text-center py-16 bg-black/20 rounded-3xl border border-white/5">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-60" />
                  <p className="text-sm font-bold text-gray-300 uppercase">Clean Disciplinary Record</p>
                  <p className="text-xs text-gray-500 mt-1">No warnings or notices recorded for this employee.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Document Preview Modal */}
      {selectedDocPreview && (
        <div className="fixed inset-0 z-[1600] bg-black/95 flex flex-col items-center justify-center p-6">
          <div className="bg-[#18181c] p-4 rounded-2xl border border-white/10 w-full max-w-3xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center pb-3 border-b border-white/10 mb-3">
              <span className="font-bold text-white text-sm">{selectedDocPreview.name}</span>
              <button 
                onClick={() => setSelectedDocPreview(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-black/50 p-2 rounded-xl">
              {selectedDocPreview.url.startsWith('data:image') || selectedDocPreview.url.includes('.png') || selectedDocPreview.url.includes('.jpg') ? (
                <img src={selectedDocPreview.url} alt="Document" className="max-w-full max-h-[70vh] object-contain rounded" />
              ) : (
                <iframe src={selectedDocPreview.url} title="Document Preview" className="w-full h-[65vh] rounded" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
