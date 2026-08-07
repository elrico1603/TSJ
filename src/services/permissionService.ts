import { db, APP_ID_PATH } from '../firebase';
import {
  PermissionAction,
  PermissionCategory,
  RoleDefinition,
  RolePermissions,
  UserRoleAssignment,
  RoleAuditLogEntry
} from '../types';

const STORAGE_ROLES_KEY = 'tsj_roles_v1';
const STORAGE_ROLE_PERMISSIONS_KEY = 'tsj_role_permissions_v1';
const STORAGE_USER_ROLES_KEY = 'tsj_user_roles_v1';
const STORAGE_ROLE_AUDIT_LOGS_KEY = 'tsj_role_audit_logs_v1';

export const ALL_PERMISSION_ACTIONS: PermissionAction[] = [
  'View',
  'Create',
  'Edit',
  'Delete',
  'Approve',
  'Print',
  'Export'
];

export interface ModuleCategoryGroup {
  category: PermissionCategory;
  modules: string[];
}

export const PERMISSION_CATEGORIES_CONFIG: ModuleCategoryGroup[] = [
  {
    category: 'SYSTEM ADMINISTRATION',
    modules: [
      'Company Information',
      'Branch Management',
      'User Assignments',
      'Version Management',
      'Roles & Permissions',
      'System Audit Log'
    ]
  },
  {
    category: 'EMPLOYEE MANAGEMENT',
    modules: [
      'Employer Registration',
      'Clocking',
      'Leave Management',
      'Work Analytics',
      'Historical Logs',
      'Generate Reports',
      'Archive Profiles'
    ]
  },
  {
    category: 'KANBAN',
    modules: [
      'Kanban Designer',
      'Product Master',
      'Print Templates',
      'QR Generation'
    ]
  },
  {
    category: 'PROCUREMENT',
    modules: [
      'QR Scan Service',
      'Basket',
      'Stock Requests',
      'Purchase Orders',
      'Goods Receiving',
      'Inventory',
      'Inventory Adjustments'
    ]
  },
  {
    category: 'REPORTS',
    modules: [
      'Dashboard',
      'Reports',
      'Exports',
      'Print'
    ]
  },
  {
    category: 'SETTINGS',
    modules: [
      'Notifications',
      'Email Templates',
      'System Settings'
    ]
  }
];

export const ALL_MODULE_NAMES: string[] = PERMISSION_CATEGORIES_CONFIG.flatMap(c => c.modules);

// Helper to construct full true actions matrix
const fullAccessMatrix = (): Record<string, Record<PermissionAction, boolean>> => {
  const matrix: Record<string, Record<PermissionAction, boolean>> = {};
  ALL_MODULE_NAMES.forEach(mod => {
    matrix[mod] = {
      View: true,
      Create: true,
      Edit: true,
      Delete: true,
      Approve: true,
      Print: true,
      Export: true
    };
  });
  return matrix;
};

// Helper for restricted matrix
const customMatrix = (allowedModules: string[], actions: PermissionAction[] = ['View']): Record<string, Record<PermissionAction, boolean>> => {
  const matrix: Record<string, Record<PermissionAction, boolean>> = {};
  ALL_MODULE_NAMES.forEach(mod => {
    const isAllowed = allowedModules.includes(mod);
    matrix[mod] = {
      View: isAllowed && actions.includes('View'),
      Create: isAllowed && actions.includes('Create'),
      Edit: isAllowed && actions.includes('Edit'),
      Delete: isAllowed && actions.includes('Delete'),
      Approve: isAllowed && actions.includes('Approve'),
      Print: isAllowed && actions.includes('Print'),
      Export: isAllowed && actions.includes('Export')
    };
  });
  return matrix;
};

