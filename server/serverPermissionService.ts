import { getServerFirestore } from './firebaseAdmin';
import { AuthoritativeUser, DOCUMENTED_EMAIL_ALIASES } from './userLookupService';

/**
 * Server-Side RBAC & Permission Enforcement Service
 * TimberSmith Hub — Phase 4B Backend Infrastructure (Phase C)
 * 
 * Path: userPermissionOverrides (canonical root collection)
 * 
 * Security Invariants:
 * 1. Faithfully reproduces the canonical TS Hub permission decision (from src/services/permissionService.ts)
 *    in a secure, server-only context.
 * 2. Role has ZERO authorization power. Role names (including 'Administrator', 'Purchasing', 'Manager')
 *    must NEVER grant, bypass, or infer functional permissions.
 * 3. Department has ZERO authorization power.
 * 4. Administrator receives NO automatic bypass; all permissions are user-centric.
 * 5. Device Access and Device View Access do NOT grant functional permissions.
 * 6. Missing overrides or missing explicit permission strictly defaults to Deny.
 * 7. Legacy 'inherit' without a role baseline strictly defaults to Deny.
 * 8. Deny is final: explicit Deny in an override cannot be overridden by user fields, role, or department.
 * 9. Fails closed on inactive (active === false) or unapproved (isApproved !== true) accounts.
 * 10. For Purchase Order dispatch, authorizes ONLY if the user has:
 *     - 'Purchase Orders' + 'Edit', OR
 *     - 'Purchase Orders' + 'Approve'
 * 11. Strictly ignores any client-supplied permissions or query/body overrides.
 * 12. Rejects conflicting or ambiguous override records (fails closed).
 * 13. Pluggable Firestore adapter allows completely isolated unit testing without live database calls.
 */

export const CANONICAL_PERMISSIONS_COLLECTION = 'userPermissionOverrides';

export type PermissionAction =
  | 'View'
  | 'Create'
  | 'Edit'
  | 'Delete'
  | 'Approve'
  | 'Process'
  | 'Print'
  | 'Export';

export type PermissionState = 'allow' | 'deny';
export type LegacyPermissionState = 'allow' | 'deny' | 'inherit';

export interface UserDeviceAccess {
  desktop: boolean;
  phone: boolean;
  tablet: boolean;
  terminal: boolean;
}

export interface UserPermissionOverride {
  userId: string;
  userEmail: string;
  physicalLocation?: string;
  branchId?: string;
  branchName?: string;
  deviceAccess?: UserDeviceAccess;
  deviceViewAccess?: Partial<Record<string, Record<string, boolean>>>;
  permissions?: Record<string, Partial<Record<PermissionAction, PermissionState | LegacyPermissionState | boolean>>>;
  deviceOverrides?: Partial<Record<string, {
    modules?: Record<string, boolean>;
    actions?: Record<string, Partial<Record<PermissionAction, boolean>>>;
  }>>;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PermissionEvaluationResult {
  authorized: boolean;
  reason: string;
  source: 'override' | 'user_direct' | 'default_deny' | 'invalid_user';
}

export interface PurchaseOrderSendAuthResult {
  authorized: boolean;
  canEdit: boolean;
  canApprove: boolean;
  reason: string;
  source: 'override' | 'user_direct' | 'default_deny' | 'invalid_user';
}

export type OverrideLookupResult =
  | { success: true; override: UserPermissionOverride | null }
  | { success: false; error: string; code: 'AMBIGUOUS_OVERRIDE' | 'CONFLICTING_OVERRIDE' | 'LOOKUP_FAILED' };

/**
 * Minimal Firestore interfaces for dependency injection & isolated unit testing
 */
export interface IOverrideFirestoreDoc {
  id: string;
  data(): any;
}

export interface IOverrideQuerySnapshot {
  empty: boolean;
  size: number;
  docs: IOverrideFirestoreDoc[];
}

export interface IOverrideQuery {
  where(field: string, opStr: string, value: any): IOverrideQuery;
  get(): Promise<IOverrideQuerySnapshot>;
}

export interface IOverrideDocRef {
  get(): Promise<{ exists: boolean; id: string; data(): any }>;
}

export interface IServerPermissionFirestore {
  collection(path: string): {
    doc(id: string): IOverrideDocRef;
    where(field: string, opStr: string, value: any): IOverrideQuery;
    get?(): Promise<IOverrideQuerySnapshot>;
  };
}

export class ServerPermissionService {
  private dbAdapter: IServerPermissionFirestore | null;

