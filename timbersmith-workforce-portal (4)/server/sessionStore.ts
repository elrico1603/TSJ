import crypto from 'crypto';
import type admin from 'firebase-admin';
import { getServerFirestore } from './firebaseAdmin';

/**
 * Server-Side OAuth Session Store
 * TimberSmith Hub — Phase 4B Backend Infrastructure
 * 
 * Path: artifacts/timbersmith-terminal-v1/private/oauth_sessions/{sessionId}
 * 
 * Security Invariants:
 * 1. Session IDs are cryptographically random (at least 32 bytes hex, 64 characters).
 * 2. Session IDs are strictly validated to prevent path traversal or malformed document queries.
 * 3. Sessions are stored in Firestore server-side; raw access tokens and session documents
 *    are NEVER exposed or serialized to browser clients.
 * 4. Expired sessions (now >= expiresAt) or revoked sessions (status !== 'active') are rejected.
 * 5. In GAIS Preview or local development environments, real live Firestore session writes
 *    are prevented by Preview Safety guards.
 * 6. Pluggable Firestore adapter allows deterministic unit testing without production database writes.
 */

export const OAUTH_SESSIONS_COLLECTION_PATH = 'artifacts/timbersmith-terminal-v1/private/oauth_sessions';

export interface OAuthSessionDoc {
  sessionId: string;
  userId: string;
  googleEmail: string;
  employeeEmail: string;
  createdAt: number;
  expiresAt: number;
  status: 'active' | 'revoked';
  // Reserved for later server-only OAuth token integration (Phase D/E)
  accessToken?: string;
  tokenExpiresAt?: number;
}

export interface CreateSessionParams {
  userId: string;
  googleEmail: string;
  employeeEmail: string;
  ttlSeconds?: number;
  // Optional reserved fields for later server-side token storage
  accessToken?: string;
  tokenExpiresAt?: number;
}

export interface ClientSafeSessionStatus {
  connected: boolean;
  googleEmail: string | null;
  canSend: boolean;
}

// 64-character lowercase hex string validation regex
const SESSION_ID_REGEX = /^[0-9a-f]{64}$/;

/**
 * Minimal Firestore collection reference interface for testing and dependency injection
 */
export interface ISessionFirestore {
  collection(path: string): {
    doc(id: string): {
      get(): Promise<{
        exists: boolean;
        data(): any;
      }>;
      set(data: any): Promise<any>;
      update(data: any): Promise<any>;
      delete(): Promise<any>;
    };
  };
}

/**
 * Server-side preview detection guard
 */
export function isServerPreviewEnvironment(): boolean {
  if (process.env.FORCE_PRODUCTION_FIRESTORE === 'true') {
    return false;
  }
  return process.env.NODE_ENV !== 'production';
}

export class SessionStore {
  private dbAdapter: ISessionFirestore | null;

  constructor(customDb?: ISessionFirestore) {
    this.dbAdapter = customDb || null;
  }

  private getDb(): ISessionFirestore {
    if (this.dbAdapter) {
      return this.dbAdapter;
    }
    return getServerFirestore() as unknown as ISessionFirestore;
  }

  /**
   * Generates a cryptographically secure 32-byte (64-character) hex session identifier
   */
  public generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validates session ID format (strict 64-char hex)
   */
  public isValidSessionId(sessionId: unknown): sessionId is string {
    return typeof sessionId === 'string' && SESSION_ID_REGEX.test(sessionId);
  }

  /**
   * Creates and persists a new OAuth session in Firestore.
   * Session ID is opaque and random.
   */
  public async createSession(params: CreateSessionParams): Promise<OAuthSessionDoc> {
    if (isServerPreviewEnvironment() && !this.dbAdapter) {
      throw new Error('[PreviewSafety] Live Firestore session creation is blocked in Preview / development environment.');
    }

    const { userId, googleEmail, employeeEmail, ttlSeconds = 3600 } = params;

    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid userId is required to create a session.');
    }
    if (!googleEmail || !googleEmail.includes('@')) {
      throw new Error('Valid googleEmail is required to create a session.');
    }
    if (!employeeEmail || !employeeEmail.includes('@')) {
      throw new Error('Valid employeeEmail is required to create a session.');
    }

    const sessionId = this.generateSessionId();
    const now = Date.now();
    const expiresAt = now + (ttlSeconds * 1000);

    const docData: OAuthSessionDoc = {
      sessionId,
      userId: userId.trim(),
      googleEmail: googleEmail.trim().toLowerCase(),
      employeeEmail: employeeEmail.trim().toLowerCase(),
      createdAt: now,
      expiresAt,
      status: 'active'
    };

    if (params.accessToken) {
      docData.accessToken = params.accessToken;
    }
    if (params.tokenExpiresAt) {
      docData.tokenExpiresAt = params.tokenExpiresAt;
    }

    const db = this.getDb();
    await db.collection(OAUTH_SESSIONS_COLLECTION_PATH).doc(sessionId).set(docData);

    return docData;
  }

  /**
   * Retrieves an active session by session ID.
   * Rejects if expired, revoked, or non-existent.
   */
  public async getSession(sessionId: unknown): Promise<OAuthSessionDoc | null> {
    if (!this.isValidSessionId(sessionId)) {
      return null;
    }

    const db = this.getDb();
    const docSnap = await db.collection(OAUTH_SESSIONS_COLLECTION_PATH).doc(sessionId).get();

    if (!docSnap.exists) {
      return null;
    }

    const data = docSnap.data() as OAuthSessionDoc | undefined;
    if (!data) {
      return null;
    }

    // Reject revoked sessions
    if (data.status !== 'active') {
      return null;
    }

    // Reject expired sessions
    if (Date.now() >= data.expiresAt) {
      return null;
    }

    return data;
  }

  /**
   * Revokes an active session by setting its status to 'revoked'
   */
  public async revokeSession(sessionId: unknown): Promise<boolean> {
    if (!this.isValidSessionId(sessionId)) {
      return false;
    }

    if (isServerPreviewEnvironment() && !this.dbAdapter) {
      throw new Error('[PreviewSafety] Live Firestore session modification is blocked in Preview / development environment.');
    }

    const db = this.getDb();
    const docRef = db.collection(OAUTH_SESSIONS_COLLECTION_PATH).doc(sessionId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return false;
    }

    await docRef.update({
      status: 'revoked',
      revokedAt: Date.now()
    });

    return true;
  }

  /**
   * Deletes a session document completely from Firestore
   */
  public async deleteSession(sessionId: unknown): Promise<boolean> {
    if (!this.isValidSessionId(sessionId)) {
      return false;
    }

    if (isServerPreviewEnvironment() && !this.dbAdapter) {
      throw new Error('[PreviewSafety] Live Firestore session deletion is blocked in Preview / development environment.');
    }

    const db = this.getDb();
    const docRef = db.collection(OAUTH_SESSIONS_COLLECTION_PATH).doc(sessionId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return false;
    }

    await docRef.delete();
    return true;
  }

  /**
   * Transforms internal session document into a safe, client-facing status representation.
   * NEVER returns accessToken, sessionId, tokens, or secret fields to browser clients.
   */
  public toClientSafeStatus(session: OAuthSessionDoc | null): ClientSafeSessionStatus {
    if (!session || session.status !== 'active' || Date.now() >= session.expiresAt) {
      return {
        connected: false,
        googleEmail: null,
        canSend: false
      };
    }

    return {
      connected: true,
      googleEmail: session.googleEmail,
      canSend: true
    };
  }
}

export const sessionStore = new SessionStore();