// DEFAULT ROLES DEFINITIONS
export const DEFAULT_ROLES: RoleDefinition[] = [
  {
    id: 'ROLE-ADMIN',
    roleName: 'Administrator',
    description: 'Full administrative access to all modules, settings, roles, permissions, and security controls.',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isSystemDefault: true
  },
  {
    id: 'ROLE-MANAGER',
    roleName: 'Manager',
    description: 'Managerial access across operations, employee logs, procurement, and reports with approval authority.',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isSystemDefault: true
  },
  {
    id: 'ROLE-PURCHASING',
    roleName: 'Purchasing',
    description: 'Procurement specialist role for managing stock requests, purchase orders, basket, and goods receiving.',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isSystemDefault: true
  },
  {
    id: 'ROLE-STOCK-MGR',
    roleName: 'Stock Manager',
    description: 'Inventory control role managing stock levels, QR scanning, adjustments, and product master data.',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isSystemDefault: true
  },
  {
    id: 'ROLE-SUPERVISOR',
    roleName: 'Supervisor',
    description: 'Operational supervisor monitoring staff clocking, approving leave requests, and requesting stock.',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isSystemDefault: true
  },
  {
    id: 'ROLE-CLOCKING-TERMINAL',
    roleName: 'Clocking Terminal',
    description: 'Shared reception/locker-room terminal account with access restricted strictly to Clocking Terminal, Employee Search, Leave Application, and QR Scanner.',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isSystemDefault: true
  },
  {
    id: 'ROLE-EMPLOYEE',
    roleName: 'Employee',
    description: 'Standard employee account for viewing dashboard, time clocking, and leave requests.',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isSystemDefault: true
  },
  {
    id: 'ROLE-VIEWER',
    roleName: 'Viewer',
    description: 'Read-only role with view permissions for dashboards, reports, and non-sensitive operational data.',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isSystemDefault: true
  }
];

