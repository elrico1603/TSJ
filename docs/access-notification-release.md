# User access + notification integration — release checklist

## Live audit findings (13 November 2026)
- Existing Kanban role is ROLE-13491. Its current matrix allows Kanban Designer, but denies QR Scan Service, Basket, Product Master and Notifications. Do not create another Kanban role or assume additional grants.
- The current stock account has a Kanban role assignment and a contradictory individual override (QR Scan allowed, Kanban denied). Old role assignments exist for the same email.
- Existing notification policies specify explicit user IDs. STOCK_REQUEST_SUBMITTED is enabled/high, with Janah and Frans as recipients; their per-user inboxes are empty.
- The pasted audit starts in the middle of an override record; the full account summary was not supplied. Multiple legacy account/assignment IDs require review before consolidation.
- Deployed Firestore rules allow all reads and writes: `allow read, write: if true;`. The existing client role checks are not a database authorization boundary.

## Implemented
- Existing-user editor uses one confirmed atomic save of account, role assignment and permission records. Duplicate active email records fail closed; do not delete/merge accounts automatically.
- Role template selection uses the existing configured matrix to materialize explicit action grants/denies and per-device view defaults. Apply/reapply explicitly; preserve hardware device access. No automatic changes to untouched users or runtime authorization based solely on role name. Quick role dropdown opens the same editor.
- Existing policy collection is read on subscription, and save/reset operations are confirmed on the server.
- Login and session navigation respect the selected interface mode.
- Prepared protected stock request notification delivery on existing Express backend. Signed application identity required; event must refer to an existing stock request owned by the signed actor; policy recipient IDs are validated against active documents. Transactional delivery receipt prevents repeat delivery. Inbox mutation routes derive the owner from signed identity. Policy disable/silent suppresses delivery. No new cloud resource created.
- Existing production stock request flow and notification behavior remain the default while protected delivery is off. No live Firestore/Auth changes were made.

## Before deploying access editor changes
1. Full TypeScript lint/build on branch. Test with non-production fixtures or controlled real administrator session after approval. Verify role and tablet/desktop/phone views persist after logout/relogin. Test stock first, confirm existing admin and clocking terminal unaffected.
2. Review legacy duplicate active accounts with actual Firebase Auth UID mapping; do not grant access or delete based only on matching email. Existing atomic editor intentionally refuses ambiguous duplicate-email accounts.
3. Existing role templates are snapshots: reapply if the template is changed later. Existing accounts are not automatically migrated or mass-updated.
4. Role/device gates are UI logic; the live database remains exposed until security migration.

## Protected notification release gate — do NOT activate yet
- Existing app login authenticates against a local AppUser/PIN pool, not a verified signed Firebase user session. Existing auth may be anonymous. Implement and test genuine Firebase sign-in and a trusted mapping from Firebase UID to one canonical application account. A backend administrator must provision signed tsj_app_user_id claims; never trust a local AppUser or a client-provided email. Do not modify locked User Creation or production Clocking without explicit approval.
- Audit all live collection accesses, back up data, design and emulator-test granular rules, including owner-only notification reads and server-only notification writes/receipts. A broad wildcard allow overrides narrower denies; do not simply add an explicit deny alongside the existing wildcard. Do not deploy a blanket deny that breaks Clocking or other existing modules.
- Only after identity/rules and actual end-to-end testing, enable server env TSJ_NOTIFICATION_DELIVERY_ENABLED=true and TSJ_NOTIFICATION_RULES_VERIFIED=I_VERIFIED_IDENTITY_AND_RULES. Client env VITE_TSJ_NOTIFICATION_DELIVERY=true and trusted VITE_TSJ_NOTIFICATION_API_BASE_URL (HTTPS origin). Existing backend CORS must allow the intended origin. Flags are disabled by default.
- Test actor/recipient identity, policy disabled/silent, duplicate request retry, recipient isolation, reload, offline retry, read/delete independence, real phone/tablet bell and unauthorized access. The backend has idempotent delivery but a durable automatic retry/outbox worker is still outstanding; a saved stock request with failed delivery returns pending, not an instruction to resubmit the business request.
- Only STOCK_REQUEST_SUBMITTED is wired in protected mode so far. Other registry events (Kanban creation/reorder, leave, borrow money, dispatch, inventory, clocking, etc.) still require verified business-event producers and appropriate authorization. No new sensitive notification data should be written under the currently open rules.

No production deploy, Firebase writes, rules changes, user creation changes or changes to Clocking persistence were performed on this branch.
