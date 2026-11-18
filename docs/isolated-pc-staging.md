# TS Hub — isolated PC test (no production deployment)

Branch: `staging/managed-user-pc-test`

This branch deliberately refuses to initialize the application unless it
points to a **separate Firebase test project** and a **separate HTTPS test API**.
Do not reuse `timbersmithapp`, production Cloud Run or the live Netlify site.

1. Use the isolated Firebase project `timbersmith-staging` (GCP project #351455828495), enable Email/Password Auth and configure
   test Firestore with test records only. Do not import real worker/PIN/payroll data.
2. Create an isolated backend service for this branch with its **own**
   staging Firebase Admin credentials/project. Keep the user/notification and
   Clocking API feature flags off until staging identity and security rules pass.
3. The Firebase Web App identifiers have been embedded in the isolated
   staging branch and its GitHub build job (public browser configuration,
   not service-account secrets). Only ONE GitHub Actions variable is pending:
   `TSJ_STAGING_MANAGED_API_URL`, pointing to a separate staging backend.
   Do not set it to the live Cloud Run or Netlify URL.
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

Confirmed staging identifiers (18 November 2026):
- Firebase project ID: `timbersmith-staging`
- Project number: `351455828495`
- Parent organization: `tsjoinery.co.za`

The staging build gate now requires this **exact** project ID. This GitHub
commit does not create a Firestore database, enable Authentication, provision
a web app, or deploy a site; those must still be configured independently.

Registered staging Web App:
- API key: embedded in staging client and GitHub build (public browser key)
- Auth domain: `timbersmith-staging.firebaseapp.com`
- Project: `timbersmith-staging`
- Storage: `timbersmith-staging.firebasestorage.app`
- Sender ID: `351455828495`
- App ID: `1:351455828495:web:0fd1d0a7846feb7a92a17a`

Firebase Authentication Email/Password and Cloud Firestore have been enabled
manually in the isolated project. The backend and separate Netlify staging site
are not yet deployed. Do not use real employee data in this test project.
