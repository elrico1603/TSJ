/**
 * Staging build gate. Fails if any required isolated Firebase/API configuration
 * is missing or accidentally references the production project.
 */
const required=[
  'VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_MESSAGING_SENDER_ID','VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_TSJ_MANAGED_USER_API_BASE_URL'
];
const missing=required.filter(k=>!process.env[k]?.trim());
if(missing.length)throw Error('Missing staging environment settings: '+missing.join(', '));
const env=process.env;
if(env.VITE_FIREBASE_PROJECT_ID!=='timbersmith-staging' ||
  /timbersmithapp/i.test(env.VITE_FIREBASE_AUTH_DOMAIN||'') ||
  /timbersmithapp/i.test(env.VITE_FIREBASE_STORAGE_BUCKET||''))
  throw Error('Refusing staging build with production Firebase identifiers.');
if(!/^https:\/\/[^/]+/.test(env.VITE_TSJ_MANAGED_USER_API_BASE_URL||'') ||
 /timbersmith-terminal|tsjoinery\.co\.za/i.test(env.VITE_TSJ_MANAGED_USER_API_BASE_URL||''))
 throw Error('Refusing staging build without isolated HTTPS backend.');
if(env.VITE_TSJ_MANAGED_USER_UI!=='true')
 throw Error('Managed user UI must be enabled for PC staging.');
console.log('PASS | Staging configuration points away from live TS Hub Firebase and backend.');
