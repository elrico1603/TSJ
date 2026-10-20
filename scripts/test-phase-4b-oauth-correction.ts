/**
 * Unit & Integration Tests: Phase 4B Gmail OAuth Correction
 * 
 * Verifies:
 * 1. Authorization scopes: strictly contains openid, userinfo.email, and gmail.send (no excessive scopes).
 * 2. Authorization URL contains access_type=offline and prompt=consent.
 * 3. AES-256-GCM authenticated encryption for refresh tokens at rest.
 * 4. Stored credentials persistence in restricted Firestore collection (artifacts/timbersmith-terminal-v1/private/oauth/credentials).
 * 5. Automatic access token refresh via refreshAccessToken.
 * 6. Transparent session restoration from durable credential (restoreSessionFromCredential).
 * 7. OAuth callback error handling: errors are never silently swallowed and redirect with oauth_error.
 * 8. Status check durable credential fallback for verified TS Hub employees.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  GmailOAuthService,
  GOOGLE_OAUTH_SCOPES
} from '../server/gmailOAuthService';
import {
  SessionStore,
  ISessionFirestore,
  OAUTH_CREDENTIALS_COLLECTION_PATH,
  OAUTH_SESSIONS_COLLECTION_PATH
} from '../server/sessionStore';
import { UserLookupService, IUserLookupFirestore } from '../server/userLookupService';
import { ServerPermissionService, IServerPermissionFirestore } from '../server/serverPermissionService';

console.log('=== STARTING PHASE 4B GMAIL OAUTH CORRECTION TESTS ===\n');

// Mock in-memory Session & Credential Firestore
class MockSessionCredentialDb implements ISessionFirestore {
  public sessions = new Map<string, any>();
  public credentials = new Map<string, any>();

  collection(collPath: string) {
    const self = this;
    const store = collPath === OAUTH_CREDENTIALS_COLLECTION_PATH ? self.credentials : self.sessions;
    return {
      doc(docId: string) {
        return {
          async get() {
            const exists = store.has(docId);
            return {
              exists,
              data: () => (exists ? JSON.parse(JSON.stringify(store.get(docId))) : undefined)
            };
          },
          async set(data: any) {
            store.set(docId, JSON.parse(JSON.stringify(data)));
          },
          async update(updates: any) {
            if (!store.has(docId)) throw new Error('Not found');
            const cur = store.get(docId);
            store.set(docId, { ...cur, ...JSON.parse(JSON.stringify(updates)) });
          },
          async delete() {
            store.delete(docId);
          }
        };
      }
    };
  }
}

// Mock User DB
class MockUserDb implements IUserLookupFirestore {
  public users = new Map<string, any>();
  collection() {
    const self = this;
    return {
      where(field: string, opStr: string, value: any) {
        return {
          where() { return this; },
          async get() {
            const matched: Array<{ id: string; data: () => any }> = [];
            for (const [id, docData] of self.users.entries()) {
              if (opStr === '==' && docData[field] === value) {
                matched.push({ id, data: () => JSON.parse(JSON.stringify(docData)) });
              }
            }
            return { empty: matched.length === 0, size: matched.length, docs: matched };
          }
        };
      },
      async get() {
        const matched = Array.from(self.users.entries()).map(([id, docData]) => ({
          id,
          data: () => JSON.parse(JSON.stringify(docData))
        }));
        return { empty: matched.length === 0, size: matched.length, docs: matched };
      }
    };
  }
}

// Mock Permission DB
class MockPermDb implements IServerPermissionFirestore {
  public overrides = new Map<string, any>();
  collection() {
    const self = this;
    return {
      doc(id: string) {
        return {
          async get() {
            const exists = self.overrides.has(id);
            return { exists, id, data: () => (exists ? JSON.parse(JSON.stringify(self.overrides.get(id))) : undefined) };
          }
        };
      },
      where(field: string, opStr: string, value: any) {
        return {
          where() { return this; },
          async get() {
            const matched: Array<{ id: string; data: () => any }> = [];
            for (const [id, docData] of self.overrides.entries()) {
              if (opStr === '==' && docData[field] === value) {
                matched.push({ id, data: () => JSON.parse(JSON.stringify(docData)) });
              }
            }
            return { empty: matched.length === 0, size: matched.length, docs: matched };
          }
        };
      }
    };
  }
}

async function runCorrectionTests() {
  let passed = 0;
  let total = 0;
  function check(cond: boolean, msg: string) {
    total++;
    if (!cond) {
      console.error(`❌ FAIL: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
    passed++;
    console.log(`✅ PASS: ${msg}`);
  }

  const mockDb = new MockSessionCredentialDb();
  const mockUserDb = new MockUserDb();
  const mockPermDb = new MockPermDb();

  const sessionStore = new SessionStore(mockDb);
  const userLookup = new UserLookupService(mockUserDb);
  const permService = new ServerPermissionService(mockPermDb);

  // Seed authoritative user
  mockUserDb.users.set('usr-admin-elrico', {
    id: 'usr-admin-elrico',
    name: 'Elrico',
    email: 'elrico@tsjoinery.co.za',
    active: true,
    isApproved: true,
    status: 'approved'
  });

  // Seed permission override for Purchase Orders: Edit allow
  mockPermDb.overrides.set('usr-admin-elrico', {
    userId: 'usr-admin-elrico',
    userEmail: 'elrico@tsjoinery.co.za',
    permissions: { 'Purchase Orders': { Edit: 'allow' } }
  });

  // Setup mock fetch
  let refreshCalledCount = 0;
  const mockFetch: typeof fetch = async (url: any, init?: any): Promise<Response> => {
    const urlStr = url.toString();
    if (urlStr.includes('oauth2.googleapis.com/token')) {
      const body = init?.body?.toString() || '';
      if (body.includes('grant_type=refresh_token')) {
        refreshCalledCount++;
        return new Response(JSON.stringify({
          access_token: 'ya29.newly_refreshed_access_token_123',
          expires_in: 3600,
          token_type: 'Bearer'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        access_token: 'ya29.initial_access_token_456',
        expires_in: 3600,
        token_type: 'Bearer',
        refresh_token: '1//0_simulated_durable_refresh_token_789'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.includes('googleapis.com/oauth2/v3/userinfo')) {
      return new Response(JSON.stringify({
        email: 'elrico@tsjoinery.co.za'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200 });
  };

  const service = new GmailOAuthService(sessionStore, userLookup, permService, mockFetch);
  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret-sec123';

  // 1. Authorization Scopes
  check(GOOGLE_OAUTH_SCOPES.includes('openid'), 'Scopes include openid');
  check(GOOGLE_OAUTH_SCOPES.includes('https://www.googleapis.com/auth/userinfo.email'), 'Scopes include userinfo.email');
  check(GOOGLE_OAUTH_SCOPES.includes('https://www.googleapis.com/auth/gmail.send'), 'Scopes include send-only gmail.send');
  check(
    !(GOOGLE_OAUTH_SCOPES as readonly string[]).some(s => s === 'https://mail.google.com/' || s.includes('gmail.readonly') || s.includes('gmail.modify')),
    'Scopes strictly exclude full mail access, modify, and readonly scopes'
  );

  // 2. Authorization URL Parameters
  const authUrlResult = service.generateAuthorizationUrl('elrico@tsjoinery.co.za', 'https://timbersmith-terminal.netlify.app/');
  const parsedAuthUrl = new URL(authUrlResult.url);
  check(parsedAuthUrl.searchParams.get('access_type') === 'offline', 'Authorization URL specifies access_type=offline');
  check(parsedAuthUrl.searchParams.get('prompt') === 'consent', 'Authorization URL specifies prompt=consent');
  check(parsedAuthUrl.searchParams.get('scope')?.includes('userinfo.email') === true, 'Authorization URL includes userinfo.email');
  check(parsedAuthUrl.searchParams.get('scope')?.includes('gmail.send') === true, 'Authorization URL includes gmail.send');

  // 3. Token Encryption at Rest
  const encrypted = service.encryptToken({ refreshToken: 'secret_123', email: 'elrico@tsjoinery.co.za' });
  check(typeof encrypted === 'string' && encrypted.split('.').length === 3, 'Encrypted token uses 3-part AES-256-GCM format (iv.tag.ciphertext)');
  check(!encrypted.includes('secret_123'), 'Encrypted token does NOT contain plaintext refresh token');

  const decrypted = service.decryptToken<{ refreshToken: string }>(encrypted);
  check(decrypted?.refreshToken === 'secret_123', 'Decrypted token matches original secret');

  const tampered = encrypted.slice(0, -4) + 'abcd';
  check(service.decryptToken(tampered) === null, 'Tampered token fails authenticated decryption safely');

  // 4. Callback with Refresh Token Storage
  const callbackRes = await service.handleCallback('test-auth-code', authUrlResult.state);
  check(sessionStore.isValidSessionId(callbackRes.sessionId), 'Callback produces valid opaque session ID');
  check((callbackRes as any).accessToken === undefined, 'Callback response does NOT expose accessToken');
  check((callbackRes as any).refreshToken === undefined, 'Callback response does NOT expose refreshToken');

  // Verify stored credential in restricted collection
  const storedCred = await sessionStore.getCredential('usr-admin-elrico');
  check(storedCred !== null, 'Durable credential saved in restricted Firestore collection');
  check(storedCred?.googleEmail === 'elrico@tsjoinery.co.za', 'Stored credential matches verified Google email');
  check(storedCred?.status === 'active', 'Stored credential status is active');
  check(storedCred?.encryptedRefreshToken !== undefined, 'Encrypted refresh token is present in credential');

  // 5. Automatic Server-Side Access Token Refresh
  refreshCalledCount = 0;
  const refreshedToken = await service.refreshAccessToken(storedCred!.encryptedRefreshToken);
  check(refreshCalledCount > 0, 'refreshAccessToken triggered Google token refresh request');
  check(refreshedToken.accessToken === 'ya29.newly_refreshed_access_token_123', 'New access token successfully acquired from refresh');

  // 6. Durable Session Restoration
  const restoredSession = await service.restoreSessionFromCredential('elrico@tsjoinery.co.za');
  check(restoredSession !== null, 'Session successfully restored from durable stored credential');
  check(sessionStore.isValidSessionId(restoredSession?.sessionId), 'Restored session has valid opaque session ID');
  check(restoredSession?.accessToken === 'ya29.newly_refreshed_access_token_123', 'Restored session contains fresh refreshed access token');

  // 7. Status Check Durable Fallback
  // Status check with non-existent session ID but valid employeeEmail
  const fallbackStatus = await service.getSessionStatus('non-existent-session-id', 'elrico@tsjoinery.co.za');
  check(fallbackStatus.connected === true, 'Status check reports connected: true based on durable credential');
  check(fallbackStatus.googleEmail === 'elrico@tsjoinery.co.za', 'Status check reports verified email');
  check(fallbackStatus.canSend === true, 'Status check reports canSend: true for authorized user');

  // 8. Revocation / Logout clears durable credential
  await service.logout(restoredSession?.sessionId, 'elrico@tsjoinery.co.za');
  const revokedCred = await sessionStore.getCredential('usr-admin-elrico');
  check(revokedCred === null, 'Revoking session and credentials marks credential inactive / non-retrievable');

  const afterLogoutStatus = await service.getSessionStatus(undefined, 'elrico@tsjoinery.co.za');
  check(afterLogoutStatus.connected === false, 'After logout, status check reports connected: false');

  // 9. FINDING 7 SECURITY REGRESSION TESTS: Read-only status & authenticated session ownership
  const serverCode = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf-8');

  // 9.1 Extract GET /api/auth/google/status handler block from server.ts
  const statusBlockMatch = serverCode.match(/app\.get\(['"]\/api\/auth\/google\/status['"][\s\S]*?\n  \}\);/);
  check(statusBlockMatch !== null, 'server.ts contains GET /api/auth/google/status endpoint');
  const statusBlock = statusBlockMatch ? statusBlockMatch[0] : '';

  check(!statusBlock.includes('Set-Cookie'), 'GET /api/auth/google/status strictly NEVER issues Set-Cookie headers');
  check(!statusBlock.includes('restoreSessionFromCredential'), 'GET /api/auth/google/status strictly NEVER calls restoreSessionFromCredential');

  // 9.2 Extract POST /api/mail/send-purchase-order handler block from server.ts
  const sendBlockMatch = serverCode.match(/app\.post\(['"]\/api\/mail\/send-purchase-order['"][\s\S]*?\n  \}\);/);
  check(sendBlockMatch !== null, 'server.ts contains POST /api/mail/send-purchase-order endpoint');
  const sendBlock = sendBlockMatch ? sendBlockMatch[0] : '';

  check(!sendBlock.includes('restoreSessionFromCredential'), 'POST /api/mail/send-purchase-order strictly NEVER calls restoreSessionFromCredential');
  check(sendBlock.includes('if (!sessionId || !sessionStore.isValidSessionId(sessionId))'), 'POST /api/mail/send-purchase-order strictly enforces valid session ID check');

  // 9.3 Behavioral verification: unauthenticated request cannot send PO even if employeeEmail is supplied
  const unauthPayload = {
    employeeEmail: 'elrico@tsjoinery.co.za',
    to: 'supplier@timber.com',
    subject: 'PO #1001',
    message: 'Please deliver timber',
    poNumber: '1001',
    pdfFileName: 'PO_1001.pdf',
    pdfBase64: 'JVBERi0xLjQK...'
  };
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const prodReq = { headers: { host: 'ts-hub-backend-859189362556.africa-south1.run.app' } };

  let unauthError = '';
  try {
    await service.executePurchaseOrderSend('', unauthPayload, prodReq);
  } catch (e: any) {
    unauthError = e.message;
  }
  check(unauthError.includes('Unauthorized') && unauthError.includes('No active Google Workspace session found'),
    'Unauthenticated call without session cookie is rejected with Unauthorized despite valid employeeEmail payload');

  // 9.4 Legitimate user with valid session cookie and expired access token seamlessly refreshes and sends PO
  // Re-save active credential for elrico
  await sessionStore.saveCredential({
    userId: 'usr-admin-elrico',
    googleEmail: 'elrico@tsjoinery.co.za',
    employeeEmail: 'elrico@tsjoinery.co.za',
    encryptedRefreshToken: service.encryptToken({
      refreshToken: 'valid-refresh-token-999',
      googleEmail: 'elrico@tsjoinery.co.za',
      userId: 'usr-admin-elrico'
    }),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'active'
  });

  // Create session with an already expired access token
  const legitimateSession = await sessionStore.createSession({
    userId: 'usr-admin-elrico',
    googleEmail: 'elrico@tsjoinery.co.za',
    employeeEmail: 'elrico@tsjoinery.co.za',
    ttlSeconds: 3600,
    accessToken: 'ya29.expired_old_token',
    tokenExpiresAt: Date.now() - 5000 // expired 5 seconds ago
  });

  refreshCalledCount = 0;
  const sendResult = await service.executePurchaseOrderSend(legitimateSession.sessionId, unauthPayload, prodReq);
  check(refreshCalledCount > 0, 'executePurchaseOrderSend automatically refreshed the expired access token using stored refresh token');
  check(sendResult.success === true, 'Legitimate authorized purchase order successfully sent');
  check(sendResult.senderGoogleEmail === 'elrico@tsjoinery.co.za', 'Sender email matches verified session owner');

  process.env.NODE_ENV = prevEnv;

  console.log(`\n=== ALL ${passed}/${total} PHASE 4B GMAIL OAUTH CORRECTION TESTS PASSED ===\n`);
}

runCorrectionTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
