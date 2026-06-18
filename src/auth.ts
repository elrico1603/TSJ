import { db, APP_ID_PATH } from './firebase';
import { auditLogger } from './audit';

export const USER_ROLES = ['Artisan', 'Supervisor', 'HR', 'Admin'] as const;
export type UserRole = typeof USER_ROLES[number];

export const SECURITY = {
  ADMIN_PIN: '2026',
  SUPER_USER_PIN: 'Elrico1603!!'
};

export const rolePermissions = {
  canManageUsers: (role: string) => ['Admin', 'Supervisor'].includes(role),
  canApproveUsers: (role: string) => role === 'Admin',
  canManageOrders: (role: string) => ['Admin', 'Supervisor', 'HR'].includes(role),
  canViewAnalytics: (role: string) => ['Admin', 'Supervisor', 'HR'].includes(role),
  canAccessMobile: (role: string) => ['Admin', 'Supervisor', 'HR', 'Artisan'].includes(role),
  canClock: (role: string) => ['Artisan', 'Supervisor', 'HR', 'Admin'].includes(role)
};

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  pin: string;
  isApproved: boolean;
  status: string;
  createdAt: string;
}

export const authManager = {
  authenticateUser(activeUsers: AppUser[], email: string, pin: string): AppUser | null {
    if (!email || !pin) return null;
    const normalizedEmail = email.trim().toLowerCase();
    const matched = (activeUsers || []).find(
      user => user.email?.toLowerCase() === normalizedEmail && user.pin === pin && user.isApproved
    );
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
