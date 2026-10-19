/**
 * TS HUB — Phase 5 Duplicate User Prevention Test Suite
 * 
 * Verifies code-level duplicate-prevention in src/auth.ts:
 * 1. Duplicate registration rejection (active, pending, defaults, normalized)
 * 2. Duplicate approval rejection (active conflicts, atomic move)
 * 3. Duplicate active-user creation rejection (fails closed)
 * 4. Failed uniqueness checks fail closed (no error swallowing)
 * 5. Concurrent registration / creation / approval safety (in-flight mutex)
 * 6. Backend MULTIPLE_MATCHES invariant remains strict
 */

import assert from 'assert';

// Provide memory localStorage polyfill for Node.js test environment
if (typeof globalThis.localStorage === 'undefined') {
  const memoryStore = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => memoryStore.get(key) || null,
    setItem: (key: string, val: string) => memoryStore.set(key, String(val)),
    removeItem: (key: string) => memoryStore.delete(key),
    clear: () => memoryStore.clear()
  };
}

(globalThis as any).__FORCE_PRODUCTION_WRITES__ = true;
process.env.NODE_ENV = 'production';

import {
  authManager,
  normalizeUserEmail,
  setFirestoreDbForTesting,
  DEFAULT_ACCOUNTS,
  AppUser
} from '../src/auth';
import { setAuditDbForTesting } from '../src/audit';
import { UserLookupService, ACTIVE_USERS_COLLECTION_PATH } from '../server/userLookupService';

// Test counters
let passed = 0;
let failed = 0;

