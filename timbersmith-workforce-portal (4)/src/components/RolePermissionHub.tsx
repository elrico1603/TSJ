import React, { useState, useEffect } from 'react';
import {
  RoleDefinition,
  RolePermissions,
  UserRoleAssignment,
  RoleAuditLogEntry,
  PermissionAction,
  PermissionCategory,
  Branch,
  DeviceInterface
} from '../types';
import { AppUser, authManager, DEFAULT_ACCOUNTS } from '../auth';
import { Icon } from './Icon';
import {
  permissionService,
  PERMISSION_CATEGORIES_CONFIG,
  ALL_PERMISSION_ACTIONS,
  DEFAULT_ROLES
} from '../services/permissionService';
import { companyService } from '../services/companyService';
import { db, APP_ID_PATH } from '../firebase';
import { canMutateAuthOrRBAC } from '../services/previewSafety';
import {
  NotificationEventDefinition,
  NotificationPolicy,
  NotificationGroup,
  NotificationPolicyPriority,
  NOTIFICATION_GROUP_LABELS
} from '../types/notification';
import { notificationEventRegistry } from '../services/notificationEventRegistry';
import { notificationPolicyService } from '../services/notificationPolicyService';

export interface RolePermissionHubProps {
  currentUser?: any;
  activeUsers?: AppUser[];
  pendingUsers?: AppUser[];
  approvePendingUser?: (user: AppUser) => Promise<any>;
  rejectPendingUser?: (user: AppUser) => Promise<any>;
  deleteActiveUser?: (user: AppUser) => Promise<any>;
  updateActiveUser?: (userId: string, updates: Partial<AppUser>) => Promise<any>;
  announce?: (msg: string) => void;
  initialSubTab?: 'matrix' | 'users' | 'audit' | 'policies';
}

