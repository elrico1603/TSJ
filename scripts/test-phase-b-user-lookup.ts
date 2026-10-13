/**
 * Comprehensive Unit Tests for Phase B User Lookup Service
 * 
 * Verifies:
 * 1. Normal lookup success with exact email match.
 * 2. Case-insensitivity and whitespace trimming.
 * 3. Documented alias handling (frans@tsjoinery.co.za -> franz@tsjoinery.co.za).
 * 4. Documented alias isolation (undocumented aliases are never silently invented).
 * 5. Unapproved user rejection (isApproved !== true).
 * 6. Inactive user rejection (active === false).
 * 7. Missing or malformed user ID rejection (id: "" or null).
 * 8. Zero matches rejection (USER_NOT_FOUND).
 * 9. Multiple matches rejection (MULTIPLE_MATCHES fail-closed).
 * 10. Invalid input rejection (empty, null, non-string, missing @).
 * 11. Sensitive credential stripping (PIN, passwords, pinHash never leaked).
 * 12. Helper findAuthoritativeUser method behavior.
 * 13. Firestore database error handling (fails closed with LOOKUP_FAILED).
 * 14. Pluggable in-memory adapter isolation (no live Firestore connection).
 */

import {
  UserLookupService,
  IUserLookupFirestore,
  IUserLookupQuery,
  IUserLookupQuerySnapshot,
  ACTIVE_USERS_COLLECTION_PATH,
  normalizeEmail,
  resolveDocumentedAlias,
  DOCUMENTED_EMAIL_ALIASES
} from '../server/userLookupService';

// Mock in-memory Firestore adapter for User Lookup
class MockUserFirestore implements IUserLookupFirestore {
  public docs = new Map<string, any>();
  public shouldThrowOnGet = false;

  collection(collPath: string) {
    if (collPath !== ACTIVE_USERS_COLLECTION_PATH) {
      throw new Error(`Unexpected collection path: ${collPath}`);
    }

    const self = this;
    return {
      where(field: string, opStr: string, value: any): IUserLookupQuery {
        return {
          where(f: string, op: string, v: any) {
            return this;
          },
          async get(): Promise<IUserLookupQuerySnapshot> {
            if (self.shouldThrowOnGet) {
              throw new Error('Simulated Firestore connection error');
            }

            const matched: Array<{ id: string; data: () => any }> = [];
            for (const [id, docData] of self.docs.entries()) {
              if (opStr === '==' && docData[field] === value) {
                matched.push({
                  id,
                  data: () => JSON.parse(JSON.stringify(docData))
                });
              }
            }

            return {
              empty: matched.length === 0,
              size: matched.length,
              docs: matched
            };
          }
        };
      },
      async get(): Promise<IUserLookupQuerySnapshot> {
        if (self.shouldThrowOnGet) {
          throw new Error('Simulated Firestore connection error');
        }
        const matched = Array.from(self.docs.entries()).map(([id, docData]) => ({
          id,
          data: () => JSON.parse(JSON.stringify(docData))
        }));
        return {
          empty: matched.length === 0,
          size: matched.length,
          docs: matched
        };
      }
    };
  }
}

