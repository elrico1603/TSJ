import React, { useState } from 'react';
import { Employee, SA_HOLIDAYS, getLocalDateString } from '../types';
import { Icon } from './Icon';
import { PhotoAvatar } from './ClockingTerminal';

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
  setShowHistoryModal
}) => {
  const activeWorkers = employees.filter(emp => !emp.isArchived);

  return (
    <div className="animate-in fade-in duration-500 font-sans">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black uppercase tracking-tighter text-white font-sans">Work Analytics & labor</h2>
        <div className="flex items-center gap-4 bg-black/20 p-2 rounded-xl">
          <label className="text-xs font-bold uppercase text-gray-400">From:</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)} 
            className="bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white" 
          />
          <label className="text-xs font-bold uppercase text-gray-400">To:</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)} 
            className="bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white" 
          />
        </div>
      </div>
      
      <div className="bg-[#151515]/90 border border-white/5 rounded-[3rem] overflow-hidden">
        {activeWorkers.sort((a, b) => a.name.localeCompare(b.name)).map(emp => {
          const { totalRangePaid } = getDailyCombinedRecords(emp, startDate, endDate);
          return (
            <div key={emp.id} className="flex items-center justify-between p-6 border-b border-white/5 last:border-b-0 hover:bg-white/1">
              <div className="flex items-center gap-5">
                <PhotoAvatar emp={emp} size={60} />
                <div>
                  <p className="font-bold text-white text-lg font-sans">{emp.name} {emp.surname}</p>
                  <p className="text-xs text-gray-400 font-sans">{emp.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-2xl font-mono font-black text-emerald-400">{formatTime(totalRangePaid)}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase pl-1">Paid labor Hours</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => { 
                      setHistoryEmp(emp); 
                      setShowHistoryModal(true); 
                    }} 
                    className="py-3 px-5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold uppercase text-gray-300 transition-colors"
                  >
                    Historical Logs
                  </button>
                  <button 
                    onClick={() => handleExportPDF(emp)} 
                    className="py-3 px-5 bg-blue-600/10 hover:bg-blue-600/20 rounded-xl text-xs font-bold uppercase text-blue-400 border border-blue-500/20 transition-all"
                  >
                    Generate report
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {activeWorkers.length === 0 && (
          <div className="text-center py-20">
            <Icon name="bar-chart-3" size={48} className="text-gray-700 mx-auto" />
            <p className="text-xs text-gray-600 font-bold uppercase mt-4">No active artisans on roster.</p>
          </div>
        )}
      </div>
    </div>
  );
};
