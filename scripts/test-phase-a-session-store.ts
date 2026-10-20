/**
 * Focused Unit Tests for Phase A Session Store
 * 
 * Verifies:
 * 1. Session ID randomness, entropy (32 bytes = 64 hex chars), and format regex.
 * 2. Session creation and retrieval through a mocked in-memory Firestore adapter.
 * 3. Expired session rejection.
 * 4. Revoked session rejection.
 * 5. Malformed/invalid session ID rejection (null, empty, short, path-traversal, non-hex).
 * 6. Browser-safe representation: secrets (accessToken, tokens, sessionId) are never leaked to client status.
 * 7. Preview Safety: prevents live writes in preview/dev mode when no mock adapter is provided.
 */

import {
  SessionStore,
  ISessionFirestore,
  OAuthSessionDoc,
  OAUTH_SESSIONS_COLLECTION_PATH,
  OAUTH_CREDENTIALS_COLLECTION_PATH,
  isValidCollectionPath
} from '../server/sessionStore';
import { getFirebaseAdminApp } from '../server/firebaseAdmin';
import { getFirestore } from 'firebase-admin/firestore';

// Mock in-memory Firestore adapter
class MockFirestore implements ISessionFirestore {
  public sessions = new Map<string, any>();
  public credentials = new Map<string, any>();

  collection(collPath: string) {
    if (!isValidCollectionPath(collPath)) {
      throw new Error(`Value for argument "collectionPath" must point to a collection, but was "${collPath}". Your path does not contain an odd number of components.`);
    }

    if (collPath !== OAUTH_SESSIONS_COLLECTION_PATH && collPath !== OAUTH_CREDENTIALS_COLLECTION_PATH) {
      throw new Error(`Unexpected collection path: ${collPath}`);
    }

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
            if (!store.has(docId)) {
              throw new Error('Document does not exist');
            }
            const existing = store.get(docId);
            store.set(docId, { ...existing, ...JSON.parse(JSON.stringify(updates)) });
          },
          async delete() {
            store.delete(docId);
          }
        };
      }
    };
  }
}

