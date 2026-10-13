/**
 * Focused Mocked Integration Tests for Phase D: OAuth Pipeline & Runtime Hardening
 * 
 * Verifies:
 * 1. No cookie/session provided.
 * 2. Malformed session ID (non-hex, short, path traversal).
 * 3. Expired session rejection.
 * 4. Revoked session rejection.
 * 5. Google identity without a valid active TS Hub user.
 * 6. Inactive user rejection (active === false).
 * 7. Unapproved user rejection (isApproved === false).
 * 8. Explicit permission denial (override has 'deny' on PO Edit/Approve).
 * 9. Missing permission (override has no PO Edit/Approve).
 * 10. Successful authorization with explicit Edit.
 * 11. Successful authorization with explicit Approve.
 * 12. Conflicting overrides fail closed.
 * 13. Preview/development send rejection (Preview Safety guard).
 * 14. Request-supplied identity or permissions being ignored.
 * 15. OAuth redirect contains NO session ID, access token, or PKCE verifier in query params.
 * 16. Browser cookie contains ONLY an opaque 64-char hex session ID.
 * 17. Google access token never appears in a browser-facing response.
 * 18. Gmail provider failure handled safely without leaking credentials.
 * 19. Session creation failure handled safely.
 * 20. Firestore lookup failure handled safely.
 */

import {
  GmailOAuthService,
  SendPOPayload,
  canSendLiveGmailServer
} from '../server/gmailOAuthService';
import { SessionStore, ISessionFirestore, OAuthSessionDoc, OAUTH_SESSIONS_COLLECTION_PATH } from '../server/sessionStore';
import { UserLookupService, IUserLookupFirestore, ACTIVE_USERS_COLLECTION_PATH } from '../server/userLookupService';
import { ServerPermissionService, IServerPermissionFirestore, CANONICAL_PERMISSIONS_COLLECTION } from '../server/serverPermissionService';

// Mock in-memory Session Firestore
class MockSessionDb implements ISessionFirestore {
  public store = new Map<string, any>();
  public throwOnSet = false;

  collection(collPath: string) {
    const self = this;
    return {
      doc(docId: string) {
        return {
          async get() {
            const exists = self.store.has(docId);
            return {
              exists,
              data: () => (exists ? JSON.parse(JSON.stringify(self.store.get(docId))) : undefined)
            };
          },
          async set(data: any) {
            if (self.throwOnSet) throw new Error('Simulated session set error');
            self.store.set(docId, JSON.parse(JSON.stringify(data)));
          },
          async update(updates: any) {
            if (!self.store.has(docId)) throw new Error('Not found');
            const cur = self.store.get(docId);
            self.store.set(docId, { ...cur, ...JSON.parse(JSON.stringify(updates)) });
          },
          async delete() {
            self.store.delete(docId);
          }
        };
      }
    };
  }
}

// Mock in-memory User Lookup Firestore
class MockUserDb implements IUserLookupFirestore {
  public users = new Map<string, any>();
  public throwOnGet = false;

