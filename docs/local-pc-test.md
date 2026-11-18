# Local TS Hub PC test
Isolated branch: `test/local-pc-firebase-emulators`.
Keep the emulator terminal running. Run `npm run local:test` in a second
terminal. Run `npm run local:seed` in a third terminal with the environment
variables TSJ_LOCAL_PC_TEST=true, FIREBASE_PROJECT_ID=timbersmith-staging,
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085,
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099.
Visit http://localhost:3000.
Fake logins: admin@local.test / LocalTest123! and
limited@local.test / LocalTest123!.
Never use real employee credentials or data. This testing branch never
deploys to live, uses loopback-only API and both emulators. Storage is
redirected to a deliberately unstarted local emulator to prevent cloud writes.
