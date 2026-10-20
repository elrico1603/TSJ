/**
 * Test Suite: Phase 6 Google Workspace OAuth Firestore Collection Path & Isolation
 * TimberSmith Hub — Phase 6 Backend Verification
 * 
 * Verifies:
 * 1. Exact reproduction and fix of production Firestore collectionPath error:
 *    - Invalid path with even components (4 segments) fails with exact runtime error:
 *      'Value for argument "collectionPath" must point to a collection, but was "artifacts/timbersmith-terminal-v1/private/oauth_sessions". Your path does not contain an odd number of components.'
 *    - Invalid credentials path (4 segments) fails identically.
 *    - Corrected collection paths have exactly 5 components (odd number) and initialize successfully.
 * 2. Session creation, retrieval, token updates, expiration, revocation, and deletion.
 * 3. OAuth credential storage, retrieval, revocation, and deletion.
 * 4. Multi-user and multi-session isolation (User A vs User B, Session 1 vs Session 2).
 * 5. Security protections: client-safe sanitization, format validations, and preview safety.
 */

import assert from 'assert';
import {
  SessionStore,
  ISessionFirestore,
  OAuthSessionDoc,
  StoredOAuthCredential,
  OAUTH_SESSIONS_COLLECTION_PATH,
  OAUTH_CREDENTIALS_COLLECTION_PATH,
  isValidCollectionPath
} from '../server/sessionStore';
import { ACTIVE_USERS_COLLECTION_PATH } from '../server/userLookupService';
import { getFirebaseAdminApp } from '../server/firebaseAdmin';
import { getFirestore } from 'firebase-admin/firestore';

console.log('=== STARTING PHASE 6 OAUTH FIRESTORE PATH & ISOLATION TESTS ===\n');

let totalTests = 0;
let passedTests = 0;

function check(cond: boolean, desc: string) {
  totalTests++;
  if (!cond) {
    console.error(`❌ FAIL: ${desc}`);
    throw new Error(`Assertion failed: ${desc}`);
  }
  passedTests++;
  console.log(`✅ PASS: ${desc}`);
}

// In-Memory Multi-Collection Firestore Adapter for Isolated Testing
class IsolatedTestFirestore implements ISessionFirestore {
  public collections = new Map<string, Map<string, any>>();

  private getStore(path: string): Map<string, any> {
    if (!this.collections.has(path)) {
      this.collections.set(path, new Map());
    }
    return this.collections.get(path)!;
  }

