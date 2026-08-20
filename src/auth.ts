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

export const DEFAULT_ACCOUNTS: AppUser[] = [
  { id: 'usr-admin-elrico', firstName: 'Elrico', lastName: 'Greyvenstein', name: 'Elrico Greyvenstein', email: 'elrico@tsjoinery.co.za', role: 'Administrator', department: 'Management', active: true, pin: SECURITY.SUPER_USER_PIN, isApproved: true, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'usr-clocking-kiosk', firstName: 'Clocking', lastName: 'Terminal', name: 'Clocking Terminal', email: 'clocking@tsjoinery.co.za', role: 'Clocking Terminal', department: 'Clocking', active: true, pin: '0000', isApproved: true, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'usr-hr-frans', firstName: 'Frans', lastName: 'User', name: 'Frans User', email: 'frans@tsjoinery.co.za', role: 'HR', department: 'Human Resources', active: true, pin: '1234', isApproved: true, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'usr-manager-janah', firstName: 'Janah', lastName: 'User', name: 'Janah User', email: 'janah@tsjoinery.co.za', role: 'Manager', department: 'Management', active: true, pin: '1234', isApproved: true, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'usr-admin-marietjie', firstName: 'Marietjie', lastName: 'User', name: 'Marietjie User', email: 'marietjie@tsjoinery.co.za', role: 'Administrator', department: 'Management', active: true, pin: '1234', isApproved: true, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'usr-purchasing', firstName: 'Purchasing', lastName: 'User', name: 'Purchasing User', email: 'purchasing@tsjoinery.co.za', role: 'Purchasing', department: 'Procurement', active: true, pin: '1234', isApproved: true, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'usr-employee', firstName: 'Employee', lastName: 'User', name: 'Employee User', email: 'employee@tsjoinery.co.za', role: 'Employee', department: 'Workshop', active: true, pin: '1234', isApproved: true, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' }
];

let internalUsersPool: AppUser[] = [...DEFAULT_ACCOUNTS];

export const authManager = {
  setUsers(users: AppUser[]): AppUser[] {
    const remoteMap = new Map(
      (users || [])
        .filter(u => u && u.email)
        .map(u => [String(u.email).toLowerCase().trim(), u])
    );

    const mergedUsers = [
      ...(users || []),
      ...DEFAULT_ACCOUNTS.filter(
        def => !remoteMap.has(String(def.email).toLowerCase().trim())
      )
    ];

    internalUsersPool = mergedUsers;
    return mergedUsers;
  },

  getUsers(): AppUser[] {
    return internalUsersPool.length > 0 ? internalUsersPool : DEFAULT_ACCOUNTS;
  },

  authenticateUser(activeUsers: AppUser[], emailOrUsername: string, pin: string): AppUser | null {
    const emailStateLength = (emailOrUsername || '').length;
    const emailStateNormalizedLength = (emailOrUsername || '').trim().length;
    const pinStateLength = (pin || '').length;
    const pinStateNormalizedLength = (pin || '').trim().length;

    console.log('[AUTHENTICATE USER ARGUMENT TRACE]', {
      emailStateLength,
      emailStateNormalizedLength,
      pinStateLength,
      pinStateNormalizedLength,
      identifier: emailOrUsername,
      pinWasEmpty: !pin || String(pin).trim().length === 0,
      timestamp: new Date().toISOString()
    });

    if (!emailOrUsername || pin === undefined || pin === null || pin === '') {
      console.log('[AUTH TRACE] Early rejection:', {
        reason: 'Missing identifier or PIN',
        hasIdentifier: Boolean(emailOrUsername),
        hasPin: pin !== undefined && pin !== null && pin !== ''
      });
      return null;
    }

    const normalizedInput = String(emailOrUsername).trim().toLowerCase();
    const normalizedPin = String(pin).trim();
    const emailFormat = normalizedInput.includes('@') ? normalizedInput : `${normalizedInput}@tsjoinery.co.za`;

    const sourceList = (activeUsers && activeUsers.length > 0) ? activeUsers : internalUsersPool;
    const remoteMap = new Map(
      sourceList
        .filter(u => u && u.email)
        .map(u => [String(u.email).toLowerCase().trim(), u])
    );
    const candidateList = [
      ...sourceList,
      ...DEFAULT_ACCOUNTS.filter(def => !remoteMap.has(String(def.email).toLowerCase().trim()))
    ];

    const checkCandidate = (user: AppUser, source: string) => {
      if (!user) return { isMatch: false, reason: 'Null user object' };

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

      if (!identifierMatches) {
        return { isMatch: false, reason: 'Identifier mismatch' };
      }

      const storedPin = user.pin !== undefined && user.pin !== null ? String(user.pin).trim() : '';
      const pinMatches = storedPin === normalizedPin;

      const candidateTrace = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        active: user.active,
        isApproved: user.isApproved,
        hasPin: user.pin !== undefined && user.pin !== null,
        pinType: typeof user.pin,
        storedPinLength: storedPin.length,
        suppliedPinLength: normalizedPin.length,
        identifierMatch: true,
        pinMatch: pinMatches,
        source
      };

      if (user.active === false) {
        console.log('[AUTH TRACE] Candidate rejected:', { ...candidateTrace, rejectionReason: 'User account is deactivated (active === false)' });
        return { isMatch: false, reason: 'Account deactivated' };
      }

      if (!pinMatches) {
        console.log('[AUTH TRACE] Candidate rejected:', { ...candidateTrace, rejectionReason: `PIN mismatch (stored length: ${storedPin.length}, supplied length: ${normalizedPin.length})` });
        return { isMatch: false, reason: 'PIN mismatch' };
      }

      console.log('[AUTH TRACE] Candidate MATCHED:', { ...candidateTrace, finalDecision: 'AUTHENTICATED' });
      return { isMatch: true, user, candidateTrace };
    };

    // 1. Try candidate list first
    let matchedUser: AppUser | null = null;
    let identifierFound = false;

    for (const user of candidateList) {
      const result = checkCandidate(user, 'candidateList');
      if (result.reason !== 'Identifier mismatch') {
        identifierFound = true;
      }
      if (result.isMatch && result.user) {
        matchedUser = result.user;
        break;
      }
    }

    // 2. Fallback to DEFAULT_ACCOUNTS directly if no match found yet
    if (!matchedUser) {
      for (const defUser of DEFAULT_ACCOUNTS) {
        const result = checkCandidate(defUser, 'DEFAULT_ACCOUNTS');
        if (result.reason !== 'Identifier mismatch') {
          identifierFound = true;
        }
        if (result.isMatch && result.user) {
          matchedUser = result.user;
          break;
        }
      }
    }

    if (!matchedUser && !identifierFound) {
      console.log('[AUTH TRACE] Rejection:', {
        candidateFound: false,
        rejectionReason: `No candidate matching identifier '${normalizedInput}' found in pool of ${candidateList.length} users`,
        candidateCount: candidateList.length,
        hasElricoInPool: candidateList.some(u => String(u.email).toLowerCase().includes('elrico')),
        hasJanahInPool: candidateList.some(u => String(u.email).toLowerCase().includes('janah'))
      });
    }

    return matchedUser;
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
