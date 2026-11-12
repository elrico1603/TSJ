# TS Hub face integration — release gate

## Implemented on this branch
- Existing employee edit form: optional Face Registration action, existing photograph and PIN unchanged.
- Reuses the successful V3 three-stage phone scanner with current-stage retries.
- Server-side enrollment, status, comparison and removal, with AES-256-GCM encrypted descriptor storage bound to the employee ID and model version.
- No descriptor arrays in the employee document or normal client queries. No face photos uploaded. No stored template returned by the API.
- Dedicated signed Firebase Auth claims, not browser role strings, authorize the API.
- Opt-in Clocking preview routes normal and supervisor Clocking attempts to face verification; removes the universal PIN exceptions in preview mode; never creates real attendance events.

## Build and test
Normal builds leave the feature disabled. Existing production behavior is unchanged. To stage the model for a controlled local build:

```powershell
$env:VITE_TSJ_FACE_INTEGRATION="true"
npm run build
npm run lint
npm run test:face
```

Set the flag before starting the local Vite server as well. Run `npm run face:prepare` before a development run to stage same-origin scanner assets. The independent phone pilot still uses `npm run build --prefix face-pilot`. It needs no Firebase backend.

## Backend activation (NOT enabled by this commit)
The API is intentionally disabled by default. A missing feature configuration, invalid credentials, missing profile or failed match must not approve a clock event.

Use the existing backend and existing Firestore database only after verifying protection of the root collection `tsj_private_face_profiles`. No new database or paid face API is required. Existing Firestore and Cloud Run usage may still incur charges.

Before enabling, an authorized Firebase administrator must:
1. Verify that no Firebase client (including authenticated administrators and anonymous users) can read, list, write, delete or otherwise access the private collection. Do not deploy a blanket rules replacement. Firestore combines overlapping allow statements with OR, so an explicit deny does NOT override an existing broad allow. Test this with the rules emulator and actual project rules. Use server-only Admin SDK access.
2. Provision a random 32-byte AES key as a base64 backend secret `TSJ_FACE_PROFILE_KEY`; maintain a protected backup and rotation procedure. Never put this value in VITE_ variables, GitHub or browser settings.
3. Assign the dedicated `tsj_face_admin: true` custom claim to authorized supervised enrollment accounts using Firebase Admin. This is independent of TS Hub's legacy local role and existing User Creation. A test kiosk may use a custom-token identity with `tsj_face_kiosk: true` and explicit `tsj_face_employee_ids`; no kiosk provisioning is performed here.
4. Set backend-only `TSJ_FACE_PROFILE_API_ENABLED=true` and `TSJ_FACE_PROFILE_RULES_VERIFIED=I_VERIFIED_SERVER_ONLY_ACCESS`. The latter is an operator attestation, not an automatic check of actual rules.
5. Configure the preview frontend `VITE_TSJ_FACE_API_BASE_URL` to the existing trusted HTTPS backend origin, or omit it when same-origin. The backend CORS allowlist must permit the exact preview origin.

Only authorized, informed test participants may be enrolled. Before employee rollout, confirm POPIA requirements, model weight commercial licenses, retention and deletion policy, access controls and supervised exception procedures.

## Remaining release blockers
- Actual negative phone/tablet tests (different face, printed photograph, replay video, multiple faces, missing camera) must refuse; a genuine same-face success alone is not sufficient.
- Validate the integrated UI and real authenticated backend/storage end to end.
- The comparison service accepts client-computed descriptors. A compromised browser can fabricate or replay them; this is not trustworthy camera attestation or a production attendance authorization. Anti-spoof and liveness checks run locally, not independently on the server.
- Integrate face authorization with the separate durable offline Clocking work, verify the real kiosk identity, enforce the attendance write path at the backend/database rules, and eliminate legacy universal PIN and direct-write bypasses. The preview never writes a clock event; it is not an offline attendance implementation.
- Test actual enrolled worker usability on the factory tablet. Repeated face false negatives must have a supervisor-controlled, audited resolution path.

No existing Firestore rules, Firebase users, production Cloud Run service, main branch or real employee clock history were modified by these commits.
