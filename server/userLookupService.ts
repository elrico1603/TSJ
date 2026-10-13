import { getServerFirestore } from './firebaseAdmin';

/**
 * Server-Side Authoritative User Lookup Service
 * TimberSmith Hub — Phase 4B Backend Infrastructure (Phase B)
 * 
 * Path: artifacts/timbersmith-terminal-v1/private/users/active
 * 
 * Security Invariants:
 * 1. Resolves a verified Google Workspace email address to exactly ONE authoritative,
 *    active, and approved TS Hub user record.
 * 2. Caller invariant: The email provided MUST be obtained from a successful Google userinfo
 *    verification server-side; NEVER trust an unverified browser-supplied address.
 * 3. Consistently normalizes emails using trim and lowercase.
 * 4. Honors documented email alias mapping from src/auth.ts (frans -> franz).
 *    Never invents or silently introduces undocumented alias mappings.
 * 5. Strict acceptance criteria:
 *    - exactly one matching record exists
 *    - active !== false
 *    - isApproved === true
 *    - user record has a valid, non-empty canonical id
 *    - stored email matches normalized verified email (accounting for documented alias)
 * 6. Fails closed: rejects zero matches, multiple matches, missing/malformed user IDs,
 *    inactive accounts, unapproved accounts, and ambiguous alias resolution.
 * 7. Strips all sensitive credentials (PINs, passwords, hashes) before returning.
 * 8. Dependency-injected Firestore adapter allows completely isolated unit testing
 *    without touching live production Firestore.
 */

export const ACTIVE_USERS_COLLECTION_PATH = 'artifacts/timbersmith-terminal-v1/private/users/active';

/**
 * Authoritative Email Alias Mapping
 * 
 * Sourced directly from src/auth.ts lines 220-221:
 * In TimberSmith Hub, Franz Posthumus's Google Workspace / email account
 * may be addressed or received as 'frans@tsjoinery.co.za', which maps
 * canonically to 'franz@tsjoinery.co.za'.
 * 
 * No other aliases exist in TS Hub. Any unauthorized or undocumented
 * alias mappings must NOT be added here.
 */
export const DOCUMENTED_EMAIL_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'frans@tsjoinery.co.za': 'franz@tsjoinery.co.za'
});

/**
 * Stripped, safe server-side user representation.
 * Excludes all sensitive authentication secrets (PIN, password, secret tokens).
 */
export interface AuthoritativeUser {
  id: string;
  email: string; // canonical normalized email
  name: string;
  firstName?: string;
  lastName?: string;
  role: string;
  roleId?: string;
  department?: string;
  branchId?: string;
  branchName?: string;
  physicalLocation?: string;
  active: boolean;
  isApproved: boolean;
  status: string;
  createdAt?: string;
  permissions?: Record<string, boolean>;
  userPermissions?: Record<string, any>;
  deviceAccess?: any;
  deviceViewAccess?: any;
}

export type UserLookupErrorCode =
  | 'INVALID_EMAIL'
  | 'USER_NOT_FOUND'
  | 'MULTIPLE_MATCHES'
  | 'USER_INACTIVE'
  | 'USER_UNAPPROVED'
  | 'MALFORMED_USER_RECORD'
  | 'EMAIL_MISMATCH'
  | 'LOOKUP_FAILED';

export type UserLookupResult =
  | { success: true; user: AuthoritativeUser }
  | { success: false; error: string; code: UserLookupErrorCode };

/**
 * Minimal Firestore interfaces for dependency injection & unit testing
 */
export interface IUserLookupFirestoreDoc {
  id: string;
  data(): any;
}

export interface IUserLookupQuerySnapshot {
  empty: boolean;
  size: number;
  docs: IUserLookupFirestoreDoc[];
}

export interface IUserLookupQuery {
  where(field: string, opStr: string, value: any): IUserLookupQuery;
  get(): Promise<IUserLookupQuerySnapshot>;
}

export interface IUserLookupFirestore {
  collection(path: string): {
    where(field: string, opStr: string, value: any): IUserLookupQuery;
    get(): Promise<IUserLookupQuerySnapshot>;
  };
}

/**
 * Normalizes email address by trimming whitespace and converting to lowercase.
 */
