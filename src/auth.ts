import { db, APP_ID_PATH } from './firebase';
import { auditLogger } from './audit';

export const USER_ROLES = ['Administrator', 'Manager', 'HR', 'Purchasing', 'Clocking Terminal', 'Stock Manager', 'Supervisor', 'Employee'] as const;
export type UserRole = typeof USER_ROLES[number];

export const SECURITY = {
  SUPER_USER_PIN: 'Elrico1603!!'
};

export const rolePermissions = {
  canManageUsers: (role: string) => ['Administrator', 'Admin', 'HR'].includes(role),
  canApproveUsers: (role: string) => ['Administrator', 'Admin'].includes(role),
  canManageOrders: (role: string) => ['Administrator', 'Admin', 'Manager', 'Purchasing'].includes(role),
  canViewAnalytics: (role: string) => ['Administrator', 'Admin', 'Manager'].includes(role),
  canAccessMobile: (role: string) => ['Administrator', 'Admin', 'Manager', 'HR', 'Purchasing', 'Employee'].includes(role),
  canClock: (role: string) => true,
  isStockManager: (role: string) => role === 'Purchasing' || role === 'Stock Manager'
};

export interface AppUser {
  id: string;
  firstName?: string;
  lastName?: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  active?: boolean;
  pin: string;
  isApproved: boolean;
  status: string;
  createdAt: string;
  permissions?: Record<string, boolean>;
  branchId?: string;
  branchName?: string;
}

export const authManager = {
  authenticateUser(activeUsers: AppUser[], emailOrUsername: string, pin: string): AppUser | null {
    if (!emailOrUsername || pin === undefined || pin === null || pin === '') return null;
    const normalizedInput = String(emailOrUsername).trim().toLowerCase();
    const normalizedPin = String(pin).trim();
    const emailFormat = normalizedInput.includes('@') ? normalizedInput : `${normalizedInput}@tsjoinery.co.za`;

    const matched = (activeUsers || []).find(user => {
      if (!user || user.active === false) return false;
      const userEmail = user.email ? String(user.email).trim().toLowerCase() : '';
      const userName = user.name ? String(user.name).trim().toLowerCase() : '';
      const userFirstName = user.firstName ? String(user.firstName).trim().toLowerCase() : (userName.split(' ')[0] || '');
      const emailPrefix = userEmail ? userEmail.split('@')[0] : '';

      const identifierMatches = 
        userEmail === normalizedInput ||
        userEmail === emailFormat ||
        emailPrefix === normalizedInput ||
        userName === normalizedInput ||
        userFirstName === normalizedInput;

      const storedPin = user.pin !== undefined && user.pin !== null ? String(user.pin).trim() : '';
      const pinMatches = storedPin === normalizedPin;

      return identifierMatches && pinMatches;
    });

    return matched || null;
  },

  async registerUserRequest(request: Omit<AppUser, 'status' | 'isApproved' | 'createdAt'>): Promise<AppUser> {
    const entry: AppUser = {
      ...request,
      status: 'pending',
      isApproved: false,
      createdAt: new Date().toISOString()
    };

    await auditLogger.log('REGISTRATION_REQUEST', request.email, `Requested ${request.role} access`);

    if (db && APP_ID_PATH) {
      try {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('private')
          .doc('users')
          .collection('pending')
          .doc(request.id)
          .set(entry);
      } catch (error) {
        console.warn('Unable to persist registration request:', error);
      }
    }

    return entry;
  },

  async approvePendingUser(user: AppUser): Promise<AppUser> {
    await auditLogger.log('USER_APPROVED', user.email, `Approved role ${user.role}`);

    const approvedUser: AppUser = { ...user, status: 'active', isApproved: true };

    if (db && APP_ID_PATH) {
      try {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('private')
          .doc('users')
          .collection('active')
          .doc(user.id)
          .set(approvedUser);

        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('private')
          .doc('users')
          .collection('pending')
          .doc(user.id)
          .delete();
      } catch (error) {
        console.warn('Unable to approve pending user in Firestore:', error);
      }
    }

    return approvedUser;
  },

  async createActiveUser(userData: Omit<AppUser, 'id' | 'status' | 'isApproved' | 'createdAt'>): Promise<AppUser | null> {
    const newUser: AppUser = {
      id: Date.now().toString(),
      ...userData,
      status: 'active',
      isApproved: true,
      createdAt: new Date().toISOString()
    };

    await auditLogger.log('USER_CREATED', newUser.email, `Created new active user ${newUser.name} with role ${newUser.role}`);

    if (db && APP_ID_PATH) {
      try {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('private')
          .doc('users')
          .collection('active')
          .doc(newUser.id)
          .set(newUser);
      } catch (error) {
        console.warn('Unable to create active user in Firestore:', error);
        return null;
      }
    }

    return newUser;
  },

  async deleteActiveUser(user: AppUser): Promise<void> {
    if (!user || !user.id) return;

    await auditLogger.log('USER_DELETED', user.email || 'N/A', `Deleted active user ${user.name}`);

    if (db && APP_ID_PATH) {
      try {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('private')
          .doc('users')
          .collection('active')
          .doc(user.id)
          .delete();
      } catch (error) {
        console.warn('Unable to delete active user in Firestore:', error);
      }
    }
  },

  async rejectPendingUser(user: AppUser): Promise<null> {
    await auditLogger.log('USER_REJECTED', user.email, `Rejected role ${user.role}`);

    if (db && APP_ID_PATH) {
      try {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('private')
          .doc('users')
          .collection('pending')
          .doc(user.id)
          .delete();
      } catch (error) {
        console.warn('Unable to delete pending user in Firestore:', error);
      }
    }

    return null;
  }
};

const globalWindow = window as any;
globalWindow.USER_ROLES = USER_ROLES;
globalWindow.SECURITY = SECURITY;
globalWindow.rolePermissions = rolePermissions;
globalWindow.authManager = authManager;
