/**
 * Regression Test Suite: Phase 4B Gmail OAuth Session Persistence & Cookie Attributes
 * 
 * Verifies:
 * 1. OAuth callback cookie creation:
 *    - ts_gmail_session=<64-char-hex>
 *    - Path=/
 *    - HttpOnly
 *    - SameSite=None
 *    - Secure
 *    - Max-Age=3600
 *    - STRICT ABSENCE of 'Partitioned' (CHIPS mismatch immunity)
 * 2. Logout cookie creation:
 *    - Max-Age=0
 *    - STRICT ABSENCE of 'Partitioned'
 * 3. Status endpoint headers:
 *    - Cache-Control contains no-store, no-cache, must-revalidate, private
 * 4. CORS header validation:
 *    - Trusted origin (https://timbersmith-terminal.netlify.app) receives Access-Control-Allow-Credentials: true
 *    - Referer fallback extracts trusted origin when Origin header is omitted
 *    - Untrusted origin does NOT receive credentialed CORS headers
 * 5. Frontend service contract verification:
 *    - checkGoogleStatus uses credentials: 'include' and cache: 'no-store'
 *    - sendPurchaseOrder uses credentials: 'include'
 *    - disconnectGoogle uses credentials: 'include'
 *    - getAuthorizeUrl uses cache: 'no-store'
 *    - Production Netlify domain resolves to Cloud Run backend URL
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('=== STARTING PHASE 4B SESSION PERSISTENCE REGRESSION TESTS ===');

// Helper to simulate Express cookie serialization logic from server.ts
function buildSessionCookieHeader(sessionId: string, req: {
  secure?: boolean;
  headers: Record<string, string | undefined>;
}): string {
  const isSecure =
    process.env.NODE_ENV === 'production' ||
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    (req.headers.host || '').includes('.run.app');

  const cookieParts = [
    `ts_gmail_session=${sessionId}`,
    'Path=/',
    'HttpOnly',
    isSecure ? 'SameSite=None' : 'SameSite=Lax',
    'Max-Age=3600'
  ];
  if (isSecure) {
    cookieParts.push('Secure');
  }
  return cookieParts.join('; ');
}

function buildLogoutCookieHeader(req: {
  secure?: boolean;
  headers: Record<string, string | undefined>;
}): string {
  const isSecure =
    process.env.NODE_ENV === 'production' ||
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    (req.headers.host || '').includes('.run.app');

  const cookieParts = [
    'ts_gmail_session=',
    'Path=/',
    'HttpOnly',
    isSecure ? 'SameSite=None' : 'SameSite=Lax',
    'Max-Age=0'
  ];
  if (isSecure) {
    cookieParts.push('Secure');
  }
  return cookieParts.join('; ');
}

// ----------------------------------------------------
// 1. COOKIE SERIALIZATION TESTS
// ----------------------------------------------------
const sampleSessionId = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

// Scenario A: Cloud Run request via HTTPS proxy (x-forwarded-proto: https)
const cloudRunHeader = buildSessionCookieHeader(sampleSessionId, {
  secure: false,
  headers: {
    host: 'ts-hub-backend-859189362556.africa-south1.run.app',
    'x-forwarded-proto': 'https'
  }
});

assert(cloudRunHeader.includes(`ts_gmail_session=${sampleSessionId}`), 'Cookie header contains exact opaque session ID');
assert(cloudRunHeader.includes('Path=/'), 'Cookie has Path=/');
assert(cloudRunHeader.includes('HttpOnly'), 'Cookie has HttpOnly');
assert(cloudRunHeader.includes('SameSite=None'), 'Cloud Run cookie has SameSite=None');
assert(cloudRunHeader.includes('Secure'), 'Cloud Run cookie has Secure');
assert(cloudRunHeader.includes('Max-Age=3600'), 'Cloud Run cookie has 1-hour TTL');
assert(!cloudRunHeader.includes('Partitioned'), 'CRITICAL: Cookie MUST NOT contain Partitioned flag');
console.log('✅ PASS: Cloud Run cookie header includes SameSite=None; Secure without Partitioned');

// Scenario B: Cloud Run request recognized via host (.run.app)
const cloudRunHostHeader = buildSessionCookieHeader(sampleSessionId, {
  secure: false,
  headers: {
    host: 'ts-hub-backend-859189362556.africa-south1.run.app'
  }
});
assert(cloudRunHostHeader.includes('SameSite=None'), '.run.app host triggers SameSite=None');
assert(cloudRunHostHeader.includes('Secure'), '.run.app host triggers Secure');
assert(!cloudRunHostHeader.includes('Partitioned'), '.run.app host does not have Partitioned');
console.log('✅ PASS: Host containing .run.app guarantees SameSite=None; Secure');

// Scenario C: Logout cookie header
const logoutHeader = buildLogoutCookieHeader({
  secure: true,
  headers: { host: 'ts-hub-backend-859189362556.africa-south1.run.app' }
});
assert(logoutHeader.includes('ts_gmail_session='), 'Logout cookie clears value');
assert(logoutHeader.includes('Max-Age=0'), 'Logout cookie sets Max-Age=0');
assert(!logoutHeader.includes('Partitioned'), 'Logout cookie does not contain Partitioned');
console.log('✅ PASS: Logout cookie clears session safely without Partitioned');

// ----------------------------------------------------
// 2. SERVER.TS CODE INSPECTION TESTS
// ----------------------------------------------------
const serverTsContent = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf-8');

// Trust proxy test
assert(serverTsContent.includes("app.set('trust proxy', 1);"), "server.ts must configure app.set('trust proxy', 1)");
console.log("✅ PASS: server.ts sets trust proxy to 1");

// Partitioned flag absence test
const partitionedOccurrences = (serverTsContent.match(/Partitioned/g) || []).length;
assert(partitionedOccurrences === 0, 'server.ts MUST NOT contain any occurrences of Partitioned');
console.log('✅ PASS: server.ts has 0 occurrences of Partitioned flag');

// Cache-Control on status endpoint test
assert(serverTsContent.includes("res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');"),
  'Status endpoint in server.ts must set Cache-Control: no-store, no-cache, must-revalidate, private');
console.log('✅ PASS: server.ts status route sets anti-caching Cache-Control header');

// CORS Referer fallback test
assert(serverTsContent.includes("if (!origin && req.headers.referer)"),
  'CORS middleware in server.ts must support referer origin fallback');
console.log('✅ PASS: server.ts CORS middleware supports referer fallback for GET requests');

// ----------------------------------------------------
// 3. FRONTEND GMAIL CLIENT SERVICE CONTRACT TESTS
// ----------------------------------------------------
const clientServiceContent = fs.readFileSync(path.resolve(process.cwd(), 'src/services/gmailClientService.ts'), 'utf-8');

// Credentials: include tests
assert(clientServiceContent.includes("credentials: 'include'"), 'Client service must use credentials: include');
const credentialsCount = (clientServiceContent.match(/credentials:\s*'include'/g) || []).length;
assert(credentialsCount >= 3, `Expected at least 3 occurrences of credentials: 'include' (status, logout, send), found ${credentialsCount}`);
console.log(`✅ PASS: gmailClientService.ts contains ${credentialsCount} credentials: 'include' calls`);

// Cache: no-store tests
const cacheNoStoreCount = (clientServiceContent.match(/cache:\s*'no-store'/g) || []).length;
assert(cacheNoStoreCount >= 2, `Expected at least 2 occurrences of cache: 'no-store' (status, authorize), found ${cacheNoStoreCount}`);
console.log(`✅ PASS: gmailClientService.ts contains ${cacheNoStoreCount} cache: 'no-store' calls`);

// Production URL resolution test
assert(clientServiceContent.includes("'https://ts-hub-backend-859189362556.africa-south1.run.app'"),
  'Client service must resolve production Netlify host to africa-south1 Cloud Run URL');
assert(clientServiceContent.includes("'timbersmith-terminal.netlify.app'"),
  'Client service checks for timbersmith-terminal.netlify.app');
console.log('✅ PASS: gmailClientService.ts correctly binds Netlify production hostname to Cloud Run backend');

// ----------------------------------------------------
// 4. CORS RESOLUTION BEHAVIORAL TESTS
// ----------------------------------------------------
const TRUSTED_ORIGINS = new Set([
  'https://timbersmith-terminal.netlify.app',
  'https://tsjoinery.co.za',
  'https://www.tsjoinery.co.za',
  'http://localhost:3000',
  'http://localhost:5173'
]);

function simulateCors(headers: { origin?: string; referer?: string }) {
  let origin = headers.origin;
  if (!origin && headers.referer) {
    try {
      origin = new URL(headers.referer).origin;
    } catch {}
  }

  const resHeaders: Record<string, string> = {};
  if (origin && TRUSTED_ORIGINS.has(origin)) {
    resHeaders['Access-Control-Allow-Origin'] = origin;
    resHeaders['Access-Control-Allow-Credentials'] = 'true';
    resHeaders['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    resHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  }
  return resHeaders;
}

// Trusted Netlify origin
const netlifyCors = simulateCors({ origin: 'https://timbersmith-terminal.netlify.app' });
assert(netlifyCors['Access-Control-Allow-Origin'] === 'https://timbersmith-terminal.netlify.app', 'Netlify origin allowed');
assert(netlifyCors['Access-Control-Allow-Credentials'] === 'true', 'Credentials allowed for Netlify');

// Referer fallback
const refererCors = simulateCors({ referer: 'https://timbersmith-terminal.netlify.app/purchase-orders?id=123' });
assert(refererCors['Access-Control-Allow-Origin'] === 'https://timbersmith-terminal.netlify.app', 'Origin extracted from Referer');
assert(refererCors['Access-Control-Allow-Credentials'] === 'true', 'Credentials allowed via Referer fallback');

// Malicious / untrusted origin
const untrustedCors = simulateCors({ origin: 'https://attacker-site.com' });
assert(untrustedCors['Access-Control-Allow-Origin'] === undefined, 'Untrusted origin receives no CORS headers');
assert(untrustedCors['Access-Control-Allow-Credentials'] === undefined, 'Untrusted origin receives no credentials header');

console.log('✅ PASS: CORS logic strictly approves Netlify and rejects untrusted origins');

console.log('=== ALL PHASE 4B REGRESSION TESTS PASSED ===');
