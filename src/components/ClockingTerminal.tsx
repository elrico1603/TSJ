import React, { useState } from 'react';
import { Employee } from '../types';
import { CheckCircle2, LogIn, LogOut, Coffee, ArrowRight, Camera, Clock } from 'lucide-react';

interface ClockingTerminalProps {
  employees: Employee[];
  setSelectedEmployee: (emp: Employee | null) => void;
  setPendingAction: (action: string) => void;
  setView: (view: string) => void;
}

export const getValidPhotoUrl = (emp: any): string | null => {
  if (!emp) return null;
  const rawUrl = emp.photo || emp.photoUrl || emp.photoURL || emp.avatarUrl || emp.avatar || emp.picture;
  if (typeof rawUrl === 'string' && rawUrl.trim().length > 0) {
    const trimmed = rawUrl.trim();
    if (trimmed !== '' && !trimmed.startsWith('data:,') && !trimmed.includes('default-avatar')) {
      return trimmed;
    }
  }
  return null;
};

export const PhotoAvatar: React.FC<{ emp: { name?: string; photo?: string | null; [key: string]: any }; size?: number; className?: string }> = ({ emp, size = 120, className = "" }) => {
  const photoUrl = getValidPhotoUrl(emp);
  return (
    <div 
      className={`rounded-[2.5rem] flex items-center justify-center overflow-hidden bg-[#111] border-2 border-white/10 shadow-inner shrink-0 ${className}`} 
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        <img src={photoUrl} className="w-full h-full object-cover" alt={emp?.name || 'Artisan'} loading="lazy" />
      ) : (
        <span className="font-black text-white/20 uppercase select-none" style={{ fontSize: size * 0.4 }}>
          {emp && emp.name ? emp.name[0] : 'U'}
        </span>
      )}
    </div>
  );
};

