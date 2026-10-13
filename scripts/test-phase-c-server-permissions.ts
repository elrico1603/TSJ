/**
 * Comprehensive Unit Tests for Phase C Server-Side RBAC Enforcement
 * 
 * Verifies:
 * 1. Explicit Edit allow grants Purchase Order sending.
 * 2. Explicit Approve allow grants Purchase Order sending.
 * 3. Explicit Deny strictly blocks Purchase Order sending.
 * 4. Missing override defaults to Deny.
 * 5. Missing explicit permission inside override defaults to Deny.
 * 6. Legacy 'inherit' strictly defaults to Deny.
 * 7. Administrator role with no explicit permission strictly Denies (no bypass).
 * 8. Role or department cannot grant access.
 * 9. Device access cannot grant functional access.
 * 10. Device-view access cannot grant functional access.
 * 11. Client-supplied permission fields cannot grant access.
 * 12. Conflicting or ambiguous overrides fail closed.
 * 13. User inactive (active === false) or unapproved (isApproved !== true) Denies.
 * 14. Unknown module or action Denies.
 * 15. Override precedence: Override DENY beats profile ALLOW, Override ALLOW beats profile DENY.
 * 16. Authoritative override lookup resolves by userId, email, and documented alias.
 * 17. Timestamp-based resolution for consistent duplicate records.
 * 18. Fail-closed behavior on database error.
 */

import {
  ServerPermissionService,
  IServerPermissionFirestore,
  IOverrideQuery,
  IOverrideQuerySnapshot,
  IOverrideDocRef,
  UserPermissionOverride,
  CANONICAL_PERMISSIONS_COLLECTION
} from '../server/serverPermissionService';
import { AuthoritativeUser } from '../server/userLookupService';

// Mock in-memory Firestore adapter for userPermissionOverrides
class MockPermissionFirestore implements IServerPermissionFirestore {
  public docs = new Map<string, any>();
  public shouldThrow = false;

