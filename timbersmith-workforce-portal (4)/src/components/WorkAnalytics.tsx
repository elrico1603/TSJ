import React, { useState } from 'react';
import { Employee, SA_HOLIDAYS, getLocalDateString } from '../types';
import { 
  DisciplinaryWarning, 
  PPEIssuanceRecord 
} from '../types/employee';
import { Icon } from './Icon';
import { PhotoAvatar } from './ClockingTerminal';
import { DisciplinaryActionModal } from './DisciplinaryActionModal';
import { PPEIssuanceModal } from './PPEIssuanceModal';
import { PPESignOffCertificate } from './PPESignOffCertificate';
import { 
  ShieldAlert, 
  HardHat, 
  FileText, 
  Printer, 
  Clock, 
  Archive, 
  Search, 
  ShieldCheck,
  AlertTriangle,
  UserCheck
} from 'lucide-react';

interface WorkAnalyticsProps {
  employees: Employee[];
  startDate: string;
  setStartDate: (d: string) => void;
  endDate: string;
  setEndDate: (d: string) => void;
  formatTime: (hrs: number) => string;
  getDailyCombinedRecords: (emp: Employee, start: string, end: string) => { sortedDays: any[]; totalRangeClocked: number; totalRangePaid: number };
  handleExportPDF: (emp: Employee) => void;
  setHistoryEmp: (emp: Employee | null) => void;
  setShowHistoryModal: (b: boolean) => void;
  onViewDetails?: (emp: Employee) => void;
  onArchiveProfile?: (emp: Employee) => void;
  currentUser?: any;
  announce?: (txt: string) => void;
  onUpdateEmployee?: (emp: Employee) => void;
}

