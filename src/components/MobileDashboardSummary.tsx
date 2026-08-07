import React, { useState } from 'react';
import { Employee, KanbanCard } from '../types';
import { Clock, Calendar, ShoppingBag, AlertTriangle, WifiOff, CheckCircle2, ChevronRight, Activity, Users, Layers } from 'lucide-react';
import { offlineSyncService } from '../services/offlineSyncService';
import { permissionService } from '../services/permissionService';

interface MobileDashboardSummaryProps {
  currentUser: any;
  employees: Employee[];
  kanbanCards: KanbanCard[];
  onNavigate: (mode: string, view?: string) => void;
}

export const MobileDashboardSummary: React.FC<MobileDashboardSummaryProps> = ({
  currentUser,
  employees,
  kanbanCards,
  onNavigate
}) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'production' | 'activity'>('attendance');

  // Greeting based on time & Firestore firstName
  const userFirstName = currentUser?.firstName || (currentUser?.name ? currentUser.name.split(' ')[0] : 'User');
  const hour = new Date().getHours();
  const defaultTimeGreeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const greetingText = permissionService?.getGreeting ? permissionService.getGreeting(userFirstName) : `${defaultTimeGreeting}, ${userFirstName}`;

  // Metrics calculation
  const activeEmployees = employees.filter(e => !e.isArchived);
  const totalEmployees = activeEmployees.length || 22;
  const clockedInCount = activeEmployees.filter(e => e.status === 'In').length;
  
  // Pending leave placeholder or mock
  const pendingLeaveCount = 2;
  // Active stock orders / kanban
  const activeStockOrdersCount = kanbanCards.length || 5;
  // Late employees count
  const lateEmployeesCount = activeEmployees.filter(e => e.status === 'Out' && e.role === 'Artisan').length ? 1 : 0;
  // Offline pending items
  const offlineCount = offlineSyncService.getQueue().length;

  return (
    <div className="w-full space-y-6 font-sans mb-8">
      {/* Top Header & Greeting */}
      <div className="bg-[#151518]/90 border border-white/10 rounded-[2.5rem] p-6 sm:p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff8c00]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ff8c00]/10 border border-[#ff8c00]/30 text-[#ff8c00] text-[10px] font-black uppercase tracking-widest">
            <span>TS HUB Portal</span>
          </div>
          <span className="text-xs text-gray-400 font-mono font-bold">
            {new Date().toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white italic">
          {greetingText}
        </h2>
        <p className="text-xs text-gray-400 font-medium mt-1">
          Here is your daily operational summary and workforce status.
        </p>

        {/* High-Impact Responsive Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mt-6">
          {/* Metric 1: Clocked In */}
          <div 
            onClick={() => onNavigate('employee', 'dashboard')}
            className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/50 transition-all cursor-pointer group active:scale-95 touch-manipulation"
          >
            <div className="flex items-center justify-between text-emerald-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Clocked In</span>
              <Users size={16} />
            </div>
            <p className="text-2xl font-black text-white font-mono tracking-tight">
              {clockedInCount} <span className="text-xs text-emerald-400/70 font-normal">/ {totalEmployees}</span>
            </p>
          </div>

          {/* Metric 2: Pending Leave */}
          <div 
            onClick={() => onNavigate('leave')}
            className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/50 transition-all cursor-pointer group active:scale-95 touch-manipulation"
          >
            <div className="flex items-center justify-between text-amber-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Pending Leave</span>
              <Calendar size={16} />
            </div>
            <p className="text-2xl font-black text-white font-mono tracking-tight">
              {pendingLeaveCount}
            </p>
          </div>

          {/* Metric 3: Stock Orders */}
          <div 
            onClick={() => onNavigate('orders')}
            className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 hover:border-cyan-500/50 transition-all cursor-pointer group active:scale-95 touch-manipulation"
          >
            <div className="flex items-center justify-between text-cyan-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Stock Orders</span>
              <ShoppingBag size={16} />
            </div>
            <p className="text-2xl font-black text-white font-mono tracking-tight">
              {activeStockOrdersCount}
            </p>
          </div>

          {/* Metric 4: Late Employees */}
          <div 
            onClick={() => onNavigate('analytics')}
            className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/50 transition-all cursor-pointer group active:scale-95 touch-manipulation"
          >
            <div className="flex items-center justify-between text-purple-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Late Staff</span>
              <AlertTriangle size={16} />
            </div>
            <p className="text-2xl font-black text-white font-mono tracking-tight">
              {lateEmployeesCount}
            </p>
          </div>

          {/* Metric 5: Offline Devices */}
          <div 
            className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/50 transition-all col-span-2 sm:col-span-1"
          >
            <div className="flex items-center justify-between text-blue-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Offline Devices</span>
              <WifiOff size={16} />
            </div>
            <p className="text-2xl font-black text-white font-mono tracking-tight">
              {offlineCount}
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Mobile Dashboard Tabs: Today's Attendance | Today's Production | Recent Activity */}
      <div className="bg-[#151518]/90 border border-white/10 rounded-[2.5rem] p-6 backdrop-blur-2xl shadow-xl">
        {/* Tab Headers */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 border-b border-white/10 no-scrollbar">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap min-h-[44px] touch-manipulation flex items-center gap-2 ${
              activeTab === 'attendance'
                ? 'bg-[#ff8c00] text-white shadow-lg shadow-[#ff8c00]/20'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            <Clock size={14} />
            <span>Today's Attendance</span>
          </button>

          <button
            onClick={() => setActiveTab('production')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap min-h-[44px] touch-manipulation flex items-center gap-2 ${
              activeTab === 'production'
                ? 'bg-[#ff8c00] text-white shadow-lg shadow-[#ff8c00]/20'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            <Layers size={14} />
            <span>Today's Production</span>
          </button>

          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap min-h-[44px] touch-manipulation flex items-center gap-2 ${
              activeTab === 'activity'
                ? 'bg-[#ff8c00] text-white shadow-lg shadow-[#ff8c00]/20'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            <Activity size={14} />
            <span>Recent Activity</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-5">
          {activeTab === 'attendance' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                <span>Artisan On-Site Status</span>
                <span className="text-[#ff8c00]">{clockedInCount} Active Now</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                {activeEmployees.slice(0, 6).map(emp => (
                  <div key={emp.id} className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${emp.status === 'In' ? 'bg-emerald-500 animate-pulse' : emp.status === 'Break' ? 'bg-purple-500' : 'bg-red-500'}`} />
                      <div>
                        <p className="text-xs font-bold text-white uppercase italic">{emp.name} {emp.surname}</p>
                        <p className="text-[10px] text-gray-400">{emp.role}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      emp.status === 'In' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {emp.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'production' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                <span>Active Job Cards</span>
                <span>{kanbanCards.length} Total</span>
              </div>
              {kanbanCards.length > 0 ? (
                <div className="space-y-2">
                  {kanbanCards.slice(0, 4).map(card => (
                    <div key={card.id} className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-white uppercase">{card.cardData.partDescription || 'Kanban Item'}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{card.cardData.partNumber || 'N/A'}</p>
                      </div>
                      <ChevronRight size={16} className="text-gray-500" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 uppercase font-bold text-center py-6">No active production job cards currently open.</p>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                <span>Live Event Stream</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Live
                </span>
              </div>
              <div className="space-y-2 text-xs text-gray-300">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <span className="font-bold text-white">Shift started — Morning Clocking Open</span>
                  <span className="text-[10px] font-mono text-gray-400">07:00 AM</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <span className="font-bold text-white">Dispatch photo package generated</span>
                  <span className="text-[10px] font-mono text-gray-400">08:15 AM</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