function it(desc: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${desc}`);
      console.error(err);
      failed++;
    }
  })();
}

/**
 * Mock Firestore for Auth Testing
 */
class MockAuthFirestore {
  public activeDocs = new Map<string, any>();
  public pendingDocs = new Map<string, any>();
  public shouldFailActiveQuery = false;
  public shouldFailPendingQuery = false;
  public shouldFailBatch = false;

  collection(path: string) {
    const isArtifacts = path === 'artifacts';
    return {
      doc: (appId: string) => ({
        collection: (priv: string) => ({
          doc: (docId: string) => {
            if (docId === 'audit') {
              return {
                collection: (sub: string) => ({
                  add: async (entry: any) => {}
                })
              };
            }
            return {
              collection: (subColl: string) => this.getSubCollection(subColl)
            };
          }
        })
      })
    };
  }

  getSubCollection(subColl: string) {
    const isPending = subColl === 'pending';
    const store = isPending ? this.pendingDocs : this.activeDocs;

    return {
      doc: (docId: string) => ({
        id: docId,
        ref: { delete: async () => store.delete(docId) },
        get: async () => {
          if (!isPending && this.shouldFailActiveQuery) {
            throw new Error('Simulated Firestore active get error');
          }
          if (isPending && this.shouldFailPendingQuery) {
            throw new Error('Simulated Firestore pending get error');
          }
          const data = store.get(docId);
          return {
            exists: !!data,
            id: docId,
            data: () => data
          };
        },
        set: async (docData: any) => {
          store.set(docId, { ...docData, id: docId });
        },
        delete: async () => {
          store.delete(docId);
        }
      }),
      where: (field: string, op: string, value: any) => ({
        get: async () => {
          if (!isPending && this.shouldFailActiveQuery) {
            throw new Error('Simulated Firestore active query error');
          }
          if (isPending && this.shouldFailPendingQuery) {
            throw new Error('Simulated Firestore pending query error');
          }
          const matches: any[] = [];
          for (const [id, data] of store.entries()) {
            if (data[field] === value) {
              matches.push({
                id,
                ref: { delete: async () => store.delete(id) },
                data: () => data
              });
            }
          }
          return {
            empty: matches.length === 0,
            docs: matches,
            size: matches.length
          };
        }
      })
    };
  }

  batch() {
    const operations: Array<() => Promise<void>> = [];
    return {
      set: (docRef: any, data: any) => {
        operations.push(async () => {
          await docRef.set(data);
        });
      },
      delete: (docRef: any) => {
        operations.push(async () => {
          await docRef.delete();
        });
      },
      commit: async () => {
        if (this.shouldFailBatch) {
          throw new Error('Simulated Firestore batch commit failure');
        }
        for (const op of operations) {
          await op();
        }
      }
    };
  }
}

async function runPhase5TestSuite() {
  console.log('=== STARTING PHASE 5 DUPLICATE USER PREVENTION TESTS ===\n');

  const mockDb = new MockAuthFirestore();
  setFirestoreDbForTesting(mockDb);
  setAuditDbForTesting(mockDb);

  // 1. Email Normalization Tests
  await it('normalizeUserEmail trims whitespace and lowercases email', () => {
    assert.strictEqual(normalizeUserEmail('  User@TsJoinery.Co.Za  '), 'user@tsjoinery.co.za');
    assert.strictEqual(normalizeUserEmail('ELRICO@TSJOINERY.CO.ZA'), 'elrico@tsjoinery.co.za');
  });

  await it('normalizeUserEmail normalises frans@tsjoinery.co.za exactly to frans@tsjoinery.co.za without alias conversion', () => {
    assert.strictEqual(normalizeUserEmail('frans@tsjoinery.co.za'), 'frans@tsjoinery.co.za');
    assert.strictEqual(normalizeUserEmail('  Frans@TSJoinery.CO.ZA '), 'frans@tsjoinery.co.za');
  });

  await it('frans@tsjoinery.co.za and franz@tsjoinery.co.za remain separate email identities', () => {
    assert.notStrictEqual(normalizeUserEmail('frans@tsjoinery.co.za'), normalizeUserEmail('franz@tsjoinery.co.za'));
    assert.strictEqual(normalizeUserEmail('franz@tsjoinery.co.za'), 'franz@tsjoinery.co.za');
    assert.strictEqual(normalizeUserEmail('frans@tsjoinery.co.za'), 'frans@tsjoinery.co.za');
  });

  await it('normalizeUserEmail returns empty string for non-string input', () => {
    assert.strictEqual(normalizeUserEmail(null), '');
    assert.strictEqual(normalizeUserEmail(undefined), '');
    assert.strictEqual(normalizeUserEmail(12345), '');
  });

  // Seed default active user in mockDb
  mockDb.activeDocs.set('usr-admin-elrico', {
    id: 'usr-admin-elrico',
    email: 'elrico@tsjoinery.co.za',
    name: 'Elrico Greyvenstein',
    role: 'Administrator',
    active: true,
    isApproved: true
  });

  mockDb.activeDocs.set('usr-hr-franz', {
    id: 'usr-hr-franz',
    email: 'franz@tsjoinery.co.za',
    name: 'Franz Posthumus',
    role: 'HR',
    active: true,
    isApproved: true
  });

  // 2. Duplicate Registration Tests
  await it('registerUserRequest rejects when email already exists in active users', async () => {
    let errorCaught = false;
    try {
      await authManager.registerUserRequest({
        id: 'req-dup-1',
        name: 'Elrico Duplicate',
        email: 'elrico@tsjoinery.co.za',
        role: 'Supervisor',
        pin: '123456'
      });
    } catch (err: any) {
      errorCaught = true;
      assert(err.message.includes('already exists'), 'Error mentions user already exists');
    }
    assert(errorCaught, 'Expected duplicate registration to throw');
  });

  await it('registerUserRequest rejects when email has different casing / whitespace', async () => {
    let errorCaught = false;
    try {
      await authManager.registerUserRequest({
        id: 'req-dup-2',
        name: 'Elrico Upper',
        email: '  ELRICO@TSJOINERY.CO.ZA  ',
        role: 'Supervisor',
        pin: '123456'
      });
    } catch (err: any) {
      errorCaught = true;
      assert(err.message.includes('already exists'), 'Error mentions user already exists');
    }
    assert(errorCaught, 'Expected case-insensitive duplicate registration to throw');
  });

  await it('registerUserRequest treats frans@tsjoinery.co.za as independent from franz@tsjoinery.co.za', async () => {
    // franz exists in activeDocs; frans is a distinct identity and can register
    const entry = await authManager.registerUserRequest({
      id: 'req-frans-distinct',
      name: 'Frans Posthumus',
      email: 'frans@tsjoinery.co.za',
      role: 'Manager',
      pin: '123456'
    });
    assert.strictEqual(entry.email, 'frans@tsjoinery.co.za');
    assert.strictEqual(mockDb.pendingDocs.has('req-frans-distinct'), true);
  });

  await it('registerUserRequest rejects duplicate registration for frans@tsjoinery.co.za once pending', async () => {
    let errorCaught = false;
    try {
      await authManager.registerUserRequest({
        id: 'req-frans-second',
        name: 'Frans Second Attempt',
        email: '  FRANS@tsjoinery.co.za  ',
        role: 'Manager',
        pin: '123456'
      });
    } catch (err: any) {
      errorCaught = true;
      assert(err.message.includes('already pending approval'), 'Error mentions already pending');
    }
    assert(errorCaught, 'Expected duplicate registration for frans to throw');
  });

  await it('registerUserRequest rejects when email matches default accounts', async () => {
    let errorCaught = false;
    try {
      await authManager.registerUserRequest({
        id: 'req-dup-janah',
        name: 'Janah Dup',
        email: 'janah@tsjoinery.co.za',
        role: 'Manager',
        pin: '123456'
      });
    } catch (err: any) {
      errorCaught = true;
      assert(err.message.includes('already exists'), 'Error mentions user already exists');
    }
    assert(errorCaught, 'Expected default account duplicate registration to throw');
  });

  await it('registerUserRequest allows valid unique email registration', async () => {
    const entry = await authManager.registerUserRequest({
      id: 'req-unique-new',
      name: 'New Employee',
      email: 'newbie@tsjoinery.co.za',
      role: 'Employee',
      pin: '654321'
    });
    assert.strictEqual(entry.email, 'newbie@tsjoinery.co.za');
    assert.strictEqual(entry.status, 'pending');
    assert.strictEqual(mockDb.pendingDocs.has('req-unique-new'), true);
  });

  await it('registerUserRequest rejects second registration for already pending email', async () => {
    let errorCaught = false;
    try {
      await authManager.registerUserRequest({
        id: 'req-unique-second',
        name: 'New Employee Second Attempt',
        email: 'newbie@tsjoinery.co.za',
        role: 'Employee',
        pin: '654321'
      });
    } catch (err: any) {
      errorCaught = true;
      assert(err.message.includes('already pending approval'), 'Error mentions request already pending');
    }
    assert(errorCaught, 'Expected duplicate pending registration to throw');
  });

  // 3. Duplicate Approval Tests
  await it('approvePendingUser rejects approval if an active user already exists with that email', async () => {
    // Simulate a pending request for elrico that somehow bypassed earlier checks
    mockDb.pendingDocs.set('1780921326575', {
      id: '1780921326575',
      name: 'Elrico Duplicate Pending',
      email: 'elrico@tsjoinery.co.za',
      role: 'Supervisor',
      status: 'pending',
      isApproved: false
    });

    let errorCaught = false;
    try {
      await authManager.approvePendingUser({
        id: '1780921326575',
        name: 'Elrico Duplicate Pending',
        email: 'elrico@tsjoinery.co.za',
        role: 'Supervisor',
        pin: '123456',
        status: 'pending',
        isApproved: false,
        createdAt: '2026-06-08T12:22:06.575Z'
      });
    } catch (err: any) {
      errorCaught = true;
      assert(err.message.includes('already exists'), 'Error states user already exists');
    }
    assert(errorCaught, 'Expected approval of duplicate email to throw');
    // Ensure the duplicate document was NOT written to activeDocs
    assert.strictEqual(mockDb.activeDocs.has('1780921326575'), false);
    // Ensure canonical master account usr-admin-elrico was not overwritten
    assert.strictEqual(mockDb.activeDocs.get('usr-admin-elrico')?.id, 'usr-admin-elrico');
  });

  await it('approvePendingUser successfully approves unique pending request and deletes from pending', async () => {
    assert.strictEqual(mockDb.pendingDocs.has('req-unique-new'), true);
    const approved = await authManager.approvePendingUser({
      id: 'req-unique-new',
      name: 'New Employee',
      email: 'newbie@tsjoinery.co.za',
      role: 'Employee',
      pin: '654321',
      status: 'pending',
      isApproved: false,
      createdAt: new Date().toISOString()
    });

    assert.strictEqual(approved.status, 'active');
    assert.strictEqual(approved.isApproved, true);
    assert.strictEqual(mockDb.activeDocs.has('req-unique-new'), true);
    assert.strictEqual(mockDb.pendingDocs.has('req-unique-new'), false);
  });

  // 4. Duplicate Active User Creation Tests
  await it('createActiveUser rejects creation when email already exists in active users', async () => {
    let errorCaught = false;
    try {
      await authManager.createActiveUser({
        name: 'Elrico Another Duplicate',
        email: 'elrico@tsjoinery.co.za',
        pin: '654321',
        role: 'Supervisor'
      });
    } catch (err: any) {
      errorCaught = true;
      assert(err.message.includes('already exists'), 'Error states user already exists');
    }
    assert(errorCaught, 'Expected createActiveUser with duplicate email to throw');
  });

  await it('createActiveUser rejects creation when email has uppercase/spaces', async () => {
    let errorCaught = false;
    try {
      await authManager.createActiveUser({
        name: 'Newbie Dup',
        email: '  NEWBIE@TSJOINERY.CO.ZA  ',
        pin: '654321',
        role: 'Employee'
      });
    } catch (err: any) {
      errorCaught = true;
      assert(err.message.includes('already exists'), 'Error states user already exists');
    }
    assert(errorCaught, 'Expected createActiveUser with case-insensitive duplicate email to throw');
  });

  await it('createActiveUser successfully creates unique active user and cleans up any pending doc', async () => {
    // Add a pending doc with the same email to verify cleanup
    mockDb.pendingDocs.set('req-artisan-pending', {
      id: 'req-artisan-pending',
      name: 'Artisan Jack',
      email: 'jack@tsjoinery.co.za',
      status: 'pending'
    });

    const created = await authManager.createActiveUser({
      name: 'Artisan Jack',
      email: 'jack@tsjoinery.co.za',
      pin: 'Secret999!',
      role: 'Employee'
    });

    assert.strictEqual(created.email, 'jack@tsjoinery.co.za');
    assert.strictEqual(created.active, true);
    assert.strictEqual(mockDb.activeDocs.has(created.id), true);
    assert.strictEqual(mockDb.pendingDocs.has('req-artisan-pending'), false, 'Pending doc was cleaned up');
  });

  // 5. Fail-Closed Verification (No Error Swallowing)
  await it('assertEmailUniqueness fails closed when Firestore active query errors', async () => {
    mockDb.shouldFailActiveQuery = true;
    let errorCaught = false;
    try {
      await authManager.assertEmailUniqueness('unknown-unique@tsjoinery.co.za');
    } catch (err: any) {
      errorCaught = true;
      assert(err.message.includes('Unable to verify user uniqueness in database'), 'Throws fail-closed database error');
    } finally {
      mockDb.shouldFailActiveQuery = false;
    }
    assert(errorCaught, 'Expected database query error to fail closed');
  });

  await it('registerUserRequest fails closed when Firestore active query errors', async () => {
    mockDb.shouldFailActiveQuery = true;
    let errorCaught = false;
    try {
      await authManager.registerUserRequest({
        id: 'req-fail-closed',
        name: 'Fail Closed Test',
        email: 'failclosed@tsjoinery.co.za',
        pin: '123456',
        role: 'Employee'
      });
    } catch (err: any) {
      errorCaught = true;
      assert(err.message.includes('Unable to verify user uniqueness'), 'Fails closed on DB error');
    } finally {
      mockDb.shouldFailActiveQuery = false;
    }
    assert(errorCaught, 'Expected registration to fail closed on database error');
    assert.strictEqual(mockDb.pendingDocs.has('req-fail-closed'), false, 'Document was not persisted');
  });

  await it('createActiveUser fails closed when Firestore active query errors', async () => {
    mockDb.shouldFailActiveQuery = true;
    let errorCaught = false;
    try {
      await authManager.createActiveUser({
        name: 'Fail Closed Create',
        email: 'failcreate@tsjoinery.co.za',
        pin: 'Secret999!',
        role: 'Employee'
      });
    } catch (err: any) {
      errorCaught = true;
      assert(err.message.includes('Unable to verify user uniqueness in database'), 'Fails closed on DB error');
    } finally {
      mockDb.shouldFailActiveQuery = false;
    }
    assert(errorCaught, 'Expected createActiveUser to fail closed on database error');
  });

  // 6. Concurrency & In-Flight Mutex Tests
  await it('in-flight mutex rejects parallel concurrent registration attempts for same email', async () => {
    const email = 'concurrent.reg@tsjoinery.co.za';
    
    // Launch two parallel registration requests simultaneously
    const promise1 = authManager.registerUserRequest({
      id: 'concurrent-1',
      name: 'Concurrent User 1',
      email,
      pin: 'Secret123!',
      role: 'Employee'
    });

    const promise2 = authManager.registerUserRequest({
      id: 'concurrent-2',
      name: 'Concurrent User 2',
      email,
      pin: 'Secret123!',
      role: 'Employee'
    });

    const results = await Promise.allSettled([promise1, promise2]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent request succeeds');
    assert.strictEqual(rejected.length, 1, 'Concurrent duplicate request is rejected');
    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
    assert(
      rejectionReason.message.includes('already in progress') || rejectionReason.message.includes('already'),
      'Rejection reason indicates concurrent operation or duplicate'
    );
  });

  await it('in-flight mutex rejects parallel concurrent createActiveUser attempts for same email', async () => {
    const email = 'concurrent.create@tsjoinery.co.za';

    const p1 = authManager.createActiveUser({
      name: 'Concurrent Creator 1',
      email,
      pin: 'Secret123!',
      role: 'Employee'
    });

    const p2 = authManager.createActiveUser({
      name: 'Concurrent Creator 2',
      email,
      pin: 'Secret123!',
      role: 'Employee'
    });

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent creation succeeds');
    assert.strictEqual(rejected.length, 1, 'Concurrent duplicate creation is rejected');
  });

  // 7. Backend Invariant Check: UserLookupService MULTIPLE_MATCHES Fails Closed
  await it('backend UserLookupService strictly fails closed with MULTIPLE_MATCHES on duplicate records', async () => {
    const backendMockDb = {
      collection: (collPath: string) => {
        return {
          where: (field: string, opStr: string, value: any) => {
            return {
              get: async () => {
                // Simulate returning both documents if querying elrico@tsjoinery.co.za
                if (value === 'elrico@tsjoinery.co.za') {
                  return {
                    empty: false,
                    size: 2,
                    docs: [
                      { id: 'usr-admin-elrico', data: () => ({ id: 'usr-admin-elrico', email: 'elrico@tsjoinery.co.za', active: true, isApproved: true }) },
                      { id: '1780921326575', data: () => ({ id: '1780921326575', email: 'elrico@tsjoinery.co.za', active: true, isApproved: true }) }
                    ]
                  };
                }
                return { empty: true, size: 0, docs: [] };
              }
            };
          }
        };
      }
    };

    const lookupService = new UserLookupService(backendMockDb as any);
    const lookupResult = await lookupService.lookupUser('elrico@tsjoinery.co.za');

    assert.strictEqual(lookupResult.success, false);
    if (!lookupResult.success) {
      assert.strictEqual(lookupResult.code, 'MULTIPLE_MATCHES');
      assert(lookupResult.error.includes('Multiple matching user records found'), 'Error describes multiple matching records');
    }
  });

  await it('setUsers preserves canonical usr-admin-elrico ID even if duplicate is received in snapshot', () => {
    const incomingDocs: AppUser[] = [
      {
        id: '1780921326575',
        name: 'Elrico Greyvenstein',
        email: 'elrico@tsjoinery.co.za',
        role: 'Administrator',
        pin: 'Elrico1603!!',
        isApproved: true,
        status: 'active',
        createdAt: '2026-06-08T12:22:06.575Z'
      }
    ];

    const merged = authManager.setUsers(incomingDocs);
    const elricoUser = merged.find(u => u.email === 'elrico@tsjoinery.co.za');
    assert.strictEqual(elricoUser?.id, 'usr-admin-elrico', 'Canonical ID usr-admin-elrico was preserved');
  });

  // Reset testing adapter
  setFirestoreDbForTesting(null);

  console.log(`\n=== PHASE 5 TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runPhase5TestSuite().catch(err => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
