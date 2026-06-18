import React from 'react';
import { Employee } from '../types';

interface ClockingTerminalProps {
  employees: Employee[];
  setSelectedEmployee: (emp: Employee | null) => void;
  setPendingAction: (action: string) => void;
  setView: (view: string) => void;
}

export const PhotoAvatar: React.FC<{ emp: { name?: string; photo?: string | null }; size?: number; className?: string }> = ({ emp, size = 100, className = "" }) => (
  <div 
    className={`rounded-[2.5rem] flex items-center justify-center overflow-hidden bg-[#111] border-2 border-white/10 shadow-inner ${className}`} 
    style={{ width: size, height: size }}
  >
    {emp && emp.photo ? (
      <img src={emp.photo} className="w-full h-full object-cover" alt="Avatar" />
    ) : (
      <span className="font-black text-white/10 uppercase" style={{ fontSize: size * 0.4 }}>
        {emp && emp.name ? emp.name[0] : 'U'}
      </span>
    )}
  </div>
);

export const ClockingTerminal: React.FC<ClockingTerminalProps> = ({
  employees,
  setSelectedEmployee,
  setPendingAction,
  setView
}) => {
  const activeWorkers = employees.filter(emp => !emp.isArchived);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 animate-in fade-in font-sans">
      {activeWorkers.map(emp => (
        <div 
          key={emp.id} 
          onClick={() => { 
            setSelectedEmployee(emp); 
            setPendingAction('hub_login'); 
            setView('personal_pin_entry'); 
          }} 
          className="bg-[#151515]/90 backdrop-blur-xl p-6 rounded-[3rem] border border-white/5 flex flex-col items-center cursor-pointer shadow-2xl hover:border-[#ff8c00] transition-all group active:scale-95 font-sans"
        >
          <div className="relative mb-6">
            <PhotoAvatar emp={emp} size={110} className="group-hover:scale-105 transition-transform duration-500" />
            <div className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full border-[6px] border-[#151515] ${
              emp.status === 'In' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse' : 
              emp.status === 'Break' ? 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 
              'bg-red-500 shadow-md'
            }`} />
          </div>
          <p className="font-black text-sm uppercase italic tracking-tighter text-center leading-none text-white font-sans">
            {emp.name} {emp.surname}
          </p>
          <p className="text-[9px] text-gray-600 mt-3 font-black uppercase tracking-widest font-sans">
            {emp.role}
          </p>
        </div>
      ))}
      {activeWorkers.length === 0 && (
        <div className="col-span-full text-center py-20 bg-black/20 rounded-[3rem] border border-white/5 font-sans">
          <p className="text-gray-500 uppercase font-black text-sm tracking-wider">No active artisans found.</p>
        </div>
      )}
    </div>
  );
};
