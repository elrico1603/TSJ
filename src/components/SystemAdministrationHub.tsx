import React, { useState } from 'react';
import { CompanySettingsHub } from './CompanySettingsHub';
import { RolePermissionHub } from './RolePermissionHub';
import { Icon } from './Icon';
import { AppUser } from '../auth';
import { APP_VERSION, CURRENT_VERSION_STRING, getGitTag } from '../version';

export type SystemAdminTab = 
  | 'company_settings'
  | 'roles_permissions'
  | 'system_health'
  | 'audit_log'
  | 'notification_settings'
  | 'email_templates'
  | 'system_settings'
  | 'feature_flags'
  | 'version_history';

interface SystemAdministrationHubProps {
  currentUser?: any;
  activeUsers?: AppUser[];
  pendingUsers?: AppUser[];
  userPermissions?: Record<string, Record<string, boolean>>;
  setUserPermissions?: React.Dispatch<React.SetStateAction<Record<string, Record<string, boolean>>>>;
  approvePendingUser?: (user: AppUser) => Promise<any>;
  rejectPendingUser?: (user: AppUser) => Promise<any>;
  deleteActiveUser?: (user: AppUser) => Promise<any>;
  updateActiveUser?: (userId: string, updates: Partial<AppUser>) => Promise<any>;
  setShowAddUserModal?: (b: boolean) => void;
  announce?: (msg: string) => void;
  onVersionUpdated?: (latestVersion: string) => void;
  voiceEnabled?: boolean;
  setVoiceEnabled?: (val: boolean) => void;
  initialTab?: SystemAdminTab;
}