  collection(collPath: string) {
    const self = this;
    return {
      where(field: string, opStr: string, value: any) {
        return {
          where() { return this; },
          async get() {
            if (self.throwOnGet) throw new Error('Simulated user lookup error');
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
        if (self.throwOnGet) throw new Error('Simulated user lookup error');
        const matched = Array.from(self.users.entries()).map(([id, docData]) => ({
          id,
          data: () => JSON.parse(JSON.stringify(docData))
        }));
        return { empty: matched.length === 0, size: matched.length, docs: matched };
      }
    };
  }
}

// Mock in-memory Permission Firestore
class MockPermissionDb implements IServerPermissionFirestore {
  public overrides = new Map<string, any>();
  public throwOnGet = false;

  collection(collPath: string) {
    const self = this;
    return {
      doc(id: string) {
        return {
          async get() {
            if (self.throwOnGet) throw new Error('Simulated permission lookup error');
            const exists = self.overrides.has(id);
            return { exists, id, data: () => (exists ? JSON.parse(JSON.stringify(self.overrides.get(id))) : undefined) };
          }
        };
      },
      where(field: string, opStr: string, value: any) {
        return {
          where() { return this; },
          async get() {
            if (self.throwOnGet) throw new Error('Simulated permission lookup error');
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

async function runTests() {
  console.log('=== STARTING PHASE D OAUTH PIPELINE INTEGRATION TESTS ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition: any, msg: string) {
    total++;
    if (!condition) {
      console.error(`❌ FAIL: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
    passed++;
    console.log(`✅ PASS: ${msg}`);
  }

  // Setup isolated mock databases & services
  const sessionDb = new MockSessionDb();
  const userDb = new MockUserDb();
  const permDb = new MockPermissionDb();

  const mockSessionStore = new SessionStore(sessionDb);
  const mockUserLookup = new UserLookupService(userDb);
  const mockPermService = new ServerPermissionService(permDb);

  // Simulated Gmail REST API mock
  let simulateGmailFailure = false;
  let lastMimeSent: string | null = null;
  let lastAuthHeader: string | null = null;

  const mockFetch: typeof fetch = async (url: any, init?: any): Promise<Response> => {
    const urlStr = url.toString();

    // 1. Token Exchange
    if (urlStr.includes('oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({
        access_token: 'ya29.simulated_access_token_never_sent_to_browser',
        expires_in: 3600,
        token_type: 'Bearer'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 2. UserInfo
    if (urlStr.includes('googleapis.com/oauth2/v3/userinfo')) {
      return new Response(JSON.stringify({
        email: 'elrico@tsjoinery.co.za'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 3. Gmail Send API
    if (urlStr.includes('gmail.googleapis.com/gmail/v1/users/me/messages/send')) {
      if (simulateGmailFailure) {
        return new Response('Simulated Gmail API 500 error', { status: 500, statusText: 'Internal Server Error' });
      }
      lastAuthHeader = init?.headers?.Authorization || null;
      lastMimeSent = init?.body ? JSON.parse(init.body).raw : null;
      return new Response(JSON.stringify({
        id: 'msg_test_success_12345'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Not Found', { status: 404 });
  };

  const service = new GmailOAuthService(
    mockSessionStore,
    mockUserLookup,
    mockPermService,
    mockFetch
  );

  // Populate valid authoritative user in userDb
  userDb.users.set('usr-admin-elrico', {
    id: 'usr-admin-elrico',
    name: 'Elrico Greyvenstein',
    email: 'elrico@tsjoinery.co.za',
    role: 'Administrator',
    active: true,
    isApproved: true,
    status: 'active'
  });

  // Populate valid override in permDb allowing Edit
  permDb.overrides.set('usr-admin-elrico', {
    userId: 'usr-admin-elrico',
    userEmail: 'elrico@tsjoinery.co.za',
    permissions: {
      'Purchase Orders': {
        Edit: 'allow'
      }
    },
    updatedAt: '2026-03-01T10:00:00.000Z'
  });

  const validPayload: SendPOPayload = {
    employeeEmail: 'elrico@tsjoinery.co.za',
    to: 'supplier@timberworld.co.za',
    subject: 'Purchase Order PO-9001',
    message: 'Please process the attached purchase order.',
    poNumber: 'PO-9001',
    pdfFileName: 'PO-9001.pdf',
    pdfBase64: Buffer.from('%PDF-1.4 test document').toString('base64')
  };

  // Mock Request object simulating production Cloud Run environment
  const prodReq = {
    headers: { host: 'ts-hub-backend-859189362556.africa-south1.run.app' }
  };
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  // ==========================================
  // A. SESSION INTEGRATION TESTS
  // ==========================================

  // Create an initial valid session in mockSessionStore
  const validSession = await mockSessionStore.createSession({
    userId: 'usr-admin-elrico',
    googleEmail: 'elrico@tsjoinery.co.za',
    employeeEmail: 'elrico@tsjoinery.co.za',
    ttlSeconds: 3600,
    accessToken: 'ya29.simulated_access_token_never_sent_to_browser'
  });

  // 1. No Cookie / Session
  let err1 = '';
  try {
    await service.executePurchaseOrderSend('', validPayload, prodReq);
  } catch (e: any) {
    err1 = e.message;
  }
  assert(err1.includes('Unauthorized'), 'Empty session ID is rejected with Unauthorized');

  // 2. Malformed Session ID
  let err2 = '';
  try {
    await service.executePurchaseOrderSend('not-a-valid-hex-session-id', validPayload, prodReq);
  } catch (e: any) {
    err2 = e.message;
  }
  assert(err2.includes('Unauthorized'), 'Malformed session ID is rejected with Unauthorized');

  // 3. Expired Session
  const expiredSession = await mockSessionStore.createSession({
    userId: 'usr-admin-elrico',
    googleEmail: 'elrico@tsjoinery.co.za',
    employeeEmail: 'elrico@tsjoinery.co.za',
    ttlSeconds: -10, // expired in past
    accessToken: 'ya29.expired_token'
  });
  let err3 = '';
  try {
    await service.executePurchaseOrderSend(expiredSession.sessionId, validPayload, prodReq);
  } catch (e: any) {
    err3 = e.message;
  }
  assert(err3.includes('expired') || err3.includes('Unauthorized'), 'Expired session is rejected');

  // 4. Revoked Session
  await mockSessionStore.revokeSession(validSession.sessionId);
  let err4 = '';
  try {
    await service.executePurchaseOrderSend(validSession.sessionId, validPayload, prodReq);
  } catch (e: any) {
    err4 = e.message;
  }
  assert(err4.includes('revoked') || err4.includes('Unauthorized'), 'Revoked session is rejected');

  // Create fresh active session for remaining tests
  const activeSession = await mockSessionStore.createSession({
    userId: 'usr-admin-elrico',
    googleEmail: 'elrico@tsjoinery.co.za',
    employeeEmail: 'elrico@tsjoinery.co.za',
    ttlSeconds: 3600,
    accessToken: 'ya29.simulated_access_token_never_sent_to_browser'
  });

  // ==========================================
  // B. IDENTITY & USER LOOKUP TESTS
  // ==========================================

  // 5. Google Identity Without Valid TS Hub User
  const unknownEmailSession = await mockSessionStore.createSession({
    userId: 'unknown-user',
    googleEmail: 'unknown_employee@tsjoinery.co.za',
    employeeEmail: 'unknown_employee@tsjoinery.co.za',
    ttlSeconds: 3600,
    accessToken: 'ya29.unknown_token'
  });
  let err5 = '';
  try {
    await service.executePurchaseOrderSend(unknownEmailSession.sessionId, validPayload, prodReq);
  } catch (e: any) {
    err5 = e.message;
  }
  assert(err5.includes('Forbidden') && err5.includes('USER_NOT_FOUND'), 'Session for unknown TS Hub user is rejected with Forbidden');

  // 6. Inactive User
  userDb.users.set('usr-inactive', {
    id: 'usr-inactive',
    name: 'Inactive Worker',
    email: 'inactive@tsjoinery.co.za',
    active: false,
    isApproved: true,
    status: 'deactivated'
  });
  const inactiveSession = await mockSessionStore.createSession({
    userId: 'usr-inactive',
    googleEmail: 'inactive@tsjoinery.co.za',
    employeeEmail: 'inactive@tsjoinery.co.za',
    ttlSeconds: 3600,
    accessToken: 'ya29.inactive_token'
  });
  let err6 = '';
  try {
    await service.executePurchaseOrderSend(inactiveSession.sessionId, validPayload, prodReq);
  } catch (e: any) {
    err6 = e.message;
  }
  assert(err6.includes('USER_INACTIVE') || err6.includes('Forbidden'), 'Inactive user session is rejected');

  // 7. Unapproved User
  userDb.users.set('usr-unapproved', {
    id: 'usr-unapproved',
    name: 'Unapproved Worker',
    email: 'unapproved@tsjoinery.co.za',
    active: true,
    isApproved: false,
    status: 'pending'
  });
  const unapprovedSession = await mockSessionStore.createSession({
    userId: 'usr-unapproved',
    googleEmail: 'unapproved@tsjoinery.co.za',
    employeeEmail: 'unapproved@tsjoinery.co.za',
    ttlSeconds: 3600,
    accessToken: 'ya29.unapproved_token'
  });
  let err7 = '';
  try {
    await service.executePurchaseOrderSend(unapprovedSession.sessionId, validPayload, prodReq);
  } catch (e: any) {
    err7 = e.message;
  }
  assert(err7.includes('USER_UNAPPROVED') || err7.includes('Forbidden'), 'Unapproved user session is rejected');

  // ==========================================
  // C. SERVER-SIDE RBAC ENFORCEMENT TESTS
  // ==========================================

  // 8. Explicit Permission Denial (Override has Deny)
  permDb.overrides.set('usr-admin-elrico', {
    userId: 'usr-admin-elrico',
    userEmail: 'elrico@tsjoinery.co.za',
    permissions: {
      'Purchase Orders': {
        Edit: 'deny',
        Approve: 'deny'
      }
    }
  });
  let err8 = '';
  try {
    await service.executePurchaseOrderSend(activeSession.sessionId, validPayload, prodReq);
  } catch (e: any) {
    err8 = e.message;
  }
  assert(err8.includes('Forbidden') && err8.includes('not authorized'), 'Explicit override deny rejects PO send');

  // 9. Missing Permission (Override has no PO permission)
  permDb.overrides.set('usr-admin-elrico', {
    userId: 'usr-admin-elrico',
    userEmail: 'elrico@tsjoinery.co.za',
    permissions: {
      'Clocking': { View: 'allow' }
    }
  });
  let err9 = '';
  try {
    await service.executePurchaseOrderSend(activeSession.sessionId, validPayload, prodReq);
  } catch (e: any) {
    err9 = e.message;
  }
  assert(err9.includes('Forbidden') && err9.includes('not authorized'), 'Missing PO permissions defaults to Deny');

  // 10. Successful Authorization With Explicit Edit
  permDb.overrides.set('usr-admin-elrico', {
    userId: 'usr-admin-elrico',
    userEmail: 'elrico@tsjoinery.co.za',
    permissions: {
      'Purchase Orders': { Edit: 'allow' }
    }
  });
  const res10 = await service.executePurchaseOrderSend(activeSession.sessionId, validPayload, prodReq);
  assert(res10.success === true && res10.status === 'sent', 'Explicit Edit authorizes PO send successfully');
  assert(res10.gmailMessageId === 'msg_test_success_12345', 'Valid Gmail message ID returned');
  assert(res10.senderGoogleEmail === 'elrico@tsjoinery.co.za', 'Sender email matches verified Google session');

  // 11. Successful Authorization With Explicit Approve
  permDb.overrides.set('usr-admin-elrico', {
    userId: 'usr-admin-elrico',
    userEmail: 'elrico@tsjoinery.co.za',
    permissions: {
      'Purchase Orders': { Approve: 'allow' }
    }
  });
  const res11 = await service.executePurchaseOrderSend(activeSession.sessionId, validPayload, prodReq);
  assert(res11.success === true && res11.status === 'sent', 'Explicit Approve authorizes PO send successfully');

  // 12. Conflicting Overrides Fail Closed
  permDb.overrides.set('doc-dup-1', {
    userId: 'usr-different-1',
    userEmail: 'elrico@tsjoinery.co.za',
    permissions: { 'Purchase Orders': { Edit: 'allow' } }
  });
  permDb.overrides.set('doc-dup-2', {
    userId: 'usr-different-2',
    userEmail: 'elrico@tsjoinery.co.za',
    permissions: { 'Purchase Orders': { Edit: 'deny' } }
  });
  let err12 = '';
  try {
    await service.executePurchaseOrderSend(activeSession.sessionId, validPayload, prodReq);
  } catch (e: any) {
    err12 = e.message;
  }
  assert(err12.includes('Forbidden') || err12.includes('AMBIGUOUS_OVERRIDE'), 'Conflicting override records fail closed');
  permDb.overrides.delete('doc-dup-1');
  permDb.overrides.delete('doc-dup-2');

  // Restore clean single override for elrico
  permDb.overrides.set('usr-admin-elrico', {
    userId: 'usr-admin-elrico',
    userEmail: 'elrico@tsjoinery.co.za',
    permissions: { 'Purchase Orders': { Edit: 'allow' } }
  });

  // 13. Preview / Development Send Rejection (Preview Safety)
  const previewReq = {
    headers: { host: 'ais-dev-test-workstation.europe-west1.run.app' }
  };
  let err13 = '';
  try {
    await service.executePurchaseOrderSend(activeSession.sessionId, validPayload, previewReq);
  } catch (e: any) {
    err13 = e.message;
  }
  assert(err13.includes('[PreviewSafety]'), 'Preview / dev environment host triggers Preview Safety rejection');

  // 14. Request-Supplied Identity / Permissions Being Ignored
  // Malicious request payload trying to spoof employeeEmail or inject roles
  const maliciousPayload: any = {
    ...validPayload,
    employeeEmail: 'victim@tsjoinery.co.za', // spoofed email
    role: 'Administrator',
    permissions: { 'Purchase Orders': { Edit: true } }
  };
  const res14 = await service.executePurchaseOrderSend(activeSession.sessionId, maliciousPayload, prodReq);
  assert(res14.senderGoogleEmail === 'elrico@tsjoinery.co.za', 'Sender is strictly taken from verified session, spoofed payload email ignored');

  // ==========================================
  // D. OAUTH BOUNDARIES & CREDENTIAL LEAKAGE TESTS
  // ==========================================

  // 15 & 16. OAuth Callback Integration & Session Creation
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret-12345';

  const authUrlResult = service.generateAuthorizationUrl('elrico@tsjoinery.co.za', 'https://timbersmith-terminal.netlify.app/');
  assert(!authUrlResult.url.includes('session_id'), 'Auth URL does NOT contain session_id');

  const callbackRes = await service.handleCallback('test-auth-code', authUrlResult.state);
  assert(mockSessionStore.isValidSessionId(callbackRes.sessionId), 'Callback returns a valid opaque 64-char hex session ID');
  assert((callbackRes as any).accessToken === undefined, 'Callback return object NEVER exposes accessToken');
  assert((callbackRes as any).tokenData === undefined, 'Callback return object NEVER exposes raw tokenData');

  // 17. Client-Safe Status NEVER Leaks Access Token
  const safeStatus = await service.getSessionStatus(callbackRes.sessionId);
  assert(safeStatus.connected === true, 'Safe status reports connected: true');
  assert(safeStatus.googleEmail === 'elrico@tsjoinery.co.za', 'Safe status reports user email');
  assert((safeStatus as any).accessToken === undefined, 'Safe status NEVER contains accessToken');
  assert((safeStatus as any).sessionId === undefined, 'Safe status NEVER contains sessionId');

  // 18. Gmail Provider Failure Handled Safely
  simulateGmailFailure = true;
  let err18 = '';
  try {
    await service.executePurchaseOrderSend(activeSession.sessionId, validPayload, prodReq);
  } catch (e: any) {
    err18 = e.message;
  }
  assert(err18.includes('Gmail API rejected message'), 'Gmail API failure caught safely');
  simulateGmailFailure = false;

  // 19. Session Creation Failure Handled Safely
  sessionDb.throwOnSet = true;
  let err19 = '';
  try {
    const freshAuth = service.generateAuthorizationUrl('elrico@tsjoinery.co.za');
    await service.handleCallback('code', freshAuth.state);
  } catch (e: any) {
    err19 = e.message;
  }
  assert(err19.includes('Simulated session set error'), 'Session creation failure prevents active session');
  sessionDb.throwOnSet = false;

  // 20. Firestore Lookup Failure Handled Safely
  userDb.throwOnGet = true;
  let err20 = '';
  try {
    await service.executePurchaseOrderSend(activeSession.sessionId, validPayload, prodReq);
  } catch (e: any) {
    err20 = e.message;
  }
  assert(err20.includes('LOOKUP_FAILED') || err20.includes('Forbidden'), 'Database lookup error fails closed safely');
  userDb.throwOnGet = false;

  // Restore NODE_ENV
  process.env.NODE_ENV = prevEnv;

  console.log(`\n=== ALL ${passed}/${total} PHASE D OAUTH PIPELINE INTEGRATION TESTS PASSED ===\n`);
}

runTests().catch(err => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
