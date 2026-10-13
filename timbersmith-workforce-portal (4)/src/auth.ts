import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { db, APP_ID_PATH, firebaseConfig } from './firebase';
import { canMutateAuthOrRBAC } from './services/previewSafety';
import { auditLogger } from './audit';
import { permissionService } from './services/permissionService';
import { UserDeviceAccess, PermissionAction } from './types';

export const USER_ROLES = ['Administrator', 'Manager', 'HR', 'Purchasing', 'Clocking Terminal', 'Stock Manager', 'Supervisor', 'Employee'] as const;
export type UserRole = typeof USER_ROLES[number];

export const SECURITY = {
  SUPER_USER_PIN: 'Elrico1603!!'
};

// Legacy helper - In pure user-centric model, Role has ZERO authorization power.
// These methods default to false unless evaluated against an authenticated AppUser object with user permissions.
export const rolePermissions = {
  canManageUsers: (userOrRole: any) => typeof userOrRole === 'object' && userOrRole ? permissionService.hasPermission(userOrRole, 'User Assignments', 'Edit') : false,
  canApproveUsers: (userOrRole: any) => typeof userOrRole === 'object' && userOrRole ? permissionService.hasPermission(userOrRole, 'User Assignments', 'Approve') : false,
  canManageOrders: (userOrRole: any) => typeof userOrRole === 'object' && userOrRole ? (permissionService.hasPermission(userOrRole, 'Purchase Orders', 'Edit') || permissionService.hasPermission(userOrRole, 'Stock Requests', 'Edit')) : false,
  canViewAnalytics: (userOrRole: any) => typeof userOrRole === 'object' && userOrRole ? permissionService.hasPermission(userOrRole, 'Work Analytics', 'View') : false,
  canAccessMobile: (userOrRole: any) => typeof userOrRole === 'object' && userOrRole ? permissionService.canAccessDevice(userOrRole, 'phone') : false,
  canClock: (userOrRole: any) => typeof userOrRole === 'object' && userOrRole ? permissionService.hasPermission(userOrRole, 'Clocking', 'Create') : false,
  isStockManager: (userOrRole: any) => typeof userOrRole === 'object' && userOrRole ? permissionService.hasPermission(userOrRole, 'Inventory', 'Edit') : false
};

export interface AppUser {
  id: string;
  firstName?: string;
  lastName?: string;
  name: string;
  email: string;
  role: string;
  roleId?: string;
  department?: string;
  active?: boolean;
  pin: string;
  isApproved: boolean;
  status: string;
  createdAt: string;
  permissions?: Record<string, boolean>;
  branchId?: string;
  branchName?: string;
  physicalLocation?: string;
  deviceAccess?: UserDeviceAccess;
  deviceViewAccess?: Partial<Record<string, Record<string, boolean>>>;
  userPermissions?: Record<string, Partial<Record<PermissionAction, boolean>>>;
}