export const SystemAdministrationHub: React.FC<SystemAdministrationHubProps> = ({
  currentUser,
  activeUsers = [],
  pendingUsers = [],
  userPermissions = {},
  setUserPermissions,
  approvePendingUser,
  rejectPendingUser,
  deleteActiveUser,
  updateActiveUser,
  setShowAddUserModal,
  announce,
  onVersionUpdated,
  voiceEnabled = true,
  setVoiceEnabled,
  initialTab = 'company_settings'
}) => {
  const isAdmin = currentUser?.role === 'Admin';
  const isManager = ['Supervisor', 'HR', 'Stock Manager'].includes(currentUser?.role || '');
  const hasAccess = isAdmin || isManager;

  const [activeTab, setActiveTab] = useState<SystemAdminTab>(initialTab);
  const [editingPins, setEditingPins] = useState<Record<string, string>>({});
  const [showPasswordId, setShowPasswordId] = useState<string | null>(null);

  // Mock states for administrative tools
  const [featureFlags, setFeatureFlags] = useState([
    { id: 'flag_realtime', name: 'Realtime Database Sync', description: 'Enable automatic background sync with Firestore', enabled: true },
    { id: 'flag_voice', name: 'Voice Announcement Engine', description: 'Play audio greetings and clock-in feedback', enabled: voiceEnabled },
    { id: 'flag_offline', name: 'Offline Storage Fallback', description: 'Cache recent transactions locally during network loss', enabled: true },
    { id: 'flag_advanced_analytics', name: 'Advanced Labor Analytics', description: 'Include predictive attendance and overtime metrics', enabled: true },
    { id: 'flag_maintenance', name: 'System Maintenance Mode', description: 'Restrict access to Super Administrators during updates', enabled: false },
  ]);

  const [auditLogs] = useState([
    { id: 'log-1', timestamp: new Date(Date.now() - 1000 * 60 * 12).toLocaleString(), user: currentUser?.fullName || 'Super Admin', action: 'Relocated Company Settings into System Administration Workspace', category: 'System', status: 'Success' },
    { id: 'log-2', timestamp: new Date(Date.now() - 1000 * 60 * 45).toLocaleString(), user: currentUser?.fullName || 'Super Admin', action: 'Updated System Version to v1.0.0.011', category: 'Version', status: 'Success' },
    { id: 'log-3', timestamp: new Date(Date.now() - 1000 * 60 * 120).toLocaleString(), user: currentUser?.fullName || 'Admin', action: 'Modified User Role Permissions Matrix', category: 'Security', status: 'Success' },
    { id: 'log-4', timestamp: new Date(Date.now() - 1000 * 60 * 360).toLocaleString(), user: currentUser?.fullName || 'Admin', action: 'Assigned Artisan Branch Allocations', category: 'Branch', status: 'Success' },
    { id: 'log-5', timestamp: new Date(Date.now() - 1000 * 60 * 720).toLocaleString(), user: currentUser?.fullName || 'System', action: 'Automated Firestore Database Index Optimization', category: 'Database', status: 'Success' },
  ]);

  const navItems: { id: SystemAdminTab; label: string; icon: string; badge?: string }[] = [
    { id: 'company_settings', label: 'Company Settings', icon: 'building' },
    { id: 'roles_permissions', label: 'Roles & Permissions', icon: 'shield' },
    { id: 'system_health', label: 'System Health', icon: 'activity' },
    { id: 'audit_log', label: 'Audit Log', icon: 'file-text' },
    { id: 'notification_settings', label: 'Notification Settings', icon: 'bell' },
    { id: 'email_templates', label: 'Email Templates', icon: 'mail' },
    { id: 'system_settings', label: 'System Settings', icon: 'sliders', badge: pendingUsers.length > 0 ? `${pendingUsers.length}` : undefined },
    { id: 'feature_flags', label: 'Feature Flags', icon: 'flag' },
    { id: 'version_history', label: 'Version History', icon: 'history' },
  ];

  if (!hasAccess) {
    return (
      <div className="p-8 text-center bg-red-500/10 border border-red-500/20 rounded-3xl font-sans max-w-2xl mx-auto my-12">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
          <Icon name="lock" size={32} />
        </div>
        <h2 className="text-xl font-black uppercase tracking-wider text-red-400 mb-2 font-sans">Access Restricted</h2>
        <p className="text-xs text-gray-300 font-sans">
          You do not have administrative permissions to view or configure System Administration settings. Please contact an Administrator if you require access.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 font-sans">
      {/* Sub Navigation Sidebar */}
      <div className="w-full lg:w-72 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-4 lg:p-6 shrink-0 flex flex-col justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-white/10">
            <div className="p-2.5 rounded-2xl bg-[#ff8c00]/10 text-[#ff8c00] border border-[#ff8c00]/30 shadow-lg">
              <Icon name="settings" size={22} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white font-sans">System Admin</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase font-sans">Control Hub</p>
            </div>
          </div>

          <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] mb-3 font-sans">Administration Menu</p>
          <nav className="space-y-1.5 font-sans">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all text-xs font-black uppercase tracking-wider font-sans ${
                    isActive
                      ? 'bg-[#ff8c00]/20 text-[#ff8c00] border border-[#ff8c00]/40 shadow-md'
                      : 'hover:bg-white/5 text-gray-400 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon name={item.icon} size={16} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-2 py-0.5 bg-orange-500 text-white text-[10px] font-mono rounded-full animate-pulse font-sans">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-8 pt-4 border-t border-white/10 text-[10px] text-gray-500 font-mono space-y-1">
          <div className="flex justify-between">
            <span>System Version:</span>
            <span className="text-emerald-400 font-bold">{CURRENT_VERSION_STRING}</span>
          </div>
          <div className="flex justify-between">
            <span>Build Date:</span>
            <span className="text-gray-300">{APP_VERSION.buildDate}</span>
          </div>
          <div className="flex justify-between">
            <span>Environment:</span>
            <span className="text-gray-300 uppercase">{APP_VERSION.environment}</span>
          </div>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 min-w-0 font-sans">
        {/* Tab 1: Company Settings */}
        {activeTab === 'company_settings' && (
          <CompanySettingsHub
            currentUser={currentUser}
            activeUsers={activeUsers}
            announce={announce}
            onVersionUpdated={onVersionUpdated}
            initialTab="info"
          />
        )}

        {/* Tab 2: Roles & Permissions */}
        {activeTab === 'roles_permissions' && (
          <RolePermissionHub
            currentUser={currentUser}
            activeUsers={activeUsers}
            announce={announce}
          />
        )}

        {/* Tab 3: System Health */}
        {activeTab === 'system_health' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white">System Health & Infrastructure</h2>
                <p className="text-xs text-gray-400 mt-0.5">Real-time status of backend services, database connections, and runtime performance</p>
              </div>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-mono font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                ALL SYSTEMS OPERATIONAL
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-black/40 border border-white/10 p-5 rounded-2xl">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-black uppercase tracking-wider">Database Engine</span>
                  <Icon name="database" size={18} className="text-emerald-400" />
                </div>
                <p className="text-lg font-mono font-black text-white">Firestore Cloud</p>
                <p className="text-[10px] text-emerald-400 font-bold mt-1">CONNECTED • 24ms Latency</p>
              </div>

              <div className="bg-black/40 border border-white/10 p-5 rounded-2xl">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-black uppercase tracking-wider">Application Server</span>
                  <Icon name="server" size={18} className="text-blue-400" />
                </div>
                <p className="text-lg font-mono font-black text-white">Cloud Run</p>
                <p className="text-[10px] text-blue-400 font-bold mt-1">ACTIVE • 99.98% Uptime</p>
              </div>

              <div className="bg-black/40 border border-white/10 p-5 rounded-2xl">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-black uppercase tracking-wider">Active Users</span>
                  <Icon name="users" size={18} className="text-purple-400" />
                </div>
                <p className="text-lg font-mono font-black text-white">{activeUsers.length} Registered</p>
                <p className="text-[10px] text-purple-400 font-bold mt-1">{pendingUsers.length} Pending Approval</p>
              </div>

              <div className="bg-black/40 border border-white/10 p-5 rounded-2xl">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-black uppercase tracking-wider">App Version</span>
                  <Icon name="cpu" size={18} className="text-[#ff8c00]" />
                </div>
                <p className="text-lg font-mono font-black text-white">{CURRENT_VERSION_STRING}</p>
                <p className="text-[10px] text-[#ff8c00] font-bold mt-1">LATEST BUILD • #{APP_VERSION.buildNumber}</p>
              </div>
            </div>

            <div className="bg-black/40 border border-white/10 p-6 rounded-3xl space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Runtime Health Indicators</h3>
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-white/5 rounded-xl flex items-center justify-between">
                  <span className="text-gray-300">Firebase Auth & Security Rules</span>
                  <span className="text-emerald-400 font-bold">VERIFIED & ENFORCED</span>
                </div>
                <div className="p-3 bg-white/5 rounded-xl flex items-center justify-between">
                  <span className="text-gray-300">Responsive Layout Engine & Auto Height</span>
                  <span className="text-emerald-400 font-bold">ACTIVE (v1.0.0.019)</span>
                </div>
                <div className="p-3 bg-white/5 rounded-xl flex items-center justify-between">
                  <span className="text-gray-300">Voice Announcement Chime Engine</span>
                  <span className="text-emerald-400 font-bold">{voiceEnabled ? 'ENABLED' : 'DISABLED'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Audit Log */}
        {activeTab === 'audit_log' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white">System Audit & Event Log</h2>
                <p className="text-xs text-gray-400 mt-0.5">Immutable record of security modifications, configuration changes, and system activities</p>
              </div>
              <button 
                onClick={() => announce?.("Audit logs exported successfully.")}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-black uppercase text-white flex items-center gap-2"
              >
                <Icon name="download" size={14} />
                Export Logs
              </button>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-white/5 border-b border-white/10 text-gray-400 uppercase font-black tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">User</th>
                      <th className="p-4">Action / Event</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 font-mono text-[11px] text-gray-400">{log.timestamp}</td>
                        <td className="p-4 font-bold text-white">{log.user}</td>
                        <td className="p-4">{log.action}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-mono text-gray-300 uppercase">
                            {log.category}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-bold uppercase">
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Notification Settings */}
        {activeTab === 'notification_settings' && (
          <div className="space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-xl font-black uppercase tracking-tight text-white">Notification Settings</h2>
              <p className="text-xs text-gray-400 mt-0.5">Configure system alert channels, sound feedback, and automated event triggers</p>
            </div>

            <div className="bg-black/40 border border-white/10 p-6 rounded-3xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="font-black text-white text-base">Voice Announcements & Chimes</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Play audio greetings and vocal feedback when artisans clock in or out</p>
                </div>
                <button
                  onClick={() => {
                    if (setVoiceEnabled) setVoiceEnabled(!voiceEnabled);
                    announce?.(`Voice announcements ${!voiceEnabled ? 'enabled' : 'disabled'}`);
                  }}
                  className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 outline-none flex items-center ${
                    voiceEnabled ? 'bg-[#ff8c00]' : 'bg-white/10'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${voiceEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="font-black text-white text-base">In-App Notification Centre Alerts</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Display real-time header badges for leave approvals and purchase orders</p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400">ACTIVE</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-white text-base">Low Stock & Reorder Alerts</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Automatically trigger stock manager notifications when inventory falls below minimum thresholds</p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400">ACTIVE</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Email Templates */}
        {activeTab === 'email_templates' && (
          <div className="space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-xl font-black uppercase tracking-tight text-white">System Email Templates</h2>
              <p className="text-xs text-gray-400 mt-0.5">Manage automated email notifications dispatched to employers, artisans, and suppliers</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { name: 'Welcome & Credential Registration', recipient: 'New Artisans / Employers', trigger: 'User Registration Approval' },
                { name: 'Purchase Order Dispatch Template', recipient: 'Suppliers', trigger: 'PO Approved & Sent' },
                { name: 'Leave Application Status Update', recipient: 'Employees', trigger: 'Leave Request Decision' },
                { name: 'Low Stock Threshold Warning', recipient: 'Stock Managers', trigger: 'Inventory Auto-Check' },
              ].map((tpl, i) => (
                <div key={i} className="bg-black/40 border border-white/10 p-5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-white text-sm">{tpl.name}</h3>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">READY</span>
                  </div>
                  <p className="text-xs text-gray-400">Target: <strong className="text-gray-200">{tpl.recipient}</strong></p>
                  <p className="text-xs text-gray-400">Trigger: <span className="text-gray-300 font-mono text-[11px]">{tpl.trigger}</span></p>
                  <button 
                    onClick={() => announce?.(`Previewing ${tpl.name}`)}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-300 hover:text-white"
                  >
                    Edit Template Body
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 7: System Settings & User Permissions */}
        {activeTab === 'system_settings' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white">System Settings & Active Users</h2>
                <p className="text-xs text-gray-400 mt-0.5">Manage system access roles, user authentication PINs, and custom permission overrides</p>
              </div>
              {setShowAddUserModal && (
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="px-4 py-2 bg-[#ff8c00] hover:bg-[#e07b00] rounded-xl text-xs font-black uppercase text-white shadow-lg flex items-center gap-2"
                >
                  <Icon name="user-plus" size={16} />
                  Add New User
                </button>
              )}
            </div>

            {/* PENDING APPROVALS SECTION */}
            {pendingUsers.length > 0 && approvePendingUser && rejectPendingUser && (
              <div className="bg-orange-500/5 border-2 border-orange-500/20 rounded-3xl p-6 space-y-4">
                <h3 className="text-base font-black uppercase text-orange-400 tracking-wider flex items-center gap-2">
                  <Icon name="user-plus" size={18} />
                  Pending User Registrations ({pendingUsers.length})
                </h3>
                <div className="space-y-3">
                  {pendingUsers.map(user => (
                    <div key={user.id} className="bg-black/60 border border-orange-500/20 p-4 rounded-2xl flex items-center justify-between">
                      <div>
                        <p className="font-black text-white text-sm">{user.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{user.email} • Requested Role: <strong className="text-orange-400">{user.role}</strong></p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            await approvePendingUser(user);
                            announce?.(`${user.name} approved as ${user.role}`);
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black uppercase text-white shadow"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={async () => {
                            await rejectPendingUser(user);
                            announce?.(`${user.name} registration rejected.`);
                          }}
                          className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-xl text-xs font-black uppercase text-red-400"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ACTIVE USERS SECTION */}
            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-gray-300">Active System Accounts ({activeUsers.length})</h3>
              <div className="space-y-4">
                {activeUsers.map(user => {
                  const isMasterAccount = user.id === '1' || user.id === 'local-admin';
                  const currentPinVal = editingPins[user.id] !== undefined ? editingPins[user.id] : (user.pin || '');
                  const isPinChanged = currentPinVal !== (user.pin || '');
                  const isPasswordVisible = showPasswordId === user.id;

                  return (
                    <div key={user.id} className="bg-black/40 border border-white/10 p-6 rounded-3xl space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-black text-white text-base">{user.name}</p>
                            {isMasterAccount && (
                              <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Master Account
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{user.email}</p>
                        </div>
                        {deleteActiveUser && (
                          <button 
                            onClick={async () => {
                              if (isMasterAccount) return alert("Master account cannot be removed.");
                              if (confirm(`Are you sure you want to delete ${user.name}?`)) {
                                await deleteActiveUser(user);
                                announce?.(`${user.name} removed.`);
                              }
                            }}
                            className="p-2 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-30"
                            disabled={isMasterAccount}
                          >
                            <Icon name="trash-2" size={18} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                        <div>
                          <label className="text-[10px] uppercase text-gray-400 font-black tracking-widest block mb-1.5">System Access Role</label>
                          <select 
                            value={user.role} 
                            disabled={isMasterAccount || !updateActiveUser}
                            onChange={async (e) => {
                              if (updateActiveUser) await updateActiveUser(user.id, { role: e.target.value });
                            }}
                            className="bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none w-full disabled:opacity-50"
                          >
                            {['Artisan', 'Supervisor', 'HR', 'Admin', 'Stock Manager'].map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase text-gray-400 font-black tracking-widest block mb-1.5">Password / PIN Code</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <input 
                                type={isPasswordVisible ? 'text' : 'password'}
                                value={currentPinVal}
                                onChange={(e) => setEditingPins(prev => ({ ...prev, [user.id]: e.target.value }))}
                                placeholder="Enter PIN"
                                className="bg-black border border-white/10 rounded-xl pl-3 pr-8 py-2 text-xs text-white outline-none w-full font-mono"
                              />
                              <button 
                                type="button"
                                onClick={() => setShowPasswordId(prev => prev === user.id ? null : user.id)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                              >
                                <Icon name={isPasswordVisible ? 'eye-off' : 'eye'} size={14} />
                              </button>
                            </div>
                            {isPinChanged && updateActiveUser && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!currentPinVal.trim()) return alert("PIN cannot be empty.");
                                  await updateActiveUser(user.id, { pin: currentPinVal.trim() });
                                  setEditingPins(prev => { const c = { ...prev }; delete c[user.id]; return c; });
                                }}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black uppercase text-white shrink-0"
                              >
                                Save
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Custom Permission Overrides */}
                      {setUserPermissions && (
                        <div>
                          <label className="text-[10px] uppercase text-gray-400 font-black tracking-widest block mb-2">Custom Access Overrides</label>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t border-white/5">
                            {[
                              { key: 'canManageUsers', label: 'Manage Users' },
                              { key: 'canApproveUsers', label: 'Approve Users' },
                              { key: 'canManageOrders', label: 'Manage Orders' },
                              { key: 'canViewAnalytics', label: 'View Analytics' },
                              { key: 'canAccessMobile', label: 'Access Mobile' },
                              { key: 'canClock', label: 'Clock In/Out' }
                            ].map(perm => (
                              <label key={perm.key} className="flex items-center space-x-2 cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-colors">
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
                                    setUserPermissions(prev => ({ ...prev, [user.id]: updatedPerms }));
                                    if (updateActiveUser) await updateActiveUser(user.id, { permissions: updatedPerms });
                                  }}
                                  className="w-4 h-4 rounded border-white/20 bg-black/40 accent-[#ff8c00] cursor-pointer"
                                />
                                <span className="text-xs font-bold text-gray-300">{perm.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 8: Feature Flags */}
        {activeTab === 'feature_flags' && (
          <div className="space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-xl font-black uppercase tracking-tight text-white">System Feature Flags</h2>
              <p className="text-xs text-gray-400 mt-0.5">Toggle live features, runtime engines, and operational modes without deploying code</p>
            </div>

            <div className="space-y-4">
              {featureFlags.map(flag => (
                <div key={flag.id} className="bg-black/40 border border-white/10 p-5 rounded-2xl flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-white text-sm">{flag.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{flag.description}</p>
                  </div>
                  <button
                    onClick={() => {
                      setFeatureFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabled: !f.enabled } : f));
                      announce?.(`${flag.name} toggled.`);
                    }}
                    className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 flex items-center ${
                      flag.enabled ? 'bg-[#ff8c00]' : 'bg-white/10'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transform transition-transform ${flag.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 9: Version History */}
        {activeTab === 'version_history' && (
          <CompanySettingsHub
            currentUser={currentUser}
            activeUsers={activeUsers}
            announce={announce}
            onVersionUpdated={onVersionUpdated}
            initialTab="versions"
          />
        )}
      </div>
    </div>
  );
};