export const ClockingTerminal: React.FC<ClockingTerminalProps> = ({
  employees,
  setSelectedEmployee,
  setPendingAction,
  setView
}) => {
  const [lastClockEvent, setLastClockEvent] = useState<{ empName: string; action: string; time: string } | null>(null);

  // 1. Strictly process live employees from props without any mock/default datasets
  const rawList = Array.isArray(employees) ? employees : [];

  // 2. Strict Filter:
  // - Must not be archived or inactive
  // - MUST have a valid non-empty photo URL (completely excludes placeholder letter initials)
  // - Deduplicated by unique ID
  const seenIds = new Set<string>();
  const activeWorkers: Employee[] = [];

  for (const emp of rawList) {
    if (!emp) continue;

    // Exclude archived and inactive profiles
    const isArchived = emp.isArchived === true || emp.status === 'Archived';
    const isInactive = (emp as any).status === 'inactive' || (emp as any).status === 'Inactive' || (emp as any).active === false;
    if (isArchived || isInactive) continue;

    // Strict photo requirement: Must have a valid, non-empty photo URL
    const photoUrl = getValidPhotoUrl(emp);
    if (!photoUrl) continue;

    // Deduplicate by unique employee ID / identifier
    const uniqueKey = emp.id || (emp as any).employeeId || emp.employeeNumber || `${emp.name}_${emp.surname}`;
    if (!uniqueKey || seenIds.has(uniqueKey)) continue;

    seenIds.add(uniqueKey);
    activeWorkers.push({
      ...emp,
      photo: photoUrl
    });
  }

  const handleCardClick = (emp: Employee) => {
    // Mobile haptic feedback
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([60, 30, 60]);
      } catch (e) {
        // ignore
      }
    }

    setSelectedEmployee(emp);
    setPendingAction('hub_login');
    setView('personal_pin_entry');
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner with Facial Scan option */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#151518] p-5 rounded-[2.5rem] border border-white/10 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#ff8c00]/20 rounded-2xl text-[#ff8c00]">
            <Clock size={24} />
          </div>
          <div>
            <h3 className="font-black text-base uppercase tracking-tight text-white">Artisan Attendance Terminal</h3>
            <p className="text-xs text-gray-400 font-medium mt-0.5">Select artisan card to perform verified clocking & leave operations</p>
          </div>
        </div>

        <button
          onClick={() => {
            if (activeWorkers.length > 0) {
              setSelectedEmployee(activeWorkers[0]);
              setView('scanning');
            }
          }}
          className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 transition-all flex items-center gap-2 active:scale-95 shadow-lg min-h-[44px]"
        >
          <Camera size={18} />
          <span>Facial Scan</span>
        </button>
      </div>

      {/* Clock event confirmation alert banner */}
      {lastClockEvent && (
        <div className="p-5 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-between shadow-2xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400">
              <CheckCircle2 size={28} />
            </div>
            <div>
              <h4 className="font-black text-base uppercase tracking-tight text-white">
                {lastClockEvent.empName} — {lastClockEvent.action}
              </h4>
              <p className="text-xs text-emerald-300/80 font-mono mt-0.5">
                Timestamp recorded at {lastClockEvent.time}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setLastClockEvent(null)} 
            className="text-xs font-bold text-gray-400 hover:text-white px-3 py-1 bg-white/5 rounded-xl"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Optimized One-Handed Mobile Artisan Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 sm:gap-8 animate-in fade-in">
        {activeWorkers.map(emp => {
          const isIn = emp.status === 'In';
          const isBreak = emp.status === 'Break';

          return (
            <div 
              key={emp.id} 
              onClick={() => handleCardClick(emp)} 
              className={`bg-[#151518] backdrop-blur-2xl p-6 sm:p-7 rounded-[3rem] border-2 transition-all duration-200 flex flex-col items-center justify-between cursor-pointer shadow-2xl group active:scale-[0.97] touch-manipulation min-h-[220px] relative overflow-hidden ${
                isIn 
                  ? 'border-emerald-500/40 hover:border-emerald-500 bg-emerald-950/10' 
                  : isBreak 
                  ? 'border-purple-500/40 hover:border-purple-500 bg-purple-950/10' 
                  : 'border-white/10 hover:border-[#ff8c00]'
              }`}
            >
              {/* Top Status Pill */}
              <div className="w-full flex items-center justify-between mb-4">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border ${
                  isIn 
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                    : isBreak 
                    ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' 
                    : 'bg-red-500/15 text-red-400 border-red-500/20'
                }`}>
                  {isIn ? <LogIn size={12} /> : isBreak ? <Coffee size={12} /> : <LogOut size={12} />}
                  {isIn ? 'CLOCKED IN' : isBreak ? 'ON BREAK' : 'CLOCKED OUT'}
                </span>
                <span className="text-[10px] text-gray-500 font-mono font-bold uppercase">
                  #{emp.employeeNumber || 'TSJ'}
                </span>
              </div>

              {/* Large Profile Photo */}
              <div className="relative my-2">
                <PhotoAvatar emp={emp} size={120} className="group-hover:scale-105 transition-transform duration-300 shadow-xl" />
                <div className={`absolute -bottom-1 -right-1 w-9 h-9 rounded-full border-4 border-[#151518] flex items-center justify-center text-white text-xs font-black shadow-lg ${
                  isIn ? 'bg-emerald-500 shadow-emerald-500/50 animate-pulse' : 
                  isBreak ? 'bg-purple-500 shadow-purple-500/50' : 
                  'bg-red-500 shadow-red-500/30'
                }`}>
                  {isIn ? '✓' : isBreak ? '⏸' : '✕'}
                </div>
              </div>

              {/* Artisan Name & Role */}
              <div className="text-center w-full mt-3">
                <p className="font-black text-base sm:text-lg uppercase italic tracking-tight text-white group-hover:text-[#ff8c00] transition-colors leading-snug">
                  {emp.name} {emp.surname}
                </p>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">
                  {emp.role}
                </p>
              </div>

              {/* Touch Selection Bar */}
              <div className="w-full mt-5 py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider text-center flex items-center justify-center gap-2 bg-white/5 text-gray-300 border border-white/10 group-hover:border-[#ff8c00] group-hover:text-white transition-all">
                <span>Tap to Select</span>
                <ArrowRight size={14} />
              </div>
            </div>
          );
        })}

        {activeWorkers.length === 0 && (
          <div className="col-span-full text-center py-24 bg-black/30 rounded-[3rem] border border-white/5 font-sans">
            <p className="text-gray-400 uppercase font-black text-sm tracking-wider">No active artisans with photos found.</p>
          </div>
        )}
      </div>
    </div>
  );
};