  constructor(customDb?: IServerPermissionFirestore) {
    this.dbAdapter = customDb || null;
  }

  private getDb(): IServerPermissionFirestore {
    if (this.dbAdapter) {
      return this.dbAdapter;
    }
    return getServerFirestore() as unknown as IServerPermissionFirestore;
  }

  /**
   * Deterministically evaluates permission for a given user and override.
   * Reproduces canonical TS Hub precedence:
   * 1. Validate user account (active !== false, isApproved === true).
   * 2. Explicit User Override (deny / allow / inherit).
   * 3. User direct permissions field fallback (from authoritative record).
   * 4. Default DENY (Role/Department have ZERO authorization power).
   */
  public evaluatePermission(
    user: AuthoritativeUser,
    override: UserPermissionOverride | null | undefined,
    moduleName: string,
    action: PermissionAction
  ): PermissionEvaluationResult {
    // 1. Account Status Gate
    if (!user) {
      return {
        authorized: false,
        reason: 'User record is null or undefined.',
        source: 'invalid_user'
      };
    }

    if (user.active === false) {
      return {
        authorized: false,
        reason: `User ${user.email || user.id} is deactivated (active === false).`,
        source: 'invalid_user'
      };
    }

    if (user.isApproved !== true) {
      return {
        authorized: false,
        reason: `User ${user.email || user.id} is not approved (isApproved !== true).`,
        source: 'invalid_user'
      };
    }

    // 2. Explicit User Override (Precedence 1)
    if (override && override.permissions) {
      const modPerms = override.permissions[moduleName];
      if (modPerms && modPerms[action] !== undefined) {
        const val = modPerms[action];
        if (val === 'deny' || val === false) {
          return {
            authorized: false,
            reason: `Explicit override DENY for ${moduleName}:${action}.`,
            source: 'override'
          };
        }
        if (val === 'allow' || val === true) {
          return {
            authorized: true,
            reason: `Explicit override ALLOW for ${moduleName}:${action}.`,
            source: 'override'
          };
        }
        if (val === 'inherit') {
          return {
            authorized: false,
            reason: `Override specifies legacy 'inherit', which strictly defaults to DENY without role baseline.`,
            source: 'override'
          };
        }
      }
    }

    // 3. User Direct Permissions Field Fallback (Precedence 2)
    // Sourced directly from authoritative Firestore user document
    if (user.userPermissions) {
      const directMod = user.userPermissions[moduleName];
      if (directMod && directMod[action] !== undefined) {
        const directVal = directMod[action];
        if (directVal === 'deny' || directVal === false) {
          return {
            authorized: false,
            reason: `Direct user profile permissions DENY for ${moduleName}:${action}.`,
            source: 'user_direct'
          };
        }
        if (directVal === 'allow' || directVal === true) {
          return {
            authorized: true,
            reason: `Direct user profile permissions ALLOW for ${moduleName}:${action}.`,
            source: 'user_direct'
          };
        }
      }
    }

    // Direct boolean view fallback for 'View' action
    if (user.permissions && user.permissions[moduleName] !== undefined && action === 'View') {
      if (typeof user.permissions[moduleName] === 'boolean') {
        const isAllowed = user.permissions[moduleName];
        return {
          authorized: isAllowed,
          reason: isAllowed
            ? `Direct profile view permission ALLOW for ${moduleName}.`
            : `Direct profile view permission DENY for ${moduleName}.`,
          source: 'user_direct'
        };
      }
    }

    // 4. Default DENY (Precedence 3)
    // Pure User-Centric Authorization:
    // Role has ZERO authorization power. Role names (Administrator, Purchasing, etc.)
    // and departments must NEVER grant, deny, bypass, or infer permissions.
    return {
      authorized: false,
      reason: `No explicit permission granted for ${moduleName}:${action}. Role (${user.role || 'none'}) and department (${user.department || 'none'}) have zero authorization power. Default DENY.`,
      source: 'default_deny'
    };
  }

  /**
   * Helper returning boolean authorization decision.
   */
  public hasPermission(
    user: AuthoritativeUser,
    override: UserPermissionOverride | null | undefined,
    moduleName: string,
    action: PermissionAction
  ): boolean {
    return this.evaluatePermission(user, override, moduleName, action).authorized;
  }

