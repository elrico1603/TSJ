import React, { useState, useEffect } from 'react';
import {
  RoleDefinition,
  RolePermissions,
  UserRoleAssignment,
  RoleAuditLogEntry,
  PermissionAction,
  PermissionCategory
} from '../types';
import { AppUser } from '../auth';
import { Icon } from './Icon';
import {
  permissionService,
  PERMISSION_CATEGORIES_CONFIG,
  ALL_PERMISSION_ACTIONS,
  DEFAULT_ROLES
} from '../services/permissionService';

interface RolePermissionHubProps {
  currentUser?: any;
  activeUsers?: AppUser[];
  announce?: (msg: string) => void;
}

export const RolePermissionHub: React.FC<RolePermissionHubProps> = ({
  currentUser,
  activeUsers = [],
  announce
}) => {
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Administrator';
  const isManager = ['Supervisor', 'Manager', 'HR', 'Stock Manager'].includes(currentUser?.role || '');
  const isReadOnly = !isAdmin;

  const [subTab, setSubTab] = useState<'matrix' | 'users' | 'audit'>('matrix');

  // Core States
  const [roles, setRoles] = useState<RoleDefinition[]>(permissionService.getLocalRoles());
  const [rolePermissionsMap, setRolePermissionsMap] = useState<Record<string, RolePermissions>>(
    permissionService.getLocalRolePermissions()
  );
  const [userRolesMap, setUserRolesMap] = useState<Record<string, UserRoleAssignment>>(
    permissionService.getLocalUserRoles()
  );
  const [auditLogs, setAuditLogs] = useState<RoleAuditLogEntry[]>(permissionService.getLocalAuditLogs());

  // Active Selected Role for Matrix Editor
  const [selectedRoleId, setSelectedRoleId] = useState<string>(roles[0]?.id || 'ROLE-ADMIN');

  // Matrix Editing Buffer
  const [matrixBuffer, setMatrixBuffer] = useState<Record<string, Record<PermissionAction, boolean>>>({});
  const [isMatrixDirty, setIsMatrixDirty] = useState(false);
  const [isSavingMatrix, setIsSavingMatrix] = useState(false);
  const [matrixSaveSuccess, setMatrixSaveSuccess] = useState(false);

  // Search States
  const [roleSearch, setRoleSearch] = useState('');
  const [permSearch, setPermSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  // Modals State
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [createRoleForm, setCreateRoleForm] = useState({ roleName: '', description: '' });

  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [editRoleForm, setEditRoleForm] = useState({ roleName: '', description: '', status: 'active' as 'active' | 'archived' });

  const [duplicateModalRole, setDuplicateModalRole] = useState<RoleDefinition | null>(null);
  const [duplicateRoleName, setDuplicateRoleName] = useState('');

  const [deleteConfirmRole, setDeleteConfirmRole] = useState<RoleDefinition | null>(null);

  // Subscriptions to Firebase Firestore
  useEffect(() => {
    const unsubRoles = permissionService.subscribeRoles(rList => {
      setRoles(rList);
      if (!selectedRoleId && rList.length > 0) {
        setSelectedRoleId(rList[0].id);
      }
    });

    const unsubPerms = permissionService.subscribeRolePermissions(map => {
      setRolePermissionsMap(map);
    });

    const unsubUserRoles = permissionService.subscribeUserRoles(map => {
      setUserRolesMap(map);
    });

    const unsubAudit = permissionService.subscribeAuditLogs(logs => {
      setAuditLogs(logs);
    });

    return () => {
      unsubRoles();
      unsubPerms();
      unsubUserRoles();
      unsubAudit();
    };
  }, []);

  // Sync buffer when selectedRoleId changes or rolePermissionsMap changes
  useEffect(() => {
    if (selectedRoleId) {
      const currentPerms = rolePermissionsMap[selectedRoleId];
      if (currentPerms) {
        setMatrixBuffer(JSON.parse(JSON.stringify(currentPerms.permissions)));
      } else {
        // Construct fallback empty matrix
        const empty: Record<string, Record<PermissionAction, boolean>> = {};
        PERMISSION_CATEGORIES_CONFIG.flatMap(c => c.modules).forEach(m => {
          empty[m] = { View: false, Create: false, Edit: false, Delete: false, Approve: false, Print: false, Export: false };
        });
        setMatrixBuffer(empty);
      }
      setIsMatrixDirty(false);
    }
  }, [selectedRoleId, rolePermissionsMap]);

  // Handle Checkbox Toggle
  const handleTogglePermission = (moduleName: string, action: PermissionAction) => {
    if (isReadOnly) return;
    setMatrixBuffer(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (!copy[moduleName]) {
        copy[moduleName] = { View: false, Create: false, Edit: false, Delete: false, Approve: false, Print: false, Export: false };
      }
      copy[moduleName][action] = !copy[moduleName][action];
      return copy;
    });
    setIsMatrixDirty(true);
  };

  // Bulk category toggle
  const handleCategoryToggle = (category: PermissionCategory, enable: boolean) => {
    if (isReadOnly) return;
    const group = PERMISSION_CATEGORIES_CONFIG.find(c => c.category === category);
    if (!group) return;

    setMatrixBuffer(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      group.modules.forEach(m => {
        if (!copy[m]) {
          copy[m] = { View: false, Create: false, Edit: false, Delete: false, Approve: false, Print: false, Export: false };
        }
        ALL_PERMISSION_ACTIONS.forEach(act => {
          copy[m][act] = enable;
        });
      });
      return copy;
    });
    setIsMatrixDirty(true);
  };

  // Save Permissions Matrix
  const handleSaveMatrix = async () => {
    if (isReadOnly || !selectedRoleId) return;
    setIsSavingMatrix(true);
    try {
      await permissionService.savePermissionsForRole(
        selectedRoleId,
        matrixBuffer,
        currentUser?.name || 'Administrator'
      );
      setIsMatrixDirty(false);
      setMatrixSaveSuccess(true);
      setTimeout(() => setMatrixSaveSuccess(false), 3000);
      announce?.(`Permissions saved for role successfully.`);
    } catch (err) {
      console.error(err);
      announce?.('Failed to save permissions.');
    } finally {
      setIsSavingMatrix(false);
    }
  };

  // Role CRUD Handlers
  const handleCreateRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !createRoleForm.roleName.trim()) return;

    try {
      const created = await permissionService.createRole(
        createRoleForm,
        currentUser?.name || 'Administrator'
      );
      announce?.(`Role "${created.roleName}" created.`);
      setSelectedRoleId(created.id);
      setShowCreateRoleModal(false);
      setCreateRoleForm({ roleName: '', description: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenEditRole = (role: RoleDefinition) => {
    setEditingRole(role);
    setEditRoleForm({
      roleName: role.roleName,
      description: role.description,
      status: role.status
    });
    setShowEditRoleModal(true);
  };

  const handleEditRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !editingRole) return;

    try {
      await permissionService.updateRole(
        editingRole.id,
        editRoleForm,
        currentUser?.name || 'Administrator'
      );
      announce?.(`Role "${editRoleForm.roleName}" updated.`);
      setShowEditRoleModal(false);
      setEditingRole(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenDuplicateRole = (role: RoleDefinition) => {
    setDuplicateModalRole(role);
    setDuplicateRoleName(`${role.roleName} (Copy)`);
  };

  const handleDuplicateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !duplicateModalRole || !duplicateRoleName.trim()) return;

    try {
      const dup = await permissionService.duplicateRole(
        duplicateModalRole.id,
        duplicateRoleName.trim(),
        currentUser?.name || 'Administrator'
      );
      if (dup) {
        announce?.(`Role duplicated as "${dup.roleName}".`);
        setSelectedRoleId(dup.id);
      }
      setDuplicateModalRole(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleArchiveRestoreToggle = async (role: RoleDefinition) => {
    if (isReadOnly) return;
    try {
      if (role.status === 'active') {
        await permissionService.archiveRole(role.id, currentUser?.name || 'Administrator');
        announce?.(`Role "${role.roleName}" archived.`);
      } else {
        await permissionService.restoreRole(role.id, currentUser?.name || 'Administrator');
        announce?.(`Role "${role.roleName}" restored.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRoleSubmit = async () => {
    if (isReadOnly || !deleteConfirmRole) return;
    try {
      await permissionService.deleteRole(deleteConfirmRole.id, currentUser?.name || 'Administrator');
      announce?.(`Role "${deleteConfirmRole.roleName}" deleted.`);
      if (selectedRoleId === deleteConfirmRole.id) {
        setSelectedRoleId(roles.find(r => r.id !== deleteConfirmRole.id)?.id || '');
      }
      setDeleteConfirmRole(null);
    } catch (err: any) {
      console.error(err);
      announce?.(err.message || 'Failed to delete role.');
    }
  };

  // User Role Assignment Handler
  const handleAssignUserRole = async (user: AppUser, targetRoleId: string) => {
    if (isReadOnly) return;
    try {
      const assigned = await permissionService.assignUserRole(
        user.id,
        user.name,
        user.email,
        targetRoleId,
        currentUser?.name || 'Administrator'
      );
      announce?.(`Assigned role "${assigned.roleName}" to ${user.name}`);
    } catch (err) {
      console.error(err);
      announce?.('Failed to assign user role.');
    }
  };

  // Filtered Roles
  const filteredRoles = roles.filter(r =>
    r.roleName.toLowerCase().includes(roleSearch.toLowerCase()) ||
    r.description.toLowerCase().includes(roleSearch.toLowerCase())
  );

  const selectedRoleObj = roles.find(r => r.id === selectedRoleId);

  // Filtered Users
  const filteredUsers = activeUsers.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter(log =>
    log.administrator.toLowerCase().includes(auditSearch.toLowerCase()) ||
    log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
    log.previousValue.toLowerCase().includes(auditSearch.toLowerCase()) ||
    log.newValue.toLowerCase().includes(auditSearch.toLowerCase()) ||
    log.date.includes(auditSearch)
  );

  if (!isAdmin && !isManager) {
    return (
      <div className="bg-neutral-900 border border-red-500/30 rounded-2xl p-8 text-center space-y-4">
        <Icon name="shield-off" size={48} className="mx-auto text-red-400" />
        <h2 className="text-xl font-black uppercase text-white tracking-wider">Access Restricted</h2>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          Role & Permission Management is restricted strictly to Administrators and Authorized Supervisors.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-purple-950/40 border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <span className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                <Icon name="shield-check" size={26} />
              </span>
              <div>
                <h1 className="text-xl font-black uppercase tracking-wider text-white">
                  Roles & Permission Management
                </h1>
                <p className="text-xs text-gray-400 font-mono">
                  Central Authority for Application Security, Role Matrices, Granular Permissions, & Audit Logs
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {isReadOnly && (
              <span className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs font-bold font-mono flex items-center gap-1.5">
                <Icon name="lock" size={14} /> Read-Only Mode (Manager View)
              </span>
            )}

            {!isReadOnly && (
              <button
                onClick={() => setShowCreateRoleModal(true)}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-lg flex items-center space-x-2"
              >
                <Icon name="plus" size={16} />
                <span>Create New Role</span>
              </button>
            )}
          </div>
        </div>

        {/* SubTab Navigation */}
        <div className="flex items-center space-x-2 mt-6 pt-4 border-t border-white/10 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setSubTab('matrix')}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-2 whitespace-nowrap ${
              subTab === 'matrix'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <Icon name="grid" size={16} />
            <span>Role Permission Matrix</span>
            <span className="px-1.5 py-0.5 bg-white/20 text-white text-[10px] font-mono rounded-full">
              {roles.length} Roles
            </span>
          </button>

          <button
            onClick={() => setSubTab('users')}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-2 whitespace-nowrap ${
              subTab === 'users'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <Icon name="users" size={16} />
            <span>User Role Assignments</span>
            <span className="px-1.5 py-0.5 bg-white/20 text-white text-[10px] font-mono rounded-full">
              {activeUsers.length} Users
            </span>
          </button>

          <button
            onClick={() => setSubTab('audit')}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-2 whitespace-nowrap ${
              subTab === 'audit'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <Icon name="activity" size={16} />
            <span>Security Audit Log</span>
            <span className="px-1.5 py-0.5 bg-white/20 text-white text-[10px] font-mono rounded-full">
              {auditLogs.length} Entries
            </span>
          </button>
        </div>
      </div>

      {/* ================= SUBTAB 1: PERMISSION MATRIX ================= */}
      {subTab === 'matrix' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column: Role Selector Directory */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-neutral-900 border border-white/10 rounded-2xl p-4 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-black uppercase tracking-wider text-gray-300">Roles Directory</span>
                <span className="text-[10px] font-mono text-gray-500 font-bold">{roles.length} Total</span>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter roles..."
                  value={roleSearch}
                  onChange={e => setRoleSearch(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <Icon name="search" size={13} className="absolute left-2.5 top-2 text-gray-500" />
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
                {filteredRoles.map(role => {
                  const isSelected = role.id === selectedRoleId;
                  const assignedCount = activeUsers.filter(u => (userRolesMap[u.id]?.roleId || '') === role.id).length;

                  return (
                    <div
                      key={role.id}
                      onClick={() => setSelectedRoleId(role.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1 relative ${
                        isSelected
                          ? 'bg-purple-600/20 border-purple-500 text-white shadow-lg'
                          : 'bg-black/30 border-white/5 hover:border-white/20 text-gray-400 hover:text-white'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${role.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <h4 className="text-xs font-bold text-white truncate">{role.roleName}</h4>
                        </div>
                        {role.isSystemDefault && (
                          <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 font-mono text-[9px] font-bold rounded">
                            DEFAULT
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-gray-400 line-clamp-2 leading-tight">{role.description}</p>

                      <div className="flex justify-between items-center pt-2 text-[10px] font-mono text-gray-500">
                        <span>Assigned: <strong className="text-purple-400">{assignedCount}</strong></span>
                        <span className="uppercase">{role.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Permission Matrix Editor */}
          <div className="lg:col-span-3 space-y-6">
            {selectedRoleObj ? (
              <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl">
                {/* Selected Role Header & Action Toolbar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                  <div>
                    <div className="flex items-center space-x-3">
                      <span className="px-3 py-1 bg-purple-500/20 text-purple-400 font-mono text-xs font-black rounded-xl border border-purple-500/30">
                        {selectedRoleObj.id}
                      </span>
                      <h2 className="text-lg font-black uppercase text-white tracking-wider">{selectedRoleObj.roleName}</h2>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        selectedRoleObj.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {selectedRoleObj.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 font-mono">{selectedRoleObj.description}</p>
                  </div>

                  {!isReadOnly && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleOpenEditRole(selectedRoleObj)}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-bold flex items-center space-x-1"
                      >
                        <Icon name="edit-2" size={14} />
                        <span>Edit Role</span>
                      </button>

                      <button
                        onClick={() => handleOpenDuplicateRole(selectedRoleObj)}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-bold flex items-center space-x-1"
                      >
                        <Icon name="copy" size={14} />
                        <span>Duplicate</span>
                      </button>

                      <button
                        onClick={() => handleArchiveRestoreToggle(selectedRoleObj)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 ${
                          selectedRoleObj.status === 'active'
                            ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                      >
                        <Icon name={selectedRoleObj.status === 'active' ? 'archive' : 'refresh-cw'} size={14} />
                        <span>{selectedRoleObj.status === 'active' ? 'Archive' : 'Restore'}</span>
                      </button>

                      {!selectedRoleObj.isSystemDefault && (
                        <button
                          onClick={() => setDeleteConfirmRole(selectedRoleObj)}
                          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center space-x-1"
                        >
                          <Icon name="trash-2" size={14} />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Matrix Notification Banner */}
                {matrixSaveSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-mono font-bold flex items-center gap-2">
                    <Icon name="check-circle" size={16} /> Permissions matrix updated and saved permanently to Firebase collection `rolePermissions`.
                  </div>
                )}

                {isMatrixDirty && !isReadOnly && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-mono flex items-center justify-between">
                    <span>Unsaved permission changes detected for {selectedRoleObj.roleName}.</span>
                    <button
                      onClick={handleSaveMatrix}
                      disabled={isSavingMatrix}
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase rounded-lg shadow"
                    >
                      {isSavingMatrix ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}

                {/* Matrix Filter & Bulk Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                  <div className="relative w-full sm:w-72">
                    <input
                      type="text"
                      placeholder="Search module permissions..."
                      value={permSearch}
                      onChange={e => setPermSearch(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                    <Icon name="search" size={13} className="absolute left-2.5 top-2 text-gray-500" />
                  </div>

                  {!isReadOnly && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleSaveMatrix}
                        disabled={!isMatrixDirty || isSavingMatrix}
                        className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-black uppercase text-xs tracking-wider rounded-xl transition-all shadow-lg flex items-center space-x-1.5"
                      >
                        <Icon name="save" size={14} />
                        <span>{isSavingMatrix ? 'Saving...' : 'Save Matrix'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Granular Permission Categories & Checkboxes */}
                <div className="space-y-6">
                  {PERMISSION_CATEGORIES_CONFIG.map(group => {
                    const filteredModules = group.modules.filter(m =>
                      m.toLowerCase().includes(permSearch.toLowerCase()) ||
                      group.category.toLowerCase().includes(permSearch.toLowerCase())
                    );

                    if (filteredModules.length === 0) return null;

                    return (
                      <div key={group.category} className="bg-black/50 border border-white/10 rounded-2xl overflow-hidden shadow-md">
                        {/* Category Header Bar */}
                        <div className="bg-gradient-to-r from-neutral-950 to-neutral-900 p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-white">{group.category}</h3>
                            <span className="text-[10px] font-mono text-gray-400">({filteredModules.length} Modules)</span>
                          </div>

                          {!isReadOnly && (
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => handleCategoryToggle(group.category, true)}
                                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-purple-300 rounded text-[10px] font-mono font-bold uppercase transition-all"
                              >
                                Select All Category
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCategoryToggle(group.category, false)}
                                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-400 rounded text-[10px] font-mono uppercase transition-all"
                              >
                                Clear Category
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Permission Table Matrix */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-sans">
                            <thead className="bg-black/80 text-gray-400 font-mono uppercase tracking-wider text-[10px] border-b border-white/10">
                              <tr>
                                <th className="p-3 w-1/3">Module Name</th>
                                {ALL_PERMISSION_ACTIONS.map(action => (
                                  <th key={action} className="p-3 text-center w-24">{action}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {filteredModules.map(moduleName => {
                                const currentActions = matrixBuffer[moduleName] || {
                                  View: false, Create: false, Edit: false, Delete: false, Approve: false, Print: false, Export: false
                                };

                                return (
                                  <tr key={moduleName} className="hover:bg-white/5 transition-all">
                                    <td className="p-3 font-bold text-gray-200">
                                      <div className="flex items-center space-x-2">
                                        <Icon name="check-square" size={14} className="text-purple-400 shrink-0" />
                                        <span>{moduleName}</span>
                                      </div>
                                    </td>

                                    {ALL_PERMISSION_ACTIONS.map(action => {
                                      const isChecked = currentActions[action];

                                      return (
                                        <td key={action} className="p-3 text-center">
                                          <label className="inline-flex items-center justify-center cursor-pointer p-1">
                                            <input
                                              type="checkbox"
                                              disabled={isReadOnly}
                                              checked={isChecked}
                                              onChange={() => handleTogglePermission(moduleName, action)}
                                              className="w-4 h-4 rounded border-white/20 bg-black/60 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 transition-all cursor-pointer disabled:opacity-40"
                                            />
                                          </label>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!isReadOnly && (
                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <button
                      onClick={handleSaveMatrix}
                      disabled={!isMatrixDirty || isSavingMatrix}
                      className="px-8 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-xl shadow-purple-600/30 flex items-center space-x-2"
                    >
                      <Icon name="save" size={16} />
                      <span>{isSavingMatrix ? 'Saving Matrix...' : 'Save Permission Matrix'}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-neutral-900 border border-white/10 rounded-2xl p-12 text-center text-gray-400">
                Select a role from the directory to view and configure permissions.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= SUBTAB 2: USER ROLE ASSIGNMENTS ================= */}
      {subTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black uppercase text-white tracking-wider">User Role Assignments</h2>
                <p className="text-xs text-gray-400">
                  Assign registered system accounts to a designated role. Role permissions trigger on next user authorization.
                </p>
              </div>

              <div className="relative w-full md:w-72">
                <input
                  type="text"
                  placeholder="Search user or email..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <Icon name="search" size={14} className="absolute left-2.5 top-2.5 text-gray-500" />
              </div>
            </div>

            {/* Role Breakdown Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-white/10">
              {roles.map(r => {
                const count = activeUsers.filter(u => {
                  const assigned = userRolesMap[u.id]?.roleId;
                  if (assigned) return assigned === r.id;
                  return u.role.toLowerCase() === r.roleName.toLowerCase();
                }).length;

                return (
                  <div key={r.id} className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block truncate">{r.roleName}</span>
                      <span className="text-[10px] text-gray-500 font-mono">{r.status}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 font-mono text-xs font-bold rounded-full">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* User Assignments Table */}
          <div className="bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-black/50 text-gray-400 font-mono uppercase tracking-wider text-[10px] border-b border-white/10">
                  <tr>
                    <th className="p-4">User</th>
                    <th className="p-4">Email Address</th>
                    <th className="p-4">Current Active Role</th>
                    <th className="p-4">Assigned System Role</th>
                    <th className="p-4">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500 font-mono">
                        No registered users found matching filter.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(user => {
                      const assignedInfo = userRolesMap[user.id];
                      const currentRoleId = assignedInfo?.roleId || roles.find(r => r.roleName.toLowerCase() === user.role.toLowerCase())?.id || 'ROLE-VIEWER';

                      return (
                        <tr key={user.id} className="hover:bg-white/5 transition-all">
                          <td className="p-4 font-bold text-white flex items-center space-x-2">
                            <span className="w-7 h-7 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-black text-xs">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                            <span>{user.name}</span>
                          </td>

                          <td className="p-4 font-mono text-gray-400">{user.email}</td>

                          <td className="p-4 font-mono font-bold">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] uppercase border ${
                              user.role === 'Admin'
                                ? 'bg-purple-500/20 border-purple-500/30 text-purple-400'
                                : 'bg-gray-800 border-white/10 text-gray-300'
                            }`}>
                              {user.role}
                            </span>
                          </td>

                          <td className="p-4">
                            <select
                              disabled={isReadOnly}
                              value={currentRoleId}
                              onChange={e => handleAssignUserRole(user, e.target.value)}
                              className="bg-black/60 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                            >
                              {roles.map(r => (
                                <option key={r.id} value={r.id}>
                                  {r.roleName} {r.isSystemDefault ? '(Default)' : ''}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="p-4 font-mono text-[11px] text-gray-500">
                            {assignedInfo ? new Date(assignedInfo.updatedAt).toLocaleDateString() : 'Initial'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= SUBTAB 3: AUDIT LOG ================= */}
      {subTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black uppercase text-white tracking-wider">Security & Permission Audit Trail</h2>
                <p className="text-xs text-gray-400 font-mono">
                  Immutable log of all role creations, edits, permission matrix updates, and user role modifications.
                </p>
              </div>

              <div className="relative w-full md:w-72">
                <input
                  type="text"
                  placeholder="Filter audit logs..."
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <Icon name="search" size={14} className="absolute left-2.5 top-2.5 text-gray-500" />
              </div>
            </div>
          </div>

          <div className="bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-black/50 text-gray-400 font-mono uppercase tracking-wider text-[10px] border-b border-white/10">
                  <tr>
                    <th className="p-4">Date & Time</th>
                    <th className="p-4">Administrator</th>
                    <th className="p-4">Security Action</th>
                    <th className="p-4">Previous Value</th>
                    <th className="p-4">New Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-gray-300">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500">
                        No security audit logs found.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-white/5 transition-all">
                        <td className="p-4 text-gray-400 whitespace-nowrap">
                          {log.date} <span className="text-purple-400">{log.time}</span>
                        </td>
                        <td className="p-4 font-bold text-white">{log.administrator}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded text-[10px] uppercase font-bold">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 text-gray-400 max-w-xs truncate">{log.previousValue}</td>
                        <td className="p-4 text-emerald-400 max-w-xs truncate">{log.newValue}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* Create Role Modal */}
      {showCreateRoleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-white/10 shrink-0">
              <h3 className="text-base font-black uppercase tracking-wider text-white">Create New System Role</h3>
              <button onClick={() => setShowCreateRoleModal(false)} className="text-gray-400 hover:text-white">
                <Icon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRoleSubmit} className="space-y-4 flex flex-col flex-1 overflow-hidden">
              <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Role Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Quality Controller"
                    value={createRoleForm.roleName}
                    onChange={e => setCreateRoleForm({ ...createRoleForm, roleName: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Description</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describe the operational responsibilities of this role..."
                    value={createRoleForm.description}
                    onChange={e => setCreateRoleForm({ ...createRoleForm, description: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateRoleModal(false)}
                  className="px-4 py-2 bg-white/10 text-gray-300 text-xs font-bold rounded-xl hover:bg-white/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase rounded-xl shadow-lg"
                >
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {showEditRoleModal && editingRole && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-white/10 shrink-0">
              <h3 className="text-base font-black uppercase tracking-wider text-white">Edit Role Details</h3>
              <button onClick={() => setShowEditRoleModal(false)} className="text-gray-400 hover:text-white">
                <Icon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleEditRoleSubmit} className="space-y-4 flex flex-col flex-1 overflow-hidden">
              <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Role Name</label>
                  <input
                    type="text"
                    required
                    disabled={editingRole.isSystemDefault}
                    value={editRoleForm.roleName}
                    onChange={e => setEditRoleForm({ ...editRoleForm, roleName: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Description</label>
                  <textarea
                    rows={3}
                    required
                    value={editRoleForm.description}
                    onChange={e => setEditRoleForm({ ...editRoleForm, description: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Status</label>
                  <select
                    value={editRoleForm.status}
                    onChange={e => setEditRoleForm({ ...editRoleForm, status: e.target.value as any })}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEditRoleModal(false)}
                  className="px-4 py-2 bg-white/10 text-gray-300 text-xs font-bold rounded-xl hover:bg-white/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase rounded-xl shadow-lg"
                >
                  Save Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate Role Modal */}
      {duplicateModalRole && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-white/10 shrink-0">
              <h3 className="text-base font-black uppercase tracking-wider text-white">Duplicate Role</h3>
              <button onClick={() => setDuplicateModalRole(null)} className="text-gray-400 hover:text-white">
                <Icon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleDuplicateSubmit} className="space-y-4 flex flex-col flex-1 overflow-hidden">
              <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
                <p className="text-xs text-gray-400">
                  Creates a new role with all permission settings copied directly from <strong className="text-white">{duplicateModalRole.roleName}</strong>.
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">New Role Name</label>
                  <input
                    type="text"
                    required
                    value={duplicateRoleName}
                    onChange={e => setDuplicateRoleName(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setDuplicateModalRole(null)}
                  className="px-4 py-2 bg-white/10 text-gray-300 text-xs font-bold rounded-xl hover:bg-white/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase rounded-xl shadow-lg"
                >
                  Duplicate Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmRole && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-red-500/30 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center space-x-3 text-red-400 shrink-0">
              <Icon name="alert-triangle" size={24} />
              <h3 className="text-base font-black uppercase tracking-wider">Confirm Delete Role</h3>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
              <p className="text-xs text-gray-300">
                Are you sure you want to permanently delete role <strong className="text-white">{deleteConfirmRole.roleName}</strong>? This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-white/10 shrink-0">
              <button
                onClick={() => setDeleteConfirmRole(null)}
                className="px-4 py-2 bg-white/10 text-gray-300 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRoleSubmit}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase rounded-xl shadow-lg"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