async function runTests() {
  console.log('=== STARTING PHASE B USER LOOKUP SERVICE TESTS ===\n');
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

  // 1. Email Normalization Function Tests
  assert(normalizeEmail('  Elrico@TSJoinery.co.za  ') === 'elrico@tsjoinery.co.za', 'normalizeEmail trims and lowercases');
  assert(normalizeEmail('') === '', 'normalizeEmail handles empty string');
  assert(normalizeEmail(null) === '', 'normalizeEmail handles null');
  assert(normalizeEmail(undefined) === '', 'normalizeEmail handles undefined');
  assert(normalizeEmail(12345) === '', 'normalizeEmail handles non-string');

  // 2. Documented Alias Mapping Invariants
  assert(DOCUMENTED_EMAIL_ALIASES['frans@tsjoinery.co.za'] === 'franz@tsjoinery.co.za', 'frans maps to franz in documented alias map');
  assert(resolveDocumentedAlias('frans@tsjoinery.co.za') === 'franz@tsjoinery.co.za', 'resolveDocumentedAlias resolves frans to franz');
  assert(resolveDocumentedAlias('elrico@tsjoinery.co.za') === 'elrico@tsjoinery.co.za', 'resolveDocumentedAlias leaves non-aliased email unchanged');
  assert(resolveDocumentedAlias('john@tsjoinery.co.za') === 'john@tsjoinery.co.za', 'Undocumented alias is NOT resolved');

  // Setup mock database
  const mockDb = new MockUserFirestore();
  const service = new UserLookupService(mockDb);

  // Seed sample users into mock store
  mockDb.docs.set('usr-admin-elrico', {
    id: 'usr-admin-elrico',
    name: 'Elrico Greyvenstein',
    firstName: 'Elrico',
    lastName: 'Greyvenstein',
    email: 'elrico@tsjoinery.co.za',
    role: 'Administrator',
    department: 'Management',
    branchId: 'BFN-01',
    branchName: 'Bloemfontein Central',
    active: true,
    isApproved: true,
    status: 'active',
    pin: 'Elrico1603!!',
    password: 'super-secret-password-hash',
    pinHash: 'sha256-hash-value'
  });

  mockDb.docs.set('usr-hr-franz', {
    id: 'usr-hr-franz',
    name: 'Franz Posthumus',
    firstName: 'Franz',
    lastName: 'Posthumus',
    email: 'franz@tsjoinery.co.za',
    role: 'HR',
    department: 'Human Resources',
    branchId: 'BFN-01',
    branchName: 'Bloemfontein Central',
    active: true,
    isApproved: true,
    status: 'active',
    pin: '1234'
  });

  // 3. Normal Lookup Success
  const elricoRes = await service.lookupUser('elrico@tsjoinery.co.za');
  assert(elricoRes.success === true, 'Valid user lookup succeeds');
  if (elricoRes.success) {
    assert(elricoRes.user.id === 'usr-admin-elrico', 'User ID matches canonical ID');
    assert(elricoRes.user.email === 'elrico@tsjoinery.co.za', 'Email matches canonical email');
    assert(elricoRes.user.name === 'Elrico Greyvenstein', 'Name is populated');
    assert(elricoRes.user.role === 'Administrator', 'Role is populated');
    assert(elricoRes.user.active === true, 'User is active');
    assert(elricoRes.user.isApproved === true, 'User is approved');
  }

  // 4. Case-Insensitivity & Whitespace Normalization
  const casingRes = await service.lookupUser('   ELRICO@TSJOINERY.CO.ZA   ');
  assert(casingRes.success === true, 'Lookup with uppercase and whitespace succeeds');
  if (casingRes.success) {
    assert(casingRes.user.id === 'usr-admin-elrico', 'Resolves to correct user ID despite casing/spaces');
  }

  // 5. Documented Alias Handling (frans -> franz)
  const aliasRes = await service.lookupUser('frans@tsjoinery.co.za');
  assert(aliasRes.success === true, 'Documented alias frans@tsjoinery.co.za resolves successfully');
  if (aliasRes.success) {
    assert(aliasRes.user.id === 'usr-hr-franz', 'Resolves to canonical Franz account');
    assert(aliasRes.user.email === 'franz@tsjoinery.co.za', 'Returned email is canonical franz@tsjoinery.co.za');
  }

  const aliasCasingRes = await service.lookupUser('  FRANS@tsjoinery.co.za  ');
  assert(aliasCasingRes.success === true, 'Documented alias with whitespace & casing resolves successfully');
  if (aliasCasingRes.success) {
    assert(aliasCasingRes.user.id === 'usr-hr-franz', 'Resolves to canonical Franz account with casing');
  }

  // 6. Sensitive Data Stripping (PIN, passwords, hashes)
  if (elricoRes.success) {
    assert((elricoRes.user as any).pin === undefined, 'PIN is strictly deleted/omitted from user object');
    assert((elricoRes.user as any).password === undefined, 'Password is strictly deleted/omitted from user object');
    assert((elricoRes.user as any).pinHash === undefined, 'pinHash is strictly deleted/omitted from user object');
  }

  // 7. Zero Matches Rejection
  const notFoundRes = await service.lookupUser('nonexistent@tsjoinery.co.za');
  assert(notFoundRes.success === false, 'Non-existent email lookup fails');
  if (notFoundRes.success === false) {
    assert(notFoundRes.code === 'USER_NOT_FOUND', 'Failure code is USER_NOT_FOUND');
  }

  // 8. Inactive User Rejection (active === false)
  mockDb.docs.set('usr-inactive-user', {
    id: 'usr-inactive-user',
    name: 'Inactive Worker',
    email: 'inactive@tsjoinery.co.za',
    role: 'Employee',
    active: false,
    isApproved: true,
    status: 'deactivated',
    pin: '1234'
  });

  const inactiveRes = await service.lookupUser('inactive@tsjoinery.co.za');
  assert(inactiveRes.success === false, 'Inactive user lookup fails');
  if (inactiveRes.success === false) {
    assert(inactiveRes.code === 'USER_INACTIVE', 'Failure code is USER_INACTIVE');
  }

  // 9. Unapproved User Rejection (isApproved !== true)
  mockDb.docs.set('usr-unapproved-user', {
    id: 'usr-unapproved-user',
    name: 'Pending Worker',
    email: 'pending@tsjoinery.co.za',
    role: 'Employee',
    active: true,
    isApproved: false,
    status: 'pending',
    pin: '1234'
  });

  const unapprovedRes = await service.lookupUser('pending@tsjoinery.co.za');
  assert(unapprovedRes.success === false, 'Unapproved user lookup fails');
  if (unapprovedRes.success === false) {
    assert(unapprovedRes.code === 'USER_UNAPPROVED', 'Failure code is USER_UNAPPROVED');
  }

  // 10. Malformed / Missing User ID Rejection
  mockDb.docs.set('usr-missing-id', {
    id: '', // empty id
    name: 'Empty ID User',
    email: 'noid@tsjoinery.co.za',
    role: 'Employee',
    active: true,
    isApproved: true,
    status: 'active'
  });

  const missingIdRes = await service.lookupUser('noid@tsjoinery.co.za');
  assert(missingIdRes.success === false, 'User with empty ID fails');
  if (missingIdRes.success === false) {
    assert(missingIdRes.code === 'MALFORMED_USER_RECORD', 'Failure code is MALFORMED_USER_RECORD');
  }

  // 11. Multiple Matches Rejection (Ambiguity / Duplicate records)
  mockDb.docs.set('usr-dup-1', {
    id: 'usr-dup-1',
    name: 'Duplicate 1',
    email: 'duplicate@tsjoinery.co.za',
    role: 'Employee',
    active: true,
    isApproved: true,
    status: 'active'
  });
  mockDb.docs.set('usr-dup-2', {
    id: 'usr-dup-2',
    name: 'Duplicate 2',
    email: 'duplicate@tsjoinery.co.za',
    role: 'Employee',
    active: true,
    isApproved: true,
    status: 'active'
  });

  const dupRes = await service.lookupUser('duplicate@tsjoinery.co.za');
  assert(dupRes.success === false, 'Multiple matching user records fail closed');
  if (dupRes.success === false) {
    assert(dupRes.code === 'MULTIPLE_MATCHES', 'Failure code is MULTIPLE_MATCHES');
  }

  // 12. Invalid Input Formats
  const emptyRes = await service.lookupUser('');
  assert(emptyRes.success === false && (emptyRes as any).code === 'INVALID_EMAIL', 'Empty email is rejected with INVALID_EMAIL');

  const nullRes = await service.lookupUser(null);
  assert(nullRes.success === false && (nullRes as any).code === 'INVALID_EMAIL', 'Null email is rejected with INVALID_EMAIL');

  const undefinedRes = await service.lookupUser(undefined);
  assert(undefinedRes.success === false && (undefinedRes as any).code === 'INVALID_EMAIL', 'Undefined email is rejected with INVALID_EMAIL');

  const nonStringRes = await service.lookupUser(9999);
  assert(nonStringRes.success === false && (nonStringRes as any).code === 'INVALID_EMAIL', 'Numeric email is rejected with INVALID_EMAIL');

  const noAtRes = await service.lookupUser('invalid-email-no-at-sign');
  assert(noAtRes.success === false && (noAtRes as any).code === 'INVALID_EMAIL', 'Email without @ is rejected with INVALID_EMAIL');

  // 13. Convenience Method findAuthoritativeUser
  const directElrico = await service.findAuthoritativeUser('elrico@tsjoinery.co.za');
  assert(directElrico !== null && directElrico.id === 'usr-admin-elrico', 'findAuthoritativeUser returns user object on success');

  const directNotFound = await service.findAuthoritativeUser('missing@tsjoinery.co.za');
  assert(directNotFound === null, 'findAuthoritativeUser returns null on failure');

  // 14. Database Exception Handling (Fail-closed)
  mockDb.shouldThrowOnGet = true;
  const dbErrorRes = await service.lookupUser('elrico@tsjoinery.co.za');
  assert(dbErrorRes.success === false, 'Database connection error is caught safely');
  if (dbErrorRes.success === false) {
    assert(dbErrorRes.code === 'LOOKUP_FAILED', 'Failure code is LOOKUP_FAILED on database error');
  }
  mockDb.shouldThrowOnGet = false;

  console.log(`\n=== ALL ${passed}/${total} PHASE B USER LOOKUP UNIT TESTS PASSED ===\n`);
}

runTests().catch(err => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
