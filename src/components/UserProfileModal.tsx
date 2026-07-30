import React from 'react';
import { Icon } from './Icon';
import { AppUser } from '../auth';

interface UserProfileModalProps {
  currentUser: AppUser | null;
  onClose: () => void;
  onLock: () => void;
  layoutMode: 'desktop' | 'tablet' | 'phone';
  onChangeLayout: (mode: 'desktop' | 'tablet' | 'phone') => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  currentUser,
  onClose,
  onLock,
  layoutMode,
  onChangeLayout
}) => {
  const roleName = currentUser?.role || 'Stock Manager';
  const userName = currentUser?.name || 'Stock Manager User';
  const email = currentUser?.email || 'stock.manager@tsjoinery.co.za';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#151515] border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Icon name="user" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase text-white font-sans tracking-tight">{userName}</h3>
              <p className="text-xs text-gray-400 font-mono">{email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Role Badge & Details */}
        <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest font-sans">Active Role</span>
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30">
              {roleName}
            </span>
          </div>

          <div className="pt-2 border-t border-white/5 space-y-2">
            <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest block font-sans">Assigned Access Modules</span>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold text-gray-300 font-sans">
              <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                <Icon name="check-circle" size={12} className="text-emerald-400" />
                <span>Dashboard</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                <Icon name="check-circle" size={12} className="text-emerald-400" />
                <span>QR Scanner</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                <Icon name="check-circle" size={12} className="text-emerald-400" />
                <span>Stock Basket</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                <Icon name="check-circle" size={12} className="text-emerald-400" />
                <span>User Profile</span>
              </div>
            </div>
          </div>
        </div>

        {/* Manual Layout Preference Switcher */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest block font-sans">Viewport Layout Mode</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onChangeLayout('desktop')}
              className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-1.5 text-xs font-bold uppercase ${
                layoutMode === 'desktop'
                  ? 'bg-[#ff8c00]/20 text-[#ff8c00] border-[#ff8c00]/50'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
              }`}
            >
              <Icon name="monitor" size={18} />
              <span>Desktop</span>
            </button>

            <button
              onClick={() => onChangeLayout('tablet')}
              className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-1.5 text-xs font-bold uppercase ${
                layoutMode === 'tablet'
                  ? 'bg-[#ff8c00]/20 text-[#ff8c00] border-[#ff8c00]/50'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
              }`}
            >
              <Icon name="tablet" size={18} />
              <span>Tablet</span>
            </button>

            <button
              onClick={() => onChangeLayout('phone')}
              className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-1.5 text-xs font-bold uppercase ${
                layoutMode === 'phone'
                  ? 'bg-[#ff8c00]/20 text-[#ff8c00] border-[#ff8c00]/50'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
              }`}
            >
              <Icon name="smartphone" size={18} />
              <span>Phone</span>
            </button>
          </div>
        </div>

        {/* Action button */}
        <div className="pt-2 border-t border-white/10 flex gap-3">
          <button
            onClick={() => {
              onClose();
              onLock();
            }}
            className="w-full py-3.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/30 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Icon name="lock" size={16} />
            <span>Lock Terminal / Sign Out</span>
          </button>
        </div>

      </div>
    </div>
  );
};