export const WorkAnalytics: React.FC<WorkAnalyticsProps> = ({
  employees,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  formatTime,
  getDailyCombinedRecords,
  handleExportPDF,
  setHistoryEmp,
  setShowHistoryModal,
  onViewDetails,
  onArchiveProfile,
  currentUser,
  announce = () => {},
  onUpdateEmployee
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showPPEModal, setShowPPEModal] = useState(false);
  const [targetEmployeeForAction, setTargetEmployeeForAction] = useState<Employee | null>(null);
  const [printingPPECertificate, setPrintingPPECertificate] = useState<{ record: PPEIssuanceRecord; employee: Employee } | null>(null);

  const activeWorkers = employees.filter(emp => !emp.isArchived);

  const filteredWorkers = activeWorkers.filter(emp => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${emp.name} ${emp.surname}`.toLowerCase();
    const role = (emp.role || '').toLowerCase();
    const idNum = (emp.idNumber || emp.personalCode || '').toLowerCase();
    return fullName.includes(query) || role.includes(query) || idNum.includes(query);
  });

  const handleOpenWarningModal = (emp?: Employee) => {
    setTargetEmployeeForAction(emp || null);
    setShowWarningModal(true);
  };

  const handleOpenPPEModal = (emp?: Employee) => {
    setTargetEmployeeForAction(emp || null);
    setShowPPEModal(true);
  };

  const handleWarningSaved = (updatedEmp: Employee, warning: DisciplinaryWarning) => {
    if (onUpdateEmployee) {
      onUpdateEmployee(updatedEmp);
    }
  };

  const handlePPESaved = (updatedEmp: Employee, record: PPEIssuanceRecord) => {
    if (onUpdateEmployee) {
      onUpdateEmployee(updatedEmp);
    }
  };

  const handlePrintCertificate = (record: PPEIssuanceRecord, employee: Employee) => {
    setPrintingPPECertificate({ record, employee });
  };

  return (
    <div className="animate-in fade-in duration-500 font-sans space-y-8">
      {/* Top Action & Control Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter text-white font-sans flex items-center gap-3">
            Work Analytics & Labor
          </h2>
          <p className="text-xs text-gray-400 font-medium mt-1">
            Labor performance, disciplinary tracking, OHS compliance & gear issuance records
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Log Warning / Disciplinary Action Button */}
          <button
            onClick={() => handleOpenWarningModal()}
            className="px-5 py-3 bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-500/30 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 flex items-center gap-2"
          >
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span>Log Warning / Disciplinary</span>
          </button>

          {/* PPE Checklist & Gear Issuance Button */}
          <button
            onClick={() => handleOpenPPEModal()}
            className="px-5 py-3 bg-[#ff8c00]/15 hover:bg-[#ff8c00]/25 text-[#ff8c00] border border-[#ff8c00]/30 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 flex items-center gap-2"
          >
            <HardHat className="w-4 h-4 text-[#ff8c00]" />
            <span>PPE Checklist & Gear Issuance</span>
          </button>

          {/* Date Range Selector */}
          <div className="flex items-center gap-3 bg-black/40 border border-white/10 p-1.5 rounded-2xl">
            <div className="flex items-center gap-1.5 px-2">
              <label className="text-[10px] font-black uppercase text-gray-400">From:</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                className="bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-[#ff8c00]" 
              />
            </div>
            <div className="flex items-center gap-1.5 px-2">
              <label className="text-[10px] font-black uppercase text-gray-400">To:</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
                className="bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-[#ff8c00]" 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#151515]/60 border border-white/5 p-4 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search artisan by name, role, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-white/20"
          />
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400 font-mono">
          <span>Active Roster: <strong className="text-white">{activeWorkers.length}</strong></span>
          <span>•</span>
          <span>Showing: <strong className="text-white">{filteredWorkers.length}</strong></span>
        </div>
      </div>
      
      {/* Artisans List Grid */}
      <div className="bg-[#151515]/90 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
        {filteredWorkers.sort((a, b) => a.name.localeCompare(b.name)).map(emp => {
          const { totalRangePaid } = getDailyCombinedRecords(emp, startDate, endDate);
          const activeWarningsCount = (emp.warnings || []).filter(w => w.status === 'Active').length;
          const ppeIssuancesCount = (emp.ppeIssuances || []).length;
          const latestPPE = (emp.ppeIssuances || [])[0];

          return (
            <div key={emp.id} className="flex flex-col xl:flex-row xl:items-center justify-between p-6 border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors gap-5">
              
              {/* Artisan Profile & Compliance Badges */}
              <div className="flex items-center gap-4">
                <PhotoAvatar emp={emp} size={58} />
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <p className="font-bold text-white text-lg font-sans">{emp.name} {emp.surname}</p>
                    <span className="text-[10px] uppercase font-bold bg-white/5 text-gray-300 border border-white/10 px-2 py-0.5 rounded-md">
                      {emp.role}
                    </span>

                    {/* Disciplinary Warning Badge */}
                    {activeWarningsCount > 0 ? (
                      <span className="text-[10px] font-black uppercase bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {activeWarningsCount} {activeWarningsCount === 1 ? 'Warning' : 'Warnings'}
                      </span>
                    ) : (
                      <span className="text-[9px] uppercase font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                        Clean Record
                      </span>
                    )}

                    {/* PPE Compliance Badge */}
                    {ppeIssuancesCount > 0 ? (
                      <span className="text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md flex items-center gap-1" title={`Last issued: ${latestPPE?.issuanceDate}`}>
                        <ShieldCheck className="w-3 h-3" />
                        PPE Verified
                      </span>
                    ) : (
                      <span className="text-[9px] uppercase font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <HardHat className="w-3 h-3" />
                        PPE Pending
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-1">
                    ID: {emp.idNumber || emp.personalCode || 'N/A'} • Contact: {emp.contactNumber || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Hours & Actions Group */}
              <div className="flex flex-wrap items-center justify-between xl:justify-end gap-5">
                {/* Total Paid Labor Hours */}
                <div className="text-left xl:text-right pr-2">
                  <p className="text-2xl font-mono font-black text-emerald-400 leading-none">{formatTime(totalRangePaid)}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Paid Labor Hours</p>
                </div>

                {/* Modular Action Buttons Grid */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Action 1: Log Warning */}
                  <button 
                    onClick={() => handleOpenWarningModal(emp)} 
                    className="py-2.5 px-3 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 active:scale-95"
                    title="Log Disciplinary Warning"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Warning</span>
                  </button>

                  {/* Action 2: Issue PPE */}
                  <button 
                    onClick={() => handleOpenPPEModal(emp)} 
                    className="py-2.5 px-3 bg-amber-600/10 hover:bg-amber-600/20 text-[#ff8c00] border border-amber-500/20 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 active:scale-95"
                    title="Issue PPE Gear"
                  >
                    <HardHat className="w-3.5 h-3.5" />
                    <span>Issue PPE</span>
                  </button>

                  {/* Action 3: View Details */}
                  <button 
                    onClick={() => onViewDetails?.(emp)} 
                    className="py-2.5 px-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Details</span>
                  </button>

                  {/* Action 4: Generate Report */}
                  <button 
                    onClick={() => handleExportPDF(emp)} 
                    className="py-2.5 px-3.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Report</span>
                  </button>

                  {/* Action 5: Historical Logs */}
                  <button 
                    onClick={() => { 
                      setHistoryEmp(emp); 
                      setShowHistoryModal(true); 
                    }} 
                    className="py-2.5 px-3 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Logs</span>
                  </button>

                  {/* Action 6: Archive Profile */}
                  <button 
                    onClick={() => onArchiveProfile?.(emp)} 
                    className="p-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold uppercase transition-all active:scale-95"
                    title="Archive Profile"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredWorkers.length === 0 && (
          <div className="text-center py-20">
            <Icon name="bar-chart-3" size={48} className="text-gray-700 mx-auto" />
            <p className="text-xs text-gray-600 font-bold uppercase mt-4">
              {searchQuery ? `No artisans matching "${searchQuery}"` : 'No active artisans on roster.'}
            </p>
          </div>
        )}
      </div>

      {/* Disciplinary Warning Modal */}
      {showWarningModal && (
        <DisciplinaryActionModal
          employees={employees}
          selectedEmployee={targetEmployeeForAction}
          currentUser={currentUser}
          onClose={() => { setShowWarningModal(false); setTargetEmployeeForAction(null); }}
          onWarningSaved={handleWarningSaved}
          announce={announce}
        />
      )}

      {/* PPE Checklist & Gear Issuance Modal */}
      {showPPEModal && (
        <PPEIssuanceModal
          employees={employees}
          selectedEmployee={targetEmployeeForAction}
          currentUser={currentUser}
          onClose={() => { setShowPPEModal(false); setTargetEmployeeForAction(null); }}
          onIssuanceSaved={handlePPESaved}
          onPrintCertificate={handlePrintCertificate}
          announce={announce}
        />
      )}

      {/* Printable PPE Sign-Off Certificate Container */}
      {printingPPECertificate && (
        <PPESignOffCertificate
          issuanceRecord={printingPPECertificate.record}
          employee={printingPPECertificate.employee}
          onClose={() => setPrintingPPECertificate(null)}
        />
      )}
    </div>
  );
};

export default WorkAnalytics;
