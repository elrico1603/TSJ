import React, { useState } from 'react';
import { Icon } from './Icon';
import { AppUser } from '../auth';

interface SettingsModalProps {
  pendingUsers: AppUser[];
  activeUsers: AppUser[];
  userPermissions: Record<string, Record<string, boolean>>;
  setUserPermissions: React.Dispatch<React.SetStateAction<Record<string, Record<string, boolean>>>>;
  approvePendingUser: (user: AppUser) => Promise<any>;
  rejectPendingUser: (user: AppUser) => Promise<any>;
  deleteActiveUser: (user: AppUser) => Promise<any>;
  updateActiveUser: (userId: string, updates: Partial<AppUser>) => Promise<any>;
  setShowAddUserModal: (b: boolean) => void;
  setShowSettingsModal: (b: boolean) => void;
  announce: (txt: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  pendingUsers,
  activeUsers,
  userPermissions,
  setUserPermissions,
  approvePendingUser,
  rejectPendingUser,
  deleteActiveUser,
  updateActiveUser,
  setShowAddUserModal,
  setShowSettingsModal,
  announce
}) => {
  const [editingPins, setEditingPins] = useState<Record<string, string>>({});
  const [showPasswordId, setShowPasswordId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-[1400] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in font-sans">
      <div className="bg-[#1a1a1a] rounded-[3rem] border border-white/10 w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="sticky top-0 bg-[#1a1a1a]/80 backdrop-blur-2xl border-b border-white/10 p-8 flex justify-between items-center z-50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#ff8c00]/10 rounded-full"><Icon name="settings" size={24} className="text-[#ff8c00]" /></div>
            <div>
              <h2 className="text-2xl font-black uppercase text-white font-sans">Admin Panel</h2>
              <p className="text-xs text-gray-500 font-bold font-sans">User Management & Permissions</p>
            </div>
          </div>
          <button onClick={() => setShowSettingsModal(false)} className="p-2 text-gray-400 hover:text-white transition-all">
            <Icon name="x" size={28} />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* PENDING APPROVALS SECTION */}
          {pendingUsers.length > 0 && (
            <div className="bg-orange-500/5 border-2 border-orange-500/20 rounded-[2rem] p-6">
              <h3 className="text-lg font-black uppercase text-orange-400 mb-4 tracking-widest flex items-center gap-2 font-sans">
                <Icon name="user-plus" size={20} />
                Pending Registrations ({pendingUsers.length})
              </h3>
              <div className="space-y-3">
                {pendingUsers.map(user => (
                  <div key={user.id} className="bg-black/40 border border-orange-500/20 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="font-black text-white font-sans">{user.name}</p>
                      <p className="text-xs text-gray-500 font-bold font-sans">{user.email} • Requested: {user.role}</p>
                    </div>
                    <div className="flex gap-2 font-sans">
                      <button
                        onClick={async () => {
                          await approvePendingUser(user);
                          announce(`${user.name} approved as ${user.role}`);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-black uppercase tracking-widest text-white transition-colors"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={async () => {
                          await rejectPendingUser(user);
                          announce(`${user.name} has been denied access.`);
                        }}
                        className="px-4 py-2 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 rounded-lg text-xs font-black uppercase tracking-widest text-red-500 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACTIVE USERS & PERMISSIONS SECTION */}
          <div className="bg-blue-500/5 border-2 border-blue-500/20 rounded-[2rem] p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black uppercase text-blue-400 tracking-widest flex items-center gap-2 font-sans">
                <Icon name="users" size={20} />
                Active Users & Permissions
              </h3>
              <button 
                onClick={() => {
                  setShowAddUserModal(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-black uppercase tracking-widest text-white transition-colors font-sans"
              >
                Add User
              </button>
            </div>
            <div className="space-y-4">
              {activeUsers.map(user => {
                const isMasterAccount = user.id === '1' || user.id === 'local-admin';
                const currentPinVal = editingPins[user.id] !== undefined ? editingPins[user.id] : (user.pin || '');
                const isPinChanged = currentPinVal !== (user.pin || '');
                const isPasswordVisible = showPasswordId === user.id;

                return (
                  <div key={user.id} className="bg-black/40 border border-white/10 p-6 rounded-[2rem] space-y-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-white text-base font-sans">{user.name}</p>
                          {isMasterAccount && (
                            <span className="text-[9px] bg-red-500/20 text-red-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-sans">
                              Master Account
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 font-bold font-sans mt-0.5">{user.email}</p>
                      </div>
                      <button 
                        onClick={async () => {
                          if (isMasterAccount) {
                            return alert("Master account cannot be removed.");
                          }
                          if (confirm(`Are you sure you want to delete the user ${user.name}? This cannot be undone.`)) {
                            await deleteActiveUser(user);
                            announce(`${user.name} has been removed.`);
                          }
                        }}
                        className="p-2 text-gray-500 hover:text-red-500 transition-colors disabled:opacity-30"
                        disabled={isMasterAccount}
                      >
                        <Icon name="trash-2" size={18} />
                      </button>
                    </div>

                    {/* Role & PIN Edit Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                      {/* Access Role select */}
                      <div>
                        <label className="text-[10px] uppercase text-gray-400 font-black tracking-widest block mb-1.5 font-sans">
                          Access Role
                        </label>
                        <select 
                          value={user.role} 
                          disabled={isMasterAccount}
                          onChange={async (e) => {
                            const newRole = e.target.value;
                            await updateActiveUser(user.id, { role: newRole });
                          }}
                          className="bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none w-full cursor-pointer disabled:opacity-50 font-sans"
                        >
                          {['Artisan', 'Supervisor', 'HR', 'Admin'].map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>

                      {/* PIN / Password with Save Button */}
                      <div>
                        <label className="text-[10px] uppercase text-gray-400 font-black tracking-widest block mb-1.5 font-sans">
                          Password / PIN
                        </label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input 
                              type={isPasswordVisible ? 'text' : 'password'}
                              value={currentPinVal}
                              onChange={(e) => {
                                setEditingPins(prev => ({ ...prev, [user.id]: e.target.value }));
                              }}
                              placeholder="Enter password/PIN"
                              className="bg-black border border-white/10 rounded-xl pl-3 pr-9 py-2 text-xs text-white outline-none w-full font-mono tracking-widest"
                            />
                            <button 
                              type="button"
                              onClick={() => setShowPasswordId(prev => prev === user.id ? null : user.id)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                            >
                              <Icon name={isPasswordVisible ? 'eye-off' : 'eye'} size={14} />
                            </button>
                          </div>
                          {isPinChanged && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!currentPinVal.trim()) {
                                  return alert("PIN / Password cannot be empty.");
                                }
                                await updateActiveUser(user.id, { pin: currentPinVal.trim() });
                                setEditingPins(prev => {
                                  const copy = { ...prev };
                                  delete copy[user.id];
                                  return copy;
                                });
                              }}
                              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black uppercase text-white transition-all flex items-center justify-center gap-1 shrink-0 shadow-lg font-sans"
                            >
                              <Icon name="check" size={12} />
                              Save
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Permissions Section */}
                    <div>
                      <label className="text-[10px] uppercase text-gray-400 font-black tracking-widest block mb-2 font-sans">
                        Custom Permission Overrides
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 pt-2 border-t border-white/5 font-sans">
                        {[
                          { key: 'canManageUsers', label: 'Manage Users' },
                          { key: 'canApproveUsers', label: 'Approve Users' },
                          { key: 'canManageOrders', label: 'Manage Orders' },
                          { key: 'canViewAnalytics', label: 'View Analytics' },
                          { key: 'canAccessMobile', label: 'Access Mobile' },
                          { key: 'canClock', label: 'Clock In/Out' }
                        ].map(perm => (
                          <label key={perm.key} className="flex items-center space-x-2 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors">
                            <input 
                              type="checkbox" 
                              checked={userPermissions[user.id]?.[perm.key] ?? true}
                              onChange={async (e) => {
                                const updatedPerms = {
                                  ...(userPermissions[user.id] || {
                                    canManageUsers: true,
                                    canApproveUsers: true,
                                    canManageOrders: true,
                                    canViewAnalytics: true,
                                    canAccessMobile: true,
                                    canClock: true
                                  }),
                                  [perm.key]: e.target.checked
                                };
                                
                                setUserPermissions(prev => ({
                                  ...prev,
                                  [user.id]: updatedPerms
                                }));

                                await updateActiveUser(user.id, { permissions: updatedPerms });
                              }}
                              className="w-4 h-4 rounded border-white/20 bg-black/40 accent-[#ff8c00] cursor-pointer"
                            />
                            <span className="text-xs font-bold text-gray-300 font-sans">{perm.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Close Button */}
          <button 
            onClick={() => setShowSettingsModal(false)}
            className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-black uppercase text-sm tracking-widest text-white transition-colors"
          >
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
};
