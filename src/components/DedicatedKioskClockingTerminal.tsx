import React, { useState, useEffect } from 'react';
import { Employee } from '../types';
import { Search, Clock, LogIn, LogOut, Coffee, Calendar, Lock, Shield, CheckCircle2, Wifi, RefreshCw, Camera } from 'lucide-react';
import { OfflineSyncStatus } from './OfflineSyncStatus';
import permissionService from '../services/permissionService';

interface DedicatedKioskClockingTerminalProps {
  employees: Employee[];
  setSelectedEmployee: (emp: Employee | null) => void;
  setPendingAction: (action: string) => void;
  setView: (view: string) => void;
  onSignOut?: () => void;
  announce?: (msg: string) => void;
  currentUser?: any;
  setAppMode?: (mode: string) => void;
}

export const DedicatedKioskClockingTerminal: React.FC<DedicatedKioskClockingTerminalProps> = ({
  employees,
  setSelectedEmployee,
  setPendingAction,
  setView,
  onSignOut,
  announce,
  currentUser,
  setAppMode
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'In' | 'Break' | 'Out'>('All');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const activeWorkers = employees.filter(emp => !emp.isArchived);

  const filteredEmployees = activeWorkers.filter(emp => {
    const matchesSearch = 
      `${emp.name} ${emp.surname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.employeeNumber && emp.employeeNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.role && emp.role.toLowerCase().includes(searchTerm.toLowerCase()));

    if (statusFilter === 'All') return matchesSearch;
    if (statusFilter === 'In') return matchesSearch && emp.status === 'In';
    if (statusFilter === 'Break') return matchesSearch && emp.status === 'Break';
    if (statusFilter === 'Out') return matchesSearch && (emp.status === 'Out' || !emp.status);
    return matchesSearch;
  });

  const handleCardClick = (emp: Employee, action: string = 'clock_toggle') => {
    if ('vibrate' in navigator) {
      try { navigator.vibrate([60, 30, 60]); } catch (e) {}
    }
    setSelectedEmployee(emp);
    setPendingAction(action);
    setView('personal_pin_entry');
  };

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const formattedDate = currentTime.toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const clockedInCount = activeWorkers.filter(e => e.status === 'In').length;
  const onBreakCount = activeWorkers.filter(e => e.status === 'Break').length;

  return (
    <div className="fixed inset-0 z-[100] bg-[#0c0c0e] text-white flex flex-col font-sans overflow-hidden select-none">
      {/* Kiosk Header */}
      <header className="bg-[#141417] border-b border-white/10 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xl">
        {/* Logo & Kiosk Title */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ff8c00] to-[#b36200] flex items-center justify-center text-black font-black text-2xl shadow-lg shadow-[#ff8c00]/30 tracking-tighter italic">
            TS
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white flex items-center gap-2">
              TS HUB <span className="text-[#ff8c00] font-sans">Clocking Terminal</span>
            </h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2">
              <span>TimberSmith Joinery Kiosk</span>
              <span className="text-white/20">•</span>
              <span className="text-emerald-400 font-mono">{clockedInCount} Active On Site</span>
            </p>
          </div>
        </div>

        {/* Live Kiosk Digital Clock & Date */}
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <div className="text-2xl font-black font-mono tracking-wider text-white">
              {formattedTime}
            </div>
            <div className="text-[10px] text-[#ff8c00] font-bold uppercase tracking-widest font-mono">
              {formattedDate}
            </div>
          </div>

          <OfflineSyncStatus announce={announce} />

          {/* Management Portals Selector for Authorized Non-Terminal Users */}
          {currentUser && !permissionService.isClockingTerminalUser(currentUser) && setAppMode && (
            <div className="flex items-center gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) setAppMode(e.target.value);
                }}
                defaultValue=""
                className="bg-[#1f1f24] text-xs font-black uppercase text-[#ff8c00] border border-[#ff8c00]/40 rounded-2xl px-3 py-2.5 outline-none cursor-pointer hover:bg-[#282830] transition-colors shadow-lg"
              >
                <option value="" disabled>Management Portals ▾</option>
                {permissionService.canAccessMode(currentUser?.role, 'system_admin') && (
                  <option value="system_admin">System Administration</option>
                )}
                {permissionService.canAccessMode(currentUser?.role, 'admin') && (
                  <option value="admin">Employer Registration</option>
                )}
                {permissionService.canAccessMode(currentUser?.role, 'analytics') && (
                  <option value="analytics">Work Analytics</option>
                )}
                {permissionService.canAccessMode(currentUser?.role, 'purchase_orders') && (
                  <option value="purchase_orders">Purchase Orders</option>
                )}
                {permissionService.canAccessMode(currentUser?.role, 'product_master') && (
                  <option value="product_master">Product Master</option>
                )}
                {permissionService.canAccessMode(currentUser?.role, 'dispatch') && (
                  <option value="dispatch">Dispatch & Receiving</option>
                )}
                {permissionService.canAccessMode(currentUser?.role, 'leave') && (
                  <option value="leave">Leave Management</option>
                )}
              </select>
            </div>
          )}

          {onSignOut && (
            <button
              onClick={onSignOut}
              className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 touch-manipulation min-h-[44px]"
              title="Sign out of Clocking Terminal"
            >
              <Lock size={16} />
              <span className="hidden sm:inline">Exit Kiosk</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Kiosk Body */}
      <main className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar max-w-7xl mx-auto w-full">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#18181c] border border-white/10 p-4 rounded-3xl shadow-xl">
          {/* Employee Search Bar */}
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search employee by name, surname, or number..."
              className="w-full bg-black/50 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#ff8c00] transition-all font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-white px-2 py-1 bg-white/10 rounded-lg"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 no-scrollbar">
            <button
              onClick={() => setStatusFilter('All')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all min-h-[44px] touch-manipulation ${
                statusFilter === 'All'
                  ? 'bg-[#ff8c00] text-white shadow-lg shadow-[#ff8c00]/20'
                  : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              All ({activeWorkers.length})
            </button>
            <button
              onClick={() => setStatusFilter('In')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all min-h-[44px] touch-manipulation flex items-center gap-1.5 ${
                statusFilter === 'In'
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
              }`}
            >
              <LogIn size={14} />
              Clocked In ({clockedInCount})
            </button>
            <button
              onClick={() => setStatusFilter('Break')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all min-h-[44px] touch-manipulation flex items-center gap-1.5 ${
                statusFilter === 'Break'
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20'
              }`}
            >
              <Coffee size={14} />
              On Break ({onBreakCount})
            </button>
            <button
              onClick={() => setStatusFilter('Out')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all min-h-[44px] touch-manipulation flex items-center gap-1.5 ${
                statusFilter === 'Out'
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
              }`}
            >
              <LogOut size={14} />
              Clocked Out ({activeWorkers.length - clockedInCount - onBreakCount})
            </button>

            {/* Facial Scan Trigger */}
            <button
              onClick={() => {
                if (activeWorkers.length > 0) {
                  setSelectedEmployee(activeWorkers[0]);
                  setView('scanning');
                }
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all min-h-[44px] touch-manipulation flex items-center gap-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 shadow-lg"
              title="Scan Face for Clocking Verification"
            >
              <Camera size={14} />
              <span>Facial Scan</span>
            </button>
          </div>
        </div>

        {/* Artisan Touch Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredEmployees.map(emp => {
            const isIn = emp.status === 'In';
            const isBreak = emp.status === 'Break';

            return (
              <div
                key={emp.id}
                onClick={() => handleCardClick(emp, 'hub_login')}
                className={`bg-[#16161a] border-2 rounded-[2.5rem] p-6 flex flex-col items-center justify-between shadow-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] touch-manipulation min-h-[260px] relative overflow-hidden group cursor-pointer ${
                  isIn
                    ? 'border-emerald-500/40 bg-emerald-950/10 hover:border-emerald-500'
                    : isBreak
                    ? 'border-purple-500/40 bg-purple-950/10 hover:border-purple-500'
                    : 'border-white/10 hover:border-[#ff8c00]'
                }`}
              >
                {/* Top Status & Badge */}
                <div className="w-full flex items-center justify-between mb-3">
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
                  <span className="text-[10px] text-gray-400 font-mono font-bold">
                    #{emp.employeeNumber || 'TSJ'}
                  </span>
                </div>

                {/* Profile Avatar */}
                <div className="relative my-2">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-[#222] border-2 border-white/20 flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform">
                    {emp.photo ? (
                      <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-black text-white/30 uppercase">{emp.name?.[0] || 'A'}</span>
                    )}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-8 h-8 rounded-full border-2 border-[#16161a] flex items-center justify-center text-white text-xs font-black shadow-lg ${
                    isIn ? 'bg-emerald-500 shadow-emerald-500/50 animate-pulse' :
                    isBreak ? 'bg-purple-500 shadow-purple-500/50' :
                    'bg-red-500 shadow-red-500/30'
                  }`}>
                    {isIn ? '✓' : isBreak ? '⏸' : '✕'}
                  </div>
                </div>

                {/* Employee Info */}
                <div className="text-center w-full my-2">
                  <h3 className="font-black text-lg uppercase italic tracking-tight text-white group-hover:text-[#ff8c00] transition-colors">
                    {emp.name} {emp.surname}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-0.5">
                    {emp.role || 'Artisan'}
                  </p>
                </div>

                {/* Touch Selection Bar */}
                <div className="w-full mt-3 py-3 px-3 rounded-2xl text-xs font-black uppercase tracking-wider bg-white/5 text-gray-300 border border-white/10 group-hover:border-[#ff8c00] group-hover:text-white transition-all flex items-center justify-center gap-1.5">
                  <span>Tap to Select</span>
                </div>
              </div>
            );
          })}

          {filteredEmployees.length === 0 && (
            <div className="col-span-full py-20 text-center bg-[#141417] border border-white/10 rounded-[3rem]">
              <p className="text-gray-400 font-black uppercase text-sm tracking-wider">No matching employees found for "{searchTerm}"</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