  /**
   * Evaluates Purchase Order Send authorization.
   * Follows canonical TS Hub rule:
   * canSendPO = hasPermission('Purchase Orders', 'Edit') || hasPermission('Purchase Orders', 'Approve')
   */
  public evaluatePurchaseOrderSend(
    user: AuthoritativeUser,
    override: UserPermissionOverride | null | undefined
  ): PurchaseOrderSendAuthResult {
    const editResult = this.evaluatePermission(user, override, 'Purchase Orders', 'Edit');
    const approveResult = this.evaluatePermission(user, override, 'Purchase Orders', 'Approve');

    const canEdit = editResult.authorized;
    const canApprove = approveResult.authorized;
    const authorized = canEdit || canApprove;

    let reason: string;
    let source: 'override' | 'user_direct' | 'default_deny' | 'invalid_user';

    if (canEdit && canApprove) {
      reason = 'User is authorized to send Purchase Orders (has both Edit and Approve permissions).';
      source = editResult.source === 'override' || approveResult.source === 'override' ? 'override' : 'user_direct';
    } else if (canEdit) {
      reason = 'User is authorized to send Purchase Orders (has Edit permission).';
      source = editResult.source;
    } else if (canApprove) {
      reason = 'User is authorized to send Purchase Orders (has Approve permission).';
      source = approveResult.source;
    } else {
      if (editResult.source === 'invalid_user') {
        reason = editResult.reason;
        source = 'invalid_user';
      } else {
        reason = 'User is NOT authorized to send Purchase Orders. Requires explicit Edit or Approve permission on Purchase Orders module. Role has zero authorization power.';
        source = editResult.source === 'override' || approveResult.source === 'override' ? 'override' : 'default_deny';
      }
    }

    return {
      authorized,
      canEdit,
      canApprove,
      reason,
      source
    };
  }

  /**
   * Boolean helper for Purchase Order Send authorization.
   */
  public canSendPurchaseOrder(
    user: AuthoritativeUser,
    override: UserPermissionOverride | null | undefined
  ): boolean {
    return this.evaluatePurchaseOrderSend(user, override).authorized;
  }