export const RolePermissionHub: React.FC<RolePermissionHubProps> = ({
  currentUser,
  activeUsers = [],
  pendingUsers = [],
  approvePendingUser,
  rejectPendingUser,
  deleteActiveUser,
  updateActiveUser,
  announce,
  initialSubTab = 'users'
}) => {
  const canEditUsers = permissionService.hasPermission(currentUser, 'User Assignments', 'Edit');
  const canApproveUsers = permissionService.hasPermission(currentUser, 'User Assignments', 'Approve');
  const canViewUsers = permissionService.hasPermission(currentUser, 'User Assignments', 'View');
  const canAccessAdmin = permissionService.canAccessDeviceView(currentUser, 'system_admin') || permissionService.canAccessDeviceView(currentUser, 'admin');
  
  // Explicit functional permissions for Notification Policy Centre (Zero role authority)
  const canViewPolicies = permissionService.hasPermission(currentUser, 'Notifications', 'View');
  const canEditPolicies = permissionService.hasPermission(currentUser, 'Notifications', 'Edit');

  const hasAccess = canViewUsers || canEditUsers || canApproveUsers || canAccessAdmin || canViewPolicies;
  const isReadOnly = !canEditUsers;

  const [subTab, setSubTab] = useState<'users' | 'roles' | 'audit' | 'policies'>(
    initialSubTab === 'matrix' ? 'roles' : (initialSubTab as any) || 'users'
  );

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab === 'matrix' ? 'roles' : (initialSubTab as any));
    }
  }, [initialSubTab]);

  // ================= NOTIFICATION POLICY CENTRE STATE =================
  const [policies, setPolicies] = useState<NotificationPolicy[]>(
    notificationPolicyService.getAllEffectivePolicies()
  );
  const [policySearch, setPolicySearch] = useState('');
  const [selectedPolicyGroup, setSelectedPolicyGroup] = useState<NotificationGroup | 'all'>('all');
  const [policyQuickFilter, setPolicyQuickFilter] = useState<'all' | 'enabled' | 'disabled' | 'has_recipients' | 'no_recipients'>('all');
  const [editingPolicy, setEditingPolicy] = useState<NotificationPolicy | null>(null);
  const [policyForm, setPolicyForm] = useState<{
    enabled: boolean;
    priority: NotificationPolicyPriority;
    recipientUserIds: string[];
    coalesceEnabled: boolean;
    coalesceWindowMinutes: number;
  }>({
    enabled: true,
    priority: 'normal',
    recipientUserIds: [],
    coalesceEnabled: false,
    coalesceWindowMinutes: 0
  });
  const [recipientSearch, setRecipientSearch] = useState('');
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [policyNotice, setPolicyNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Subscribe to real-time policy updates
  useEffect(() => {
    const unsub = notificationPolicyService.subscribeToPolicies(updatedPolicies => {
      setPolicies(updatedPolicies);
    });
    return () => unsub();
  }, []);

  // Eligible active users for recipient assignment (Strictly AppUser.id)
  const eligibleUsers: AppUser[] = (activeUsers && activeUsers.length > 0 ? activeUsers : authManager.getUsers()).filter(u =>
    Boolean(u.id && u.active !== false && u.isApproved !== false && (u.status || '').toLowerCase() !== 'inactive')
  );

  // Core States
  const [roles, setRoles] = useState<RoleDefinition[]>(permissionService.getLocalRoles());
  const [rolePermissionsMap, setRolePermissionsMap] = useState<Record<string, RolePermissions>>(
    permissionService.getLocalRolePermissions()
  );
  const [userRolesMap, setUserRolesMap] = useState<Record<string, UserRoleAssignment>>(
    permissionService.getLocalUserRoles()
  );
  const [auditLogs, setAuditLogs] = useState<RoleAuditLogEntry[]>(permissionService.getLocalAuditLogs());
  const [branches, setBranches] = useState<Branch[]>(companyService.getLocalBranches());

  // Active Selected Role for Matrix Editor
  const [selectedRoleId, setSelectedRoleId] = useState<string>(roles[0]?.id || 'ROLE-ADMIN');

  // Matrix Editing Buffer
  const [matrixBuffer, setMatrixBuffer] = useState<Record<string, Record<PermissionAction, boolean>>>({});
  const [isMatrixDirty, setIsMatrixDirty] = useState(false);
  const [isSavingMatrix, setIsSavingMatrix] = useState(false);
  const [matrixSaveSuccess, setMatrixSaveSuccess] = useState(false);

  // Search & Filter States
  const [roleSearch, setRoleSearch] = useState('');
  const [permSearch, setPermSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [auditSearch, setAuditSearch] = useState('');

  // Role Modals State
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [createRoleForm, setCreateRoleForm] = useState({ roleName: '', description: '' });

  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [editRoleForm, setEditRoleForm] = useState({ roleName: '', description: '', status: 'active' as 'active' | 'archived' });

  const [duplicateModalRole, setDuplicateModalRole] = useState<RoleDefinition | null>(null);
  const [duplicateRoleName, setDuplicateRoleName] = useState('');

  const [deleteConfirmRole, setDeleteConfirmRole] = useState<RoleDefinition | null>(null);

  // User Management Modals State
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserResult, setCreateUserResult] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);
  const [showCreatePin, setShowCreatePin] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    name: '',
    email: '',
    branchId: '',
    branchName: '',
    pin: '',
    roleId: '',
    roleName: '',
    department: 'Workshop'
  });

  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [showEditPin, setShowEditPin] = useState(false);
  const [selectedDeviceViewTab, setSelectedDeviceViewTab] = useState<DeviceInterface>('phone');
  const [editUserForm, setEditUserForm] = useState({
    name: '',
    email: '',
    branchId: '',
    branchName: '',
    physicalLocation: '',
    pin: '',
    roleId: '',
    roleName: '',
    department: 'Operations',
    active: true,
    deviceAccess: {
      desktop: true,
      phone: true,
      tablet: false,
      terminal: false
    },
    deviceViewAccess: {
      phone: {} as Record<string, boolean>,
      tablet: {} as Record<string, boolean>,
      desktop: {} as Record<string, boolean>,
      terminal: {} as Record<string, boolean>
    }
  });

  const [userPermissionOverridesBuffer, setUserPermissionOverridesBuffer] = useState<
    Record<string, Partial<Record<PermissionAction, 'allow' | 'deny' | 'inherit'>>>
  >({});
  const [userModalPermSearch, setUserModalPermSearch] = useState('');
  const [userModalCategoryFilter, setUserModalCategoryFilter] = useState('ALL');
  const [isSavingUser, setIsSavingUser] = useState(false);

  const [deleteConfirmUser, setDeleteConfirmUser] = useState<AppUser | null>(null);
  const [showPasswordIds, setShowPasswordIds] = useState<Record<string, boolean>>({});
  const [editingPins, setEditingPins] = useState<Record<string, string>>({});

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

    const unsubBranches = companyService.subscribeBranches(bList => {
      setBranches(bList);
    });

    return () => {
      unsubRoles();
      unsubPerms();
      unsubUserRoles();
      unsubAudit();
      unsubBranches();
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
          empty[m] = { View: false, Create: false, Edit: false, Delete: false, Approve: false, Process: false, Print: false, Export: false };
        });
        setMatrixBuffer(empty);
      }
      setIsMatrixDirty(false);
    }
  }, [selectedRoleId, rolePermissionsMap]);

  // Set default initial branch/role in createUserForm
  useEffect(() => {
    if (branches.length > 0 && !createUserForm.branchId) {
      setCreateUserForm(prev => ({
        ...prev,
        branchId: branches[0].id,
        branchName: branches[0].branchName
      }));
    }
    if (roles.length > 0 && !createUserForm.roleId) {
      const defaultRole = roles.find(r => r.roleName.toLowerCase() === 'supervisor') || roles[0];
      setCreateUserForm(prev => ({
        ...prev,
        roleId: defaultRole.id,
        roleName: defaultRole.roleName
      }));
    }
  }, [branches, roles]);

  // Handle Checkbox Toggle
  const handleTogglePermission = (moduleName: string, action: PermissionAction) => {
    if (isReadOnly) return;
    setMatrixBuffer(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (!copy[moduleName]) {
        copy[moduleName] = { View: false, Create: false, Edit: false, Delete: false, Approve: false, Process: false, Print: false, Export: false };
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
          copy[m] = { View: false, Create: false, Edit: false, Delete: false, Approve: false, Process: false, Print: false, Export: false };
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

  // User Role Assignment Handler (Dropdown change in table)
  const handleAssignUserRole = async (user: AppUser, targetRoleId: string) => {
    if (isReadOnly) return;
    try {
      const matchedRole = roles.find(r => r.id === targetRoleId);
      const roleName = matchedRole ? matchedRole.roleName : user.role;

      // Update active user in Firestore
      if (updateActiveUser) {
        await updateActiveUser(user.id, {
          role: roleName,
          roleId: targetRoleId
        });
      } else if (db && APP_ID_PATH && canMutateAuthOrRBAC('assignRole', user.id)) {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('private')
          .doc('users')
          .collection('active')
          .doc(user.id)
          .update({
            role: roleName,
            roleId: targetRoleId
          });
      }

      // Record in permission service
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

  // Create User Handler
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setCreateUserResult(null);

    const name = createUserForm.name.trim();
    const email = createUserForm.email.trim().toLowerCase();
    const pin = createUserForm.pin.trim();

    if (!name || !email || !pin) {
      const err = 'Please provide Name, Email, and PIN code.';
      setCreateUserResult({
        type: 'error',
        title: 'USER CREATION FAILED',
        message: err
      });
      announce?.(err);
      return;
    }

    if (pin.length < 6) {
      const err = 'Password must be at least 6 characters.';
      setCreateUserResult({
        type: 'error',
        title: 'USER CREATION FAILED',
        message: err
      });
      announce?.(err);
      return;
    }

    setIsCreatingUser(true);
    try {
      const selectedRole = roles.find(r => r.id === createUserForm.roleId) || 
                           roles.find(r => r.roleName.toLowerCase() === 'supervisor') || 
                           roles[0];
      const roleName = selectedRole ? selectedRole.roleName : 'Employee';
      const roleId = selectedRole ? selectedRole.id : 'ROLE-EMPLOYEE';

      const selectedBranch = branches.find(b => b.id === createUserForm.branchId);
      const branchName = selectedBranch ? selectedBranch.branchName : (createUserForm.branchName || (branches[0]?.branchName || 'Bloemfontein Central'));
      const branchId = selectedBranch ? selectedBranch.id : (createUserForm.branchId || (branches[0]?.id || 'BR-001'));

      const nameParts = name.split(' ');
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || '';

      const newUserData: Omit<AppUser, 'id' | 'status' | 'isApproved' | 'createdAt'> = {
        name,
        firstName,
        lastName,
        email,
        pin,
        role: roleName,
        roleId,
        branchId,
        branchName,
        department: createUserForm.department || 'Workshop',
        active: true,
        permissions: {}
      };

      const created = await authManager.createActiveUser(newUserData);

      if (created && roleId) {
        try {
          await permissionService.assignUserRole(
            created.id,
            created.name,
            created.email,
            roleId,
            currentUser?.name || 'Administrator'
          );
        } catch (roleErr) {
          console.warn('Role assignment notice:', roleErr);
        }
      }

      const successTitle = 'USER CREATED SUCCESSFULLY';
      const successMsg = `${created.name || created.email} (${created.email}) has been added to TS Hub.`;
      
      setCreateUserResult({
        type: 'success',
        title: successTitle,
        message: successMsg
      });
      announce?.(successMsg);

      // Reset form
      setCreateUserForm({
        name: '',
        email: '',
        branchId: branches[0]?.id || '',
        branchName: branches[0]?.branchName || '',
        pin: '',
        roleId: roles[0]?.id || '',
        roleName: roles[0]?.roleName || '',
        department: 'Workshop'
      });

      // Auto-close modal after user sees the clear success confirmation
      setTimeout(() => {
        setShowCreateUserModal(false);
        setCreateUserResult(null);
      }, 2500);
    } catch (err: any) {
      console.error('Failed to create user:', err);
      const errorMsg = err.message || 'An unexpected error occurred during user creation.';
      setCreateUserResult({
        type: 'error',
        title: 'USER CREATION FAILED',
        message: errorMsg
      });
      announce?.(`USER CREATION FAILED: ${errorMsg}`);
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Open Edit User Modal
  const handleOpenEditUser = (user: AppUser) => {
    setEditingUser(user);
    const assignedRoleId = user.roleId || userRolesMap[user.id || user.email]?.roleId || roles.find(r => r.roleName.toLowerCase() === (user.role || '').toLowerCase())?.id || roles[0]?.id || '';
    const userBranch = branches.find(b => b.id === user.branchId || b.branchName === user.branchName) || branches[0];
    const userOverride = permissionService.getUserOverride(user);

    const initialDeviceViewAccess = {
      phone: { ...(userOverride?.deviceViewAccess?.phone || user.deviceViewAccess?.phone || {}) },
      tablet: { ...(userOverride?.deviceViewAccess?.tablet || user.deviceViewAccess?.tablet || {}) },
      desktop: { ...(userOverride?.deviceViewAccess?.desktop || user.deviceViewAccess?.desktop || {}) },
      terminal: { ...(userOverride?.deviceViewAccess?.terminal || user.deviceViewAccess?.terminal || {}) }
    };

    setEditUserForm({
      name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      email: user.email || '',
      branchId: user.branchId || userOverride?.branchId || userBranch?.id || '',
      branchName: user.branchName || userOverride?.branchName || userBranch?.branchName || '',
      physicalLocation: user.physicalLocation || userOverride?.physicalLocation || '',
      pin: user.pin || '',
      roleId: assignedRoleId,
      roleName: user.role || 'Employee',
      department: user.department || 'Operations',
      active: user.active !== undefined ? user.active : true,
      deviceAccess: userOverride?.deviceAccess || user.deviceAccess || {
        desktop: true,
        phone: true,
        tablet: false,
        terminal: false
      },
      deviceViewAccess: initialDeviceViewAccess
    });

    // Populate user permissions buffer:
    const initialBuffer: Record<string, Partial<Record<PermissionAction, 'allow' | 'deny' | 'inherit'>>> = {};
    PERMISSION_CATEGORIES_CONFIG.flatMap(c => c.modules).forEach(moduleName => {
      initialBuffer[moduleName] = {};
      ALL_PERMISSION_ACTIONS.forEach(act => {
        const overrideVal = userOverride?.permissions?.[moduleName]?.[act];
        if (overrideVal === 'allow' || overrideVal === true) {
          initialBuffer[moduleName]![act] = 'allow';
        } else if (overrideVal === 'deny' || overrideVal === false) {
          initialBuffer[moduleName]![act] = 'deny';
        } else {
          initialBuffer[moduleName]![act] = 'inherit';
        }
      });
    });
    setUserPermissionOverridesBuffer(initialBuffer);
    setUserModalPermSearch('');
    setUserModalCategoryFilter('ALL');
    setSelectedDeviceViewTab('phone');
    setShowEditUserModal(true);
  };

  // 3-state Permission Cell Cycling
  const cycleUserCellState = (moduleName: string, action: PermissionAction) => {
    if (isReadOnly) return;
    setUserPermissionOverridesBuffer(prev => {
      const current = prev[moduleName]?.[action] || 'inherit';
      let next: 'allow' | 'deny' | 'inherit' = 'inherit';
      if (current === 'inherit') next = 'allow';
      else if (current === 'allow') next = 'deny';
      else if (current === 'deny') next = 'inherit';

      return {
        ...prev,
        [moduleName]: {
          ...(prev[moduleName] || {}),
          [action]: next
        }
      };
    });
  };

  const handleResetUserPermissionsToInherit = () => {
    if (isReadOnly) return;
    const next: Record<string, Partial<Record<PermissionAction, 'allow' | 'deny' | 'inherit'>>> = {};
    PERMISSION_CATEGORIES_CONFIG.flatMap(c => c.modules).forEach(moduleName => {
      next[moduleName] = {};
      ALL_PERMISSION_ACTIONS.forEach(act => {
        next[moduleName]![act] = 'inherit';
      });
    });
    setUserPermissionOverridesBuffer(next);
  };

  // Global Matrix Control: Set every action in every module to explicit 'allow' or 'deny'
  const handleSetAllUserPermissions = (state: 'allow' | 'deny') => {
    if (isReadOnly) return;
    setUserPermissionOverridesBuffer(prev => {
      const next = { ...prev };
      PERMISSION_CATEGORIES_CONFIG.flatMap(c => c.modules).forEach(moduleName => {
        const modObj: Partial<Record<PermissionAction, 'allow' | 'deny' | 'inherit'>> = {
          ...(next[moduleName] || {})
        };
        ALL_PERMISSION_ACTIONS.forEach(act => {
          modObj[act] = state;
        });
        next[moduleName] = modObj;
      });
      return next;
    });
  };

  // Bulk Row Control: Set all actions for a specific module to explicit 'allow' or 'deny'
  const handleRowSetAll = (moduleName: string, state: 'allow' | 'deny') => {
    if (isReadOnly) return;
    setUserPermissionOverridesBuffer(prev => {
      const updatedRow: Partial<Record<PermissionAction, 'allow' | 'deny' | 'inherit'>> = {
        ...(prev[moduleName] || {})
      };
      ALL_PERMISSION_ACTIONS.forEach(act => {
        updatedRow[act] = state;
      });
      return {
        ...prev,
        [moduleName]: updatedRow
      };
    });
  };

  // Bulk Column Control: Set a specific action to explicit 'allow' or 'deny' across all modules
  const handleColumnSetAll = (action: PermissionAction, state: 'allow' | 'deny') => {
    if (isReadOnly) return;
    setUserPermissionOverridesBuffer(prev => {
      const next = { ...prev };
      PERMISSION_CATEGORIES_CONFIG.flatMap(c => c.modules).forEach(moduleName => {
        next[moduleName] = {
          ...(next[moduleName] || {}),
          [action]: state
        };
      });
      return next;
    });
  };

  // Bulk Category Control: Set all actions for all modules in a category to explicit 'allow' or 'deny'
  const handleCategorySetAll = (category: string, state: 'allow' | 'deny') => {
    if (isReadOnly) return;
    const catGroup = PERMISSION_CATEGORIES_CONFIG.find(c => c.category === category);
    if (!catGroup) return;
    setUserPermissionOverridesBuffer(prev => {
      const next = { ...prev };
      catGroup.modules.forEach(moduleName => {
        const modObj: Partial<Record<PermissionAction, 'allow' | 'deny' | 'inherit'>> = {
          ...(next[moduleName] || {})
        };
        ALL_PERMISSION_ACTIONS.forEach(act => {
          modObj[act] = state;
        });
        next[moduleName] = modObj;
      });
      return next;
    });
  };

  // Save Edit User with Admin Lockout Protection
  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !editingUser) return;

    // Self-Deactivation Protection: Prevent user from locking themselves out
    const isEditingSelf = (editingUser.email && currentUser?.email && editingUser.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim()) ||
                          editingUser.id === currentUser?.id;
    if (isEditingSelf && editUserForm.active === false) {
      alert('Protection: You cannot deactivate your own active account.');
      return;
    }

    setIsSavingUser(true);
    try {
      const selectedRole = roles.find(r => r.id === editUserForm.roleId);
      const roleName = selectedRole ? selectedRole.roleName : editUserForm.roleName;
      const roleId = selectedRole ? selectedRole.id : editUserForm.roleId;

      const selectedBranch = branches.find(b => b.id === editUserForm.branchId);
      const branchName = selectedBranch ? selectedBranch.branchName : editUserForm.branchName;
      const branchId = selectedBranch ? selectedBranch.id : editUserForm.branchId;

      const nameParts = editUserForm.name.trim().split(' ');
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || '';

      const updates: Partial<AppUser> = {
        name: editUserForm.name.trim(),
        firstName,
        lastName,
        email: editUserForm.email.trim().toLowerCase(),
        role: roleName,
        roleId: roleId,
        branchId,
        branchName,
        physicalLocation: editUserForm.physicalLocation.trim(),
        department: editUserForm.department,
        active: editUserForm.active,
        deviceAccess: editUserForm.deviceAccess,
        deviceViewAccess: editUserForm.deviceViewAccess
      };

      // Only update PIN/password if explicitly provided and intentionally changed
      if (editUserForm.pin && editUserForm.pin.trim() !== '' && editUserForm.pin.trim() !== (editingUser.pin || '')) {
        updates.pin = editUserForm.pin.trim();
      }

      if (updateActiveUser) {
        await updateActiveUser(editingUser.id, updates);
      } else if (db && APP_ID_PATH && canMutateAuthOrRBAC('updateUser', editingUser.id)) {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('private')
          .doc('users')
          .collection('active')
          .doc(editingUser.id)
          .update(updates);
      }

      // Persist user-specific override to permissionService
      await permissionService.saveUserOverride({
        userId: editingUser.id,
        userEmail: editUserForm.email.trim().toLowerCase(),
        branchId,
        branchName,
        physicalLocation: editUserForm.physicalLocation.trim(),
        deviceAccess: editUserForm.deviceAccess,
        deviceViewAccess: editUserForm.deviceViewAccess,
        permissions: userPermissionOverridesBuffer,
        updatedBy: currentUser?.name || 'Administrator'
      }, currentUser?.name || 'Administrator');

      if (roleId && roleId !== editingUser.roleId) {
        await permissionService.assignUserRole(
          editingUser.id,
          editUserForm.name.trim(),
          editUserForm.email.trim(),
          roleId,
          currentUser?.name || 'Administrator'
        );
      }

      announce?.(`User ${editUserForm.name} permissions and access updated successfully.`);
      setShowEditUserModal(false);
      setEditingUser(null);
    } catch (err: any) {
      console.error('Failed to update user:', err);
      announce?.(err.message || 'Failed to update user.');
    } finally {
      setIsSavingUser(false);
    }
  };

  // Delete User Confirmation
  const handleDeleteUserConfirm = async () => {
    if (isReadOnly || !deleteConfirmUser) return;
    const isMaster = deleteConfirmUser.id === '1' || deleteConfirmUser.id === 'local-admin' || deleteConfirmUser.id === 'usr-admin-elrico';
    if (isMaster) {
      announce?.('Master administrator accounts cannot be deleted.');
      setDeleteConfirmUser(null);
      return;
    }

    try {
      if (deleteActiveUser) {
        await deleteActiveUser(deleteConfirmUser);
      } else {
        await authManager.deleteActiveUser(deleteConfirmUser);
      }
      announce?.(`User ${deleteConfirmUser.name} deleted.`);
      setDeleteConfirmUser(null);
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      announce?.('Error deleting user account.');
    }
  };

  // Toggle user active status quickly
  const handleToggleUserActive = async (user: AppUser) => {
    if (isReadOnly) return;
    const isMaster = user.id === '1' || user.id === 'local-admin' || user.id === 'usr-admin-elrico';
    if (isMaster) {
      announce?.('Master administrator account status cannot be deactivated.');
      return;
    }
    const newActive = user.active === false ? true : false;
    try {
      if (updateActiveUser) {
        await updateActiveUser(user.id, { active: newActive });
      } else if (db && APP_ID_PATH && canMutateAuthOrRBAC('updateActiveStatus', user.id)) {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('private')
          .doc('users')
          .collection('active')
          .doc(user.id)
          .update({ active: newActive });
      }
      announce?.(`Account for ${user.name} is now ${newActive ? 'Active' : 'Suspended'}.`);
    } catch (err) {
      console.error(err);
      announce?.('Failed to update user status.');
    }
  };

  // Save quick PIN edit
  const handleSaveQuickPin = async (user: AppUser) => {
    const newPin = editingPins[user.id];
    if (!newPin || !newPin.trim()) return;

    try {
      if (updateActiveUser) {
        await updateActiveUser(user.id, { pin: newPin.trim() });
      } else if (db && APP_ID_PATH && canMutateAuthOrRBAC('updateQuickPin', user.id)) {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('private')
          .doc('users')
          .collection('active')
          .doc(user.id)
          .update({ pin: newPin.trim() });
      }
      setEditingPins(prev => {
        const copy = { ...prev };
        delete copy[user.id];
        return copy;
      });
      announce?.(`PIN updated for ${user.name}.`);
    } catch (err) {
      console.error(err);
      announce?.('Failed to save PIN.');
    }
  };

  // Filtered Roles
  const filteredRoles = roles.filter(r =>
    r.roleName.toLowerCase().includes(roleSearch.toLowerCase()) ||
    r.description.toLowerCase().includes(roleSearch.toLowerCase())
  );

  const selectedRoleObj = roles.find(r => r.id === selectedRoleId);

  // Filtered Users
  const filteredUsers = activeUsers.filter(u => {
    const matchesSearch = 
      (u.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.role || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.branchName || '').toLowerCase().includes(userSearch.toLowerCase());

    const matchesBranch = branchFilter === 'All' || u.branchId === branchFilter || u.branchName === branchFilter;

    const assignedRoleId = u.roleId || roles.find(r => r.roleName.toLowerCase() === (u.role || '').toLowerCase())?.id;
    const matchesRole = roleFilter === 'All' || assignedRoleId === roleFilter || u.role === roleFilter;

    return matchesSearch && matchesBranch && matchesRole;
  });

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter(log =>
    log.administrator.toLowerCase().includes(auditSearch.toLowerCase()) ||
    log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
    log.previousValue.toLowerCase().includes(auditSearch.toLowerCase()) ||
    log.newValue.toLowerCase().includes(auditSearch.toLowerCase()) ||
    log.date.includes(auditSearch)
  );

  if (!hasAccess) {
    return (
      <div className="bg-neutral-900 border border-red-500/30 rounded-2xl p-8 text-center space-y-4 font-sans">
        <Icon name="shield-off" size={48} className="mx-auto text-red-400" />
        <h2 className="text-xl font-black uppercase text-white tracking-wider">Access Restricted</h2>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          Role & Permission Management is restricted strictly to users with authorized User Assignments or System Administration access.
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
                  Roles & User Access Hub
                </h1>
                <p className="text-xs text-gray-400 font-mono">
                  Central Authority for User Accounts, Role Matrices, Granular Permissions, & Security Audit Logs
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 flex-wrap gap-2">
            {isReadOnly && (
              <span className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs font-bold font-mono flex items-center gap-1.5">
                <Icon name="lock" size={14} /> Read-Only Mode (Manager View)
              </span>
            )}

            {!isReadOnly && (
              <>
                <button
                  onClick={() => setShowCreateUserModal(true)}
                  className="px-5 py-2.5 bg-[#ff8c00] hover:bg-[#e07b00] active:scale-95 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-lg flex items-center space-x-2"
                >
                  <Icon name="user-plus" size={16} />
                  <span>Create New User</span>
                </button>

                <button
                  onClick={() => setShowCreateRoleModal(true)}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-lg flex items-center space-x-2"
                >
                  <Icon name="plus" size={16} />
                  <span>Create Role</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* SubTab Navigation */}
        <div className="flex items-center space-x-2 mt-6 pt-4 border-t border-white/10 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setSubTab('users')}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-2 whitespace-nowrap ${
              subTab === 'users'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <Icon name="users" size={16} />
            <span>User Accounts & Access</span>
            <span className="px-1.5 py-0.5 bg-white/20 text-white text-[10px] font-mono rounded-full">
              {activeUsers.length} Active
            </span>
            {pendingUsers.length > 0 && (
              <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-mono font-black rounded-full animate-pulse">
                {pendingUsers.length} Pending
              </span>
            )}
          </button>

          <button
            onClick={() => setSubTab('roles')}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-2 whitespace-nowrap ${
              subTab === 'roles'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <Icon name="shield" size={16} />
            <span>Role Classification (Metadata Only)</span>
            <span className="px-1.5 py-0.5 bg-white/20 text-white text-[10px] font-mono rounded-full">
              {roles.length} Roles
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

          {canViewPolicies && (
            <button
              onClick={() => setSubTab('policies')}
              className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-2 whitespace-nowrap ${
                subTab === 'policies'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
              }`}
            >
              <Icon name="bell" size={16} />
              <span>Notification Policies</span>
              <span className="px-1.5 py-0.5 bg-white/20 text-white text-[10px] font-mono rounded-full">
                24 Events
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ================= SUBTAB 1: ROLE DEFINITIONS & BASELINE ================= */}
      {subTab === 'roles' && (
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
                  const assignedCount = activeUsers.filter(u => (userRolesMap[u.id]?.roleId || '') === role.id || u.role.toLowerCase() === role.roleName.toLowerCase()).length;

                  return (
                    <div
                      key={role.id}
                      onClick={() => setSelectedRoleId(role.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col space-y-2 ${
                        isSelected
                          ? 'bg-purple-950/40 border-purple-500/50 shadow-md'
                          : 'bg-black/40 border-white/5 hover:border-white/20 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              role.status === 'active' ? 'bg-emerald-400' : 'bg-gray-500'
                            }`}
                          />
                          <span className="font-bold text-xs text-white truncate max-w-[130px]">
                            {role.roleName}
                          </span>
                        </div>

                        {role.isSystemDefault && (
                          <span className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[9px] uppercase font-mono rounded">
                            Default
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-gray-400 line-clamp-2">{role.description}</p>

                      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-gray-500 font-mono">
                        <span>{assignedCount} Assigned</span>
                        <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
                          {!isReadOnly && (
                            <>
                              <button
                                onClick={() => handleOpenEditRole(role)}
                                title="Edit Role"
                                className="p-1 hover:text-white transition-colors"
                              >
                                <Icon name="edit-3" size={12} />
                              </button>
                              <button
                                onClick={() => handleOpenDuplicateRole(role)}
                                title="Duplicate Role"
                                className="p-1 hover:text-purple-400 transition-colors"
                              >
                                <Icon name="copy" size={12} />
                              </button>
                              {!role.isSystemDefault && (
                                <>
                                  <button
                                    onClick={() => handleArchiveRestoreToggle(role)}
                                    title={role.status === 'active' ? 'Archive Role' : 'Restore Role'}
                                    className="p-1 hover:text-amber-400 transition-colors"
                                  >
                                    <Icon name={role.status === 'active' ? 'archive' : 'refresh-cw'} size={12} />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmRole(role)}
                                    title="Delete Role"
                                    className="p-1 hover:text-red-400 transition-colors"
                                  >
                                    <Icon name="trash-2" size={12} />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Permission Matrix Grid for Selected Role */}
          <div className="lg:col-span-3 space-y-4">
            {selectedRoleObj ? (
              <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
                {/* Header for Matrix Configuration */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                  <div>
                    <div className="flex items-center space-x-3">
                      <h2 className="text-lg font-black uppercase text-white tracking-wider">
                        {selectedRoleObj.roleName}
                      </h2>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold ${
                          selectedRoleObj.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-gray-700 text-gray-300'
                        }`}
                      >
                        {selectedRoleObj.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{selectedRoleObj.description}</p>
                    <p className="text-[11px] text-amber-400/90 font-mono mt-1">
                      ℹ Pure User-Centric Model: Roles serve as metadata/classification labels only. Functional and device permissions are granted exclusively at the user account level.
                    </p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="relative w-48">
                      <input
                        type="text"
                        placeholder="Search modules..."
                        value={permSearch}
                        onChange={e => setPermSearch(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                      <Icon name="search" size={13} className="absolute left-2.5 top-2 text-gray-500" />
                    </div>

                    {!isReadOnly && (
                      <button
                        onClick={handleSaveMatrix}
                        disabled={!isMatrixDirty || isSavingMatrix}
                        className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 shadow-lg ${
                          isMatrixDirty
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse'
                            : 'bg-white/10 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <Icon name="save" size={14} />
                        <span>{isSavingMatrix ? 'Saving...' : 'Save Matrix'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {matrixSaveSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-mono flex items-center space-x-2">
                    <Icon name="check-circle" size={16} />
                    <span>Role permission matrix successfully updated in Firestore.</span>
                  </div>
                )}

                {/* Matrix Categories & Tables */}
                <div className="space-y-6">
                  {PERMISSION_CATEGORIES_CONFIG.map(group => {
                    const filteredModules = group.modules.filter(m =>
                      m.toLowerCase().includes(permSearch.toLowerCase()) ||
                      group.category.toLowerCase().includes(permSearch.toLowerCase())
                    );

                    if (filteredModules.length === 0) return null;

                    return (
                      <div key={group.category} className="border border-white/5 bg-black/30 rounded-2xl overflow-hidden">
                        {/* Category Header with Bulk Actions */}
                        <div className="p-4 bg-black/50 border-b border-white/5 flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500" />
                            <h3 className="text-xs font-black uppercase tracking-wider text-purple-300">
                              {group.category}
                            </h3>
                          </div>

                          {!isReadOnly && (
                            <div className="flex items-center space-x-3 text-[11px] font-mono">
                              <button
                                onClick={() => handleCategoryToggle(group.category, true)}
                                className="text-emerald-400 hover:underline"
                              >
                                Enable All
                              </button>
                              <span className="text-gray-600">|</span>
                              <button
                                onClick={() => handleCategoryToggle(group.category, false)}
                                className="text-red-400 hover:underline"
                              >
                                Clear All
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Modules Permissions Grid */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-sans">
                            <thead className="bg-black/30 text-gray-400 font-mono uppercase text-[10px] border-b border-white/5">
                              <tr>
                                <th className="p-3 w-1/3">Sub-Module</th>
                                {ALL_PERMISSION_ACTIONS.map(action => (
                                  <th key={action} className="p-3 text-center">
                                    {action}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-gray-300">
                              {filteredModules.map(moduleName => {
                                const modulePerms = matrixBuffer[moduleName] || {
                                  View: false,
                                  Create: false,
                                  Edit: false,
                                  Delete: false,
                                  Approve: false,
                                  Print: false,
                                  Export: false
                                };

                                return (
                                  <tr key={moduleName} className="hover:bg-white/5 transition-colors">
                                    <td className="p-3 font-bold text-white whitespace-nowrap">
                                      {moduleName}
                                    </td>
                                    {ALL_PERMISSION_ACTIONS.map(action => {
                                      const isChecked = !!modulePerms[action];

                                      return (
                                        <td key={action} className="p-3 text-center">
                                          <input
                                            type="checkbox"
                                            disabled={isReadOnly}
                                            checked={isChecked}
                                            onChange={() => handleTogglePermission(moduleName, action)}
                                            className="w-4 h-4 rounded border-white/20 bg-black/40 text-purple-600 focus:ring-purple-500 cursor-pointer disabled:opacity-40"
                                          />
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

                {isMatrixDirty && !isReadOnly && (
                  <div className="sticky bottom-4 bg-neutral-900 border border-purple-500/50 p-4 rounded-2xl shadow-2xl flex items-center justify-between animate-in fade-in">
                    <span className="text-xs text-purple-300 font-bold font-mono">
                      You have unsaved changes in the permission matrix for {selectedRoleObj.roleName}.
                    </span>
                    <button
                      onClick={handleSaveMatrix}
                      disabled={isSavingMatrix}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg"
                    >
                      {isSavingMatrix ? 'Saving...' : 'Save Changes'}
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

      {/* ================= SUBTAB 2: USER ACCOUNTS & ACCESS ================= */}
      {subTab === 'users' && (
        <div className="space-y-6">
          {/* Header & Filter Controls Bar */}
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black uppercase text-white tracking-wider flex items-center gap-2">
                  <Icon name="users" size={20} className="text-[#ff8c00]" />
                  User Accounts & Access Management
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Manage registered active users, depot/branch assignments, system roles, and PIN credentials.
                </p>
              </div>

              {!isReadOnly && (
                <button
                  onClick={() => setShowCreateUserModal(true)}
                  className="px-5 py-2.5 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg flex items-center gap-2 self-start lg:self-auto"
                >
                  <Icon name="user-plus" size={16} />
                  <span>+ Create New User</span>
                </button>
              )}
            </div>

            {/* Metrics & Role Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-black/40 border border-white/5 rounded-xl">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Active Users</span>
                <span className="text-xl font-black text-white font-mono">{activeUsers.length}</span>
              </div>
              <div className="p-3 bg-black/40 border border-white/5 rounded-xl">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Assigned Branches</span>
                <span className="text-xl font-black text-blue-400 font-mono">{branches.length}</span>
              </div>
              <div className="p-3 bg-black/40 border border-white/5 rounded-xl">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Active Roles</span>
                <span className="text-xl font-black text-purple-400 font-mono">{roles.filter(r => r.status === 'active').length}</span>
              </div>
              <div className="p-3 bg-black/40 border border-white/5 rounded-xl">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Pending Registrations</span>
                <span className="text-xl font-black text-orange-400 font-mono">{pendingUsers.length}</span>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-white/10">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search user name or email..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <Icon name="search" size={14} className="absolute left-2.5 top-2.5 text-gray-500" />
              </div>

              <div>
                <select
                  value={branchFilter}
                  onChange={e => setBranchFilter(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="All">All Branches / Depots</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.branchName}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="All">All Roles</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.roleName}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* PENDING APPROVALS NOTIFICATION CARD */}
          {pendingUsers.length > 0 && (
            <div className="bg-orange-500/5 border-2 border-orange-500/20 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black uppercase text-orange-400 tracking-wider flex items-center gap-2">
                  <Icon name="user-plus" size={18} />
                  Pending User Registrations ({pendingUsers.length})
                </h3>
                <span className="text-xs text-gray-400 font-mono">Requires Administrator Approval</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingUsers.map(user => (
                  <div key={user.id} className="bg-black/60 border border-orange-500/20 p-4 rounded-2xl flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="font-black text-white text-sm">{user.name}</p>
                        <span className="px-2 py-0.5 bg-orange-500/20 border border-orange-500/30 text-orange-300 text-[10px] uppercase font-mono rounded">
                          {user.role}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{user.email}</p>
                      {user.createdAt && (
                        <p className="text-[10px] text-gray-500 font-mono mt-1">Requested: {new Date(user.createdAt).toLocaleString()}</p>
                      )}
                    </div>

                    {!isReadOnly && (
                      <div className="flex gap-2 pt-2 border-t border-white/5">
                        <button
                          onClick={async () => {
                            if (approvePendingUser) {
                              await approvePendingUser(user);
                            } else {
                              await authManager.approvePendingUser(user);
                            }
                            announce?.(`${user.name} approved.`);
                          }}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black uppercase text-white shadow transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={async () => {
                            if (rejectPendingUser) {
                              await rejectPendingUser(user);
                            } else {
                              await authManager.rejectPendingUser(user);
                            }
                            announce?.(`${user.name} registration rejected.`);
                          }}
                          className="flex-1 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-xl text-xs font-black uppercase text-red-400 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACTIVE USERS TABLE */}
          <div className="bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-black/50 text-gray-400 font-mono uppercase tracking-wider text-[10px] border-b border-white/10">
                  <tr>
                    <th className="p-4">User Details</th>
                    <th className="p-4">Branch / Depot</th>
                    <th className="p-4">Assigned Role</th>
                    <th className="p-4">PIN / Credentials</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500 font-mono">
                        No registered users found matching the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(user => {
                      const isMasterAccount = user.id === '1' || user.id === 'local-admin' || user.id === 'usr-admin-elrico';
                      const assignedInfo = userRolesMap[user.id];
                      const currentRoleId = user.roleId || assignedInfo?.roleId || roles.find(r => r.roleName.toLowerCase() === (user.role || '').toLowerCase())?.id || roles[0]?.id || '';
                      const isPasswordVisible = !!showPasswordIds[user.id];
                      const currentPinVal = editingPins[user.id] !== undefined ? editingPins[user.id] : (user.pin || '');
                      const isPinChanged = currentPinVal !== (user.pin || '');
                      const userBranch = branches.find(b => b.id === user.branchId) || branches.find(b => b.branchName === user.branchName);

                      return (
                        <tr key={user.id} className="hover:bg-white/5 transition-all">
                          {/* User Details */}
                          <td className="p-4">
                            <div className="flex items-center space-x-3">
                              <span className="w-8 h-8 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-black text-xs shrink-0">
                                {(user.name || 'U').charAt(0).toUpperCase()}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white text-sm">{user.name}</span>
                                  {isMasterAccount && (
                                    <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 font-bold px-1.5 py-0.2 rounded uppercase">
                                      Master
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono text-gray-400 text-xs block">{user.email}</span>
                              </div>
                            </div>
                          </td>

                          {/* Branch / Depot */}
                          <td className="p-4">
                            <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white/5 border border-white/10 text-gray-300 inline-flex items-center gap-1.5">
                              <Icon name="map-pin" size={12} className="text-blue-400" />
                              {user.branchName || userBranch?.branchName || 'Main Factory'}
                            </span>
                          </td>

                          {/* Dynamic System Role Selector */}
                          <td className="p-4">
                            <select
                              disabled={isReadOnly || isMasterAccount}
                              value={currentRoleId}
                              onChange={e => handleAssignUserRole(user, e.target.value)}
                              className="bg-black/60 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 disabled:opacity-50 font-bold"
                            >
                              {roles.map(r => (
                                <option key={r.id} value={r.id}>
                                  {r.roleName} {r.isSystemDefault ? '(Default)' : ''}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* PIN / Password with Eye Reveal */}
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              <div className="relative w-28">
                                <input
                                  type={isPasswordVisible ? 'text' : 'password'}
                                  value={currentPinVal}
                                  disabled={isReadOnly}
                                  onChange={e => setEditingPins(prev => ({ ...prev, [user.id]: e.target.value }))}
                                  className="w-full bg-black/60 border border-white/10 rounded-xl pl-2.5 pr-7 py-1 text-xs text-white font-mono outline-none focus:border-purple-500 disabled:opacity-50"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPasswordIds(prev => ({ ...prev, [user.id]: !prev[user.id] }))}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                                  title={isPasswordVisible ? 'Hide PIN' : 'Reveal PIN'}
                                >
                                  <Icon name={isPasswordVisible ? 'eye-off' : 'eye'} size={12} />
                                </button>
                              </div>

                              {isPinChanged && !isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => handleSaveQuickPin(user)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
                                >
                                  Save
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Status Toggle */}
                          <td className="p-4">
                            <button
                              disabled={isReadOnly || isMasterAccount}
                              onClick={() => handleToggleUserActive(user)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-black uppercase transition-all ${
                                user.active !== false
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
                              } ${!isReadOnly && !isMasterAccount ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                            >
                              {user.active !== false ? 'Active' : 'Suspended'}
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              {!isReadOnly && (
                                <button
                                  onClick={() => handleOpenEditUser(user)}
                                  title="Edit User Details"
                                  className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                                >
                                  <Icon name="edit-3" size={14} />
                                </button>
                              )}

                              {!isReadOnly && !isMasterAccount && (
                                <button
                                  onClick={() => setDeleteConfirmUser(user)}
                                  title="Delete User Account"
                                  className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                                >
                                  <Icon name="trash-2" size={14} />
                                </button>
                              )}
                            </div>
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
                  Immutable log of all role creations, edits, permission matrix updates, user registrations, and role modifications.
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

      {/* ================= SUBTAB 4: NOTIFICATION POLICY CENTRE ================= */}
      {subTab === 'policies' && canViewPolicies && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
                    <Icon name="bell" size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black uppercase text-white tracking-wider flex items-center gap-2">
                      Notification Policy Centre
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-mono rounded-full border border-purple-500/30">
                        24 Canonical Events
                      </span>
                    </h2>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      Configure event routing, explicit recipient users (AppUser.id), alert priorities, and coalescing windows.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Notice */}
              {policyNotice && (
                <div className={`px-4 py-2 rounded-xl text-xs flex items-center gap-2 border animate-in fade-in duration-200 ${
                  policyNotice.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : policyNotice.type === 'error'
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                }`}>
                  <Icon name={policyNotice.type === 'success' ? 'check' : 'info'} size={14} />
                  <span>{policyNotice.message}</span>
                  <button onClick={() => setPolicyNotice(null)} className="ml-2 text-gray-400 hover:text-white">
                    <Icon name="x" size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* View Only Warning for non-editors */}
            {!canEditPolicies && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-xs text-amber-400">
                <Icon name="alert-triangle" size={16} />
                <span>
                  <strong>View Only Mode:</strong> You have permission to inspect notification policies. Modifying or saving policies requires the explicit <strong>SETTINGS → Notifications → Edit</strong> permission.
                </span>
              </div>
            )}

            {/* Bulk Controls Bar */}
            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Global Controls:</span>
                <button
                  type="button"
                  disabled={!canEditPolicies}
                  onClick={async () => {
                    if (!canEditPolicies) return;
                    const allDefs = notificationPolicyService.getAllEventDefinitions();
                    for (const def of allDefs) {
                      const pol = policies.find(p => p.eventId === def.eventId) || notificationPolicyService.getEffectivePolicy(def.eventId)!;
                      if (!pol.enabled) {
                        await notificationPolicyService.savePolicy({
                          ...pol,
                          enabled: true,
                          updatedAt: new Date().toISOString(),
                          updatedByUserId: currentUser?.id || 'system'
                        });
                      }
                    }
                    setPolicyNotice({ type: 'success', message: 'All 24 notification events enabled successfully.' });
                  }}
                  className={`px-2.5 py-1 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all ${
                    canEditPolicies
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                  }`}
                >
                  Enable All
                </button>
                <button
                  type="button"
                  disabled={!canEditPolicies}
                  onClick={async () => {
                    if (!canEditPolicies) return;
                    const allDefs = notificationPolicyService.getAllEventDefinitions();
                    for (const def of allDefs) {
                      const pol = policies.find(p => p.eventId === def.eventId) || notificationPolicyService.getEffectivePolicy(def.eventId)!;
                      if (pol.enabled) {
                        await notificationPolicyService.savePolicy({
                          ...pol,
                          enabled: false,
                          updatedAt: new Date().toISOString(),
                          updatedByUserId: currentUser?.id || 'system'
                        });
                      }
                    }
                    setPolicyNotice({ type: 'info', message: 'All 24 notification events disabled.' });
                  }}
                  className={`px-2.5 py-1 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all ${
                    canEditPolicies
                      ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                  }`}
                >
                  Disable All
                </button>
                <button
                  type="button"
                  disabled={!canEditPolicies}
                  onClick={async () => {
                    if (!canEditPolicies) return;
                    if (!window.confirm('Reset all 24 events to canonical registry defaults? Configured recipients will be cleared.')) return;
                    await notificationPolicyService.resetAllPolicies();
                    setPolicyNotice({ type: 'info', message: 'All 24 events reset to canonical registry defaults.' });
                  }}
                  className={`px-2.5 py-1 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all ${
                    canEditPolicies
                      ? 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
                      : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                  }`}
                >
                  Reset All to Defaults
                </button>
              </div>

              {selectedPolicyGroup !== 'all' && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider">
                    {NOTIFICATION_GROUP_LABELS[selectedPolicyGroup]}:
                  </span>
                  <button
                    type="button"
                    disabled={!canEditPolicies}
                    onClick={async () => {
                      if (!canEditPolicies) return;
                      const groupDefs = notificationEventRegistry.getEventsByGroup(selectedPolicyGroup);
                      for (const def of groupDefs) {
                        const pol = policies.find(p => p.eventId === def.eventId) || notificationPolicyService.getEffectivePolicy(def.eventId)!;
                        if (!pol.enabled) {
                          await notificationPolicyService.savePolicy({
                            ...pol,
                            enabled: true,
                            updatedAt: new Date().toISOString(),
                            updatedByUserId: currentUser?.id || 'system'
                          });
                        }
                      }
                      setPolicyNotice({ type: 'success', message: `All events in "${NOTIFICATION_GROUP_LABELS[selectedPolicyGroup]}" enabled.` });
                    }}
                    className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-black uppercase tracking-wider"
                  >
                    Enable Group
                  </button>
                  <button
                    type="button"
                    disabled={!canEditPolicies}
                    onClick={async () => {
                      if (!canEditPolicies) return;
                      const groupDefs = notificationEventRegistry.getEventsByGroup(selectedPolicyGroup);
                      for (const def of groupDefs) {
                        const pol = policies.find(p => p.eventId === def.eventId) || notificationPolicyService.getEffectivePolicy(def.eventId)!;
                        if (pol.enabled) {
                          await notificationPolicyService.savePolicy({
                            ...pol,
                            enabled: false,
                            updatedAt: new Date().toISOString(),
                            updatedByUserId: currentUser?.id || 'system'
                          });
                        }
                      }
                      setPolicyNotice({ type: 'info', message: `All events in "${NOTIFICATION_GROUP_LABELS[selectedPolicyGroup]}" disabled.` });
                    }}
                    className="px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[9px] font-black uppercase tracking-wider"
                  >
                    Disable Group
                  </button>
                  <button
                    type="button"
                    disabled={!canEditPolicies}
                    onClick={async () => {
                      if (!canEditPolicies) return;
                      const groupDefs = notificationEventRegistry.getEventsByGroup(selectedPolicyGroup);
                      for (const def of groupDefs) {
                        await notificationPolicyService.resetPolicy(def.eventId);
                      }
                      setPolicyNotice({ type: 'info', message: `All events in "${NOTIFICATION_GROUP_LABELS[selectedPolicyGroup]}" reset to defaults.` });
                    }}
                    className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded text-[9px] font-black uppercase tracking-wider"
                  >
                    Reset Group
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Filters & Search Bar */}
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative w-full md:w-96">
                <input
                  type="text"
                  placeholder="Search by event name, ID, module, description..."
                  value={policySearch}
                  onChange={e => setPolicySearch(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <Icon name="search" size={14} className="absolute left-3 top-2.5 text-gray-500" />
              </div>

              {/* Quick Filters */}
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar w-full md:w-auto pb-1">
                {(['all', 'enabled', 'disabled', 'has_recipients', 'no_recipients'] as const).map(filter => {
                  const labels: Record<typeof filter, string> = {
                    all: 'All',
                    enabled: 'Enabled',
                    disabled: 'Disabled',
                    has_recipients: 'Has Recipients',
                    no_recipients: 'No Recipients'
                  };
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setPolicyQuickFilter(filter)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shrink-0 ${
                        policyQuickFilter === filter
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
                      }`}
                    >
                      {labels[filter]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Canonical Group Filter Bar */}
            <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1 pt-1 border-t border-white/5">
              <button
                type="button"
                onClick={() => setSelectedPolicyGroup('all')}
                className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedPolicyGroup === 'all'
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
                }`}
              >
                <Icon name="bell" size={12} />
                <span>All Groups</span>
              </button>
              {(Object.keys(NOTIFICATION_GROUP_LABELS) as NotificationGroup[]).map(grp => {
                const groupIcons: Record<NotificationGroup, string> = {
                  attention: 'alert-triangle',
                  clocking: 'clock',
                  leave: 'calendar',
                  money_borrowing: 'banknote',
                  stock_procurement: 'shopping-cart',
                  dispatch_receiving: 'truck',
                  users_security: 'shield',
                  kanban: 'kanban',
                  system_deployment: 'activity',
                  other: 'bell'
                };
                return (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => setSelectedPolicyGroup(grp)}
                    className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${
                      selectedPolicyGroup === grp
                        ? 'bg-purple-600 text-white shadow'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
                    }`}
                  >
                    <Icon name={groupIcons[grp] || 'bell'} size={12} />
                    <span>{NOTIFICATION_GROUP_LABELS[grp]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Policy Cards Grid */}
          {(() => {
            const allDefs = notificationPolicyService.getAllEventDefinitions();
            const filteredDefs = allDefs.filter(def => {
              const pol = policies.find(p => p.eventId === def.eventId) || notificationPolicyService.getEffectivePolicy(def.eventId);
              if (!pol) return false;

              if (selectedPolicyGroup !== 'all' && def.groupId !== selectedPolicyGroup) return false;

              if (policyQuickFilter === 'enabled' && !pol.enabled) return false;
              if (policyQuickFilter === 'disabled' && pol.enabled) return false;
              if (policyQuickFilter === 'has_recipients' && (!pol.recipientUserIds || pol.recipientUserIds.length === 0)) return false;
              if (policyQuickFilter === 'no_recipients' && pol.recipientUserIds && pol.recipientUserIds.length > 0) return false;

              if (policySearch.trim()) {
                const q = policySearch.toLowerCase().trim();
                const matchName = def.eventName.toLowerCase().includes(q);
                const matchId = def.eventId.toLowerCase().includes(q);
                const matchDesc = (def.description || '').toLowerCase().includes(q);
                const matchModule = def.moduleId.toLowerCase().includes(q);
                if (!matchName && !matchId && !matchDesc && !matchModule) return false;
              }

              return true;
            });

            if (filteredDefs.length === 0) {
              return (
                <div className="bg-neutral-900 border border-white/10 rounded-2xl p-12 text-center space-y-3 shadow-xl">
                  <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto text-gray-500">
                    <Icon name="bell" size={24} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">No Notification Policies Found</h3>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    No canonical events match the selected search query or group filter.
                  </p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredDefs.map(def => {
                  const pol = policies.find(p => p.eventId === def.eventId) || notificationPolicyService.getEffectivePolicy(def.eventId)!;
                  const groupIcons: Record<NotificationGroup, string> = {
                    attention: 'alert-triangle',
                    clocking: 'clock',
                    leave: 'calendar',
                    money_borrowing: 'banknote',
                    stock_procurement: 'shopping-cart',
                    dispatch_receiving: 'truck',
                    users_security: 'shield',
                    kanban: 'kanban',
                    system_deployment: 'activity',
                    other: 'bell'
                  };

                  const getPriorityStyle = (priority: NotificationPolicyPriority) => {
                    switch (priority) {
                      case 'critical':
                        return 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse';
                      case 'high':
                        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
                      case 'normal':
                        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
                      case 'info':
                        return 'bg-sky-500/20 text-sky-400 border-sky-500/40';
                      case 'silent':
                      default:
                        return 'bg-gray-500/20 text-gray-400 border-gray-500/40';
                    }
                  };

                  const configuredRecipients = pol.recipientUserIds || [];

                  return (
                    <div
                      key={def.eventId}
                      className={`bg-neutral-900 border rounded-2xl p-5 shadow-xl transition-all space-y-4 ${
                        pol.enabled
                          ? 'border-white/10 hover:border-purple-500/40'
                          : 'border-white/5 opacity-70 bg-black/40'
                      }`}
                    >
                      {/* Top Bar: Group, Module, and Status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/20">
                            <Icon name={groupIcons[def.groupId] || 'bell'} size={14} />
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">
                            {NOTIFICATION_GROUP_LABELS[def.groupId]}
                          </span>
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
                            mod: {def.moduleId}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase font-mono border ${
                            pol.enabled
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                          }`}>
                            {pol.enabled ? '● Enabled' : '○ Disabled'}
                          </span>
                        </div>
                      </div>

                      {/* Event Title & Description */}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-black text-white">{def.eventName}</h3>
                          <span className="text-[10px] font-mono text-gray-500">({def.eventId})</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                          {def.description}
                        </p>
                      </div>

                      {/* Parameters: Priority & Coalescing */}
                      <div className="flex items-center gap-3 pt-1 border-t border-white/5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-gray-500 uppercase">Priority:</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border font-mono ${getPriorityStyle(pol.priority)}`}>
                            {pol.priority}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-gray-500 uppercase">Coalescing:</span>
                          <span className="text-[10px] font-mono text-gray-300">
                            {pol.coalesceEnabled ? `${pol.coalesceWindowMinutes} min` : 'Off'}
                          </span>
                        </div>
                      </div>

                      {/* Recipients List & Warnings */}
                      <div className="pt-2 border-t border-white/5 space-y-2">
                        {pol.enabled && configuredRecipients.length === 0 && (
                          <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-[11px] text-amber-400 font-bold">
                            <Icon name="alert-triangle" size={14} />
                            <span>NO RECIPIENTS CONFIGURED — Alerts for this event will be dropped until users are assigned.</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                            Recipients: <strong className="text-white font-mono">{configuredRecipients.length} Users</strong>
                          </span>
                          {configuredRecipients.length > 0 && (
                            <span className="text-[10px] text-gray-500 font-mono">
                              Explicit AppUser.id
                            </span>
                          )}
                        </div>

                        {configuredRecipients.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {configuredRecipients.slice(0, 4).map(uid => {
                              const u = eligibleUsers.find(user => user.id === uid);
                              return (
                                <span
                                  key={uid}
                                  className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-sans text-gray-300 flex items-center gap-1"
                                >
                                  <Icon name="user" size={10} className="text-purple-400" />
                                  <span>{u?.name || uid}</span>
                                </span>
                              );
                            })}
                            {configuredRecipients.length > 4 && (
                              <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-mono text-gray-500">
                                +{configuredRecipients.length - 4} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-600 italic">No recipient users assigned.</p>
                        )}
                      </div>

                      {/* Action Bar */}
                      <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-gray-500">
                          {pol.updatedAt ? `Updated: ${new Date(pol.updatedAt).toLocaleDateString()}` : 'Canonical Default'}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingPolicy(pol);
                            setPolicyForm({
                              enabled: pol.enabled,
                              priority: pol.priority,
                              recipientUserIds: [...(pol.recipientUserIds || [])],
                              coalesceEnabled: pol.coalesceEnabled,
                              coalesceWindowMinutes: pol.coalesceWindowMinutes || (pol.coalesceEnabled ? 60 : 0)
                            });
                            setRecipientSearch('');
                            setPolicyNotice(null);
                          }}
                          className={`px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                            canEditPolicies
                              ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20'
                              : 'bg-white/10 hover:bg-white/20 text-gray-300'
                          }`}
                        >
                          <Icon name={canEditPolicies ? 'edit-3' : 'eye'} size={14} />
                          <span>{canEditPolicies ? 'Edit Policy' : 'View Details'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ================= USER MANAGEMENT MODALS ================= */}

      {/* CREATE NEW USER MODAL */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-[#ff8c00]/20 text-[#ff8c00] rounded-xl">
                  <Icon name="user-plus" size={18} />
                </span>
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider text-white">Create New User Account</h3>
                  <p className="text-xs text-gray-400">Add active system credentials and assign branch & role</p>
                </div>
              </div>
              <button onClick={() => setShowCreateUserModal(false)} className="text-gray-400 hover:text-white">
                <Icon name="x" size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="space-y-4 flex flex-col flex-1 overflow-hidden">
              {/* Status Banner */}
              {createUserResult && (
                <div className={`p-4 rounded-2xl border flex items-start gap-3 shrink-0 ${
                  createUserResult.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}>
                  <span className={`p-1.5 rounded-xl shrink-0 ${
                    createUserResult.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    <Icon name={createUserResult.type === 'success' ? 'check-circle' : 'alert-triangle'} size={18} />
                  </span>
                  <div className="space-y-0.5 text-xs">
                    <p className="font-black uppercase tracking-wider font-mono">
                      {createUserResult.title}
                    </p>
                    <p className="leading-relaxed opacity-90">
                      {createUserResult.message}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-300 uppercase">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Johannes Botha"
                    value={createUserForm.name}
                    onChange={e => setCreateUserForm({ ...createUserForm, name: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-300 uppercase">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. j.botha@tsjoinery.co.za"
                    value={createUserForm.email}
                    onChange={e => setCreateUserForm({ ...createUserForm, email: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                  />
                </div>

                {/* Branch / Depot Selector */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-300 uppercase">Assigned Branch / Depot *</label>
                  <select
                    required
                    value={createUserForm.branchId}
                    onChange={e => {
                      const selected = branches.find(b => b.id === e.target.value);
                      setCreateUserForm({
                        ...createUserForm,
                        branchId: e.target.value,
                        branchName: selected ? selected.branchName : ''
                      });
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.branchName} ({b.branchCode}) - {b.province}
                      </option>
                    ))}
                  </select>
                </div>

                {/* System Role Selector */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-300 uppercase flex items-center justify-between">
                    <span>System Role & Permissions *</span>
                    <span className="text-[10px] text-purple-400 font-mono lowercase">Firestore dynamic matrix</span>
                  </label>
                  <select
                    required
                    value={createUserForm.roleId}
                    onChange={e => {
                      const selected = roles.find(r => r.id === e.target.value);
                      setCreateUserForm({
                        ...createUserForm,
                        roleId: e.target.value,
                        roleName: selected ? selected.roleName : ''
                      });
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 font-bold"
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.roleName} {r.isSystemDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Password / PIN Credentials */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-gray-300 uppercase">PIN / Password Credentials *</label>
                    <span className="text-[10px] text-amber-400 font-mono">Min 6 characters</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showCreatePin ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters (e.g. 123456)"
                      value={createUserForm.pin}
                      onChange={e => setCreateUserForm({ ...createUserForm, pin: e.target.value })}
                      className="w-full bg-black/60 border border-white/10 rounded-xl p-3 pr-10 text-xs text-white font-mono focus:outline-none focus:border-[#ff8c00]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePin(!showCreatePin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      <Icon name={showCreatePin ? 'eye-off' : 'eye'} size={16} />
                    </button>
                  </div>
                </div>

                {/* Department */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-300 uppercase">Department</label>
                  <select
                    value={createUserForm.department}
                    onChange={e => setCreateUserForm({ ...createUserForm, department: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                  >
                    <option value="Workshop">Workshop & Joinery</option>
                    <option value="Management">Management & Executive</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Procurement">Procurement & Stores</option>
                    <option value="Dispatch">Dispatch & Logistics</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="px-4 py-2.5 bg-white/10 text-gray-300 text-xs font-bold rounded-xl hover:bg-white/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-6 py-2.5 bg-[#ff8c00] hover:bg-[#e07b00] text-white font-black text-xs uppercase rounded-xl shadow-lg transition-colors flex items-center gap-2"
                >
                  {isCreatingUser ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL - UNIFIED RBAC & ACCESS EDITOR */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 md:p-6">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-6xl max-h-[94vh] p-5 md:p-6 space-y-4 shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-purple-500/20 text-purple-400 rounded-2xl border border-purple-500/30">
                  <Icon name="shield" size={22} />
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black uppercase tracking-wider text-white">
                      User Permissions & Access Editor
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {editingUser.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-gray-400 bg-white/5 border border-white/10">
                      {editingUser.email}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Manage hardware device authorization, organizational depot assignments, and granular action overrides.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditUserModal(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <form onSubmit={handleEditUserSubmit} className="flex flex-col flex-1 overflow-hidden space-y-4">
              {/* Two-Column Responsive Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 overflow-hidden">
                {/* LEFT COLUMN: User Info, Device Access, Branch & Location */}
                <div className="lg:col-span-5 space-y-4 overflow-y-auto custom-scrollbar pr-1">
                  {/* CARD 1: User Identity & Credentials */}
                  <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                      <Icon name="user" size={14} className="text-purple-400" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-white">User Identity</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[11px] font-bold text-gray-400 uppercase">Full Name</label>
                        <input
                          type="text"
                          required
                          value={editUserForm.name}
                          onChange={e => setEditUserForm({ ...editUserForm, name: e.target.value })}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-bold"
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[11px] font-bold text-gray-400 uppercase">Email Address</label>
                        <input
                          type="email"
                          required
                          value={editUserForm.email}
                          onChange={e => setEditUserForm({ ...editUserForm, email: e.target.value })}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-400 uppercase">Assigned Role</label>
                        <select
                          value={editUserForm.roleId}
                          onChange={e => {
                            const selected = roles.find(r => r.id === e.target.value);
                            setEditUserForm({
                              ...editUserForm,
                              roleId: e.target.value,
                              roleName: selected ? selected.roleName : ''
                            });
                          }}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-bold"
                        >
                          {roles.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.roleName} {r.isSystemDefault ? '(Default)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-400 uppercase">Department</label>
                        <input
                          type="text"
                          value={editUserForm.department}
                          onChange={e => setEditUserForm({ ...editUserForm, department: e.target.value })}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-400 uppercase">PIN / Password</label>
                        <div className="relative">
                          <input
                            type={showEditPin ? 'text' : 'password'}
                            required
                            value={editUserForm.pin}
                            onChange={e => setEditUserForm({ ...editUserForm, pin: e.target.value })}
                            className="w-full bg-black/60 border border-white/10 rounded-xl pl-3 pr-9 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowEditPin(!showEditPin)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                          >
                            <Icon name={showEditPin ? 'eye-off' : 'eye'} size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-400 uppercase">Account Status</label>
                        <select
                          value={editUserForm.active ? 'active' : 'suspended'}
                          onChange={e => setEditUserForm({ ...editUserForm, active: e.target.value === 'active' })}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-bold"
                        >
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* CARD 2: Explicit Device Access (Layer 1 Hardware Gate) */}
                  <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <Icon name="monitor" size={14} className="text-purple-400" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-white">1. Device Access (Layer 1 Gate)</h4>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">Hardware Authorization</span>
                    </div>

                    <p className="text-[11px] text-gray-400">
                      Controls which physical device interfaces this user is authorized to sign into and access.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { key: 'phone', label: '1. Phone', sub: 'Mobile Interface', icon: 'smartphone' },
                        { key: 'tablet', label: '2. Tablet', sub: 'Tablet / iPad', icon: 'tablet' },
                        { key: 'desktop', label: '3. Desktop', sub: 'PC / Mac Screen', icon: 'monitor' }
                      ].map(dev => {
                        const isAllowed = !!editUserForm.deviceAccess[dev.key as keyof typeof editUserForm.deviceAccess];
                        return (
                          <button
                            type="button"
                            key={dev.key}
                            onClick={() => {
                              setEditUserForm({
                                ...editUserForm,
                                deviceAccess: {
                                  ...editUserForm.deviceAccess,
                                  [dev.key]: !isAllowed
                                }
                              });
                            }}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                              isAllowed
                                ? 'bg-purple-600/20 border-purple-500 text-white shadow-md'
                                : 'bg-black/30 border-white/10 text-gray-500 hover:text-gray-300'
                            }`}
                          >
                            <Icon name={dev.icon as any} size={20} className={isAllowed ? 'text-purple-400 mb-1' : 'text-gray-500 mb-1'} />
                            <span className="text-xs font-black uppercase">{dev.label}</span>
                            <span className="text-[10px] text-gray-400 font-mono mt-0.5">{dev.sub}</span>
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full mt-2 ${
                              isAllowed ? 'bg-purple-500/40 text-purple-200' : 'bg-white/5 text-gray-500'
                            }`}>
                              {isAllowed ? 'ENABLED' : 'DISABLED'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* CARD 2.5: Device View Access & Module Visibility (Layer 2 Gate) */}
                  <div className="bg-black/40 border border-purple-500/30 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <Icon name="layout" size={14} className="text-purple-400" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-white">2. Device View Access (Layer 2 Gate)</h4>
                      </div>
                      <span className="text-[10px] text-purple-300 font-mono font-bold">Module Visibility</span>
                    </div>

                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Controls which specific business modules are visible and accessible to this user on each authorized device.
                    </p>

                    {/* Device View Selector Tabs */}
                    <div className="flex items-center gap-1.5 p-1 bg-black/60 rounded-xl border border-white/10">
                      {(['phone', 'tablet', 'desktop'] as DeviceInterface[]).map(devKey => {
                        const isDeviceActive = !!editUserForm.deviceAccess[devKey];
                        const isSelected = selectedDeviceViewTab === devKey;
                        return (
                          <button
                            type="button"
                            key={devKey}
                            onClick={() => setSelectedDeviceViewTab(devKey)}
                            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                              isSelected
                                ? 'bg-purple-600 text-white shadow-md'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                            }`}
                          >
                            <Icon
                              name={devKey === 'phone' ? 'smartphone' : devKey === 'tablet' ? 'tablet' : 'monitor'}
                              size={13}
                            />
                            <span>{devKey}</span>
                            {!isDeviceActive && (
                              <span className="text-[9px] px-1 py-0.2 bg-red-500/30 text-red-300 rounded font-normal">Off</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Quick Action Helpers */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 px-0.5">
                      <span>Configuring: <strong className="text-purple-300 uppercase">{selectedDeviceViewTab} View</strong></span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const supported = permissionService.getModulesForDevice(selectedDeviceViewTab);
                            const updatedMap = { ...(editUserForm.deviceViewAccess[selectedDeviceViewTab] || {}) };
                            supported.forEach(m => { updatedMap[m.id] = true; });
                            setEditUserForm({
                              ...editUserForm,
                              deviceViewAccess: {
                                ...editUserForm.deviceViewAccess,
                                [selectedDeviceViewTab]: updatedMap
                              }
                            });
                          }}
                          className="px-2 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded border border-emerald-500/30 font-bold"
                        >
                          Enable All
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditUserForm({
                              ...editUserForm,
                              deviceViewAccess: {
                                ...editUserForm.deviceViewAccess,
                                [selectedDeviceViewTab]: {}
                              }
                            });
                          }}
                          className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded border border-white/10"
                        >
                          Reset to Role
                        </button>
                      </div>
                    </div>

                    {/* Modules List for Selected Device View */}
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                      {permissionService.getModulesForDevice(selectedDeviceViewTab).map(moduleDef => {
                        const explicitVal = editUserForm.deviceViewAccess[selectedDeviceViewTab]?.[moduleDef.id];
                        
                        // Compute effective status
                        let isEffectiveAllowed = false;
                        if (explicitVal !== undefined) {
                          isEffectiveAllowed = !!explicitVal;
                        } else {
                          // Inherited from role
                          const mockUser = {
                            role: editUserForm.roleName,
                            roleId: editUserForm.roleId,
                            active: true,
                            deviceAccess: editUserForm.deviceAccess
                          };
                          isEffectiveAllowed = permissionService.canAccessDeviceView(mockUser, moduleDef.id, selectedDeviceViewTab);
                        }

                        const isExplicitOverride = explicitVal !== undefined;

                        return (
                          <div
                            key={moduleDef.id}
                            className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                              isEffectiveAllowed
                                ? 'bg-purple-950/20 border-purple-500/30 text-white'
                                : 'bg-black/40 border-white/5 text-gray-400'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`p-1.5 rounded-lg shrink-0 ${isEffectiveAllowed ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-gray-500'}`}>
                                <Icon name={moduleDef.icon as any || 'box'} size={15} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold truncate text-white">{moduleDef.name}</span>
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-gray-400">
                                    {moduleDef.category}
                                  </span>
                                </div>
                                <p className="text-[10px] text-gray-400 truncate mt-0.5">{moduleDef.description}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isExplicitOverride && (
                                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                  explicitVal ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                }`}>
                                  Override
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const current = editUserForm.deviceViewAccess[selectedDeviceViewTab]?.[moduleDef.id];
                                  const next = current !== undefined ? !current : !isEffectiveAllowed;
                                  setEditUserForm({
                                    ...editUserForm,
                                    deviceViewAccess: {
                                      ...editUserForm.deviceViewAccess,
                                      [selectedDeviceViewTab]: {
                                        ...(editUserForm.deviceViewAccess[selectedDeviceViewTab] || {}),
                                        [moduleDef.id]: next
                                      }
                                    }
                                  });
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                                  isEffectiveAllowed
                                    ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300 hover:bg-emerald-600/50'
                                    : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                                }`}
                              >
                                {isEffectiveAllowed ? 'VISIBLE' : 'HIDDEN'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* CARD 3: Location & Organisational Structure */}
                  <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                      <Icon name="map-pin" size={14} className="text-blue-400" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-white">Location & Branch Structure</h4>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-300 uppercase flex items-center justify-between">
                          <span>Organisational Branch</span>
                          <span className="text-[10px] text-gray-500 font-normal">Reporting & Depot ID</span>
                        </label>
                        <select
                          value={editUserForm.branchId}
                          onChange={e => {
                            const selected = branches.find(b => b.id === e.target.value);
                            setEditUserForm({
                              ...editUserForm,
                              branchId: e.target.value,
                              branchName: selected ? selected.branchName : ''
                            });
                          }}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-bold"
                        >
                          {branches.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.branchName} ({b.branchCode})
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-gray-500">
                          The official branch/depot the user is assigned to for system records (e.g. Bloemfontein Central).
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-300 uppercase flex items-center justify-between">
                          <span>Physical Location (Optional)</span>
                          <span className="text-[10px] text-gray-500 font-normal">Actual Workplace</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Cape Town (working remotely or stationed at Cape Town depot)"
                          value={editUserForm.physicalLocation}
                          onChange={e => setEditUserForm({ ...editUserForm, physicalLocation: e.target.value })}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                        <p className="text-[10px] text-gray-500">
                          The physical city or workshop where the person is located (stored distinctly from organisational branch).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Granular Module & Action Permissions Matrix */}
                <div className="lg:col-span-7 flex flex-col bg-black/40 border border-white/10 rounded-2xl p-4 overflow-hidden space-y-3">
                  {/* Explanatory Banner */}
                  <div className="bg-purple-950/30 border border-purple-500/30 rounded-xl p-3 flex items-start gap-2.5">
                    <Icon name="info" size={16} className="text-purple-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-purple-200 leading-relaxed">
                      <strong>Inherited permissions</strong> come from the user's role (<strong>{editUserForm.roleName}</strong>).
                      You can override any specific action below. Clicking cycles between <strong>Inherited (—)</strong>, <strong>Allowed (✓)</strong>, and <strong>Denied (✕)</strong>.
                    </div>
                  </div>

                  {/* Filter & Quick Action Bar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Filter modules..."
                          value={userModalPermSearch}
                          onChange={e => setUserModalPermSearch(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                        <Icon name="search" size={13} className="absolute left-2.5 top-2 text-gray-500" />
                      </div>

                      <select
                        value={userModalCategoryFilter}
                        onChange={e => setUserModalCategoryFilter(e.target.value)}
                        className="bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-purple-500"
                      >
                        <option value="ALL">All Categories</option>
                        {PERMISSION_CATEGORIES_CONFIG.map(c => (
                          <option key={c.category} value={c.category}>{c.category}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                        <span className="text-[9px] font-mono uppercase text-gray-400 px-1 font-bold">Matrix:</span>
                        <button
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => handleSetAllUserPermissions('allow')}
                          className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/40 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 shadow-sm cursor-pointer disabled:opacity-40"
                          title="Global Enable All: Set all functional permissions to explicit ALLOW"
                        >
                          <Icon name="check" size={11} />
                          <span>Enable All</span>
                        </button>
                        <button
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => handleSetAllUserPermissions('deny')}
                          className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/35 text-red-300 border border-red-500/40 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 shadow-sm cursor-pointer disabled:opacity-40"
                          title="Global Disable All: Set all functional permissions to explicit DENY"
                        >
                          <Icon name="x" size={11} />
                          <span>Disable All</span>
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={isReadOnly}
                        onClick={handleResetUserPermissionsToInherit}
                        className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 border border-white/10 rounded-xl text-[10px] font-bold uppercase transition-all disabled:opacity-40"
                        title="Reset all permissions to Default Deny (Unset)"
                      >
                        Reset (Unset)
                      </button>
                    </div>
                  </div>

                  {/* 3-State Legend (Pure User-Centric Authorization) */}
                  <div className="flex items-center gap-4 text-[10px] font-mono text-gray-400 px-1">
                    <span className="flex items-center gap-1">
                      <span className="w-3.5 h-3.5 rounded bg-emerald-600/30 border border-emerald-500 text-emerald-300 flex items-center justify-center font-bold">✓</span>
                      <span>Explicit ALLOW</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3.5 h-3.5 rounded bg-red-600/30 border border-red-500 text-red-300 flex items-center justify-center font-bold">✕</span>
                      <span>Explicit DENY</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3.5 h-3.5 rounded bg-white/5 border border-white/15 text-gray-400 flex items-center justify-center font-bold">—</span>
                      <span>DEFAULT DENY (Unset)</span>
                    </span>
                  </div>

                  {/* Permissions Matrix Table */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/10 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-black/70 text-gray-400 font-mono uppercase text-[9px] sticky top-0 z-10 border-b border-white/10">
                        <tr>
                          <th className="p-2.5 min-w-[240px]">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-gray-300 text-[10px]">Module / Resource</span>
                              <span className="text-[8px] text-gray-500 font-sans normal-case">Row shortcuts apply to module</span>
                            </div>
                          </th>
                          {ALL_PERMISSION_ACTIONS.map(action => (
                            <th key={action} className="p-2 text-center min-w-[70px]">
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-bold text-gray-200 tracking-wider text-[10px]">{action}</span>
                                <div className="flex flex-col gap-1 w-full max-w-[62px]">
                                  <button
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => handleColumnSetAll(action, 'allow')}
                                    title={`Set ${action} = ALLOW across all modules`}
                                    className="w-full px-1 py-0.5 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/35 text-[7.5px] font-bold uppercase tracking-tight transition-all whitespace-nowrap cursor-pointer disabled:opacity-40"
                                  >
                                    Enable All
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => handleColumnSetAll(action, 'deny')}
                                    title={`Set ${action} = DENY across all modules`}
                                    className="w-full px-1 py-0.5 rounded bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/35 text-[7.5px] font-bold uppercase tracking-tight transition-all whitespace-nowrap cursor-pointer disabled:opacity-40"
                                  >
                                    Disable All
                                  </button>
                                </div>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {PERMISSION_CATEGORIES_CONFIG
                          .filter(catGroup => userModalCategoryFilter === 'ALL' || userModalCategoryFilter === catGroup.category)
                          .map(catGroup => {
                            const filteredMods = catGroup.modules.filter(m =>
                              m.toLowerCase().includes(userModalPermSearch.toLowerCase())
                            );
                            if (filteredMods.length === 0) return null;

                            return (
                              <React.Fragment key={catGroup.category}>
                                <tr className="bg-white/5 font-mono text-[10px] text-purple-300 font-bold uppercase tracking-wider">
                                  <td colSpan={1 + ALL_PERMISSION_ACTIONS.length} className="px-3 py-1.5">
                                    <div className="flex items-center justify-between">
                                      <span>{catGroup.category}</span>
                                      <div className="flex items-center gap-2 font-mono text-[9px] lowercase">
                                        <button
                                          type="button"
                                          disabled={isReadOnly}
                                          onClick={() => handleCategorySetAll(catGroup.category, 'allow')}
                                          className="text-emerald-400 hover:text-emerald-300 uppercase font-bold tracking-wider cursor-pointer disabled:opacity-40"
                                          title={`Enable all modules in ${catGroup.category}`}
                                        >
                                          Enable Category
                                        </button>
                                        <span className="text-gray-600">|</span>
                                        <button
                                          type="button"
                                          disabled={isReadOnly}
                                          onClick={() => handleCategorySetAll(catGroup.category, 'deny')}
                                          className="text-red-400 hover:text-red-300 uppercase font-bold tracking-wider cursor-pointer disabled:opacity-40"
                                          title={`Disable all modules in ${catGroup.category}`}
                                        >
                                          Disable Category
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>

                                {filteredMods.map(moduleName => {
                                  const roleBaseline = rolePermissionsMap[editUserForm.roleId]?.permissions[moduleName];

                                  return (
                                    <tr key={moduleName} className="hover:bg-white/5 transition-colors">
                                      <td className="p-2 font-medium text-gray-200 text-[11px]">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="truncate font-semibold text-gray-200" title={moduleName}>
                                            {moduleName}
                                          </span>
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              type="button"
                                              disabled={isReadOnly}
                                              onClick={() => handleRowSetAll(moduleName, 'allow')}
                                              title={`Enable All: Set all permissions for ${moduleName} to ALLOW`}
                                              className="px-1.5 py-0.5 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/35 text-[8px] font-bold uppercase tracking-tight transition-all whitespace-nowrap cursor-pointer disabled:opacity-40"
                                            >
                                              Enable All
                                            </button>
                                            <button
                                              type="button"
                                              disabled={isReadOnly}
                                              onClick={() => handleRowSetAll(moduleName, 'deny')}
                                              title={`Disable All: Set all permissions for ${moduleName} to DENY`}
                                              className="px-1.5 py-0.5 rounded bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/35 text-[8px] font-bold uppercase tracking-tight transition-all whitespace-nowrap cursor-pointer disabled:opacity-40"
                                            >
                                              Disable All
                                            </button>
                                          </div>
                                        </div>
                                      </td>

                                      {ALL_PERMISSION_ACTIONS.map(act => {
                                        const overrideState = userPermissionOverridesBuffer[moduleName]?.[act] || 'inherit';
                                        const roleVal = roleBaseline?.[act] ?? false;

                                        let buttonClass = 'bg-white/5 border-white/10 text-gray-500 hover:border-white/30';
                                        let label = '—';
                                        let title = 'Default DENY (Unset) - Click to Allow';

                                        if (overrideState === 'allow') {
                                          buttonClass = 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-sm font-black';
                                          label = '✓';
                                          title = 'Explicitly ALLOWED - Click to Deny';
                                        } else if (overrideState === 'deny') {
                                          buttonClass = 'bg-red-600/30 border-red-500 text-red-300 shadow-sm font-black';
                                          label = '✕';
                                          title = 'Explicitly DENIED - Click to reset to Default Deny';
                                        }

                                        return (
                                          <td key={act} className="p-1 text-center">
                                            <button
                                              type="button"
                                              onClick={() => cycleUserCellState(moduleName, act)}
                                              title={title}
                                              className={`w-10 h-7 rounded-lg border text-[10px] font-mono inline-flex items-center justify-center transition-all cursor-pointer ${buttonClass}`}
                                            >
                                              {label}
                                            </button>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10 shrink-0">
                <div className="text-[11px] text-gray-400 font-mono">
                  * Pure User-Centric: Role is metadata only. Explicit user permissions govern all functional and device view access.
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowEditUserModal(false)}
                    className="px-4 py-2.5 bg-white/10 text-gray-300 text-xs font-bold rounded-xl hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingUser}
                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase rounded-xl shadow-lg transition-colors flex items-center gap-2"
                  >
                    {isSavingUser ? (
                      <>
                        <Icon name="clock" size={14} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Icon name="check" size={14} />
                        <span>Save User Permissions & Access</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION MODAL */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-red-500/30 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-400">
              <Icon name="alert-triangle" size={24} />
              <h3 className="text-base font-black uppercase tracking-wider">Confirm Delete User</h3>
            </div>

            <p className="text-xs text-gray-300">
              Are you sure you want to permanently delete the user account for <strong className="text-white">{deleteConfirmUser.name}</strong> ({deleteConfirmUser.email})?
            </p>

            <div className="flex justify-end space-x-2 pt-4 border-t border-white/10">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 bg-white/10 text-gray-300 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUserConfirm}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase rounded-xl shadow-lg"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ROLE MANAGEMENT MODALS ================= */}

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

      {/* Delete Role Confirmation Modal */}
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

      {/* ================= POLICY EDIT MODAL ================= */}
      {editingPolicy && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-2xl p-6 space-y-5 shadow-2xl max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-start pb-3 border-b border-white/10 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase font-mono rounded">
                    {NOTIFICATION_GROUP_LABELS[editingPolicy.groupId]}
                  </span>
                  <span className="text-[10px] font-mono text-gray-500">
                    {editingPolicy.eventId}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  {editingPolicy.eventName}
                </h3>
                <p className="text-xs text-gray-400">
                  {notificationPolicyService.getEventDefinition(editingPolicy.eventId)?.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingPolicy(null)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={async e => {
                e.preventDefault();
                if (!canEditPolicies || !editingPolicy) return;
                setIsSavingPolicy(true);
                try {
                  const updatedPolicy: NotificationPolicy = {
                    ...editingPolicy,
                    enabled: policyForm.enabled,
                    priority: policyForm.priority,
                    recipientUserIds: policyForm.recipientUserIds,
                    coalesceEnabled: policyForm.coalesceEnabled,
                    coalesceWindowMinutes: policyForm.coalesceEnabled ? (policyForm.coalesceWindowMinutes || 60) : 0,
                    updatedAt: new Date().toISOString(),
                    updatedByUserId: currentUser?.id || 'system'
                  };

                  await notificationPolicyService.savePolicy(updatedPolicy);
                  setEditingPolicy(null);
                  setPolicyNotice({
                    type: 'success',
                    message: `Policy for ${updatedPolicy.eventName} saved successfully.`
                  });
                } catch (err: any) {
                  setPolicyNotice({ type: 'error', message: err.message || 'Failed to save policy.' });
                } finally {
                  setIsSavingPolicy(false);
                }
              }}
              className="space-y-5 flex-1 overflow-y-auto custom-scrollbar pr-1"
            >
              {/* Enabled / Disabled Toggle */}
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-white">Event Delivery Status</label>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    When disabled, business events of this type produce zero notifications.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canEditPolicies}
                  onClick={() => setPolicyForm(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                    policyForm.enabled
                      ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                      : 'bg-white/10 text-gray-400 hover:bg-white/20'
                  }`}
                >
                  <Icon name={policyForm.enabled ? 'check' : 'x'} size={14} />
                  <span>{policyForm.enabled ? 'Enabled' : 'Disabled'}</span>
                </button>
              </div>

              {/* Priority Selector */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-gray-300">
                  Notification Priority
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(['critical', 'high', 'normal', 'info', 'silent'] as NotificationPolicyPriority[]).map(p => {
                    const isSelected = policyForm.priority === p;
                    const priorityThemes: Record<NotificationPolicyPriority, string> = {
                      critical: isSelected ? 'bg-red-500 text-white border-red-400' : 'bg-red-500/10 text-red-300 border-red-500/30',
                      high: isSelected ? 'bg-amber-500 text-black border-amber-400' : 'bg-amber-500/10 text-amber-300 border-amber-500/30',
                      normal: isSelected ? 'bg-blue-600 text-white border-blue-400' : 'bg-blue-500/10 text-blue-300 border-blue-500/30',
                      info: isSelected ? 'bg-sky-500 text-black border-sky-400' : 'bg-sky-500/10 text-sky-300 border-sky-500/30',
                      silent: isSelected ? 'bg-gray-400 text-black border-gray-300' : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                    };
                    return (
                      <button
                        key={p}
                        type="button"
                        disabled={!canEditPolicies}
                        onClick={() => setPolicyForm(prev => ({ ...prev, priority: p }))}
                        className={`p-2.5 rounded-xl border font-black text-xs uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 ${priorityThemes[p]}`}
                      >
                        <span>{p}</span>
                      </button>
                    );
                  })}
                </div>
                {policyForm.priority === 'silent' && (
                  <p className="text-[11px] text-gray-400 italic bg-white/5 border border-white/5 rounded-xl p-2.5">
                    ℹ️ SILENT — This event will not appear in the notification bell. It is captured strictly for audit trail history.
                  </p>
                )}
              </div>

              {/* Recipient User Selector (AppUser.id) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-gray-300">
                      Explicit Recipient Users
                    </label>
                    <p className="text-[10px] text-gray-500 font-mono">
                      Recipients are explicit AppUser.id values. Roles and departments have zero routing authority.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!canEditPolicies}
                      onClick={() => setPolicyForm(prev => ({ ...prev, recipientUserIds: eligibleUsers.map(u => u.id) }))}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 text-purple-400 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-wider"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      disabled={!canEditPolicies}
                      onClick={() => setPolicyForm(prev => ({ ...prev, recipientUserIds: [] }))}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-wider"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Recipient Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Filter eligible users by name, email, department..."
                    value={recipientSearch}
                    onChange={e => setRecipientSearch(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                  <Icon name="search" size={14} className="absolute left-2.5 top-2.5 text-gray-500" />
                </div>

                {/* Recipient Checkbox List */}
                <div className="border border-white/10 rounded-2xl p-2 bg-black/40 max-h-56 overflow-y-auto custom-scrollbar space-y-1">
                  {(() => {
                    const filteredUsers = eligibleUsers.filter(u => {
                      if (!recipientSearch.trim()) return true;
                      const q = recipientSearch.toLowerCase().trim();
                      return (
                        u.name.toLowerCase().includes(q) ||
                        (u.email || '').toLowerCase().includes(q) ||
                        (u.department || '').toLowerCase().includes(q) ||
                        (u.branchName || '').toLowerCase().includes(q)
                      );
                    });

                    if (filteredUsers.length === 0) {
                      return (
                        <p className="text-center py-6 text-xs text-gray-500">
                          No eligible active users match the search filter.
                        </p>
                      );
                    }

                    return filteredUsers.map(u => {
                      const isChecked = policyForm.recipientUserIds.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => {
                            if (!canEditPolicies) return;
                            setPolicyForm(prev => {
                              const exists = prev.recipientUserIds.includes(u.id);
                              return {
                                ...prev,
                                recipientUserIds: exists
                                  ? prev.recipientUserIds.filter(id => id !== u.id)
                                  : [...prev.recipientUserIds, u.id]
                              };
                            });
                          }}
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-purple-900/20 border-purple-500/40 text-white'
                              : 'bg-black/20 border-white/5 hover:bg-white/5 text-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              className="rounded border-gray-700 text-purple-600 focus:ring-purple-600 bg-black/50 pointer-events-none"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-white">{u.name}</span>
                                <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-1.5 rounded">
                                  {u.id}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                <span>{u.email}</span>
                                {u.department && <span>• {u.department}</span>}
                                {u.branchName && <span>• {u.branchName}</span>}
                              </div>
                            </div>
                          </div>

                          <span className={`text-[10px] font-black uppercase font-mono px-2 py-0.5 rounded ${
                            isChecked ? 'bg-purple-500/20 text-purple-300' : 'text-gray-600'
                          }`}>
                            {isChecked ? 'RECIPIENT' : 'EXCLUDED'}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
                <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono px-1">
                  <span>Selected: <strong>{policyForm.recipientUserIds.length}</strong> of {eligibleUsers.length} active users</span>
                  {policyForm.recipientUserIds.length === 0 && (
                    <span className="text-amber-400 font-bold">⚠️ Warning: No recipients selected</span>
                  )}
                </div>
              </div>

              {/* Coalescing Settings */}
              <div className="space-y-3 bg-black/40 border border-white/5 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-white">Event Coalescing</label>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Combines repeated notifications of the same event into a single card with a multiplier badge (e.g. ×3).
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canEditPolicies}
                    onClick={() => setPolicyForm(prev => ({
                      ...prev,
                      coalesceEnabled: !prev.coalesceEnabled,
                      coalesceWindowMinutes: !prev.coalesceEnabled ? (prev.coalesceWindowMinutes || 60) : 0
                    }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      policyForm.coalesceEnabled
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                        : 'bg-white/10 text-gray-400'
                    }`}
                  >
                    {policyForm.coalesceEnabled ? 'Coalescing ON' : 'Coalescing OFF'}
                  </button>
                </div>

                {policyForm.coalesceEnabled && (
                  <div className="space-y-1.5 pt-2 border-t border-white/5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Coalescing Window Duration
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {[15, 30, 60, 120, 1440].map(mins => (
                        <button
                          key={mins}
                          type="button"
                          disabled={!canEditPolicies}
                          onClick={() => setPolicyForm(prev => ({ ...prev, coalesceWindowMinutes: mins }))}
                          className={`py-2 rounded-xl text-xs font-black font-mono transition-all border ${
                            policyForm.coalesceWindowMinutes === mins
                              ? 'bg-purple-600 text-white border-purple-400 shadow'
                              : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
                          }`}
                        >
                          {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10 shrink-0">
                <button
                  type="button"
                  disabled={!canEditPolicies || isSavingPolicy}
                  onClick={async () => {
                    if (!canEditPolicies || !editingPolicy) return;
                    if (!window.confirm('Reset this event policy to canonical defaults?')) return;
                    await notificationPolicyService.resetPolicy(editingPolicy.eventId);
                    setEditingPolicy(null);
                    setPolicyNotice({
                      type: 'info',
                      message: `Policy for ${editingPolicy.eventName} reset to canonical defaults.`
                    });
                  }}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-black uppercase rounded-xl transition-all"
                >
                  Reset to Default
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPolicy(null)}
                    className="px-4 py-2 bg-white/10 text-gray-300 text-xs font-bold rounded-xl hover:bg-white/20"
                  >
                    Cancel
                  </button>
                  {canEditPolicies && (
                    <button
                      type="submit"
                      disabled={isSavingPolicy}
                      className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase rounded-xl shadow-lg shadow-purple-600/30 flex items-center gap-2"
                    >
                      {isSavingPolicy ? <Icon name="refresh-cw" size={14} className="animate-spin" /> : <Icon name="check" size={14} />}
                      <span>Save Policy</span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
