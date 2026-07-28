import React, { useState } from 'react';
import { GlobalNotification, NotificationCategory } from '../types';
import { Icon } from './Icon';

interface NotificationCentreProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: GlobalNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onNavigateToPage: (page: string) => void;
  userRole?: string;
  userEmail?: string;
}

const CATEGORY_MAP: { id: NotificationCategory | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: 'bell' },
  { id: 'leave_request', label: 'Leave Requests', icon: 'calendar' },
  { id: 'stock_order', label: 'Stock Orders', icon: 'kanban' },
  { id: 'clocking_exception', label: 'Clocking Exceptions', icon: 'clock' },
  { id: 'employee_request', label: 'Employee Requests', icon: 'users' },
  { id: 'system_alert', label: 'System Alerts', icon: 'shield-alert' }
];

export const NotificationCentre: React.FC<NotificationCentreProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onNavigateToPage,
  userRole,
  userEmail
}) => {
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | 'all'>('all');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [pushPermission, setPushPermission] = useState<string>('default');

  if (!isOpen) return null;

  const filtered = notifications.filter(n => {
    if (selectedCategory !== 'all' && n.category !== selectedCategory) return false;
    if (unreadOnly && n.isRead) return false;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleRequestPushPermission = async () => {
    if (!('Notification' in window)) {
      alert('Web Push Notifications are supported on this device. When deployed to HTTPS / PWA, push notifications will register for Android, iPhone & Windows.');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setPushPermission(perm);
      if (perm === 'granted') {
        alert('Push notifications enabled successfully! Ready for Windows, Android, and iOS PWA push messaging.');
      }
    } catch (e) {
      console.warn('Notification permission error:', e);
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse';
      case 'high':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'medium':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'leave_request':
        return 'calendar';
      case 'stock_order':
        return 'kanban';
      case 'clocking_exception':
        return 'clock';
      case 'employee_request':
        return 'users';
      case 'system_alert':
        return 'shield-alert';
      default:
        return 'bell';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#0e0e0e] border-l border-white/10 h-full flex flex-col shadow-2xl overflow-hidden font-sans italic text-white"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#ff8c00]/10 rounded-2xl text-[#ff8c00] border border-[#ff8c00]/30">
              <Icon name="bell" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black uppercase tracking-tight text-white">Notification Centre</h2>
                {unreadCount > 0 && (
                  <span className="px-2.5 py-0.5 bg-red-500 text-white font-black text-xs rounded-full font-mono">
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                TS Joinery Real-Time Alerts
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Manager permission info badge */}
        <div className="px-6 py-2.5 bg-[#151515] border-b border-white/5 flex items-center justify-between text-[11px] font-sans">
          <div className="flex items-center gap-2 text-gray-400">
            <Icon name="shield" size={14} className="text-[#ff8c00]" />
            <span>Active Profile: <strong className="text-white uppercase">{userEmail || userRole || 'Management'}</strong></span>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="text-[#ff8c00] hover:underline font-black uppercase tracking-wider text-[10px]"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Category Filters */}
        <div className="p-4 border-b border-white/10 bg-black/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Filter Category</span>
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={unreadOnly} 
                onChange={e => setUnreadOnly(e.target.checked)}
                className="rounded border-gray-700 text-[#ff8c00] focus:ring-[#ff8c00] bg-black/50"
              />
              <span className="font-bold uppercase text-[10px]">Unread only</span>
            </label>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {CATEGORY_MAP.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  selectedCategory === cat.id
                    ? 'bg-[#ff8c00] text-black shadow-lg shadow-[#ff8c00]/20'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
                }`}
              >
                <Icon name={cat.icon} size={13} />
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white/2 rounded-3xl border border-white/5 p-8">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-500">
                <Icon name="bell" size={32} />
              </div>
              <p className="text-gray-400 font-black uppercase text-sm">No notifications found</p>
              <p className="text-xs text-gray-600 mt-1">You are all caught up for {selectedCategory !== 'all' ? selectedCategory.replace('_', ' ') : 'all categories'}.</p>
            </div>
          ) : (
            filtered.map(notif => (
              <div
                key={notif.id}
                onClick={() => {
                  if (!notif.isRead) {
                    onMarkAsRead(notif.id);
                  }
                  if (notif.relatedPage) {
                    onNavigateToPage(notif.relatedPage);
                    onClose();
                  }
                }}
                className={`group relative p-4 rounded-2xl border transition-all cursor-pointer ${
                  notif.isRead
                    ? 'bg-black/30 border-white/5 opacity-70 hover:opacity-100 hover:bg-white/5'
                    : 'bg-[#181818] border-[#ff8c00]/30 shadow-lg shadow-black/50 hover:border-[#ff8c00]'
                }`}
              >
                {!notif.isRead && (
                  <span className="absolute top-4 right-4 w-2.5 h-2.5 bg-[#ff8c00] rounded-full ring-4 ring-[#181818]" />
                )}

                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl border ${getPriorityStyle(notif.priority)} shrink-0 mt-0.5`}>
                    <Icon name={getCategoryIcon(notif.category)} size={18} />
                  </div>

                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/5 text-gray-400 border border-white/10">
                        {notif.categoryLabel}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {notif.date} • {notif.time}
                      </span>
                    </div>

                    <h4 className="font-black text-sm text-white group-hover:text-[#ff8c00] transition-colors leading-snug">
                      {notif.title}
                    </h4>

                    <p className="text-xs text-gray-300 mt-1.5 leading-relaxed font-sans line-clamp-3">
                      {notif.description}
                    </p>

                    <div className="mt-3 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-[#ff8c00]">
                      <span className="flex items-center gap-1 hover:underline">
                        View details <Icon name="arrow-right" size={12} />
                      </span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onDeleteNotification(notif.id);
                        }}
                        className="text-gray-500 hover:text-red-400 p-1"
                        title="Remove notification"
                      >
                        <Icon name="trash-2" size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer with Push Notification Readiness status */}
        <div className="p-4 border-t border-white/10 bg-black/60 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] font-sans">
            <div className="flex items-center gap-2 text-gray-400">
              <Icon name="smartphone" size={16} className="text-emerald-400" />
              <span>Future-Ready Push Messaging (FCM / WebPush)</span>
            </div>
            <button
              onClick={handleRequestPushPermission}
              className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider"
            >
              Enable Push
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