  collection(collPath: string) {
    if (collPath !== CANONICAL_PERMISSIONS_COLLECTION) {
      throw new Error(`Unexpected collection path: ${collPath}`);
    }

    const self = this;
    return {
      doc(id: string): IOverrideDocRef {
        return {
          async get() {
            if (self.shouldThrow) {
              throw new Error('Simulated Firestore error');
            }
            const exists = self.docs.has(id);
            return {
              exists,
              id,
              data: () => (exists ? JSON.parse(JSON.stringify(self.docs.get(id))) : undefined)
            };
          }
        };
      },
      where(field: string, opStr: string, value: any): IOverrideQuery {
        return {
          where(f: string, op: string, v: any) {
            return this;
          },
          async get(): Promise<IOverrideQuerySnapshot> {
            if (self.shouldThrow) {
              throw new Error('Simulated Firestore error');
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
      async get(): Promise<IOverrideQuerySnapshot> {
        if (self.shouldThrow) {
          throw new Error('Simulated Firestore error');
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
  console.log('=== STARTING PHASE C SERVER-SIDE RBAC ENFORCEMENT TESTS ===\n');
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

  const mockDb = new MockPermissionFirestore();
  const service = new ServerPermissionService(mockDb);

  // Base valid authoritative user
  const baseUser: AuthoritativeUser = {
    id: 'usr-buyer-john',
    email: 'john@tsjoinery.co.za',
    name: 'John Buyer',
    firstName: 'John',
    lastName: 'Buyer',
    role: 'Employee',
    department: 'Purchasing',
    active: true,
    isApproved: true,
    status: 'active'
  };

  // 1. Explicit Edit Allow
  const editAllowOverride: UserPermissionOverride = {
    userId: 'usr-buyer-john',
    userEmail: 'john@tsjoinery.co.za',
    permissions: {
      'Purchase Orders': {
        Edit: 'allow'
      }
    }
  };
  const res1 = service.evaluatePermission(baseUser, editAllowOverride, 'Purchase Orders', 'Edit');
  assert(res1.authorized === true, 'Explicit Edit allow grants Edit permission');
  assert(service.canSendPurchaseOrder(baseUser, editAllowOverride) === true, 'Explicit Edit allow authorizes PO send');

  const editAllowBoolean = {
    ...editAllowOverride,
    permissions: { 'Purchase Orders': { Edit: true } }
  };
  assert(service.canSendPurchaseOrder(baseUser, editAllowBoolean) === true, 'Explicit boolean true grants Edit permission');

  // 2. Explicit Approve Allow
  const approveAllowOverride: UserPermissionOverride = {
    userId: 'usr-buyer-john',
    userEmail: 'john@tsjoinery.co.za',
    permissions: {
      'Purchase Orders': {
        Approve: 'allow'
      }
    }
  };
  const res2 = service.evaluatePermission(baseUser, approveAllowOverride, 'Purchase Orders', 'Approve');
  assert(res2.authorized === true, 'Explicit Approve allow grants Approve permission');
  assert(service.canSendPurchaseOrder(baseUser, approveAllowOverride) === true, 'Explicit Approve allow authorizes PO send');

  // 3. Explicit Deny
  const denyOverride: UserPermissionOverride = {
    userId: 'usr-buyer-john',
    userEmail: 'john@tsjoinery.co.za',
    permissions: {
      'Purchase Orders': {
        Edit: 'deny',
        Approve: 'deny'
      }
    }
  };
  const res3 = service.evaluatePermission(baseUser, denyOverride, 'Purchase Orders', 'Edit');
  assert(res3.authorized === false, 'Explicit Edit deny returns false');
  assert(service.canSendPurchaseOrder(baseUser, denyOverride) === false, 'Explicit Deny blocks PO send');

  const booleanDenyOverride: UserPermissionOverride = {
    userId: 'usr-buyer-john',
    userEmail: 'john@tsjoinery.co.za',
    permissions: {
      'Purchase Orders': {
        Edit: false,
        Approve: false
      }
    }
  };
  assert(service.canSendPurchaseOrder(baseUser, booleanDenyOverride) === false, 'Boolean false explicitly denies PO send');

  // 4. Missing Override (null / undefined)
  assert(service.canSendPurchaseOrder(baseUser, null) === false, 'Null override defaults to Deny');
  assert(service.canSendPurchaseOrder(baseUser, undefined) === false, 'Undefined override defaults to Deny');

  // 5. Missing Explicit Permission (override exists but has no PO permissions)
  const emptyOverride: UserPermissionOverride = {
    userId: 'usr-buyer-john',
    userEmail: 'john@tsjoinery.co.za',
    permissions: {
      'Clocking': {
        View: 'allow'
      }
    }
  };
  assert(service.canSendPurchaseOrder(baseUser, emptyOverride) === false, 'Override with missing PO permissions defaults to Deny');

  // 6. Legacy 'inherit' Denies
  const inheritOverride: UserPermissionOverride = {
    userId: 'usr-buyer-john',
    userEmail: 'john@tsjoinery.co.za',
    permissions: {
      'Purchase Orders': {
        Edit: 'inherit',
        Approve: 'inherit'
      }
    }
  };
  const res6 = service.evaluatePermission(baseUser, inheritOverride, 'Purchase Orders', 'Edit');
  assert(res6.authorized === false, 'Legacy inherit for Edit evaluates to Deny');
  assert(service.canSendPurchaseOrder(baseUser, inheritOverride) === false, 'Legacy inherit strictly denies PO send');

  // 7. Administrator Role With No Explicit Permission Denies (No Bypass)
  const adminUser: AuthoritativeUser = {
    ...baseUser,
    id: 'usr-admin-elrico',
    email: 'elrico@tsjoinery.co.za',
    name: 'Elrico Greyvenstein',
    role: 'Administrator',
    department: 'Management'
  };
  assert(service.canSendPurchaseOrder(adminUser, null) === false, 'Administrator with null override is denied (no bypass)');
  assert(service.canSendPurchaseOrder(adminUser, emptyOverride) === false, 'Administrator without explicit PO permission is denied');

  // 8. Role or Department Cannot Grant Access
  const purchasingRoleUser: AuthoritativeUser = {
    ...baseUser,
    role: 'Purchasing',
    department: 'Procurement'
  };
  assert(service.canSendPurchaseOrder(purchasingRoleUser, null) === false, 'Purchasing role name has zero authorization power');

  const managerRoleUser: AuthoritativeUser = {
    ...baseUser,
    role: 'Manager',
    department: 'Management'
  };
  assert(service.canSendPurchaseOrder(managerRoleUser, null) === false, 'Manager role name has zero authorization power');

  // 9. Device Access Cannot Grant Functional Access
  const deviceAccessUser: AuthoritativeUser = {
    ...baseUser,
    deviceAccess: {
      desktop: true,
      phone: true,
      tablet: true,
      terminal: true
    }
  };
  const deviceAccessOverride: UserPermissionOverride = {
    userId: 'usr-buyer-john',
    userEmail: 'john@tsjoinery.co.za',
    deviceAccess: {
      desktop: true,
      phone: true,
      tablet: true,
      terminal: true
    }
  };
  assert(service.canSendPurchaseOrder(deviceAccessUser, deviceAccessOverride) === false, 'Device Access hardware flags do not grant PO send');

  // 10. Device-View Access Cannot Grant Functional Access
  const deviceViewOverride: UserPermissionOverride = {
    userId: 'usr-buyer-john',
    userEmail: 'john@tsjoinery.co.za',
    deviceViewAccess: {
      desktop: {
        purchase_orders: true
      }
    }
  };
  assert(service.canSendPurchaseOrder(baseUser, deviceViewOverride) === false, 'Device View Access UI flag does not grant functional PO send');

  // 11. Client-Supplied Permission Fields Cannot Grant Access
  // Simulated malicious browser payload where someone injected a permissions field on the user object
  const clientTamperedUser: any = {
    ...baseUser,
    clientInjectedPermissions: { 'Purchase Orders': { Edit: true } },
    isAdmin: true,
    canSendAll: true
  };
  assert(service.canSendPurchaseOrder(clientTamperedUser, null) === false, 'Arbitrary client injected fields are completely ignored');

  // 12. Override Precedence: Override Deny beats Profile Allow, Override Allow beats Profile Deny
  const profileAllowUser: AuthoritativeUser = {
    ...baseUser,
    userPermissions: {
      'Purchase Orders': {
        Edit: true
      }
    }
  };
  // With no override, profile allows:
  assert(service.canSendPurchaseOrder(profileAllowUser, null) === true, 'Direct profile permissions allow when no override exists');

  // With explicit override DENY, profile allow is overridden:
  assert(service.canSendPurchaseOrder(profileAllowUser, denyOverride) === false, 'Explicit override DENY takes precedence over profile ALLOW');

  const profileDenyUser: AuthoritativeUser = {
    ...baseUser,
    userPermissions: {
      'Purchase Orders': {
        Edit: false,
        Approve: false
      }
    }
  };
  // With explicit override ALLOW, profile deny is overridden:
  assert(service.canSendPurchaseOrder(profileDenyUser, editAllowOverride) === true, 'Explicit override ALLOW takes precedence over profile DENY');

  // 13. User Inactive or Unapproved Denies
  const inactiveUser: AuthoritativeUser = {
    ...baseUser,
    active: false
  };
  assert(service.canSendPurchaseOrder(inactiveUser, editAllowOverride) === false, 'Inactive user (active === false) is strictly denied');

  const unapprovedUser: AuthoritativeUser = {
    ...baseUser,
    isApproved: false
  };
  assert(service.canSendPurchaseOrder(unapprovedUser, editAllowOverride) === false, 'Unapproved user (isApproved === false) is strictly denied');

  // 14. Unknown Module or Action Denies
  const res14a = service.evaluatePermission(baseUser, editAllowOverride, 'NonExistentModule', 'Edit');
  assert(res14a.authorized === false, 'Unknown module evaluates to Deny');

  const res14b = service.evaluatePermission(baseUser, editAllowOverride, 'Purchase Orders', 'Process');
  assert(res14b.authorized === false, 'Action not in override evaluates to Deny');

  // ==========================================
  // FIRESTORE OVERRIDE LOOKUP TESTS (STEP 3)
  // ==========================================

  // 15. Single Canonical Override Lookup by userId
  mockDb.docs.clear();
  mockDb.docs.set('usr-buyer-john', {
    userId: 'usr-buyer-john',
    userEmail: 'john@tsjoinery.co.za',
    permissions: {
      'Purchase Orders': {
        Edit: 'allow'
      }
    },
    updatedAt: '2026-03-01T10:00:00.000Z'
  });

  const lookupRes1 = await service.getUserPermissionOverride(baseUser);
  assert(lookupRes1.success === true, 'Override lookup succeeds for matching userId');
  if (lookupRes1.success) {
    assert(lookupRes1.override?.userId === 'usr-buyer-john', 'Retrieved override matches user ID');
  }

  // 16. Override Lookup by userEmail document ID
  mockDb.docs.clear();
  mockDb.docs.set('john@tsjoinery.co.za', {
    userId: 'usr-buyer-john',
    userEmail: 'john@tsjoinery.co.za',
    permissions: {
      'Purchase Orders': {
        Approve: 'allow'
      }
    },
    updatedAt: '2026-03-01T10:00:00.000Z'
  });

  const lookupRes2 = await service.getUserPermissionOverride(baseUser);
  assert(lookupRes2.success === true, 'Override lookup succeeds by email docId');
  if (lookupRes2.success) {
    assert(lookupRes2.override?.userEmail === 'john@tsjoinery.co.za', 'Retrieved override matches user email');
  }

  // 17. Documented Alias Lookup (frans <-> franz)
  const franzUser: AuthoritativeUser = {
    id: 'usr-hr-franz',
    email: 'franz@tsjoinery.co.za',
    name: 'Franz Posthumus',
    role: 'HR',
    active: true,
    isApproved: true,
    status: 'active'
  };
  mockDb.docs.clear();
  mockDb.docs.set('frans@tsjoinery.co.za', {
    userId: 'usr-hr-franz',
    userEmail: 'frans@tsjoinery.co.za',
    permissions: {
      'Purchase Orders': {
        Approve: 'allow'
      }
    },
    updatedAt: '2026-03-01T10:00:00.000Z'
  });

  const aliasLookupRes = await service.getUserPermissionOverride(franzUser);
  assert(aliasLookupRes.success === true, 'Override lookup for franz resolves alias doc frans@tsjoinery.co.za');

  // 18. Conflicting / Ambiguous Overrides Fail Closed
  // Scenario A: Two override docs for same email with DIFFERENT user IDs
  mockDb.docs.clear();
  mockDb.docs.set('doc-1', {
    userId: 'usr-user-A',
    userEmail: 'john@tsjoinery.co.za',
    permissions: { 'Purchase Orders': { Edit: 'allow' } }
  });
  mockDb.docs.set('doc-2', {
    userId: 'usr-user-B',
    userEmail: 'john@tsjoinery.co.za',
    permissions: { 'Purchase Orders': { Edit: 'deny' } }
  });

  const conflictRes = await service.getUserPermissionOverride(baseUser);
  assert(conflictRes.success === false, 'Conflicting override records fail closed');
  if (conflictRes.success === false) {
    assert(conflictRes.code === 'AMBIGUOUS_OVERRIDE', 'Failure code is AMBIGUOUS_OVERRIDE');
  }

  // Scenario B: Override document userId conflicts with authenticated user id
  mockDb.docs.clear();
  mockDb.docs.set('usr-buyer-john', {
    userId: 'usr-completely-different-id',
    userEmail: 'john@tsjoinery.co.za'
  });
  const mismatchRes = await service.getUserPermissionOverride(baseUser);
  assert(mismatchRes.success === false, 'Mismatched user ID in override document fails closed');
  if (mismatchRes.success === false) {
    assert(mismatchRes.code === 'CONFLICTING_OVERRIDE', 'Failure code is CONFLICTING_OVERRIDE');
  }

  // 19. Timestamp-based resolution for consistent duplicate records
  mockDb.docs.clear();
  mockDb.docs.set('usr-buyer-john', {
    userId: 'usr-buyer-john',
    userEmail: 'john@tsjoinery.co.za',
    permissions: { 'Purchase Orders': { Edit: 'deny' } },
    updatedAt: '2026-01-01T00:00:00.000Z'
  });
  mockDb.docs.set('john@tsjoinery.co.za', {
    userId: 'usr-buyer-john',
    userEmail: 'john@tsjoinery.co.za',
    permissions: { 'Purchase Orders': { Edit: 'allow' } },
    updatedAt: '2026-03-01T00:00:00.000Z' // Newer!
  });

  const dedupeRes = await service.getUserPermissionOverride(baseUser);
  assert(dedupeRes.success === true, 'Duplicate records resolve to newest updatedAt');
  if (dedupeRes.success) {
    assert(dedupeRes.override?.permissions?.['Purchase Orders']?.Edit === 'allow', 'Resolved override uses newer record');
  }

  // 20. End-to-end authorizePurchaseOrderSend method
  mockDb.docs.clear();
  mockDb.docs.set('usr-buyer-john', {
    userId: 'usr-buyer-john',
    userEmail: 'john@tsjoinery.co.za',
    permissions: {
      'Purchase Orders': {
        Edit: 'allow'
      }
    },
    updatedAt: '2026-03-01T00:00:00.000Z'
  });
  const e2eRes = await service.authorizePurchaseOrderSend(baseUser);
  assert(e2eRes.authorized === true, 'authorizePurchaseOrderSend authorizes valid user with Firestore override');

  // Inactive user in e2e check fails closed
  const e2eInactive = await service.authorizePurchaseOrderSend(inactiveUser);
  assert(e2eInactive.authorized === false, 'authorizePurchaseOrderSend rejects inactive user');

  // 21. Database Error Handling
  mockDb.shouldThrow = true;
  const dbErrRes = await service.getUserPermissionOverride(baseUser);
  assert(dbErrRes.success === false, 'Database error caught safely');
  if (dbErrRes.success === false) {
    assert(dbErrRes.code === 'LOOKUP_FAILED', 'Failure code is LOOKUP_FAILED on database error');
  }
  const e2eErrRes = await service.authorizePurchaseOrderSend(baseUser);
  assert(e2eErrRes.authorized === false, 'Database error in e2e authorizePurchaseOrderSend fails closed');
  mockDb.shouldThrow = false;

  console.log(`\n=== ALL ${passed}/${total} PHASE C SERVER PERMISSION UNIT TESTS PASSED ===\n`);
}

runTests().catch(err => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