export function normalizeEmail(email: unknown): string {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Resolves a normalized email address using documented TS Hub aliases.
 * Returns the canonical email if an alias exists, or the input email unchanged.
 */
export function resolveDocumentedAlias(normalizedEmail: string): string {
  return DOCUMENTED_EMAIL_ALIASES[normalizedEmail] || normalizedEmail;
}

export class UserLookupService {
  private dbAdapter: IUserLookupFirestore | null;

  constructor(customDb?: IUserLookupFirestore) {
    this.dbAdapter = customDb || null;
  }

  private getDb(): IUserLookupFirestore {
    if (this.dbAdapter) {
      return this.dbAdapter;
    }
    return getServerFirestore() as unknown as IUserLookupFirestore;
  }

  /**
   * Authoritatively looks up a user by their verified Google Workspace email.
   * 
   * Pre-condition: verifiedGoogleEmail MUST come from Google userinfo token verification,
   * never from untrusted browser input.
   */
  public async lookupUser(verifiedGoogleEmail: unknown): Promise<UserLookupResult> {
    const normalizedInput = normalizeEmail(verifiedGoogleEmail);

    if (!normalizedInput || !normalizedInput.includes('@')) {
      return {
        success: false,
        error: 'Invalid or missing verified Google email address.',
        code: 'INVALID_EMAIL'
      };
    }

    // Resolve documented alias (e.g., frans@tsjoinery.co.za -> franz@tsjoinery.co.za)
    const canonicalEmail = resolveDocumentedAlias(normalizedInput);

    try {
      const db = this.getDb();

      // Query active users collection.
      // We search for both canonical email and raw normalized input (if an alias applied),
      // to handle cases where stored records may match either representation.
      const candidateEmails = [canonicalEmail];
      if (canonicalEmail !== normalizedInput && !candidateEmails.includes(normalizedInput)) {
        candidateEmails.push(normalizedInput);
      }

      const rawMatches: Array<{ id: string; data: any }> = [];
      const seenDocIds = new Set<string>();

      for (const targetEmail of candidateEmails) {
        const querySnap = await db
          .collection(ACTIVE_USERS_COLLECTION_PATH)
          .where('email', '==', targetEmail)
          .get();

        if (querySnap && Array.isArray(querySnap.docs)) {
          for (const doc of querySnap.docs) {
            if (!seenDocIds.has(doc.id)) {
              seenDocIds.add(doc.id);
              rawMatches.push({ id: doc.id, data: doc.data ? doc.data() : {} });
            }
          }
        }
      }

      // Check for zero matches
      if (rawMatches.length === 0) {
        return {
          success: false,
          error: `No authoritative TS Hub user found for verified email: ${normalizedInput}`,
          code: 'USER_NOT_FOUND'
        };
      }

      // Check for multiple distinct users (fail closed on ambiguity)
      const distinctUserIds = new Set(
        rawMatches.map(m => (m.data?.id || m.id || '').trim()).filter(Boolean)
      );

      if (rawMatches.length > 1 || distinctUserIds.size > 1) {
        return {
          success: false,
          error: `Multiple matching user records found for email: ${normalizedInput}`,
          code: 'MULTIPLE_MATCHES'
        };
      }

      const match = rawMatches[0];
      const data = match.data || {};
      const dataId = typeof data.id === 'string' ? data.id.trim() : '';
      const docId = typeof match.id === 'string' ? match.id.trim() : '';

      // Validate non-empty canonical ID in the user record
      if (!dataId || (docId && dataId !== docId)) {
        return {
          success: false,
          error: 'Authoritative user record has a missing, malformed, or mismatched canonical ID.',
          code: 'MALFORMED_USER_RECORD'
        };
      }

      const canonicalUserId = dataId;

      // Validate active status: must NOT be false (active !== false)
      if (data.active === false) {
        return {
          success: false,
          error: `User account for ${normalizedInput} is inactive (deactivated).`,
          code: 'USER_INACTIVE'
        };
      }

      // Validate approval status: must strictly be true (isApproved === true)
      if (data.isApproved !== true) {
        return {
          success: false,
          error: `User account for ${normalizedInput} is not approved.`,
          code: 'USER_UNAPPROVED'
        };
      }

      // Validate stored email matches verified email (accounting for documented alias)
      const storedNormalizedEmail = normalizeEmail(data.email);
      const storedResolvedEmail = resolveDocumentedAlias(storedNormalizedEmail);

      if (storedResolvedEmail !== canonicalEmail && storedNormalizedEmail !== normalizedInput) {
        return {
          success: false,
          error: `Stored user email (${storedNormalizedEmail}) does not match verified email (${normalizedInput}).`,
          code: 'EMAIL_MISMATCH'
        };
      }

      // Build safe authoritative user object (strictly stripping PINs and secret credentials)
      const firstName = data.firstName || data.name?.split(' ')[0] || 'User';
      const lastName = data.lastName || data.name?.split(' ').slice(1).join(' ') || '';
      const name = data.name || `${firstName} ${lastName}`.trim() || 'User';
      const role = data.role || 'Employee';

      const safeUser: AuthoritativeUser = {
        id: canonicalUserId,
        email: canonicalEmail,
        name,
        firstName,
        lastName,
        role,
        roleId: data.roleId,
        department: data.department,
        branchId: data.branchId,
        branchName: data.branchName,
        physicalLocation: data.physicalLocation,
        active: true,
        isApproved: true,
        status: data.status || 'active',
        createdAt: data.createdAt,
        permissions: data.permissions ? { ...data.permissions } : undefined,
        userPermissions: data.userPermissions ? JSON.parse(JSON.stringify(data.userPermissions)) : undefined,
        deviceAccess: data.deviceAccess ? JSON.parse(JSON.stringify(data.deviceAccess)) : undefined,
        deviceViewAccess: data.deviceViewAccess ? JSON.parse(JSON.stringify(data.deviceViewAccess)) : undefined
      };

      // Guarantee sensitive credentials are never leaked
      delete (safeUser as any).pin;
      delete (safeUser as any).password;
      delete (safeUser as any).pinHash;

      return {
        success: true,
        user: safeUser
      };
    } catch (err: any) {
      console.error('[UserLookupService] Error during user lookup:', err.message);
      return {
        success: false,
        error: `Authoritative user lookup failed: ${err.message || 'Unknown database error'}`,
        code: 'LOOKUP_FAILED'
      };
    }
  }

  /**
   * Convenience helper: returns AuthoritativeUser or null if lookup fails.
   */
  public async findAuthoritativeUser(verifiedGoogleEmail: unknown): Promise<AuthoritativeUser | null> {
    const result = await this.lookupUser(verifiedGoogleEmail);
    if (result.success) {
      return result.user;
    }
    return null;
  }
}

export const userLookupService = new UserLookupService();
