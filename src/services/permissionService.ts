import { db, APP_ID_PATH } from '../firebase';
import {
  PermissionAction,
  PermissionCategory,
  RoleDefinition,
  RolePermissions,
  UserRoleAssignment,
  RoleAuditLogEntry,
  DeviceInterface,
  UserDeviceAccess,
  UserPermissionOverride,
  EffectiveUserPermissions,
  ModuleDefinition
} from '../types';

const STORAGE_ROLES_KEY = 'tsj_roles_v1';
const STORAGE_ROLE_PERMISSIONS_KEY = 'tsj_role_permissions_v1';
const STORAGE_USER_ROLES_KEY = 'tsj_user_roles_v1';
const STORAGE_USER_OVERRIDES_KEY = 'tsj_user_permission_overrides_v1';
const STORAGE_ROLE_AUDIT_LOGS_KEY = 'tsj_role_audit_logs_v1';

export const ALL_PERMISSION_ACTIONS: PermissionAction[] = [
  'View',
  'Create',
  'Edit',
  'Delete',
  'Approve',
  'Process',
  'Print',
  'Export'
];

export const CENTRAL_MODULE_REGISTRY: ModuleDefinition[] = [
  {
    id: 'clocking',
    name: 'Clocking Terminal / Employee',
    category: 'Operations',
    description: 'Artisan clock in/out, breaks, and personal profile verification.',
    supportsDevices: { phone: true, tablet: true, desktop: true, terminal: true },
    appMode: 'employee',
    icon: 'clock',
    permissionModules: ['Clocking', 'Dashboard']
  },
  {
    id: 'qr_scan',
    name: 'QR Scan Service',
    category: 'Operations',
    description: 'Scanning Kanban QR barcodes for stock transactions, orders, and lookups.',
    supportsDevices: { phone: true, tablet: true, desktop: true, terminal: true },
    appMode: 'qr_scan_service',
    icon: 'scan',
    permissionModules: ['QR Scan Service']
  },
  {
    id: 'dispatch',
    name: 'Dispatch & Receiving',
    category: 'Logistics',
    description: 'Outbound waybills, delivery notes, receiving inspections, and depot transfers.',
    supportsDevices: { phone: true, tablet: true, desktop: true, terminal: false },
    appMode: 'dispatch',
    icon: 'truck',
    permissionModules: ['Dispatch Creation', 'Receiving Inspection', 'Discrepancy Management', 'Waybills & Delivery Notes']
  },
  {
    id: 'product_master',
    name: 'Product Master',
    category: 'Management',
    description: 'Master catalog of joinery items, SKU numbers, specs, and default suppliers.',
    supportsDevices: { phone: false, tablet: true, desktop: true, terminal: false },
    appMode: 'product_master',
    icon: 'box',
    permissionModules: ['Product Master', 'QR Generation']
  },
  {
    id: 'purchase_orders',
    name: 'Purchase Orders',
    category: 'Procurement',
    description: 'Formal supplier purchase orders, PO tracking, approvals, and goods receiving.',
    supportsDevices: { phone: false, tablet: true, desktop: true, terminal: false },
    appMode: 'purchase_orders',
    icon: 'file-text',
    permissionModules: ['Purchase Orders', 'Goods Receiving', 'Stock Requests']
  },
  {
    id: 'orders',
    name: 'Procurement & Orders',
    category: 'Procurement',
    description: 'Direct procurement stock requests, replenishment, and reorder basket.',
    supportsDevices: { phone: true, tablet: true, desktop: true, terminal: false },
    appMode: 'orders',
    icon: 'banknote',
    permissionModules: ['Inventory', 'Basket', 'Stock Requests']
  },
  {
    id: 'kanban',
    name: 'Kanban Designer',
    category: 'Management',
    description: 'Custom visual card designer, template management, and PDF print exports.',
    supportsDevices: { phone: true, tablet: true, desktop: true, terminal: false },
    appMode: 'template_designer',
    icon: 'layout-template',
    permissionModules: ['Kanban Designer', 'Print Templates']
  },
  {
    id: 'admin',
    name: 'Employer Registration',
    category: 'Management',
    description: 'Artisan enrollment, personal details, tax/UIF, and profile archives.',
    supportsDevices: { phone: true, tablet: true, desktop: true, terminal: false },
    appMode: 'admin',
    icon: 'users',
    permissionModules: ['Employer Registration', 'Archive Profiles']
  },
  {
    id: 'analytics',
    name: 'Work Analytics',
    category: 'Management',
    description: 'Shift durations, overtime computations, attendance KPIs, and audit exports.',
    supportsDevices: { phone: true, tablet: true, desktop: true, terminal: false },
    appMode: 'analytics',
    icon: 'bar-chart-3',
    permissionModules: ['Work Analytics', 'Generate Reports', 'Historical Logs']
  },
  {
    id: 'leave',
    name: 'Leave Management',
    category: 'Operations',
    description: 'Staff leave applications, sick/annual balances, and supervisor approvals.',
    supportsDevices: { phone: true, tablet: true, desktop: true, terminal: true },
    appMode: 'leave',
    icon: 'calendar',
    permissionModules: ['Leave Management']
  },
  {
    id: 'gemini_ai',
    name: 'Gemini AI Hub',
    category: 'Intelligence',
    description: 'Intelligent AI assistant for workshop assistance, stock analytics, and summaries.',
    supportsDevices: { phone: true, tablet: true, desktop: true, terminal: false },
    appMode: 'gemini_chat',
    icon: 'bot',
    permissionModules: []
  },
  {
    id: 'system_admin',
    name: 'System Administration',
    category: 'System',
    description: 'User access controls, role definitions, security policies, and audit logs.',
    supportsDevices: { phone: false, tablet: true, desktop: true, terminal: false },
    appMode: 'system_admin',
    icon: 'shield',
    permissionModules: ['Roles & Permissions', 'System Audit Log', 'User Assignments']
  },
  {
    id: 'company_settings',
    name: 'Company Settings',
    category: 'System',
    description: 'Company information, branch/depot structure, and software version history.',
    supportsDevices: { phone: false, tablet: true, desktop: true, terminal: false },
    appMode: 'company_settings',
    icon: 'building',
    permissionModules: ['Company Information', 'Branch Management', 'Version Management']
  }
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
    category: 'DISPATCH & RECEIVING',
    modules: [
      'Dispatch Creation',
      'Receiving Inspection',
      'Discrepancy Management',
      'Waybills & Delivery Notes'
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
      Process: true,
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
      Process: isAllowed && actions.includes('Process'),
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
    description: 'Full administrative access to all modules, settings, roles, permissions, and security controls across all devices.',
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
    description: 'Operational supervisor monitoring staff clocking, approving leave requests, requesting stock, and dispatch/receiving oversight.',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isSystemDefault: true
  },
  {
    id: 'ROLE-CLOCKING-TERMINAL',
    roleName: 'Clocking Terminal',
    description: 'Dedicated reception/locker-room terminal account with access restricted strictly to Clocking Terminal, Employee Search, Leave Application, and QR Scanner.',
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
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System'
  },
  'ROLE-CLOCKING-TERMINAL': {
    roleId: 'ROLE-CLOCKING-TERMINAL',
    roleName: 'Clocking Terminal',
    permissions: customMatrix(
      ['Clocking', 'Leave Management', 'Employer Registration', 'QR Scan Service'],
      ['View', 'Create']
    ),
    updatedAt: '2026-01-01T00:00:00.000Z',
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
        'Dispatch Creation', 'Receiving Inspection', 'Discrepancy Management', 'Waybills & Delivery Notes',
        'Dashboard', 'Reports', 'Exports', 'Print', 'Notifications', 'System Settings'
      ],
      ['View', 'Create', 'Edit', 'Approve', 'Print', 'Export']
    ),
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System'
  },
  'ROLE-PURCHASING': {
    roleId: 'ROLE-PURCHASING',
    roleName: 'Purchasing',
    permissions: customMatrix(
      [
        'Basket', 'Stock Requests', 'Purchase Orders', 'Goods Receiving', 'Inventory', 'QR Scan Service',
        'Dispatch Creation', 'Receiving Inspection', 'Discrepancy Management', 'Waybills & Delivery Notes',
        'Dashboard', 'Reports', 'Print', 'Export'
      ],
      ['View', 'Create', 'Edit', 'Approve', 'Print', 'Export']
    ),
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System'
  },
  'ROLE-STOCK-MGR': {
    roleId: 'ROLE-STOCK-MGR',
    roleName: 'Stock Manager',
    permissions: customMatrix(
      [
        'Product Master', 'QR Generation', 'QR Scan Service', 'Stock Requests', 'Goods Receiving', 'Inventory', 'Inventory Adjustments',
        'Dispatch Creation', 'Receiving Inspection', 'Discrepancy Management', 'Waybills & Delivery Notes',
        'Dashboard', 'Print'
      ],
      ['View', 'Create', 'Edit', 'Delete', 'Print']
    ),
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System'
  },
  'ROLE-SUPERVISOR': {
    roleId: 'ROLE-SUPERVISOR',
    roleName: 'Supervisor',
    permissions: customMatrix(
      [
        'Clocking', 'Leave Management', 'Work Analytics', 'Historical Logs', 'Generate Reports', 'Stock Requests', 'Kanban Designer',
        'Dispatch Creation', 'Receiving Inspection', 'Discrepancy Management', 'Waybills & Delivery Notes',
        'Dashboard', 'Print'
      ],
      ['View', 'Create', 'Edit', 'Approve', 'Print']
    ),
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System'
  },
  'ROLE-EMPLOYEE': {
    roleId: 'ROLE-EMPLOYEE',
    roleName: 'Employee',
    permissions: customMatrix(
      ['Clocking', 'Leave Management', 'Dashboard', 'Notifications'],
      ['View', 'Create']
    ),
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System'
  },
  'ROLE-VIEWER': {
    roleId: 'ROLE-VIEWER',
    roleName: 'Viewer',
    permissions: customMatrix(
      ['Dashboard', 'Work Analytics', 'Historical Logs', 'Product Master', 'Inventory', 'Dispatch Creation', 'Receiving Inspection', 'Waybills & Delivery Notes', 'Reports'],
      ['View']
    ),
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System'
  }
};