async function runTests() {
  console.log('=== STARTING PHASE A SESSION STORE TESTS ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (!condition) {
      console.error(`❌ FAIL: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
    passed++;
    console.log(`✅ PASS: ${msg}`);
  }

  // 1. Session ID Randomness & Format
  const mockDb = new MockFirestore();
  const store = new SessionStore(mockDb);

  const id1 = store.generateSessionId();
  const id2 = store.generateSessionId();
  assert(id1 !== id2, 'Session IDs must be distinct and non-colliding');
  assert(id1.length === 64, 'Session ID must be 64 characters long (32 bytes hex)');
  assert(store.isValidSessionId(id1), 'Generated session ID matches strict 64-char hex format');
  assert(store.isValidSessionId(id2), 'Second session ID matches strict 64-char hex format');

  // 2. Malformed / Invalid Session ID Rejection
  assert(!store.isValidSessionId(''), 'Empty string is rejected');
  assert(!store.isValidSessionId(null), 'Null is rejected');
  assert(!store.isValidSessionId(undefined), 'Undefined is rejected');
  assert(!store.isValidSessionId('abc123'), 'Short hex string is rejected');
  assert(!store.isValidSessionId('G'.repeat(64)), 'Non-hex string of length 64 is rejected');
  assert(!store.isValidSessionId('../../../etc/passwd'), 'Path traversal string is rejected');
  assert(!store.isValidSessionId('0'.repeat(63)), '63-character string is rejected');
  assert(!store.isValidSessionId('0'.repeat(65)), '65-character string is rejected');

  const malformedGet = await store.getSession('../malicious/path');
  assert(malformedGet === null, 'Malformed session ID returns null without querying storage');

  // 3. Session Creation & Retrieval via Mock Adapter
  const created = await store.createSession({
    userId: 'usr-admin-elrico',
    googleEmail: 'elrico@tsjoinery.co.za',
    employeeEmail: 'elrico@tsjoinery.co.za',
    ttlSeconds: 3600,
    accessToken: 'ya29.secret_google_access_token_never_expose'
  });

  assert(store.isValidSessionId(created.sessionId), 'Created session has valid opaque ID');
  assert(created.userId === 'usr-admin-elrico', 'User ID is correctly recorded');
  assert(created.googleEmail === 'elrico@tsjoinery.co.za', 'Google email is normalized and recorded');
  assert(created.status === 'active', 'Initial status is active');
  assert(created.expiresAt > Date.now(), 'Expiration is in future');

  const retrieved = await store.getSession(created.sessionId);
  assert(retrieved !== null, 'Session is successfully retrieved by ID');
  assert(retrieved?.userId === 'usr-admin-elrico', 'Retrieved session matches stored userId');
  assert(retrieved?.accessToken === 'ya29.secret_google_access_token_never_expose', 'Server-side access token is preserved in document');

  // 4. Expired Session Rejection
  const expiredSession = await store.createSession({
    userId: 'usr-manager-janah',
    googleEmail: 'janah@tsjoinery.co.za',
    employeeEmail: 'janah@tsjoinery.co.za',
    ttlSeconds: -10 // expired 10 seconds ago
  });

  const getExpired = await store.getSession(expiredSession.sessionId);
  assert(getExpired === null, 'Expired session is strictly rejected and returns null');

  // 5. Revoked Session Rejection
  const sessionToRevoke = await store.createSession({
    userId: 'usr-hr-franz',
    googleEmail: 'franz@tsjoinery.co.za',
    employeeEmail: 'franz@tsjoinery.co.za',
    ttlSeconds: 3600
  });

  const activeBeforeRevoke = await store.getSession(sessionToRevoke.sessionId);
  assert(activeBeforeRevoke !== null, 'Session is initially active');

  const revokeResult = await store.revokeSession(sessionToRevoke.sessionId);
  assert(revokeResult === true, 'Revocation operation returns true');

  const getRevoked = await store.getSession(sessionToRevoke.sessionId);
  assert(getRevoked === null, 'Revoked session is strictly rejected and returns null');

  // 6. Delete Session
  const sessionToDelete = await store.createSession({
    userId: 'usr-supervisor-juan',
    googleEmail: 'juan@tsjoinery.co.za',
    employeeEmail: 'juan@tsjoinery.co.za',
    ttlSeconds: 3600
  });

  const deleteResult = await store.deleteSession(sessionToDelete.sessionId);
  assert(deleteResult === true, 'Delete operation returns true');
  const getDeleted = await store.getSession(sessionToDelete.sessionId);
  assert(getDeleted === null, 'Deleted session returns null');

  // 7. Client-Safe Status Representation (Secrets NEVER leaked)
  const clientSafe = store.toClientSafeStatus(retrieved);
  assert(clientSafe.connected === true, 'Client safe status indicates connected: true');
  assert(clientSafe.googleEmail === 'elrico@tsjoinery.co.za', 'Client safe status displays user email');
  assert(clientSafe.canSend === true, 'Client safe status includes canSend flag');
  assert((clientSafe as any).accessToken === undefined, 'Client safe status NEVER includes accessToken');
  assert((clientSafe as any).sessionId === undefined, 'Client safe status NEVER includes sessionId');
  assert((clientSafe as any).userId === undefined, 'Client safe status does not expose internal userId');

  const clientSafeRevoked = store.toClientSafeStatus(getRevoked);
  assert(clientSafeRevoked.connected === false, 'Revoked/null session produces connected: false');
  assert(clientSafeRevoked.googleEmail === null, 'Revoked/null session produces googleEmail: null');
  assert(clientSafeRevoked.canSend === false, 'Revoked/null session produces canSend: false');

  // 8. Preview Safety Check
  const liveStoreWithoutMock = new SessionStore(); // no mock adapter injected
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development'; // simulate preview / dev environment

  let previewBlocked = false;
  try {
    await liveStoreWithoutMock.createSession({
      userId: 'test',
      googleEmail: 'test@tsjoinery.co.za',
      employeeEmail: 'test@tsjoinery.co.za'
    });
  } catch (err: any) {
    if (err.message.includes('[PreviewSafety]')) {
      previewBlocked = true;
    }
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
  assert(previewBlocked, 'Preview Safety blocks live Firestore writes in development/preview when no mock adapter is supplied');

  console.log(`\n=== ALL ${passed}/${total} PHASE A UNIT TESTS PASSED ===\n`);
}

runTests().catch(err => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