  /**
   * Retrieves the authoritative user permission override from Firestore collection 'userPermissionOverrides'.
   * 
   * Resolves against:
   * 1. Direct document keyed by user.id
   * 2. Direct document keyed by user.email
   * 3. Query by userId == user.id
   * 4. Query by userEmail == user.email
   * 5. Documented alias mapping if applicable (frans <-> franz)
   * 
   * Fails closed if conflicting or ambiguous records exist.
   */
  public async getUserPermissionOverride(user: AuthoritativeUser): Promise<OverrideLookupResult> {
    if (!user) {
      return {
        success: false,
        error: 'Cannot lookup override for null user.',
        code: 'LOOKUP_FAILED'
      };
    }

    const userId = (user.id || '').trim();
    const userEmail = (user.email || '').toLowerCase().trim();

    if (!userId && !userEmail) {
      return {
        success: false,
        error: 'User record has neither ID nor email for override lookup.',
        code: 'LOOKUP_FAILED'
      };
    }

    try {
      const db = this.getDb();
      const collection = db.collection(CANONICAL_PERMISSIONS_COLLECTION);
      const candidates = new Map<string, { docId: string; data: UserPermissionOverride }>();

      // 1. Direct document lookup by userId
      if (userId) {
        const docSnap = await collection.doc(userId).get();
        if (docSnap && docSnap.exists) {
          candidates.set(docSnap.id || userId, {
            docId: docSnap.id || userId,
            data: docSnap.data() as UserPermissionOverride
          });
        }
      }

      // 2. Direct document lookup by userEmail
      if (userEmail && userEmail !== userId) {
        const docSnap = await collection.doc(userEmail).get();
        if (docSnap && docSnap.exists) {
          candidates.set(docSnap.id || userEmail, {
            docId: docSnap.id || userEmail,
            data: docSnap.data() as UserPermissionOverride
          });
        }
      }

      // 3. Query by field 'userId' == userId
      if (userId) {
        const qSnap = await collection.where('userId', '==', userId).get();
        if (qSnap && Array.isArray(qSnap.docs)) {
          for (const doc of qSnap.docs) {
            candidates.set(doc.id, {
              docId: doc.id,
              data: doc.data() as UserPermissionOverride
            });
          }
        }
      }

      // 4. Query by field 'userEmail' == userEmail
      const candidateEmails = [userEmail];
      // Check documented aliases
      for (const [alias, canonical] of Object.entries(DOCUMENTED_EMAIL_ALIASES)) {
        if (userEmail === canonical && !candidateEmails.includes(alias)) {
          candidateEmails.push(alias);
        } else if (userEmail === alias && !candidateEmails.includes(canonical)) {
          candidateEmails.push(canonical);
        }
      }

      for (const targetEmail of candidateEmails) {
        if (!targetEmail) continue;
        const qSnap = await collection.where('userEmail', '==', targetEmail).get();
        if (qSnap && Array.isArray(qSnap.docs)) {
          for (const doc of qSnap.docs) {
            candidates.set(doc.id, {
              docId: doc.id,
              data: doc.data() as UserPermissionOverride
            });
          }
        }
      }

      // No overrides found: default safe empty state
      if (candidates.size === 0) {
        return { success: true, override: null };
      }

      const candidateList = Array.from(candidates.values());

      // Exactly 1 candidate found
      if (candidateList.length === 1) {
        const single = candidateList[0].data;
        const candUserId = (single.userId || '').trim();
        const candEmail = (single.userEmail || '').toLowerCase().trim();

        // Validate that candidate belongs to the requesting user
        if (candUserId && userId && candUserId !== userId) {
          return {
            success: false,
            error: `Override document userId (${candUserId}) conflicts with authenticated user id (${userId}).`,
            code: 'CONFLICTING_OVERRIDE'
          };
        }
        if (candEmail && userEmail && candEmail !== userEmail && !candidateEmails.includes(candEmail)) {
          return {
            success: false,
            error: `Override document userEmail (${candEmail}) conflicts with authenticated user email (${userEmail}).`,
            code: 'CONFLICTING_OVERRIDE'
          };
        }

        return { success: true, override: single };
      }

      // Multiple candidates found: check for ambiguity or conflict
      // If multiple distinct user IDs are associated with the candidates: identity conflict!
      const distinctUserIds = new Set(
        candidateList.map(c => (c.data.userId || '').trim()).filter(Boolean)
      );
      if (distinctUserIds.size > 1) {
        return {
          success: false,
          error: `Ambiguous user overrides: multiple distinct user IDs (${Array.from(distinctUserIds).join(', ')}) match user ${userEmail}.`,
          code: 'AMBIGUOUS_OVERRIDE'
        };
      }

      // If user IDs match or are consistent, apply canonical resolution: pick latest by updatedAt
      let bestMatch: UserPermissionOverride | null = null;
      let hasConflictingPermissions = false;

      for (const cand of candidateList) {
        const ov = cand.data;
        if (!bestMatch) {
          bestMatch = ov;
        } else {
          const prevTime = bestMatch.updatedAt ? new Date(bestMatch.updatedAt).getTime() : 0;
          const currTime = ov.updatedAt ? new Date(ov.updatedAt).getTime() : 0;

          if (currTime > prevTime) {
            bestMatch = ov;
          } else if (currTime === prevTime && currTime === 0) {
            // Neither record has a timestamp; check if permissions conflict
            const json1 = JSON.stringify(bestMatch.permissions || {});
            const json2 = JSON.stringify(ov.permissions || {});
            if (json1 !== json2) {
              hasConflictingPermissions = true;
            }
          }
        }
      }

      if (hasConflictingPermissions) {
        return {
          success: false,
          error: `Multiple override records with contradictory permissions and missing timestamps found for user ${userId || userEmail}.`,
          code: 'CONFLICTING_OVERRIDE'
        };
      }

      return { success: true, override: bestMatch };
    } catch (err: any) {
      console.error('[ServerPermissionService] Override lookup failure:', err?.message);
      return {
        success: false,
        error: `Override lookup failed: ${err?.message || 'Database error'}`,
        code: 'LOOKUP_FAILED'
      };
    }
  }

  /**
   * End-to-end authorization check for sending Purchase Orders:
   * 1. Loads authoritative override from Firestore for user.
   * 2. Evaluates Purchase Order sending permissions.
   * 3. Fails closed on any error or ambiguity.
   */
  public async authorizePurchaseOrderSend(user: AuthoritativeUser): Promise<{
    authorized: boolean;
    reason: string;
    override: UserPermissionOverride | null;
    errorCode?: string;
  }> {
    const overrideRes = await this.getUserPermissionOverride(user);
    if (overrideRes.success === false) {
      return {
        authorized: false,
        reason: overrideRes.error,
        override: null,
        errorCode: overrideRes.code
      };
    }

    const evalResult = this.evaluatePurchaseOrderSend(user, overrideRes.override);
    return {
      authorized: evalResult.authorized,
      reason: evalResult.reason,
      override: overrideRes.override
    };
  }
}

export const serverPermissionService = new ServerPermissionService();