  collection(collPath: string) {
    if (!isValidCollectionPath(collPath)) {
      throw new Error(
        `Value for argument "collectionPath" must point to a collection, but was "${collPath}". Your path does not contain an odd number of components.`
      );
    }

    const self = this;
    const store = self.getStore(collPath);

    return {
      doc(docId: string) {
        return {
          async get() {
            const exists = store.has(docId);
            return {
              exists,
              id: docId,
              data: () => (exists ? JSON.parse(JSON.stringify(store.get(docId))) : undefined)
            };
          },
          async set(data: any) {
            store.set(docId, JSON.parse(JSON.stringify(data)));
          },
          async update(updates: any) {
            if (!store.has(docId)) {
              throw new Error(`Document ${docId} does not exist in ${collPath}`);
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

async function runTestSuite() {
  // =========================================================================
  // 1. EXACT PRODUCTION RUNTIME ERROR REPRODUCTION & PATH VALIDATION
  // =========================================================================
  const adminApp = getFirebaseAdminApp();
  const realAdminDb = getFirestore(adminApp);

  // 1.1 Reproduce exact runtime error with invalid 4-component sessions path
  const invalidSessionPath = 'artifacts/timbersmith-terminal-v1/private/oauth_sessions';
  let sessionPathErrorCaught = false;
  let sessionPathErrorMessage = '';

  try {
    realAdminDb.collection(invalidSessionPath);
  } catch (err: any) {
    sessionPathErrorCaught = true;
    sessionPathErrorMessage = err.message;
  }

  check(sessionPathErrorCaught, 'Real Firebase Admin throws on 4-component oauth_sessions path');
  check(
    sessionPathErrorMessage === 'Value for argument "collectionPath" must point to a collection, but was "artifacts/timbersmith-terminal-v1/private/oauth_sessions". Your path does not contain an odd number of components.',
    'Reproduces exact production error message for invalid sessions path'
  );
  check(!isValidCollectionPath(invalidSessionPath), 'isValidCollectionPath rejects 4-component sessions path');

  // 1.2 Reproduce error for invalid 4-component credentials path
  const invalidCredPath = 'artifacts/timbersmith-terminal-v1/private/oauth_credentials';
  let credPathErrorCaught = false;
  let credPathErrorMessage = '';

  try {
    realAdminDb.collection(invalidCredPath);
  } catch (err: any) {
    credPathErrorCaught = true;
    credPathErrorMessage = err.message;
  }

  check(credPathErrorCaught, 'Real Firebase Admin throws on 4-component oauth_credentials path');
  check(
    credPathErrorMessage === 'Value for argument "collectionPath" must point to a collection, but was "artifacts/timbersmith-terminal-v1/private/oauth_credentials". Your path does not contain an odd number of components.',
    'Reproduces exact error for invalid credentials path'
  );
  check(!isValidCollectionPath(invalidCredPath), 'isValidCollectionPath rejects 4-component credentials path');

  // 1.3 Verify corrected 5-component sessions path
  const sessionSegments = OAUTH_SESSIONS_COLLECTION_PATH.split('/').filter(Boolean);
  check(sessionSegments.length === 5, 'OAUTH_SESSIONS_COLLECTION_PATH has exactly 5 components (odd count)');
  check(
    OAUTH_SESSIONS_COLLECTION_PATH === 'artifacts/timbersmith-terminal-v1/private/oauth/sessions',
    'OAUTH_SESSIONS_COLLECTION_PATH matches canonical nested path'
  );
  check(isValidCollectionPath(OAUTH_SESSIONS_COLLECTION_PATH), 'isValidCollectionPath validates corrected sessions path');

  const realSessionCol = realAdminDb.collection(OAUTH_SESSIONS_COLLECTION_PATH);
  check(realSessionCol.path === OAUTH_SESSIONS_COLLECTION_PATH, 'Real Firebase Admin accepts corrected sessions collection');

  // 1.4 Verify corrected 5-component credentials path
  const credSegments = OAUTH_CREDENTIALS_COLLECTION_PATH.split('/').filter(Boolean);
  check(credSegments.length === 5, 'OAUTH_CREDENTIALS_COLLECTION_PATH has exactly 5 components (odd count)');
  check(
    OAUTH_CREDENTIALS_COLLECTION_PATH === 'artifacts/timbersmith-terminal-v1/private/oauth/credentials',
    'OAUTH_CREDENTIALS_COLLECTION_PATH matches canonical nested path'
  );
  check(isValidCollectionPath(OAUTH_CREDENTIALS_COLLECTION_PATH), 'isValidCollectionPath validates corrected credentials path');

  const realCredCol = realAdminDb.collection(OAUTH_CREDENTIALS_COLLECTION_PATH);
  check(realCredCol.path === OAUTH_CREDENTIALS_COLLECTION_PATH, 'Real Firebase Admin accepts corrected credentials collection');

  // 1.5 Verify consistency with users active collection
  const activeUserSegments = ACTIVE_USERS_COLLECTION_PATH.split('/').filter(Boolean);
  check(activeUserSegments.length === 5, 'ACTIVE_USERS_COLLECTION_PATH has exactly 5 components (consistent architecture)');
  check(isValidCollectionPath(ACTIVE_USERS_COLLECTION_PATH), 'isValidCollectionPath validates active users collection path');

  // 1.6 Verify document path depths (even component count = 6)
  const sampleSessionDocPath = `${OAUTH_SESSIONS_COLLECTION_PATH}/sample-session-id`;
  check(sampleSessionDocPath.split('/').filter(Boolean).length === 6, 'Session document path has 6 components (even count)');

  const sampleCredDocPath = `${OAUTH_CREDENTIALS_COLLECTION_PATH}/usr-admin-elrico`;
  check(sampleCredDocPath.split('/').filter(Boolean).length === 6, 'Credential document path has 6 components (even count)');

  // =========================================================================
  // 2. SESSION LIFECYCLE TESTS (CREATE, RETRIEVE, UPDATE, EXPIRE, REVOKE, DELETE)
  // =========================================================================
  const testDb = new IsolatedTestFirestore();
  const store = new SessionStore(testDb);

  // 2.1 Session Creation
  const session1 = await store.createSession({
    userId: 'usr-admin-elrico',
    googleEmail: 'elrico@tsjoinery.co.za',
    employeeEmail: 'elrico@tsjoinery.co.za',
    ttlSeconds: 3600,
    accessToken: 'ya29.elrico_access_token_1',
    tokenExpiresAt: Date.now() + 3500 * 1000
  });

  check(store.isValidSessionId(session1.sessionId), 'Session 1 has valid 64-char hex opaque ID');
  check(session1.userId === 'usr-admin-elrico', 'Session 1 records canonical userId');
  check(session1.googleEmail === 'elrico@tsjoinery.co.za', 'Session 1 records normalized googleEmail');
  check(session1.status === 'active', 'Session 1 status is active');
  check(session1.accessToken === 'ya29.elrico_access_token_1', 'Session 1 stores access token server-side');

  // 2.2 Session Retrieval
  const fetchedSession1 = await store.getSession(session1.sessionId);
  check(fetchedSession1 !== null, 'Session 1 retrieved successfully by ID');
  check(fetchedSession1?.sessionId === session1.sessionId, 'Fetched session matches requested ID');
  check(fetchedSession1?.userId === 'usr-admin-elrico', 'Fetched session preserves userId');
  check(fetchedSession1?.accessToken === 'ya29.elrico_access_token_1', 'Fetched session preserves access token');

  // 2.3 Session Token Update (Refresh)
  const newAccessToken = 'ya29.elrico_refreshed_access_token_2';
  const newExpiresAt = Date.now() + 3600 * 1000;
  await store.updateSessionToken(session1.sessionId, newAccessToken, newExpiresAt);

  const updatedSession1 = await store.getSession(session1.sessionId);
  check(updatedSession1?.accessToken === newAccessToken, 'updateSessionToken updates access token in Firestore');
  check(updatedSession1?.tokenExpiresAt === newExpiresAt, 'updateSessionToken updates token expiry');

  // 2.4 Session Expiration
  const expiredSession = await store.createSession({
    userId: 'usr-admin-elrico',
    googleEmail: 'elrico@tsjoinery.co.za',
    employeeEmail: 'elrico@tsjoinery.co.za',
    ttlSeconds: -60 // expired 60 seconds ago
  });

  const fetchedExpired = await store.getSession(expiredSession.sessionId);
  check(fetchedExpired === null, 'Expired session is strictly rejected and returns null');

  // 2.5 Session Revocation
  const sessionToRevoke = await store.createSession({
    userId: 'usr-admin-elrico',
    googleEmail: 'elrico@tsjoinery.co.za',
    employeeEmail: 'elrico@tsjoinery.co.za',
    ttlSeconds: 3600
  });

  const revokeRes = await store.revokeSession(sessionToRevoke.sessionId);
  check(revokeRes === true, 'revokeSession returns true on active session');

  const fetchedRevoked = await store.getSession(sessionToRevoke.sessionId);
  check(fetchedRevoked === null, 'Revoked session is strictly rejected on getSession');

  // 2.6 Session Deletion
  const sessionToDelete = await store.createSession({
    userId: 'usr-admin-elrico',
    googleEmail: 'elrico@tsjoinery.co.za',
    employeeEmail: 'elrico@tsjoinery.co.za',
    ttlSeconds: 3600
  });

  const deleteRes = await store.deleteSession(sessionToDelete.sessionId);
  check(deleteRes === true, 'deleteSession returns true');

  const fetchedDeleted = await store.getSession(sessionToDelete.sessionId);
  check(fetchedDeleted === null, 'Deleted session document returns null');

  // =========================================================================
  // 3. OAUTH CREDENTIAL CRUD TESTS
  // =========================================================================
  // 3.1 Save Credential
  const elricoCred: StoredOAuthCredential = {
    userId: 'usr-admin-elrico',
    googleEmail: 'elrico@tsjoinery.co.za',
    employeeEmail: 'elrico@tsjoinery.co.za',
    encryptedRefreshToken: 'enc_iv1.tag1.cipher_refresh_elrico',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'active'
  };

  await store.saveCredential(elricoCred);

  // 3.2 Retrieve Credential
  const fetchedCred = await store.getCredential('usr-admin-elrico');
  check(fetchedCred !== null, 'getCredential successfully retrieves active credential');
  check(fetchedCred?.userId === 'usr-admin-elrico', 'Retrieved credential matches userId');
  check(fetchedCred?.googleEmail === 'elrico@tsjoinery.co.za', 'Retrieved credential matches googleEmail');
  check(fetchedCred?.encryptedRefreshToken === 'enc_iv1.tag1.cipher_refresh_elrico', 'Retrieved credential matches encrypted token');
  check(fetchedCred?.status === 'active', 'Retrieved credential status is active');

  // Non-existent user returns null
  const nonExistentCred = await store.getCredential('usr-non-existent');
  check(nonExistentCred === null, 'getCredential returns null for non-existent userId');

  // 3.3 Revoke Credential
  const revokeCredRes = await store.revokeCredential('usr-admin-elrico');
  check(revokeCredRes === true, 'revokeCredential returns true');

  const fetchedRevokedCred = await store.getCredential('usr-admin-elrico');
  check(fetchedRevokedCred === null, 'Revoked credential is excluded from getCredential');

  // Re-save credential
  await store.saveCredential(elricoCred);
  const reSavedCred = await store.getCredential('usr-admin-elrico');
  check(reSavedCred !== null && reSavedCred.status === 'active', 'Credential can be saved / updated after revocation');

  // 3.4 Delete Credential
  const deleteCredRes = await store.deleteCredential('usr-admin-elrico');
  check(deleteCredRes === true, 'deleteCredential returns true');

  const fetchedDeletedCred = await store.getCredential('usr-admin-elrico');
  check(fetchedDeletedCred === null, 'Deleted credential returns null');

  // =========================================================================
  // 4. MULTI-USER & MULTI-SESSION ISOLATION TESTS
  // =========================================================================
  // User 1: Elrico (Admin)
  const elricoSessionA = await store.createSession({
    userId: 'usr-admin-elrico',
    googleEmail: 'elrico@tsjoinery.co.za',
    employeeEmail: 'elrico@tsjoinery.co.za',
    ttlSeconds: 3600,
    accessToken: 'token-elrico-device-A'
  });

  const elricoSessionB = await store.createSession({
    userId: 'usr-admin-elrico',
    googleEmail: 'elrico@tsjoinery.co.za',
    employeeEmail: 'elrico@tsjoinery.co.za',
    ttlSeconds: 3600,
    accessToken: 'token-elrico-device-B'
  });

  // User 2: Juan (Supervisor)
  const juanSession = await store.createSession({
    userId: 'usr-supervisor-juan',
    googleEmail: 'juan@tsjoinery.co.za',
    employeeEmail: 'juan@tsjoinery.co.za',
    ttlSeconds: 3600,
    accessToken: 'token-juan-device-1'
  });

  // 4.1 Session ID non-collision & isolation
  check(elricoSessionA.sessionId !== elricoSessionB.sessionId, 'Elrico sessions have distinct non-colliding IDs');
  check(elricoSessionA.sessionId !== juanSession.sessionId, 'Elrico and Juan sessions have distinct IDs');

  // 4.2 Individual session lifecycle isolation
  await store.revokeSession(elricoSessionA.sessionId);
  check((await store.getSession(elricoSessionA.sessionId)) === null, 'Elrico Session A is revoked');
  check((await store.getSession(elricoSessionB.sessionId)) !== null, 'Elrico Session B remains active despite Session A revocation');
  check((await store.getSession(juanSession.sessionId)) !== null, 'Juan session remains active despite Elrico revocation');

  // 4.3 Multi-user credential isolation
  await store.saveCredential({
    userId: 'usr-admin-elrico',
    googleEmail: 'elrico@tsjoinery.co.za',
    employeeEmail: 'elrico@tsjoinery.co.za',
    encryptedRefreshToken: 'refresh_token_elrico_authenticated',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'active'
  });

  await store.saveCredential({
    userId: 'usr-supervisor-juan',
    googleEmail: 'juan@tsjoinery.co.za',
    employeeEmail: 'juan@tsjoinery.co.za',
    encryptedRefreshToken: 'refresh_token_juan_authenticated',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'active'
  });

  const cElrico = await store.getCredential('usr-admin-elrico');
  const cJuan = await store.getCredential('usr-supervisor-juan');

  check(cElrico?.encryptedRefreshToken === 'refresh_token_elrico_authenticated', 'Elrico credential isolated and intact');
  check(cJuan?.encryptedRefreshToken === 'refresh_token_juan_authenticated', 'Juan credential isolated and intact');

  // Revoke Juan's credential, verify Elrico's is untouched
  await store.revokeCredential('usr-supervisor-juan');
  check((await store.getCredential('usr-supervisor-juan')) === null, 'Juan credential is revoked');
  check((await store.getCredential('usr-admin-elrico')) !== null, 'Elrico credential remains active and untouched');

  // =========================================================================
  // 5. CLIENT-SAFE SECURITY & PREVIEW SAFETY
  // =========================================================================
  const liveElricoSession = await store.getSession(elricoSessionB.sessionId);
  const clientSafe = store.toClientSafeStatus(liveElricoSession);

  check(clientSafe.connected === true, 'Client safe status connected: true');
  check(clientSafe.googleEmail === 'elrico@tsjoinery.co.za', 'Client safe status contains googleEmail');
  check(clientSafe.canSend === true, 'Client safe status canSend: true');
  check((clientSafe as any).accessToken === undefined, 'Client safe status NEVER contains accessToken');
  check((clientSafe as any).sessionId === undefined, 'Client safe status NEVER contains sessionId');
  check((clientSafe as any).userId === undefined, 'Client safe status NEVER contains userId');

  // Malformed session IDs rejection
  check(!store.isValidSessionId(''), 'Rejects empty sessionId');
  check(!store.isValidSessionId(null), 'Rejects null sessionId');
  check(!store.isValidSessionId('../traversal'), 'Rejects path traversal');
  check(!store.isValidSessionId('a'.repeat(63)), 'Rejects 63-char sessionId');
  check(!store.isValidSessionId('a'.repeat(65)), 'Rejects 65-char sessionId');
  check(!store.isValidSessionId('z'.repeat(64)), 'Rejects non-hex characters');

  // =========================================================================
  // 6. PRODUCTION RUNTIME BUNDLE & BUILDPACK CONFIGURATION INTEGRITY
  // =========================================================================
  const fs = await import('fs');
  const path = await import('path');

  const bundlePath = path.resolve(process.cwd(), 'dist', 'server.cjs');
  check(fs.existsSync(bundlePath), 'Compiled bundle dist/server.cjs exists');

  const bundleContent = fs.readFileSync(bundlePath, 'utf8');

  // Verify bundle contains the corrected 5-component paths
  check(
    bundleContent.includes('artifacts/timbersmith-terminal-v1/private/oauth/sessions'),
    'Bundle dist/server.cjs strictly contains corrected sessions path (private/oauth/sessions)'
  );
  check(
    bundleContent.includes('artifacts/timbersmith-terminal-v1/private/oauth/credentials'),
    'Bundle dist/server.cjs strictly contains corrected credentials path (private/oauth/credentials)'
  );

  // Strictly verify bundle contains ZERO occurrences of legacy 4-component invalid paths
  check(
    !bundleContent.includes('artifacts/timbersmith-terminal-v1/private/oauth_sessions'),
    'Bundle dist/server.cjs strictly contains ZERO occurrences of invalid oauth_sessions path'
  );
  check(
    !bundleContent.includes('artifacts/timbersmith-terminal-v1/private/oauth_credentials'),
    'Bundle dist/server.cjs strictly contains ZERO occurrences of invalid oauth_credentials path'
  );
  check(
    !bundleContent.includes('private/oauth_sessions'),
    'Bundle dist/server.cjs contains ZERO occurrences of substring private/oauth_sessions'
  );
  check(
    !bundleContent.includes('private/oauth_credentials'),
    'Bundle dist/server.cjs contains ZERO occurrences of substring private/oauth_credentials'
  );

  // Verify source server/sessionStore.ts contains ZERO occurrences of invalid paths
  const sessionStoreSource = fs.readFileSync(path.resolve(process.cwd(), 'server', 'sessionStore.ts'), 'utf8');
  check(
    !sessionStoreSource.includes('private/oauth_sessions'),
    'server/sessionStore.ts contains ZERO occurrences of private/oauth_sessions'
  );
  check(
    !sessionStoreSource.includes('private/oauth_credentials'),
    'server/sessionStore.ts contains ZERO occurrences of private/oauth_credentials'
  );

  // Verify package.json contains gcp-build to ensure Cloud Run / Cloud Buildpack invokes fresh build
  const pkgJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
  check(pkgJson.scripts['gcp-build'] === 'npm run build', 'package.json contains gcp-build script for Cloud Buildpack');
  check(pkgJson.scripts['start'] === 'node dist/server.cjs', 'package.json start command executes compiled node dist/server.cjs');
  check(pkgJson.scripts['prestart'] === undefined, 'package.json avoids redundant prestart rebuild during container boot');

  console.log(`\n=== ALL ${passedTests}/${totalTests} PHASE 6 TESTS PASSED ===\n`);
}

runTestSuite().catch(err => {
  console.error('Phase 6 test suite failure:', err);
  process.exit(1);
});
