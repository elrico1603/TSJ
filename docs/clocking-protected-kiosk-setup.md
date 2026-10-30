# TimberSmith Offline Clocking — Protected Kiosk Enrollment

## Status (TEST BRANCH ONLY)

The existing local Clocking Pilot still writes solely to fictional/test employee data.
The protected test replay API is disabled by default, and there is NO production
payroll clocking migration in this branch. The existing username/password,
four-digit employee PINs and Clocking UI must remain unchanged.

## Security boundary

The production Firebase project's legacy default Firestore database currently
has rules that are too permissive to protect kiosk identity enrollment.

Therefore kiosk registrations MUST NOT be stored in the default database.

The new server code uses an **independent named Firestore database**:
`tsj-clock-registry`. Only the Firebase Admin SDK may read/write registration
records. Publish `config/firestore.clock-registry.rules` **only on this named
database**. Those rules deny all client reads and writes.

NEVER deploy this deny-all rule file to the existing `(default)` database; doing
so would break the running TimberSmith application.

The named database has not been created, configured or deployed by GitHub
commits. It is an explicit future administrator setup step.

**Billing:** Firebase currently requires the pay-as-you-go Blaze plan to create
a second/named Firestore database. The new database has no free quota;
document reads, writes and storage are charged by usage. Do NOT create a
named database or upgrade billing without explicit owner approval.

After approval, create the named database in **Production mode** (deny-all
client access), then verify its exact ID and published rules. The dedicated
`firebase.clock-registry.json` includes ONLY the named registry; do not merge
its rule mapping into the existing application's default configuration.
After verifying the correct project and registry database in the CLI, the
targeted deployment command is:

```powershell
firebase deploy --config firebase.clock-registry.json --project timbersmithapp --only firestore:tsj-clock-registry
```

NEVER run this deployment before billing approval and the database exists.
NEVER run a generic `firebase deploy --only firestore:rules` using an
unreviewed configuration file. The production `(default)` database rules must
not be changed during the pilot.


## Enrollment: future administrator procedure

1. Verify an independent named database `tsj-clock-registry` exists and its
   client rules deny all reads/writes. Do not run enrollment otherwise.
2. On the localhost Sandbox open **Protected test kiosk setup (administrator only)**.
   Copy its test device ID and the owner's separate `pilot-...` test employee ID.
   Neither is an employee PIN or a secret.
3. With a privileged, properly authorized Firebase Admin identity on a local
   computer, do a safe preview:
   `npx tsx scripts/enroll-clock-test-device.ts --device=<DEVICE_ID> --employee=<PILOT_ID>`
   This command validates input but does NOT access Firebase or issue tokens.
4. Only after the database and rules are verified, explicitly set
   `TSJ_CLOCK_REGISTRY_RULES_CONFIRMED=I_VERIFIED_DENY_ALL` in the
   operator's local environment and add `--issue` to register the device.
   This action needs Admin SDK credentials and writes only a test-device
   record to the separate registry; it will fail if the test employee does not
   exist in the isolated test namespace.
5. The command displays a **short-lived Firebase custom token**. Never paste
   the token into ChatGPT, GitHub, email, issue trackers or screenshots. Enter
   it only in the localhost enrollment field and select **Enroll this test kiosk**.
6. Select **Verify kiosk Firebase identity**. This validates the signed device
   identity on the browser, NOT the full API transaction.
7. The server-only test replay API requires explicit
   `TSJ_ENABLE_CLOCK_TEST_API=true` in a local development environment and
   verifies its identity against `tsj-clock-registry`. It is hard-disabled in
   production/Cloud Run/Netlify environments.

## Read-only server identity verification

The **Verify kiosk Firebase identity** button checks only the locally signed
Firebase ID token. For an independently verified registry result, enable the
nonproduction test API **only in a local development environment** and select
**Verify protected server registration**. This checks the token against the
protected registry database and returns only the test device ID, test namespace
and number of allowed fictional employees.

The status API has no production route and is not enabled until an
administrator deliberately sets `TSJ_ENABLE_CLOCK_TEST_API=true` locally.
It must never grant access to real clock records.

## Lost device / emergency revocation

If a registered test tablet is lost or compromised, the protected registry can
be marked revoked and the dedicated Firebase Auth user disabled:

```powershell
npx tsx scripts/revoke-clock-test-device.ts --device=<DEVICE_ID>
```

This is a no-write dry run. To actually revoke a device requires the local
operator to confirm the protected registry rules and pass `--revoke`.
The existing TimberSmith users and production data must never be modified.

**Custom-token limitation:** Firebase custom tokens expire after one hour,
but a successful sign-in creates a refreshable authenticated session. Treat
the enrollment token as a secret and never assume one-time presentation by
itself guarantees single-use enforcement. For a compromised device, revoke
the registration and disable its dedicated Firebase Auth user.

## Security design

- A Firebase ID token must have `sign_in_provider=custom` and a signed
  `clocking_kiosk` claim.
- A signed device ID, test namespace and allowed employee list must match
  the Admin-only registration record.
- Each offline event has an immutable UUID. The server transaction commits
  the employee update and a unique receipt atomically.
- A duplicate event must return `already_committed`; unauthorized/unknown
  events must never update payroll data.
- The original employee PIN is not stored in kiosk registration, sent to
  the API, or copied into the recovery journal.
- No public endpoint issues kiosk custom tokens.
- The API is not an employee PIN verifier. A separate, reviewed authorization
  and device-provisioning process remains necessary before production.
- Client-side PIN bypasses and permissive rules on the existing database are
  unresolved deployment blockers; do not enable real employee clocking.

## Test suite

`npm run lint`

`npm run test:clocking`

The combined test suite uses fictional in-memory fixtures. A PASS in these
tests does not prove that registry rules are deployed or a kiosk is provisioned.

## Production blockers

1. Configure and test the named registry with deny-all rules.
2. Verify administrator-controlled device issuance, revocation and lost-tablet recovery.
3. Review the existing client-side PIN bypass and how offline PIN verification
   will be secured without changing the worker's interaction.
4. Run live authenticated end-to-end tests against isolated test employee data.
5. Review backup, recovery, supervision and deployment/rollback procedures.
6. Only then plan migration of real employee Clocking to the backend.
