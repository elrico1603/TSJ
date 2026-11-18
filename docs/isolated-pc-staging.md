# TS Hub — isolated PC test (no production deployment)

Branch: `staging/managed-user-pc-test`

This branch deliberately refuses to initialize the application unless it
points to a **separate Firebase test project** and a **separate HTTPS test API**.
Do not reuse `timbersmithapp`, production Cloud Run or the live Netlify site.

1. Create an isolated Firebase project, enable Email/Password Auth and configure
   test Firestore with test records only. Do not import real worker/PIN/payroll data.
2. Create an isolated backend service for this branch with its **own**
   staging Firebase Admin credentials/project. Keep the user/notification and
   Clocking API feature flags off until staging identity and security rules pass.
3. In GitHub repo Settings > Secrets and variables > Actions, set:
   - Secret: TSJ_STAGING_FIREBASE_API_KEY
   - Variables: TSJ_STAGING_FIREBASE_AUTH_DOMAIN,
     TSJ_STAGING_FIREBASE_PROJECT_ID, TSJ_STAGING_FIREBASE_APP_ID,
     TSJ_STAGING_FIREBASE_SENDER_ID, TSJ_STAGING_FIREBASE_STORAGE_BUCKET,
     TSJ_STAGING_MANAGED_API_URL
4. Run GitHub Actions > Isolated TS Hub staging package > Run workflow.
   It will fail safely if project/API isolation is not configured.
5. Create a **new** Netlify test site (not a deploy preview of the existing
   live site), and deploy only the resulting isolated staging artifact.
   Do not link production domain or reuse production environment variables.
6. Test login, per-branch permissions, Notification Centre, transfers,
   and historical data integrity with synthetic employees. Clocking remains
   LOCKED in live production, and none of these steps change existing devices.

Important: A successful frontend build is **not** evidence that the backend,
Firebase rules, test identity provisioning or Netlify test site are configured.
These must be validated separately.