// DEFAULT USER OVERRIDES
// Evaluated deterministically via Explicit User Overrides in the RBAC pipeline
export const DEFAULT_USER_OVERRIDES: Record<string, UserPermissionOverride> = {
  'juan@tsjoinery.co.za': {
    userId: 'usr-depot-juan',
    userEmail: 'juan@tsjoinery.co.za',
    branchId: 'BFN-01',
    branchName: 'Bloemfontein Central',
    physicalLocation: 'Cape Town',
    deviceAccess: {
      desktop: true,
      phone: true,
      tablet: false,
      terminal: false
    },
    deviceViewAccess: {
      phone: {
        dispatch: true,
        clocking: false,
        leave: false
      },
      tablet: {
        dispatch: false,
        clocking: false,
        leave: false
      },
      desktop: {
        dispatch: true,
        clocking: true,
        leave: true,
        analytics: true
      }
    },
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System'
  }
};

export interface AuthorizedNavItem {
  id: string;
  label: string;
  icon: string;
  appMode: string;
  view?: string;
  badge?: number;
  category?: string;
}

export const permissionService = {
  // ================= STORAGE HELPERS =================
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

  getLocalUserOverrides(): Record<string, UserPermissionOverride> {
    try {
      const data = localStorage.getItem(STORAGE_USER_OVERRIDES_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        const merged: Record<string, UserPermissionOverride> = { ...DEFAULT_USER_OVERRIDES };
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            const ov = v as UserPermissionOverride;
            if (!ov) continue;
            const email = ov.userEmail?.toLowerCase().trim();
            const uid = ov.userId;
            // Purge default placeholder key if a newer override exists for this user
            if (email && merged[email] && (!merged[email].updatedAt || (ov.updatedAt && ov.updatedAt >= merged[email].updatedAt))) {
              delete merged[email];
            }
            if (uid && merged[uid] && (!merged[uid].updatedAt || (ov.updatedAt && ov.updatedAt >= merged[uid].updatedAt))) {
              delete merged[uid];
            }
            merged[k] = ov;
          }
        }
        return merged;
      }
    } catch (e) {
      console.warn('Failed to parse local user overrides:', e);
    }
    return { ...DEFAULT_USER_OVERRIDES };
  },

  saveLocalUserOverrides(overrides: Record<string, UserPermissionOverride>): void {
    try {
      localStorage.setItem(STORAGE_USER_OVERRIDES_KEY, JSON.stringify(overrides));
    } catch (e) {
      console.warn('Failed to save local user overrides:', e);
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

  // Retrieve user override record by userId or email
  getUserOverride(userIdOrEmail: string): UserPermissionOverride | null {
    if (!userIdOrEmail) return null;
    const cleanKey = userIdOrEmail.toLowerCase().trim();
    const overrides = this.getLocalUserOverrides();

    // Priority 1: Direct key lookup
    if (overrides[cleanKey]) return overrides[cleanKey];
    if (overrides[userIdOrEmail]) return overrides[userIdOrEmail];

    // Priority 2: Scan for matching entries, choosing the most recently updated
    let bestMatch: UserPermissionOverride | null = null;
    for (const ov of Object.values(overrides)) {
      const overrideObj = ov as UserPermissionOverride;
      if (!overrideObj) continue;
      const matches =
        overrideObj.userEmail?.toLowerCase().trim() === cleanKey ||
        overrideObj.userId?.toLowerCase().trim() === cleanKey ||
        overrideObj.userId === userIdOrEmail;

      if (matches) {
        if (!bestMatch) {
          bestMatch = overrideObj;
        } else {
          const prevTime = bestMatch.updatedAt ? new Date(bestMatch.updatedAt).getTime() : 0;
          const currTime = overrideObj.updatedAt ? new Date(overrideObj.updatedAt).getTime() : 0;
          if (currTime >= prevTime) {
            bestMatch = overrideObj;
          }
        }
      }
    }
    return bestMatch;
  },

  // Central Module Registry helpers
  getCentralModules(): ModuleDefinition[] {
    return CENTRAL_MODULE_REGISTRY;
  },

  getModulesForDevice(deviceContext: DeviceInterface = 'desktop'): ModuleDefinition[] {
    return CENTRAL_MODULE_REGISTRY.filter(m => m.supportsDevices[deviceContext]);
  },

  // Save or update an explicit user permission override
  async saveUserOverride(override: UserPermissionOverride, adminName: string = 'Administrator'): Promise<UserPermissionOverride> {
    const overrides = this.getLocalUserOverrides();
    const emailKey = (override.userEmail || '').toLowerCase().trim();
    const idKey = (override.userId || '').trim();
    const primaryKey = emailKey || idKey;

    const updated: UserPermissionOverride = {
      ...override,
      userEmail: emailKey,
      userId: idKey || override.userId,
      updatedAt: new Date().toISOString(),
      updatedBy: adminName || 'System Admin'
    };

    // Remove any stale entries for this user
    for (const k of Object.keys(overrides)) {
      const ov = overrides[k];
      if (
        (emailKey && (k.toLowerCase() === emailKey || ov?.userEmail?.toLowerCase() === emailKey)) ||
        (idKey && (k === idKey || ov?.userId === idKey))
      ) {
        delete overrides[k];
      }
    }

    // Save under primary key and alias
    if (primaryKey) overrides[primaryKey] = updated;
    if (idKey && idKey !== primaryKey) overrides[idKey] = updated;

    this.saveLocalUserOverrides(overrides);

    await this.logAudit(
      adminName,
      `USER_PERMISSION_OVERRIDE_SAVED`,
      `User ${override.userEmail}`,
      JSON.stringify({
        deviceAccess: override.deviceAccess,
        deviceViewAccess: override.deviceViewAccess,
        permissionsCount: Object.keys(override.permissions || {}).length
      })
    );

    if (db && APP_ID_PATH) {
      try {
        const batch = [
          db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('userPermissionOverrides').collection('items').doc(primaryKey).set(updated),
          db.collection('userPermissionOverrides').doc(primaryKey).set(updated)
        ];
        if (idKey && idKey !== primaryKey) {
          batch.push(db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('userPermissionOverrides').collection('items').doc(idKey).set(updated));
          batch.push(db.collection('userPermissionOverrides').doc(idKey).set(updated));
        }
        await Promise.allSettled(batch);
      } catch (e) {
        console.warn('Firebase userPermissionOverrides sync error:', e);
      }
    }

    return updated;
  },

  async setUserOverride(override: UserPermissionOverride): Promise<UserPermissionOverride> {
    return this.saveUserOverride(override, override.updatedBy || 'Administrator');
  },

  // ================= DEVICE CONTEXT EVALUATION =================
  canAccessDevice(user: any, deviceContext?: DeviceInterface): boolean {
    if (!user) return false;
    if (user.active === false) return false;
    if (!deviceContext) return true;

    // Administrators always have full device access
    const role = (user.role || '').trim();
    if (role === 'Administrator' || role === 'Admin') return true;

    // Clocking Terminal account is restricted to terminal interface
    if (this.isClockingTerminalUser(user)) {
      return deviceContext === 'terminal';
    }

    // Check user explicit override
    const override = this.getUserOverride(user.id || user.email);
    if (override?.deviceAccess && override.deviceAccess[deviceContext] !== undefined) {
      return !!override.deviceAccess[deviceContext];
    }

    // Check user direct deviceAccess object if present
    if (user.deviceAccess && user.deviceAccess[deviceContext] !== undefined) {
      return !!user.deviceAccess[deviceContext];
    }

    // Standard defaults: Desktop & Phone enabled, Tablet/Terminal disabled unless assigned
    if (deviceContext === 'desktop' || deviceContext === 'phone') return true;
    return false;
  },

  // ================= DEVICE VIEW / MODULE ACCESS (LAYER 2 GATE) =================
  canAccessDeviceView(
    user: any,
    moduleId: string,
    deviceContext: DeviceInterface = 'desktop'
  ): boolean {
    if (!user || user.active === false) return false;
    if (!this.canAccessDevice(user, deviceContext)) return false;

    const moduleDef = CENTRAL_MODULE_REGISTRY.find(m => m.id === moduleId);
    if (!moduleDef) return false;

    // Check if module physically supports this device
    if (moduleDef.supportsDevices && moduleDef.supportsDevices[deviceContext] === false) {
      return false;
    }

    // 1. Check explicit user override for this device view
    const override = this.getUserOverride(user.id || user.email);
    if (override?.deviceViewAccess?.[deviceContext]?.[moduleId] !== undefined) {
      return !!override.deviceViewAccess[deviceContext]![moduleId];
    }

    // 2. Check user object direct deviceViewAccess
    if (user.deviceViewAccess?.[deviceContext]?.[moduleId] !== undefined) {
      return !!user.deviceViewAccess[deviceContext][moduleId];
    }

    // 3. Check legacy deviceOverrides if present
    if (override?.deviceOverrides?.[deviceContext]?.modules?.[moduleId] !== undefined) {
      return !!override.deviceOverrides[deviceContext]!.modules![moduleId];
    }

    // 4. Role Baseline Evaluation
    const role = (user.role || '').trim();
    if (role === 'Administrator' || role === 'Admin') {
      return true;
    }

    if (this.isClockingTerminalUser(user)) {
      return ['clocking', 'qr_scan', 'leave'].includes(moduleId);
    }

    // Built-in modules open to authorized device users
    if (moduleId === 'gemini_ai') {
      return true;
    }

    if (moduleId === 'clocking') {
      return this.hasPermission(user, 'Clocking', 'View', deviceContext) ||
             this.hasPermission(user, 'Dashboard', 'View', deviceContext);
    }

    // Check mapped granular permission modules
    if (moduleDef.permissionModules && moduleDef.permissionModules.length > 0) {
      return moduleDef.permissionModules.some(pMod =>
        this.hasPermission(user, pMod, 'View', deviceContext)
      );
    }

    return true;
  },

  // Returns all authorized modules for user on the given device view
  getAuthorizedModulesForUser(
    user: any,
    deviceContext: DeviceInterface = 'desktop'
  ): ModuleDefinition[] {
    if (!user || user.active === false) return [];
    if (!this.canAccessDevice(user, deviceContext)) return [];

    return CENTRAL_MODULE_REGISTRY.filter(m =>
      this.canAccessDeviceView(user, m.id, deviceContext)
    );
  },

  // ================= DETERMINISTIC PERMISSION CHECK ENGINE =================
  /**
   * Evaluates user permission using strict precedence:
   * 1. Explicit User DENY
   * 2. Explicit User ALLOW
   * 3. Device-specific User Permission
   * 4. Role Permission
   * 5. Default DENY
   */
  hasPermission(
    user: any,
    moduleName: string,
    action: PermissionAction = 'View',
    deviceContext?: DeviceInterface
  ): boolean {
    if (!user) return false;
    if (user.active === false) return false;

    // Device access gate: If deviceContext is specified, verify device authorization
    if (deviceContext && !this.canAccessDevice(user, deviceContext)) {
      return false;
    }

    const override = this.getUserOverride(user.id || user.email);

    // 1. Device-specific action override
    if (deviceContext && override?.deviceOverrides?.[deviceContext]?.actions?.[moduleName]?.[action] !== undefined) {
      const devActionVal = override.deviceOverrides[deviceContext]!.actions![moduleName]![action];
      if (devActionVal === false) return false;
      if (devActionVal === true) return true;
    }

    // 2. Device-specific module deny
    if (deviceContext && override?.deviceOverrides?.[deviceContext]?.modules?.[moduleName] === false) {
      return false;
    }

    // 3. Explicit User Overrides (DENY / ALLOW / INHERIT)
    const userVal = override?.permissions?.[moduleName]?.[action];
    if (userVal !== undefined) {
      if (userVal === 'deny' || userVal === false) return false;
      if (userVal === 'allow' || userVal === true) return true;
      // If userVal === 'inherit', continue to role permission check
    }

    // 4. User direct permissions field fallback
    const directVal = user?.userPermissions?.[moduleName]?.[action];
    if (directVal !== undefined) {
      if (directVal === 'deny' || directVal === false) return false;
      if (directVal === 'allow' || directVal === true) return true;
    }

    if (user.permissions && user.permissions[moduleName] !== undefined) {
      if (typeof user.permissions[moduleName] === 'boolean' && action === 'View') {
        return user.permissions[moduleName];
      }
    }

    // 5. Role Permission Baseline
    const role = (user.role || '').trim();
    if (role === 'Administrator' || role === 'Admin') {
      return true;
    }

    const userRoles = this.getLocalUserRoles();
    const assigned = userRoles[user.id || user.email];
    let roleId = assigned?.roleId || user.roleId;

    if (!roleId) {
      const roles = this.getLocalRoles();
      const matched = roles.find(r => r.roleName.toLowerCase() === role.toLowerCase());
      if (matched) roleId = matched.id;
    }

    if (!roleId) {
      if (role === 'Manager') roleId = 'ROLE-MANAGER';
      else if (role === 'Purchasing') roleId = 'ROLE-PURCHASING';
      else if (role === 'Stock Manager') roleId = 'ROLE-STOCK-MGR';
      else if (role === 'Supervisor') roleId = 'ROLE-SUPERVISOR';
      else if (role === 'Clocking Terminal' || role === 'Clocking Kiosk') roleId = 'ROLE-CLOCKING-TERMINAL';
      else if (role === 'Employee' || role === 'Artisan') roleId = 'ROLE-EMPLOYEE';
      else if (role === 'Viewer') roleId = 'ROLE-VIEWER';
      else return false;
    }

    const allRolePerms = this.getLocalRolePermissions();
    const rolePerms = allRolePerms[roleId];

    if (!rolePerms || !rolePerms.permissions[moduleName]) {
      return false;
    }

    return !!rolePerms.permissions[moduleName][action];
  },

  // Alias for granular action checks
  canPerform(
    user: any,
    moduleName: string,
    action: PermissionAction,
    deviceContext?: DeviceInterface
  ): boolean {
    return this.hasPermission(user, moduleName, action, deviceContext);
  },

  // ================= MODULE & ROUTE ACCESS ENGINE =================
  canAccessMode(user: any, mode: string, deviceContext?: DeviceInterface): boolean {
    if (!user) return false;
    if (user.active === false) return false;

    const dev = deviceContext || 'desktop';

    // Device access gate
    if (!this.canAccessDevice(user, dev)) {
      return false;
    }

    // Evaluate required module view permissions for each application mode
    switch (mode) {
      case 'clocking_terminal':
      case 'employee':
        return this.canAccessDeviceView(user, 'clocking', dev);

      case 'qr_scan_service':
        return this.canAccessDeviceView(user, 'qr_scan', dev);

      case 'dispatch':
      case 'dispatches':
      case 'mobile_dispatches':
        return this.canAccessDeviceView(user, 'dispatch', dev);

      case 'purchase_orders':
        return this.canAccessDeviceView(user, 'purchase_orders', dev);

      case 'product_master':
        return this.canAccessDeviceView(user, 'product_master', dev);

      case 'orders':
        return this.canAccessDeviceView(user, 'orders', dev);

      case 'kanban':
      case 'template_designer':
        return this.canAccessDeviceView(user, 'kanban', dev);

      case 'admin':
        return this.canAccessDeviceView(user, 'admin', dev);

      case 'analytics':
        return this.canAccessDeviceView(user, 'analytics', dev);

      case 'leave':
        return this.canAccessDeviceView(user, 'leave', dev);

      case 'gemini_chat':
      case 'ai_assistant':
        return this.canAccessDeviceView(user, 'gemini_ai', dev);

      case 'system_admin':
        return this.canAccessDeviceView(user, 'system_admin', dev);

      case 'company_settings':
        return this.canAccessDeviceView(user, 'company_settings', dev);

      case 'mobile':
        return this.canAccessDevice(user, 'phone');

      default:
        return false;
    }
  },

  // ================= UNIFIED NAVIGATION GENERATOR =================
  getAuthorizedNavigationItems(
    user: any,
    deviceContext: DeviceInterface = 'desktop'
  ): AuthorizedNavItem[] {
    if (!user || user.active === false) return [];
    if (!this.canAccessDevice(user, deviceContext)) return [];

    const allNavCandidates: AuthorizedNavItem[] = [
      {
        id: 'employee_terminal',
        label: 'Clocking Terminal',
        icon: 'clock',
        appMode: 'employee',
        view: 'dashboard',
        category: 'Artisan Terminal'
      },
      {
        id: 'qr_scan',
        label: 'QR Scan Service',
        icon: 'scan',
        appMode: 'qr_scan_service',
        view: 'dashboard',
        category: 'Artisan Terminal'
      },
      {
        id: 'gemini_ai',
        label: 'Gemini AI Hub',
        icon: 'bot',
        appMode: 'gemini_chat',
        category: 'AI Intelligence'
      },
      {
        id: 'dispatch',
        label: 'Dispatch & Receiving',
        icon: 'truck',
        appMode: 'dispatch',
        view: 'dashboard',
        category: 'Management Hub'
      },
      {
        id: 'product_master',
        label: 'Product Master',
        icon: 'box',
        appMode: 'product_master',
        category: 'Management Hub'
      },
      {
        id: 'purchase_orders',
        label: 'Purchase Orders',
        icon: 'file-text',
        appMode: 'purchase_orders',
        category: 'Management Hub'
      },
      {
        id: 'kanban_designer',
        label: 'Kanban Designer',
        icon: 'layout-template',
        appMode: 'template_designer',
        category: 'Management Hub'
      },
      {
        id: 'orders',
        label: 'Procurement & Orders',
        icon: 'banknote',
        appMode: 'orders',
        view: 'dashboard',
        category: 'Management Hub'
      },
      {
        id: 'employer_reg',
        label: 'Employer Registration',
        icon: 'users',
        appMode: 'admin',
        view: 'dashboard',
        category: 'Management Hub'
      },
      {
        id: 'analytics',
        label: 'Work Analytics',
        icon: 'bar-chart-3',
        appMode: 'analytics',
        view: 'dashboard',
        category: 'Management Hub'
      },
      {
        id: 'leave',
        label: 'Leave Management',
        icon: 'calendar',
        appMode: 'leave',
        view: 'dashboard',
        category: 'Management Hub'
      },
      {
        id: 'system_admin',
        label: 'System Admin',
        icon: 'shield',
        appMode: 'system_admin',
        view: 'dashboard',
        category: 'System'
      },
      {
        id: 'company_settings',
        label: 'Company Settings',
        icon: 'settings',
        appMode: 'company_settings',
        view: 'dashboard',
        category: 'System'
      }
    ];

    // Filter candidate items through strict permission evaluation for the specified device context
    return allNavCandidates.filter(item => this.canAccessMode(user, item.appMode, deviceContext));
  },

  // ================= AUTHORIZED PHONE NAVIGATION GENERATOR =================
  getAuthorizedPhoneNavItems(
    user: any,
    options: { basketCount?: number; unreadNotifications?: number } = {}
  ): Array<{
    id: string;
    label: string;
    icon: string;
    badge?: number;
    targetMode?: string;
    isModal?: boolean;
    modalTarget?: 'profile' | 'notifications';
  }> {
    if (!user || user.active === false) return [];
    if (!this.canAccessDevice(user, 'phone')) return [];

    const items: Array<{
      id: string;
      label: string;
      icon: string;
      badge?: number;
      targetMode?: string;
      isModal?: boolean;
      modalTarget?: 'profile' | 'notifications';
    }> = [];

    // 1. Clocking (if authorized for Clocking module on phone)
    if (this.canAccessDeviceView(user, 'clocking', 'phone')) {
      items.push({
        id: 'clocking',
        label: 'Clocking',
        icon: 'clock',
        targetMode: 'employee'
      });
    }

    // 2. QR Scan (if authorized on phone)
    if (this.canAccessDeviceView(user, 'qr_scan', 'phone')) {
      items.push({
        id: 'qr_scan',
        label: 'QR Scan',
        icon: 'scan',
        targetMode: 'qr_scan_service'
      });
    }

    // 3. Dispatch & Receiving (if authorized on phone)
    if (this.canAccessDeviceView(user, 'dispatch', 'phone')) {
      items.push({
        id: 'dispatches',
        label: 'Dispatches',
        icon: 'truck',
        targetMode: 'dispatch'
      });
    }

    // 4. Basket (if authorized for orders and has basket items)
    if (options.basketCount && options.basketCount > 0 && this.canAccessDeviceView(user, 'orders', 'phone')) {
      items.push({
        id: 'basket',
        label: 'Basket',
        icon: 'shopping-bag',
        badge: options.basketCount,
        targetMode: 'qr_scan_service'
      });
    }

    // 5. Procurement / Orders (if authorized on phone)
    if (this.canAccessDeviceView(user, 'orders', 'phone') && !items.some(i => i.id === 'dispatches')) {
      items.push({
        id: 'orders',
        label: 'Orders',
        icon: 'banknote',
        targetMode: 'orders'
      });
    }

    // 6. Hub / Management (if authorized for kanban or admin on phone)
    if ((this.canAccessDeviceView(user, 'kanban', 'phone') || this.canAccessDeviceView(user, 'admin', 'phone')) && items.length < 3) {
      items.push({
        id: 'management',
        label: 'Hub',
        icon: 'layout-template',
        targetMode: this.canAccessDeviceView(user, 'kanban', 'phone') ? 'template_designer' : 'admin'
      });
    }

    // 7. Work Analytics (if authorized on phone)
    if (this.canAccessDeviceView(user, 'analytics', 'phone') && items.length < 3) {
      items.push({
        id: 'analytics',
        label: 'Analytics',
        icon: 'bar-chart-3',
        targetMode: 'analytics'
      });
    }

    // 8. Alerts / Notifications
    if (options.unreadNotifications && options.unreadNotifications > 0) {
      items.push({
        id: 'notifications',
        label: 'Alerts',
        icon: 'bell',
        badge: options.unreadNotifications,
        isModal: true,
        modalTarget: 'notifications'
      });
    }

    // 9. Profile (Always accessible to authenticated user)
    items.push({
      id: 'profile',
      label: 'Profile',
      icon: 'user',
      isModal: true,
      modalTarget: 'profile'
    });

    return items;
  },

  // ================= INITIAL ROUTING =================
  getInitialModeAndView(user: any, deviceContext: DeviceInterface = 'desktop'): { appMode: string; view: string } {
    if (!user || user.active === false) {
      return { appMode: 'restricted', view: 'restricted' };
    }

    if (this.isClockingTerminalUser(user)) {
      return { appMode: 'clocking_terminal', view: 'clocking' };
    }

    // Priority 1: Check if user has primary dispatch authorization (e.g. Depot / Receiving Officer)
    if (
      this.canAccessMode(user, 'dispatch', deviceContext) &&
      !this.hasPermission(user, 'Clocking', 'View', deviceContext)
    ) {
      return { appMode: 'dispatch', view: 'dashboard' };
    }

    // Priority 2: Standard employee clocking/dashboard
    if (this.canAccessMode(user, 'employee', deviceContext)) {
      return { appMode: 'employee', view: 'dashboard' };
    }

    // Priority 3: Purchase orders
    if (this.canAccessMode(user, 'purchase_orders', deviceContext)) {
      return { appMode: 'purchase_orders', view: 'purchase_orders' };
    }

    // Priority 4: Dispatch
    if (this.canAccessMode(user, 'dispatch', deviceContext)) {
      return { appMode: 'dispatch', view: 'dashboard' };
    }

    // Fallback: Check all authorized navigation items
    const authorized = this.getAuthorizedNavigationItems(user, deviceContext);
    if (authorized.length > 0) {
      return { appMode: authorized[0].appMode, view: authorized[0].view || 'dashboard' };
    }

    return { appMode: 'restricted', view: 'restricted' };
  },

  // ================= EFFECTIVE PERMISSIONS COMPUTATION =================
  getEffectiveUserPermissions(user: any): EffectiveUserPermissions {
    const email = (user?.email || '').toLowerCase().trim();
    const userId = user?.id || '';
    const role = (user?.role || 'Employee').trim();
    const override = this.getUserOverride(userId || email);

    const deviceAccess: UserDeviceAccess = override?.deviceAccess || user?.deviceAccess || {
      desktop: true,
      phone: true,
      tablet: false,
      terminal: false
    };

    const modules: Record<string, boolean> = {};
    const actions: Record<string, Record<PermissionAction, boolean>> = {};

    ALL_MODULE_NAMES.forEach(mod => {
      actions[mod] = {
        View: this.hasPermission(user, mod, 'View'),
        Create: this.hasPermission(user, mod, 'Create'),
        Edit: this.hasPermission(user, mod, 'Edit'),
        Delete: this.hasPermission(user, mod, 'Delete'),
        Approve: this.hasPermission(user, mod, 'Approve'),
        Process: this.hasPermission(user, mod, 'Process'),
        Print: this.hasPermission(user, mod, 'Print'),
        Export: this.hasPermission(user, mod, 'Export')
      };
      modules[mod] = actions[mod].View;
    });

    return {
      userId,
      userEmail: email,
      roleName: role,
      physicalLocation: override?.physicalLocation || user?.physicalLocation || 'Bloemfontein',
      branchId: override?.branchId || user?.branchId || 'BFN-01',
      branchName: override?.branchName || user?.branchName || 'Bloemfontein Central',
      deviceAccess,
      modules,
      actions
    };
  },

  // ================= HELPERS & AUDIT =================
  isClockingTerminalUser(user: any): boolean {
    if (!user) return false;
    const role = (user.role || '').trim();
    const email = (user.email || '').trim().toLowerCase();
    return (
      role === 'Clocking Kiosk' ||
      role === 'Clocking Terminal' ||
      role === 'Clocking' ||
      email === 'clocking@tsjoinery.co.za'
    );
  },

  getGreeting(firstName?: string, date: Date = new Date()): string {
    const hour = date.getHours();
    const timeGreeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
    const name = (firstName || '').trim() || 'User';
    return `${timeGreeting}, ${name}`;
  },

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

    const permissionsMap = this.getLocalRolePermissions();
    const newRolePerms: RolePermissions = {
      roleId: newRole.id,
      roleName: newRole.roleName,
      permissions: customMatrix(['Dashboard'], ['View']),
      updatedAt: new Date().toISOString(),
      updatedBy: adminName
    };
    permissionsMap[newRole.id] = newRolePerms;
    this.saveLocalRolePermissions(permissionsMap);

    await this.logAudit(adminName, 'ROLE_CREATED', 'None', `Created role ${newRole.roleName} (${newRole.id})`);

    if (db && APP_ID_PATH) {
      try {
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('roles').collection('items').doc(newRole.id).set(newRole);
        await db.collection('roles').doc(newRole.id).set(newRole);
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('rolePermissions').collection('items').doc(newRole.id).set(newRolePerms);
        await db.collection('rolePermissions').doc(newRole.id).set(newRolePerms);
      } catch (e) {
        console.warn('Firebase createRole sync error:', e);
      }
    }

    return newRole;
  },

  async updateRole(roleId: string, updates: Partial<RoleDefinition>, adminName: string): Promise<void> {
    const roles = this.getLocalRoles();
    const idx = roles.findIndex(r => r.id === roleId);
    if (idx === -1) return;

    const oldRole = roles[idx];
    const updatedRole: RoleDefinition = {
      ...oldRole,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    roles[idx] = updatedRole;
    this.saveLocalRoles(roles);

    if (updates.roleName && updates.roleName !== oldRole.roleName) {
      const permsMap = this.getLocalRolePermissions();
      if (permsMap[roleId]) {
        permsMap[roleId].roleName = updates.roleName;
        permsMap[roleId].updatedAt = new Date().toISOString();
        permsMap[roleId].updatedBy = adminName;
        this.saveLocalRolePermissions(permsMap);
      }
    }

    await this.logAudit(adminName, 'ROLE_UPDATED', JSON.stringify(oldRole), JSON.stringify(updatedRole));

    if (db && APP_ID_PATH) {
      try {
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('roles').collection('items').doc(roleId).update(updatedRole);
        await db.collection('roles').doc(roleId).update(updatedRole);
      } catch (e) {
        console.warn('Firebase updateRole sync error:', e);
      }
    }
  },

  async duplicateRole(sourceRoleId: string, newRoleName: string, adminName: string): Promise<RoleDefinition | null> {
    const roles = this.getLocalRoles();
    const sourceRole = roles.find(r => r.id === sourceRoleId);
    if (!sourceRole) return null;

    const duplicatedRole: RoleDefinition = {
      id: `ROLE-${Date.now().toString().slice(-5)}`,
      roleName: newRoleName.trim(),
      description: `Copy of ${sourceRole.roleName}: ${sourceRole.description}`,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSystemDefault: false
    };

    const updatedRoles = [...roles, duplicatedRole];
    this.saveLocalRoles(updatedRoles);

    const permsMap = this.getLocalRolePermissions();
    const sourcePerms = permsMap[sourceRoleId] || { permissions: customMatrix(['Dashboard'], ['View']) };

    const duplicatedPerms: RolePermissions = {
      roleId: duplicatedRole.id,
      roleName: duplicatedRole.roleName,
      permissions: JSON.parse(JSON.stringify(sourcePerms.permissions)),
      updatedAt: new Date().toISOString(),
      updatedBy: adminName
    };
    permsMap[duplicatedRole.id] = duplicatedPerms;
    this.saveLocalRolePermissions(permsMap);

    await this.logAudit(adminName, 'ROLE_DUPLICATED', sourceRole.roleName, duplicatedRole.roleName);

    if (db && APP_ID_PATH) {
      try {
        await db.collection('roles').doc(duplicatedRole.id).set(duplicatedRole);
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('roles').collection('items').doc(duplicatedRole.id).set(duplicatedRole);
        await db.collection('rolePermissions').doc(duplicatedRole.id).set(duplicatedPerms);
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('rolePermissions').collection('items').doc(duplicatedRole.id).set(duplicatedPerms);
      } catch (e) {
        console.warn('Firebase duplicateRole sync error:', e);
      }
    }

    return duplicatedRole;
  },

  async archiveRole(roleId: string, adminName: string): Promise<void> {
    await this.updateRole(roleId, { status: 'archived' }, adminName);
  },

  async restoreRole(roleId: string, adminName: string): Promise<void> {
    await this.updateRole(roleId, { status: 'active' }, adminName);
  },

  async deleteRole(roleId: string, adminName: string): Promise<boolean> {
    const roles = this.getLocalRoles();
    const target = roles.find(r => r.id === roleId);
    if (!target || target.isSystemDefault) {
      return false;
    }

    const updatedRoles = roles.filter(r => r.id !== roleId);
    this.saveLocalRoles(updatedRoles);

    const permsMap = this.getLocalRolePermissions();
    delete permsMap[roleId];
    this.saveLocalRolePermissions(permsMap);

    await this.logAudit(adminName, 'ROLE_DELETED', target.roleName, 'Deleted permanently');

    if (db && APP_ID_PATH) {
      try {
        await db.collection('roles').doc(roleId).delete();
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('roles').collection('items').doc(roleId).delete();
        await db.collection('rolePermissions').doc(roleId).delete();
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('rolePermissions').collection('items').doc(roleId).delete();
      } catch (e) {
        console.warn('Firebase deleteRole sync error:', e);
      }
    }

    return true;
  },

  async savePermissionsForRole(
    roleId: string,
    newPermissions: Record<string, Record<PermissionAction, boolean>>,
    adminName: string
  ): Promise<void> {
    const roles = this.getLocalRoles();
    const roleDef = roles.find(r => r.id === roleId);
    const roleName = roleDef ? roleDef.roleName : roleId;

    const permsMap = this.getLocalRolePermissions();
    const oldPerms = permsMap[roleId];

    const updatedRolePerms: RolePermissions = {
      roleId,
      roleName,
      permissions: newPermissions,
      updatedAt: new Date().toISOString(),
      updatedBy: adminName
    };

    permsMap[roleId] = updatedRolePerms;
    this.saveLocalRolePermissions(permsMap);

    await this.logAudit(
      adminName,
      'ROLE_PERMISSIONS_UPDATED',
      oldPerms ? `Updated matrix for ${roleName}` : 'None',
      `Saved ${Object.keys(newPermissions).length} module permissions`
    );

    if (db && APP_ID_PATH) {
      try {
        await db.collection('rolePermissions').doc(roleId).set(updatedRolePerms);
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('rolePermissions').collection('items').doc(roleId).set(updatedRolePerms);
      } catch (e) {
        console.warn('Firebase savePermissionsForRole sync error:', e);
      }
    }
  },

  async assignUserRole(
    userId: string,
    userName: string,
    userEmail: string,
    roleId: string,
    roleNameOrAdmin?: string,
    adminName?: string
  ): Promise<UserRoleAssignment> {
    const roles = this.getLocalRoles();
    const matchedRole = roles.find(r => r.id === roleId);
    let resolvedRoleName = matchedRole ? matchedRole.roleName : 'Employee';
    let resolvedAdminName = 'Administrator';

    if (adminName) {
      resolvedRoleName = roleNameOrAdmin || resolvedRoleName;
      resolvedAdminName = adminName;
    } else if (roleNameOrAdmin) {
      if (roles.some(r => r.roleName.toLowerCase() === roleNameOrAdmin.toLowerCase())) {
        resolvedRoleName = roleNameOrAdmin;
      } else {
        resolvedAdminName = roleNameOrAdmin;
      }
    }

    const userRoles = this.getLocalUserRoles();
    const oldRole = userRoles[userId]?.roleName || 'Unassigned';

    const assignment: UserRoleAssignment = {
      userId,
      userName,
      userEmail,
      roleId,
      roleName: resolvedRoleName,
      updatedAt: new Date().toISOString()
    };

    userRoles[userId] = assignment;
    this.saveLocalUserRoles(userRoles);

    await this.logAudit(resolvedAdminName, 'USER_ROLE_ASSIGNED', `${userName}: ${oldRole}`, `${userName}: ${resolvedRoleName}`);

    if (db && APP_ID_PATH) {
      try {
        await db.collection('userRoles').doc(userId).set(assignment);
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('userRoles').collection('items').doc(userId).set(assignment);
      } catch (e) {
        console.warn('Firebase assignUserRole sync error:', e);
      }
    }

    return assignment;
  },

  // ================= FIRESTORE SUBSCRIPTIONS =================
  subscribeRoles(callback: (roles: RoleDefinition[]) => void) {
    callback(this.getLocalRoles());

    if (db && APP_ID_PATH) {
      try {
        const unsub = db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('roles')
          .collection('items')
          .onSnapshot(
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

  subscribeRolePermissions(callback: (perms: Record<string, RolePermissions>) => void) {
    callback(this.getLocalRolePermissions());

    if (db && APP_ID_PATH) {
      try {
        const unsub = db.collection('rolePermissions').onSnapshot(
          snap => {
            if (snap && !snap.empty) {
              const map: Record<string, RolePermissions> = {};
              snap.forEach(d => {
                const data = d.data() as RolePermissions;
                map[data.roleId || d.id] = data;
              });
              this.saveLocalRolePermissions(map);
              callback(map);
            }
          },
          err => console.warn('RolePermissions subscription error:', err)
        );
        return unsub;
      } catch (e) {
        console.warn('Unable to subscribe to rolePermissions collection:', e);
      }
    }

    return () => {};
  },

  subscribeUserRoles(callback: (userRoles: Record<string, UserRoleAssignment>) => void) {
    callback(this.getLocalUserRoles());

    if (db && APP_ID_PATH) {
      try {
        const unsub = db.collection('userRoles').onSnapshot(
          snap => {
            if (snap && !snap.empty) {
              const map: Record<string, UserRoleAssignment> = {};
              snap.forEach(d => {
                const data = d.data() as UserRoleAssignment;
                map[data.userId || d.id] = data;
              });
              this.saveLocalUserRoles(map);
              callback(map);
            }
          },
          err => console.warn('UserRoles subscription error:', err)
        );
        return unsub;
      } catch (e) {
        console.warn('Unable to subscribe to userRoles collection:', e);
      }
    }

    return () => {};
  },

  subscribeUserOverrides(callback: (overrides: Record<string, UserPermissionOverride>) => void) {
    callback(this.getLocalUserOverrides());

    if (db && APP_ID_PATH) {
      try {
        const unsub = db.collection('userPermissionOverrides').onSnapshot(
          snap => {
            if (snap && !snap.empty) {
              const map: Record<string, UserPermissionOverride> = { ...DEFAULT_USER_OVERRIDES };
              snap.forEach(d => {
                const data = d.data() as UserPermissionOverride;
                if (!data) return;
                const emailKey = data.userEmail?.toLowerCase().trim();
                const idKey = data.userId?.trim();
                if (emailKey) map[emailKey] = data;
                if (idKey) map[idKey] = data;
                map[d.id] = data;
              });
              this.saveLocalUserOverrides(map);
              callback(map);
            }
          },
          err => console.warn('UserOverrides subscription error:', err)
        );
        return unsub;
      } catch (e) {
        console.warn('Unable to subscribe to userPermissionOverrides collection:', e);
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
  }
};

export default permissionService;