// DEFAULT PERMISSIONS PER ROLE
export const DEFAULT_ROLE_PERMISSIONS: Record<string, RolePermissions> = {
  'ROLE-ADMIN': {
    roleId: 'ROLE-ADMIN',
    roleName: 'Administrator',
    permissions: fullAccessMatrix(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'System'
  },
  'ROLE-CLOCKING-TERMINAL': {
    roleId: 'ROLE-CLOCKING-TERMINAL',
    roleName: 'Clocking Terminal',
    permissions: customMatrix(
      ['Clocking', 'Leave Management', 'Employer Registration', 'QR Scan Service'],
      ['View', 'Create']
    ),
    updatedAt: new Date().toISOString(),
    updatedBy: 'System'
  },
  'ROLE-MANAGER': {
    roleId: 'ROLE-MANAGER',
    roleName: 'Manager',
    permissions: customMatrix(
      [
        'Company Information', 'Branch Management', 'User Assignments', 'Version Management',
        'Employer Registration', 'Clocking', 'Leave Management', 'Work Analytics', 'Historical Logs', 'Generate Reports',
        'Kanban Designer', 'Product Master', 'Print Templates', 'QR Generation',
        'QR Scan Service', 'Basket', 'Stock Requests', 'Purchase Orders', 'Goods Receiving', 'Inventory', 'Inventory Adjustments',
        'Dashboard', 'Reports', 'Exports', 'Print', 'Notifications', 'System Settings'
      ],
      ['View', 'Create', 'Edit', 'Approve', 'Print', 'Export']
    ),
    updatedAt: new Date().toISOString(),
    updatedBy: 'System'
  },
  'ROLE-PURCHASING': {
    roleId: 'ROLE-PURCHASING',
    roleName: 'Purchasing',
    permissions: customMatrix(
      ['Basket', 'Stock Requests', 'Purchase Orders', 'Goods Receiving', 'Inventory', 'QR Scan Service', 'Dashboard', 'Reports', 'Print', 'Export'],
      ['View', 'Create', 'Edit', 'Approve', 'Print', 'Export']
    ),
    updatedAt: new Date().toISOString(),
    updatedBy: 'System'
  },
  'ROLE-STOCK-MGR': {
    roleId: 'ROLE-STOCK-MGR',
    roleName: 'Stock Manager',
    permissions: customMatrix(
      ['Product Master', 'QR Generation', 'QR Scan Service', 'Stock Requests', 'Goods Receiving', 'Inventory', 'Inventory Adjustments', 'Dashboard', 'Print'],
      ['View', 'Create', 'Edit', 'Delete', 'Print']
    ),
    updatedAt: new Date().toISOString(),
    updatedBy: 'System'
  },
  'ROLE-SUPERVISOR': {
    roleId: 'ROLE-SUPERVISOR',
    roleName: 'Supervisor',
    permissions: customMatrix(
      ['Clocking', 'Leave Management', 'Work Analytics', 'Historical Logs', 'Generate Reports', 'Stock Requests', 'Kanban Designer', 'Dashboard', 'Print'],
      ['View', 'Create', 'Edit', 'Approve', 'Print']
    ),
    updatedAt: new Date().toISOString(),
    updatedBy: 'System'
  },
  'ROLE-EMPLOYEE': {
    roleId: 'ROLE-EMPLOYEE',
    roleName: 'Employee',
    permissions: customMatrix(
      ['Clocking', 'Leave Management', 'Dashboard', 'Notifications'],
      ['View', 'Create']
    ),
    updatedAt: new Date().toISOString(),
    updatedBy: 'System'
  },
  'ROLE-VIEWER': {
    roleId: 'ROLE-VIEWER',
    roleName: 'Viewer',
    permissions: customMatrix(
      ['Dashboard', 'Work Analytics', 'Historical Logs', 'Product Master', 'Inventory', 'Reports'],
      ['View']
    ),
    updatedAt: new Date().toISOString(),
    updatedBy: 'System'
  }
};

export const permissionService = {
  // Local storage helpers
  getLocalRoles(): RoleDefinition[] {
    try {
      const data = localStorage.getItem(STORAGE_ROLES_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse local roles:', e);
    }
    return DEFAULT_ROLES;
  },

  saveLocalRoles(roles: RoleDefinition[]): void {
    try {
      localStorage.setItem(STORAGE_ROLES_KEY, JSON.stringify(roles));
    } catch (e) {
      console.warn('Failed to save local roles:', e);
    }
  },

  getLocalRolePermissions(): Record<string, RolePermissions> {
    try {
      const data = localStorage.getItem(STORAGE_ROLE_PERMISSIONS_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse local role permissions:', e);
    }
    return DEFAULT_ROLE_PERMISSIONS;
  },

  saveLocalRolePermissions(permissionsMap: Record<string, RolePermissions>): void {
    try {
      localStorage.setItem(STORAGE_ROLE_PERMISSIONS_KEY, JSON.stringify(permissionsMap));
    } catch (e) {
      console.warn('Failed to save local role permissions:', e);
    }
  },

  getLocalUserRoles(): Record<string, UserRoleAssignment> {
    try {
      const data = localStorage.getItem(STORAGE_USER_ROLES_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse local user roles:', e);
    }
    return {};
  },

  saveLocalUserRoles(userRoles: Record<string, UserRoleAssignment>): void {
    try {
      localStorage.setItem(STORAGE_USER_ROLES_KEY, JSON.stringify(userRoles));
    } catch (e) {
      console.warn('Failed to save local user roles:', e);
    }
  },

  getLocalAuditLogs(): RoleAuditLogEntry[] {
    try {
      const data = localStorage.getItem(STORAGE_ROLE_AUDIT_LOGS_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse local role audit logs:', e);
    }
    return [];
  },

  saveLocalAuditLogs(logs: RoleAuditLogEntry[]): void {
    try {
      localStorage.setItem(STORAGE_ROLE_AUDIT_LOGS_KEY, JSON.stringify(logs));
    } catch (e) {
      console.warn('Failed to save local role audit logs:', e);
    }
  },

  // Central Permission Check Engine
  hasPermission(
    user: any,
    moduleName: string,
    action: PermissionAction = 'View'
  ): boolean {
    if (!user) return false;

    // Administrators always have full permissions
    if (user.role === 'Admin' || user.role === 'Administrator') return true;

    // Retrieve user assigned roleId or match by role name
    const userRoles = this.getLocalUserRoles();
    const assigned = userRoles[user.id];
    let roleId = assigned?.roleId;

    if (!roleId) {
      // Find default matching role by roleName
      const roles = this.getLocalRoles();
      const matched = roles.find(r => r.roleName.toLowerCase() === (user.role || '').toLowerCase());
      if (matched) roleId = matched.id;
    }

    if (!roleId) {
      // Fallback matching logic for standard roles
      if (user.role === 'Manager') roleId = 'ROLE-MANAGER';
      else if (user.role === 'Purchasing') roleId = 'ROLE-PURCHASING';
      else if (user.role === 'Stock Manager') roleId = 'ROLE-STOCK-MGR';
      else if (user.role === 'Supervisor') roleId = 'ROLE-SUPERVISOR';
      else if (user.role === 'Employee') roleId = 'ROLE-EMPLOYEE';
      else if (user.role === 'Viewer') roleId = 'ROLE-VIEWER';
      else return false;
    }

    const allPermissions = this.getLocalRolePermissions();
    const rolePerms = allPermissions[roleId];

    if (!rolePerms || !rolePerms.permissions[moduleName]) {
      return false;
    }

    return !!rolePerms.permissions[moduleName][action];
  },

  // Audit Log Entry Logger
  async logAudit(administrator: string, action: string, previousValue: string, newValue: string): Promise<RoleAuditLogEntry> {
    const now = new Date();
    const entry: RoleAuditLogEntry = {
      id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0],
      administrator: administrator || 'System Admin',
      action,
      previousValue,
      newValue
    };

    const logs = this.getLocalAuditLogs();
    const updated = [entry, ...logs];
    this.saveLocalAuditLogs(updated);

    if (db && APP_ID_PATH) {
      try {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('private')
          .doc('role_audit_logs')
          .collection('items')
          .doc(entry.id)
          .set(entry);

        await db.collection('role_audit_logs').doc(entry.id).set(entry);
      } catch (e) {
        console.warn('Firebase logAudit sync error:', e);
      }
    }

    return entry;
  },

  // ================= ROLE CRUD operations =================
  async createRole(roleData: { roleName: string; description: string }, adminName: string): Promise<RoleDefinition> {
    const roles = this.getLocalRoles();
    const newRole: RoleDefinition = {
      id: `ROLE-${Date.now().toString().slice(-5)}`,
      roleName: roleData.roleName.trim(),
      description: roleData.description.trim(),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSystemDefault: false
    };

    const updatedRoles = [...roles, newRole];
    this.saveLocalRoles(updatedRoles);

    // Initialize blank permissions matrix for new role
    const allPermsMap = this.getLocalRolePermissions();
    const blankMatrix: Record<string, Record<PermissionAction, boolean>> = {};
    ALL_MODULE_NAMES.forEach(mod => {
      blankMatrix[mod] = {
        View: false,
        Create: false,
        Edit: false,
        Delete: false,
        Approve: false,
        Print: false,
        Export: false
      };
    });

    const newRolePerms: RolePermissions = {
      roleId: newRole.id,
      roleName: newRole.roleName,
      permissions: blankMatrix,
      updatedAt: new Date().toISOString(),
      updatedBy: adminName
    };

    allPermsMap[newRole.id] = newRolePerms;
    this.saveLocalRolePermissions(allPermsMap);

    if (db && APP_ID_PATH) {
      try {
        await db.collection('roles').doc(newRole.id).set(newRole);
        await db.collection('rolePermissions').doc(newRole.id).set(newRolePerms);

        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('roles').collection('items').doc(newRole.id).set(newRole);
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('rolePermissions').collection('items').doc(newRole.id).set(newRolePerms);
      } catch (e) {
        console.warn('Firebase createRole error:', e);
      }
    }

    await this.logAudit(adminName, 'Role Created', 'None', `Created role "${newRole.roleName}" (${newRole.id})`);
    return newRole;
  },

  async updateRole(roleId: string, updates: Partial<RoleDefinition>, adminName: string): Promise<RoleDefinition | null> {
    const roles = this.getLocalRoles();
    const idx = roles.findIndex(r => r.id === roleId);
    if (idx === -1) return null;

    const prevRole = roles[idx];
    const updatedRole: RoleDefinition = {
      ...prevRole,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    roles[idx] = updatedRole;
    this.saveLocalRoles(roles);

    if (db && APP_ID_PATH) {
      try {
        await db.collection('roles').doc(roleId).set(updatedRole, { merge: true });
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('roles').collection('items').doc(roleId).set(updatedRole, { merge: true });
      } catch (e) {
        console.warn('Firebase updateRole error:', e);
      }
    }

    await this.logAudit(
      adminName,
      'Role Edited',
      `Name: ${prevRole.roleName}, Status: ${prevRole.status}`,
      `Name: ${updatedRole.roleName}, Status: ${updatedRole.status}`
    );

    return updatedRole;
  },

  async duplicateRole(roleId: string, newRoleName: string, adminName: string): Promise<RoleDefinition | null> {
    const roles = this.getLocalRoles();
    const sourceRole = roles.find(r => r.id === roleId);
    if (!sourceRole) return null;

    const allPermsMap = this.getLocalRolePermissions();
    const sourcePerms = allPermsMap[roleId];

    const duplicatedRole: RoleDefinition = {
      id: `ROLE-${Date.now().toString().slice(-5)}`,
      roleName: newRoleName.trim(),
      description: `Copy of ${sourceRole.roleName}. ${sourceRole.description}`,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSystemDefault: false
    };

    const updatedRoles = [...roles, duplicatedRole];
    this.saveLocalRoles(updatedRoles);

    const duplicatedPerms: RolePermissions = {
      roleId: duplicatedRole.id,
      roleName: duplicatedRole.roleName,
      permissions: sourcePerms ? JSON.parse(JSON.stringify(sourcePerms.permissions)) : customMatrix([]),
      updatedAt: new Date().toISOString(),
      updatedBy: adminName
    };

    allPermsMap[duplicatedRole.id] = duplicatedPerms;
    this.saveLocalRolePermissions(allPermsMap);

    if (db && APP_ID_PATH) {
      try {
        await db.collection('roles').doc(duplicatedRole.id).set(duplicatedRole);
        await db.collection('rolePermissions').doc(duplicatedRole.id).set(duplicatedPerms);

        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('roles').collection('items').doc(duplicatedRole.id).set(duplicatedRole);
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('rolePermissions').collection('items').doc(duplicatedRole.id).set(duplicatedPerms);
      } catch (e) {
        console.warn('Firebase duplicateRole error:', e);
      }
    }

    await this.logAudit(adminName, 'Role Duplicated', `Source Role: ${sourceRole.roleName}`, `New Role: ${duplicatedRole.roleName}`);
    return duplicatedRole;
  },

  async archiveRole(roleId: string, adminName: string): Promise<RoleDefinition | null> {
    return this.updateRole(roleId, { status: 'archived' }, adminName);
  },

  async restoreRole(roleId: string, adminName: string): Promise<RoleDefinition | null> {
    return this.updateRole(roleId, { status: 'active' }, adminName);
  },

  async deleteRole(roleId: string, adminName: string): Promise<boolean> {
    const roles = this.getLocalRoles();
    const roleToDelete = roles.find(r => r.id === roleId);
    if (!roleToDelete) return false;

    // Prevent deletion of System Default roles
    if (roleToDelete.isSystemDefault) {
      throw new Error('System default roles cannot be deleted. You may archive them instead.');
    }

    const filtered = roles.filter(r => r.id !== roleId);
    this.saveLocalRoles(filtered);

    const allPermsMap = this.getLocalRolePermissions();
    delete allPermsMap[roleId];
    this.saveLocalRolePermissions(allPermsMap);

    if (db && APP_ID_PATH) {
      try {
        await db.collection('roles').doc(roleId).delete();
        await db.collection('rolePermissions').doc(roleId).delete();

        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('roles').collection('items').doc(roleId).delete();
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('rolePermissions').collection('items').doc(roleId).delete();
      } catch (e) {
        console.warn('Firebase deleteRole error:', e);
      }
    }

    await this.logAudit(adminName, 'Role Deleted', `Deleted role "${roleToDelete.roleName}" (${roleId})`, 'Deleted');
    return true;
  },

  // ================= PERMISSION SAVING =================
  async savePermissionsForRole(
    roleId: string,
    permissionsMatrix: Record<string, Record<PermissionAction, boolean>>,
    adminName: string
  ): Promise<RolePermissions> {
    const roles = this.getLocalRoles();
    const role = roles.find(r => r.id === roleId);
    const roleName = role ? role.roleName : 'Unknown Role';

    const allPermsMap = this.getLocalRolePermissions();
    const previous = allPermsMap[roleId] ? JSON.stringify(allPermsMap[roleId].permissions) : 'None';

    const updatedRolePerms: RolePermissions = {
      roleId,
      roleName,
      permissions: permissionsMatrix,
      updatedAt: new Date().toISOString(),
      updatedBy: adminName
    };

    allPermsMap[roleId] = updatedRolePerms;
    this.saveLocalRolePermissions(allPermsMap);

    if (db && APP_ID_PATH) {
      try {
        await db.collection('rolePermissions').doc(roleId).set(updatedRolePerms);
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('rolePermissions').collection('items').doc(roleId).set(updatedRolePerms);
      } catch (e) {
        console.warn('Firebase savePermissionsForRole error:', e);
      }
    }

    await this.logAudit(
      adminName,
      'Permissions Changed',
      `Role: ${roleName}`,
      `Updated permissions matrix for role "${roleName}"`
    );

    return updatedRolePerms;
  },

  // ================= USER ROLE ASSIGNMENTS =================
  async assignUserRole(
    userId: string,
    userName: string,
    userEmail: string,
    roleId: string,
    adminName: string
  ): Promise<UserRoleAssignment> {
    const roles = this.getLocalRoles();
    const targetRole = roles.find(r => r.id === roleId);
    const roleName = targetRole ? targetRole.roleName : 'Viewer';

    const userRoles = this.getLocalUserRoles();
    const previousValue = userRoles[userId] ? `${userRoles[userId].roleName} (${userRoles[userId].roleId})` : 'Default Role';

    const newAssignment: UserRoleAssignment = {
      userId,
      userName,
      userEmail,
      roleId,
      roleName,
      updatedAt: new Date().toISOString()
    };

    userRoles[userId] = newAssignment;
    this.saveLocalUserRoles(userRoles);

    if (db && APP_ID_PATH) {
      try {
        // Sync to userRoles collection in Firebase as requested
        await db.collection('userRoles').doc(userId).set(newAssignment);
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('userRoles').collection('items').doc(userId).set(newAssignment);

        // Also update user active doc in Firestore
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('private')
          .doc('users')
          .collection('active')
          .doc(userId)
          .set({ role: roleName, roleId }, { merge: true });
      } catch (e) {
        console.warn('Firebase assignUserRole error:', e);
      }
    }

    await this.logAudit(
      adminName,
      'User Role Changed',
      `User: ${userName} (${userEmail}), Old Role: ${previousValue}`,
      `New Role: ${roleName} (${roleId})`
    );

    return newAssignment;
  },

  // Subscriptions
  subscribeRoles(callback: (roles: RoleDefinition[]) => void) {
    callback(this.getLocalRoles());

    if (db && APP_ID_PATH) {
      try {
        const unsub = db.collection('roles').onSnapshot(
          snap => {
            if (snap && !snap.empty) {
              const list: RoleDefinition[] = [];
              snap.forEach(d => list.push(d.data() as RoleDefinition));
              this.saveLocalRoles(list);
              callback(list);
            }
          },
          err => console.warn('Roles subscription error:', err)
        );
        return unsub;
      } catch (e) {
        console.warn('Unable to subscribe to roles collection:', e);
      }
    }

    return () => {};
  },

  subscribeRolePermissions(callback: (map: Record<string, RolePermissions>) => void) {
    callback(this.getLocalRolePermissions());

    if (db && APP_ID_PATH) {
      try {
        const unsub = db.collection('rolePermissions').onSnapshot(
          snap => {
            if (snap && !snap.empty) {
              const map: Record<string, RolePermissions> = {};
              snap.forEach(d => {
                const data = d.data() as RolePermissions;
                map[data.roleId] = data;
              });
              this.saveLocalRolePermissions(map);
              callback(map);
            }
          },
          err => console.warn('Role permissions subscription error:', err)
        );
        return unsub;
      } catch (e) {
        console.warn('Unable to subscribe to rolePermissions collection:', e);
      }
    }

    return () => {};
  },

  subscribeUserRoles(callback: (map: Record<string, UserRoleAssignment>) => void) {
    callback(this.getLocalUserRoles());

    if (db && APP_ID_PATH) {
      try {
        const unsub = db.collection('userRoles').onSnapshot(
          snap => {
            if (snap && !snap.empty) {
              const map: Record<string, UserRoleAssignment> = {};
              snap.forEach(d => {
                const data = d.data() as UserRoleAssignment;
                map[data.userId] = data;
              });
              this.saveLocalUserRoles(map);
              callback(map);
            }
          },
          err => console.warn('User roles subscription error:', err)
        );
        return unsub;
      } catch (e) {
        console.warn('Unable to subscribe to userRoles collection:', e);
      }
    }

    return () => {};
  },

  subscribeAuditLogs(callback: (logs: RoleAuditLogEntry[]) => void) {
    callback(this.getLocalAuditLogs());

    if (db && APP_ID_PATH) {
      try {
        const unsub = db.collection('role_audit_logs').onSnapshot(
          snap => {
            if (snap && !snap.empty) {
              const list: RoleAuditLogEntry[] = [];
              snap.forEach(d => list.push(d.data() as RoleAuditLogEntry));
              list.sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());
              this.saveLocalAuditLogs(list);
              callback(list);
            }
          },
          err => console.warn('Role audit logs subscription error:', err)
        );
        return unsub;
      } catch (e) {
        console.warn('Unable to subscribe to role_audit_logs collection:', e);
      }
    }

    return () => {};
  },

  // ================= TS HUB PHASE 2 ROLE & PERMISSION HELPERS =================
  isClockingTerminalUser(user: any): boolean {
    if (!user) return false;
    const role = (user.role || '').trim();
    const email = (user.email || '').trim().toLowerCase();
    return role === 'Clocking Terminal' || role === 'Clocking' || email === 'clocking@tsjoinery.co.za';
  },

  getGreeting(firstName?: string, date: Date = new Date()): string {
    const hour = date.getHours();
    const timeGreeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
    const name = (firstName || '').trim() || 'User';
    return `${timeGreeting}, ${name}`;
  },

  canAccessMode(role: string, mode: string): boolean {
    const normRole = (role || '').trim();
    if (normRole === 'Administrator' || normRole === 'Admin') return true;
    if (normRole === 'Clocking Terminal' || normRole === 'Clocking') {
      return ['clocking_terminal', 'employee', 'leave', 'qr_scan_service'].includes(mode);
    }

    switch (normRole) {
      case 'Manager':
        return ['clocking_terminal', 'admin', 'employee', 'analytics', 'leave', 'qr_scan_service', 'orders'].includes(mode);
      case 'HR':
        return ['clocking_terminal', 'admin', 'employee', 'leave'].includes(mode);
      case 'Purchasing':
        return ['clocking_terminal', 'purchase_orders', 'orders', 'product_master', 'kanban', 'dispatch', 'qr_scan_service'].includes(mode);
      case 'Stock Manager':
        return ['clocking_terminal', 'product_master', 'purchase_orders', 'dispatch', 'qr_scan_service'].includes(mode);
      case 'Supervisor':
        return ['clocking_terminal', 'admin', 'employee', 'analytics', 'leave', 'qr_scan_service'].includes(mode);
      case 'Employee':
      case 'Artisan':
        return ['clocking_terminal', 'employee', 'leave'].includes(mode);
      default:
        return false;
    }
  },

  canAccessView(role: string, viewName: string): boolean {
    const normRole = (role || '').trim();
    if (normRole === 'Administrator' || normRole === 'Admin') return true;
    if (normRole === 'Clocking Terminal' || normRole === 'Clocking') {
      return ['clocking', 'employee_search', 'leave', 'qr_scan', 'personal_pin_entry', 'scanning'].includes(viewName);
    }

    switch (normRole) {
      case 'Manager':
        return ['dashboard', 'attendance', 'leave', 'reports', 'notifications', 'clocking', 'employee_status'].includes(viewName);
      case 'HR':
        return ['employees', 'attendance', 'leave', 'notifications', 'clocking'].includes(viewName);
      case 'Purchasing':
        return ['purchase_orders', 'suppliers', 'qr_ordering', 'warehouse', 'kanban', 'stock_requests', 'product_master', 'notifications'].includes(viewName);
      case 'Employee':
      case 'Artisan':
        return ['emp_home', 'my_profile', 'my_leave', 'clocking_history', 'notifications', 'dashboard', 'clocking'].includes(viewName);
      default:
        return false;
    }
  },

  getInitialModeAndView(user: any): { appMode: string; view: string } {
    // PHASE 2.1 Requirements 4 & 8: Default landing page for ALL authenticated users must be the Clocking Terminal immediately after login.
    return { appMode: 'clocking_terminal', view: 'clocking' };
  },

  getAllowedModesForRole(role: string): string[] {
    const normRole = (role || '').trim();
    if (normRole === 'Administrator' || normRole === 'Admin') {
      return ['clocking_terminal', 'admin', 'employee', 'kanban', 'orders', 'product_master', 'purchase_orders', 'dispatch', 'analytics', 'leave', 'qr_scan_service', 'template_designer', 'system_admin', 'company_settings', 'mobile'];
    }
    if (normRole === 'Clocking Terminal' || normRole === 'Clocking') {
      return ['clocking_terminal'];
    }
    switch (normRole) {
      case 'Manager':
        return ['clocking_terminal', 'admin', 'employee', 'analytics', 'leave', 'qr_scan_service', 'orders'];
      case 'HR':
        return ['clocking_terminal', 'admin', 'employee', 'leave'];
      case 'Purchasing':
        return ['clocking_terminal', 'purchase_orders', 'orders', 'product_master', 'kanban', 'dispatch', 'qr_scan_service'];
      case 'Employee':
      case 'Artisan':
        return ['clocking_terminal', 'employee', 'leave'];
      default:
        return ['clocking_terminal', 'employee'];
    }
  }
};

export default permissionService;