export const DEFAULT_ACCOUNTS: AppUser[] = [
  { id: 'usr-admin-elrico', firstName: 'Elrico', lastName: 'Greyvenstein', name: 'Elrico Greyvenstein', email: 'elrico@tsjoinery.co.za', role: 'Administrator', department: 'Management', physicalLocation: 'Bloemfontein', branchName: 'Bloemfontein Central', branchId: 'BFN-01', active: true, pin: SECURITY.SUPER_USER_PIN, isApproved: true, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'usr-hr-franz', firstName: 'Franz', lastName: 'Posthumus', name: 'Franz Posthumus', email: 'franz@tsjoinery.co.za', role: 'HR', department: 'Human Resources', physicalLocation: 'Bloemfontein', branchName: 'Bloemfontein Central', branchId: 'BFN-01', active: true, pin: '1234', isApproved: true, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'usr-manager-janah', firstName: 'Janah', lastName: 'Posthumus', name: 'Janah Posthumus', email: 'janah@tsjoinery.co.za', role: 'Manager', department: 'Management', physicalLocation: 'Bloemfontein', branchName: 'Bloemfontein Central', branchId: 'BFN-01', active: true, pin: '1234', isApproved: true, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'usr-admin-marietjie', firstName: 'Marietjie', lastName: 'Barkhuizen', name: 'Marietjie Barkhuizen', email: 'marietjie@tsjoinery.co.za', role: 'Administrator', department: 'Management', physicalLocation: 'Bloemfontein', branchName: 'Bloemfontein Central', branchId: 'BFN-01', active: true, pin: '1234', isApproved: true, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'usr-depot-juan', firstName: 'Juan', lastName: 'de Lange', name: 'Juan de Lange', email: 'juan@tsjoinery.co.za', role: 'Supervisor', department: 'Dispatch & Receiving', physicalLocation: 'Cape Town', branchName: 'Bloemfontein Central', branchId: 'BFN-01', active: true, pin: '1234', isApproved: true, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'usr-clocking-kiosk', firstName: 'Clocking', lastName: 'Terminal', name: 'Clocking Terminal', email: 'clocking@tsjoinery.co.za', role: 'Clocking Terminal', department: 'Clocking', physicalLocation: 'Bloemfontein', branchName: 'Bloemfontein Central', branchId: 'BFN-01', active: true, pin: '0000', isApproved: true, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' }
];

const STORAGE_SESSION_KEY = 'ts_hub_active_session_v1';
const STORAGE_CACHED_USERS_KEY = 'ts_hub_cached_users_v1';

const getInitialUsersPool = (): AppUser[] => {
  try {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(STORAGE_CACHED_USERS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as AppUser[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with defaults
          const map = new Map<string, AppUser>();
          DEFAULT_ACCOUNTS.forEach(def => map.set(def.email.toLowerCase().trim(), { ...def }));
          parsed.forEach(u => {
            if (u && u.email) {
              const key = u.email.toLowerCase().trim();
              map.set(key, { ...(map.get(key) || {}), ...u });
            }
          });
          return Array.from(map.values());
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load cached users pool:', e);
  }
  return [...DEFAULT_ACCOUNTS];
};

let internalUsersPool: AppUser[] = getInitialUsersPool();

export const authManager = {
  getStoredSession(): AppUser | null {
    try {
      const raw = localStorage.getItem(STORAGE_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const user = parsed?.user || parsed;
        if (user && user.email) {
          // Re-validate against current user pool
          const users = this.getUsers();
          const found = users.find(u => 
            u.email?.toLowerCase().trim() === user.email.toLowerCase().trim() ||
            u.id === user.id
          );
          if (found && found.active === false) {
            this.clearSession();
            return null;
          }
          const override = permissionService.getUserOverride(found || user);
          return {
            ...user,
            ...(found || {}),
            deviceAccess: override?.deviceAccess || found?.deviceAccess || user.deviceAccess,
            deviceViewAccess: override?.deviceViewAccess || found?.deviceViewAccess || user.deviceViewAccess
          };
        }
      }
    } catch (e) {
      console.warn('Failed to retrieve stored session:', e);
    }
    return null;
  },

  saveSession(user: AppUser): void {
    try {
      if (!user || !user.email) return;
      const override = permissionService.getUserOverride(user);
      const sessionUser: AppUser = {
        ...user,
        deviceAccess: override?.deviceAccess || user.deviceAccess,
        deviceViewAccess: override?.deviceViewAccess || user.deviceViewAccess
      };
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionUser));
    } catch (e) {
      console.warn('Failed to save session to localStorage:', e);
    }
  },

  clearSession(): void {
    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    } catch (e) {
      console.warn('Failed to clear session from localStorage:', e);
    }
  },

  _userListeners: [] as Array<(users: AppUser[]) => void>,

  subscribeUsers(listener: (users: AppUser[]) => void): () => void {
    this._userListeners.push(listener);
    return () => {
      this._userListeners = this._userListeners.filter(l => l !== listener);
    };
  },

  notifyUsersChanged(): void {
    const currentUsers = this.getUsers();
    this._userListeners.forEach(fn => {
      try { fn(currentUsers); } catch (e) { console.error('Error in user listener:', e); }
    });
  },

  addUserToLocalPool(newUser: AppUser): void {
    const normalizedEmail = (newUser.email || '').toLowerCase().trim();
    const updated = internalUsersPool.filter(u => (u.email || '').toLowerCase().trim() !== normalizedEmail);
    updated.push(newUser);
    internalUsersPool = updated;
    try {
      localStorage.setItem(STORAGE_CACHED_USERS_KEY, JSON.stringify(internalUsersPool));
    } catch (e) {
      console.warn('Failed to cache user in local storage:', e);
    }
  },

  updateUser(userId: string, updates: Partial<AppUser>): void {
    try {
      let updated = false;
      internalUsersPool = internalUsersPool.map(u => {
        if (u.id === userId || (u.email && updates.email && u.email.toLowerCase().trim() === updates.email.toLowerCase().trim())) {
          updated = true;
          return { ...u, ...updates };
        }
        return u;
      });
      if (updated) {
        localStorage.setItem(STORAGE_CACHED_USERS_KEY, JSON.stringify(internalUsersPool));
        this.notifyUsersChanged();
      }
    } catch (e) {
      console.warn('Failed to update user in internal pool:', e);
    }
  },

  setUsers(users: AppUser[]): AppUser[] {
    const canonicalMap = new Map<string, AppUser>();

    // Seed defaults first into the map
    DEFAULT_ACCOUNTS.forEach(def => {
      canonicalMap.set(def.email.toLowerCase().trim(), { ...def });
    });

    // Helper to identify dummy/test placeholder names
    const isPlaceholderTestUser = (u: AppUser): boolean => {
      const name = (u.name || '').trim().toLowerCase();
      const email = (u.email || '').trim().toLowerCase();
      // Never filter out real stock accounts or company emails
      if (email === 'stock@tsjoinery.co.za') return false;
      if (name === 'employee user' || name === 'purchasing user') return true;
      if (email === 'employee@tsjoinery.co.za' || email === 'purchasing@tsjoinery.co.za') return true;
      if (name === 'elrico user' || name === 'franz user' || name === 'frans user' || name === 'janah user' || name === 'marietjie user') return true;
      return false;
    };

    // Merge in remote/Firestore users, deduplicating and polishing legitimate accounts
    (users || []).forEach(u => {
      if (!u || !u.email) return;
      if (isPlaceholderTestUser(u)) return; // Skip dummy test accounts to keep admin lists clean

      let email = String(u.email).toLowerCase().trim();
      // Alias frans -> franz
      if (email === 'frans@tsjoinery.co.za') email = 'franz@tsjoinery.co.za';

      const existing = canonicalMap.get(email);
      if (existing) {
        // Live user u from Firestore is authoritative and always wins over default account
        canonicalMap.set(email, {
          ...existing,
          ...u,
          id: u.id || existing.id,
          name: u.name || existing.name,
          firstName: u.firstName || (u.name ? u.name.split(' ')[0] : existing.firstName),
          lastName: u.lastName || (u.name ? u.name.split(' ').slice(1).join(' ') : existing.lastName),
          email,
          role: u.role || existing.role,
          department: u.department || existing.department,
          active: u.active !== undefined ? u.active : true,
          pin: u.pin !== undefined ? u.pin : (existing.pin || ''),
          branchName: u.branchName || existing.branchName,
          branchId: u.branchId || existing.branchId,
          deviceAccess: u.deviceAccess || existing.deviceAccess,
          deviceViewAccess: u.deviceViewAccess || existing.deviceViewAccess,
          permissions: (u as any).permissions || (existing as any).permissions || {}
        });
      } else {
        canonicalMap.set(email, {
          ...u,
          email,
          firstName: u.firstName || u.name?.split(' ')[0] || 'User',
          lastName: u.lastName || u.name?.split(' ').slice(1).join(' ') || '',
          active: u.active !== undefined ? u.active : true,
          pin: u.pin || ''
        });
      }
    });

    const mergedUsers = Array.from(canonicalMap.values()).map(user => {
      const override = permissionService.getUserOverride(user);
      return {
        ...user,
        deviceAccess: override?.deviceAccess || user.deviceAccess,
        deviceViewAccess: override?.deviceViewAccess || user.deviceViewAccess
      };
    });
    internalUsersPool = mergedUsers;
    try {
      localStorage.setItem(STORAGE_CACHED_USERS_KEY, JSON.stringify(mergedUsers));
    } catch (e) {
      console.warn('Failed to cache merged users pool:', e);
    }
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
    const hasLiveUsers = Boolean(sourceList && sourceList.length > 0);

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

    let matchedUser: AppUser | null = null;
    let liveUserIdentified = false;

    // 1. If live users exist in the active user pool, evaluate ONLY against live users.
    if (hasLiveUsers) {
      for (const user of sourceList) {
        const result = checkCandidate(user, 'liveUsers');
        if (result.reason !== 'Identifier mismatch') {
          liveUserIdentified = true;
        }
        if (result.isMatch && result.user) {
          matchedUser = result.user;
          break;
        }
      }

      // If an existing live user was identified, decision is FINAL based on live user credential.
      // NEVER fall back to DEFAULT_ACCOUNTS for existing live users or missing live users when live pool is active.
      if (liveUserIdentified && !matchedUser) {
        console.log('[AUTH TRACE] Live user identified but credential rejected. DEFAULT_ACCOUNTS fallback blocked.');
        return null;
      }

      // If no live user was found and live pool is active, reject immediately (no silent DEFAULT_ACCOUNTS fallback).
      if (!matchedUser) {
        console.log('[AUTH TRACE] Rejection: No active live user matching identifier found.');
        return null;
      }
    } else {
      // 2. Offline / isolated in-memory development fallback: ONLY used when live user pool is completely empty (0 users loaded).
      for (const defUser of DEFAULT_ACCOUNTS) {
        const result = checkCandidate(defUser, 'DEFAULT_ACCOUNTS_OFFLINE_DEV');
        if (result.isMatch && result.user) {
          matchedUser = result.user;
          break;
        }
      }
    }

    if (matchedUser) {
      const override = permissionService.getUserOverride(matchedUser);
      return {
        ...matchedUser,
        deviceAccess: override?.deviceAccess || matchedUser.deviceAccess,
        deviceViewAccess: override?.deviceViewAccess || matchedUser.deviceViewAccess
      };
    }

    return null;
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

    if (db && APP_ID_PATH && canMutateAuthOrRBAC('approvePendingUser', user.id)) {
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

  async createActiveUser(userData: Omit<AppUser, 'id' | 'status' | 'isApproved' | 'createdAt'>): Promise<AppUser> {
    // 1. Form Validation
    const name = (userData.name || '').trim();
    const email = (userData.email || '').trim().toLowerCase();
    const pin = (userData.pin || '').trim();

    if (!name) {
      throw new Error("Full Name is required.");
    }
    if (!email || !email.includes('@') || !email.includes('.')) {
      throw new Error("A valid email address is required.");
    }
    if (!pin) {
      throw new Error("A password or PIN code is required.");
    }
    if (pin.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }

    const normalizedEmail = email;

    // 2. Duplicate Check in Firestore & Local Pool
    if (db && APP_ID_PATH) {
      try {
        const snap = await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('private')
          .doc('users')
          .collection('active')
          .where('email', '==', normalizedEmail)
          .get();

        if (!snap.empty) {
          throw new Error("User already exists.");
        }
      } catch (checkErr: any) {
        if (checkErr.message === "User already exists.") {
          throw checkErr;
        }
        console.warn("Firestore duplicate check notice:", checkErr);
      }
    }

    // Check in local pool & default accounts
    const existingInLocal = internalUsersPool.find(u => (u.email || '').toLowerCase().trim() === normalizedEmail && u.active !== false);
    if (existingInLocal) {
      throw new Error("User already exists.");
    }

    // 3. Firebase Authentication User Creation using a Secondary Firebase App
    // Note: Creating via secondary Firebase app prevents the client browser from signing out
    // or mutating the current administrator's active session.
    let authUid = '';
    if (canMutateAuthOrRBAC('createAuthUser', normalizedEmail)) {
      const secondaryAppName = `user-creator-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      let secondaryApp: any = null;

      try {
        secondaryApp = firebase.initializeApp(firebaseConfig, secondaryAppName);
        const userCred = await secondaryApp.auth().createUserWithEmailAndPassword(normalizedEmail, pin);
        authUid = userCred.user?.uid || '';
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          // If Auth account exists but Firestore profile was missing, we allow profile repair
          if (existingInLocal) {
            throw new Error("User already exists.");
          }
          console.log("Firebase Auth account already exists. Proceeding with Firestore profile creation/repair...");
        } else if (authErr.code === 'auth/weak-password') {
          throw new Error("Password must be at least 6 characters.");
        } else if (authErr.code === 'auth/invalid-email') {
          throw new Error("Invalid email address format.");
        } else {
          throw new Error(`Authentication creation failed: ${authErr.message || 'Unknown error'}`);
        }
      } finally {
        if (secondaryApp) {
          try {
            await secondaryApp.delete();
          } catch (delErr) {
            console.warn("Secondary app cleanup:", delErr);
          }
        }
      }
    } else {
      authUid = `usr-preview-${Date.now()}`;
      console.log(`[PREVIEW SAFETY] Simulating user creation in Preview mode for ${normalizedEmail} (authUid: ${authUid})`);
    }

    // 4. Create Firestore User Profile
    const userId = authUid || `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const nameParts = name.split(' ');
    const firstName = userData.firstName || nameParts[0] || 'User';
    const lastName = userData.lastName || nameParts.slice(1).join(' ') || '';

    const newUser: AppUser = {
      id: userId,
      name,
      firstName,
      lastName,
      email: normalizedEmail,
      pin,
      role: userData.role || 'Employee',
      roleId: userData.roleId || 'ROLE-EMPLOYEE',
      department: userData.department || 'Workshop',
      branchId: userData.branchId || 'BR-001',
      branchName: userData.branchName || 'Bloemfontein Central',
      physicalLocation: userData.physicalLocation || 'Bloemfontein',
      active: true,
      isApproved: true,
      status: 'active',
      createdAt: new Date().toISOString(),
      permissions: userData.permissions || {},
      deviceAccess: userData.deviceAccess || {
        desktop: true,
        phone: true,
        tablet: false,
        terminal: false
      },
      deviceViewAccess: userData.deviceViewAccess || {
        desktop: {},
        phone: {},
        tablet: {},
        terminal: {}
      }
    };

    if (db && APP_ID_PATH && canMutateAuthOrRBAC('createFirestoreUser', newUser.id)) {
      try {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('private')
          .doc('users')
          .collection('active')
          .doc(newUser.id)
          .set(newUser);
      } catch (error: any) {
        console.error('Unable to create active user in Firestore:', error);
        throw new Error(`Firestore profile creation failed: ${error.message || 'Permission or network error'}`);
      }

      // 5. Verify User Profile Exists in Firestore
      try {
        const verifySnap = await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('private')
          .doc('users')
          .collection('active')
          .doc(newUser.id)
          .get();

        if (!verifySnap.exists) {
          throw new Error("Firestore profile creation failed: Profile verification check returned not found.");
        }
      } catch (verErr: any) {
        throw new Error(verErr.message || "Firestore profile verification failed");
      }
    }

    // 6. Refresh User List & Local Memory Pool
    this.addUserToLocalPool(newUser);
    this.notifyUsersChanged();

    await auditLogger.log('USER_CREATED', newUser.email, `Created new active user ${newUser.name} with role ${newUser.role}`);

    return newUser;
  },

  async deleteActiveUser(user: AppUser): Promise<void> {
    if (!user || !user.id) return;

    await auditLogger.log('USER_DELETED', user.email || 'N/A', `Deleted active user ${user.name}`);

    if (db && APP_ID_PATH && canMutateAuthOrRBAC('deleteActiveUser', user.id)) {
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

    if (db && APP_ID_PATH && canMutateAuthOrRBAC('rejectPendingUser', user.id)) {
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

if (typeof window !== 'undefined') {
  const globalWindow = window as any;
  globalWindow.USER_ROLES = USER_ROLES;
  globalWindow.SECURITY = SECURITY;
  globalWindow.rolePermissions = rolePermissions;
  globalWindow.authManager = authManager;
}
