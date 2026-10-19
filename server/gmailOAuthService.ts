import crypto from 'crypto';
import { sessionStore, SessionStore, OAuthSessionDoc, ClientSafeSessionStatus } from './sessionStore';
import { userLookupService, UserLookupService, AuthoritativeUser } from './userLookupService';
import { serverPermissionService, ServerPermissionService } from './serverPermissionService';

/**
 * TS HUB — Server-Side Google Workspace / Gmail OAuth & Sending Service
 * Phase 4B Production Implementation (Phase D Integrated Runtime)
 * 
 * Security Invariants:
 * 1. Google OAuth 2.0 Authorization Code flow with PKCE and authenticated state tokens.
 * 2. Scope strictly limited to: https://www.googleapis.com/auth/gmail.send
 * 3. Enforces authenticated Google identity is an authorized @tsjoinery.co.za account.
 * 4. Resolves Google identity to authoritative, active, approved TS Hub user via Phase B (userLookupService).
 * 5. Persists session into shared Firestore session collection via Phase A (sessionStore).
 * 6. Google access token is stored EXCLUSIVELY server-side in Firestore. NEVER returned to client.
 * 7. Browser receives ONLY a cryptographically random, opaque session ID (64 hex characters).
 * 8. Server-side RBAC enforcement via Phase C (serverPermissionService). Requires 'Purchase Orders' + 'Edit' OR 'Approve'.
 * 9. Server-side Preview Safety independently blocks live email transmissions in preview / dev environments.
 * 10. Dependency injection allows fully isolated unit testing without touching production Firestore or Gmail API.
 */

export interface OAuthStateData {
  state: string;
  codeVerifier: string;
  employeeEmail: string;
  appReturnUrl: string;
  createdAt: number;
  nonce?: string;
}

export interface SendPOPayload {
  employeeEmail?: string;
  to: string;
  cc?: string[];
  subject: string;
  message: string;
  poNumber: string;
  pdfFileName: string;
  pdfBase64: string;
}

export interface SendPOResult {
  success: boolean;
  status: 'sent';
  gmailMessageId: string;
  senderGoogleEmail: string;
  recipient: string;
  sentAt: string;
}

export interface OAuthCallbackResult {
  sessionId: string;
  googleEmail: string;
  appReturnUrl: string;
  user: AuthoritativeUser;
}

export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.send'
] as const;

// Fallback transient key in case GOOGLE_CLIENT_SECRET is missing during local start
const FALLBACK_SECRET = 'ts-hub-internal-crypto-salt-' + (process.env.SESSION_SECRET || 'tsjoinery-co-za-default-secret-salt-key-991');

/**
 * Server-side Preview Safety check for Gmail API transmission.
 * Fails closed in non-production or preview environments.
 */
export function canSendLiveGmailServer(req?: any): boolean {
  if (process.env.FORCE_PRODUCTION_GMAIL === 'true') {
    return true;
  }
  if (process.env.NODE_ENV !== 'production') {
    return false;
  }
  if (req) {
    const host = (req.headers?.['x-forwarded-host'] || req.headers?.host || req.hostname || '').toString().toLowerCase();
    if (
      host.includes('ais-dev-') ||
      host.includes('ais-pre-') ||
      host.includes('localhost') ||
      host.includes('127.0.0.1') ||
      host.includes('webcontainer')
    ) {
      return false;
    }
  }
  return true;
}

export class GmailOAuthService {
  constructor(
    private sessionStoreInstance: SessionStore = sessionStore,
    private userLookupInstance: UserLookupService = userLookupService,
    private permissionServiceInstance: ServerPermissionService = serverPermissionService,
    private fetchImpl: typeof fetch = fetch
  ) {}

  private getClientId(): string {
    return process.env.GOOGLE_CLIENT_ID || '';
  }

  private getClientSecret(): string {
    return process.env.GOOGLE_CLIENT_SECRET || '';
  }

  private getRedirectUri(): string {
    return (
      process.env.GOOGLE_REDIRECT_URI ||
      'https://ts-hub-backend-859189362556.africa-south1.run.app/api/auth/google/callback'
    );
  }

  /**
   * Derives a deterministic 256-bit symmetric encryption key from server secrets
   */
  private getEncryptionKey(): Buffer {
    const seed = this.getClientSecret() || FALLBACK_SECRET;
    return crypto.createHash('sha256').update(`ts_hub_oauth_aes_${seed}`).digest();
  }

  /**
   * Encrypts arbitrary payload into an authenticated, URL-safe AES-256-GCM token:
   * Format: <iv_base64url>.<tag_base64url>.<ciphertext_base64url>
   */
  public encryptToken(payload: object): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update(JSON.stringify(payload), 'utf8', 'base64url');
    ciphertext += cipher.final('base64url');
    const authTag = cipher.getAuthTag().toString('base64url');
    return `${iv.toString('base64url')}.${authTag}.${ciphertext}`;
  }

  /**
   * Decrypts and authenticates an AES-256-GCM token. Returns null if altered, expired, or invalid.
   */
  public decryptToken<T>(token: string): T | null {
    if (!token || typeof token !== 'string') return null;
    const parts = token.trim().split('.');
    if (parts.length !== 3) return null;
    try {
      const key = this.getEncryptionKey();
      const iv = Buffer.from(parts[0], 'base64url');
      const authTag = Buffer.from(parts[1], 'base64url');
      const ciphertext = parts[2];
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(ciphertext, 'base64url', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted) as T;
    } catch {
      return null;
    }
  }

  // Trusted frontend base origins for OAuth redirection (no open redirect allowed)
  private static readonly TRUSTED_RETURN_ORIGINS = new Set([
    'https://timbersmith-terminal.netlify.app',
    'https://tsjoinery.co.za',
    'https://www.tsjoinery.co.za',
    'http://localhost:3000',
    'http://localhost:5173'
  ]);

  /**
   * Sanitizes and validates the return URL to prevent open-redirect vulnerabilities.
   * If invalid or untrusted origin, safely falls back to canonical Netlify app URL.
   */
  public sanitizeReturnUrl(returnUrl?: string): string {
    const defaultUrl = 'https://timbersmith-terminal.netlify.app/';
    if (!returnUrl || typeof returnUrl !== 'string') return defaultUrl;
    try {
      const parsed = new URL(returnUrl.trim());
      if (GmailOAuthService.TRUSTED_RETURN_ORIGINS.has(parsed.origin)) {
        return parsed.toString();
      }
    } catch {
      // Malformed URL, fall through to defaultUrl
    }
    return defaultUrl;
  }

  /**
   * Generates authorization URL with PKCE and an authenticated, encrypted state token.
   * Multi-instance Cloud Run safe.
   */
  public generateAuthorizationUrl(
    employeeEmail: string,
    appReturnUrl: string = 'https://timbersmith-terminal.netlify.app/'
  ): { url: string; state: string } {
    const clientId = this.getClientId();
    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID is not configured in environment variables.');
    }

    const normalizedEmail = (employeeEmail || '').trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.endsWith('@tsjoinery.co.za')) {
      throw new Error('Employee email must be an authorized @tsjoinery.co.za company account.');
    }

    const safeReturnUrl = this.sanitizeReturnUrl(appReturnUrl);

    // 1. Generate PKCE code verifier and S256 code challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    // 2. Pack verifier, expected email, return URL, and timestamp into an authenticated encrypted state token
    const state = this.encryptToken({
      codeVerifier,
      employeeEmail: normalizedEmail,
      appReturnUrl: safeReturnUrl,
      createdAt: Date.now(),
      nonce: crypto.randomBytes(16).toString('base64url')
    });

    const redirectUri = this.getRedirectUri();
    // Scope strictly includes identity scopes (openid, userinfo.email) for verified identity resolution
    // and send-only Gmail scope (gmail.send) for Purchase Order transmission
    const scopes = [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/gmail.send'
    ];
    const scope = scopes.join(' ');

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('access_type', 'offline'); // Offline access to obtain refresh token for durable PO sending
    authUrl.searchParams.set('prompt', 'consent'); // Explicit consent guarantees refresh token issuance
    authUrl.searchParams.set('login_hint', normalizedEmail);

    return {
      url: authUrl.toString(),
      state
    };
  }

  /**
   * Validates OAuth callback, exchanges authorization code, verifies identity,
   * resolves authoritative TS Hub user via Phase B, and creates an opaque server-side session in Firestore via Phase A.
   * Returns ONLY the opaque random session ID (never access tokens).
   */
  public async handleCallback(
    code: string,
    state: string
  ): Promise<OAuthCallbackResult> {
    // 1. Decrypt and authenticate the OAuth state token
    const stateData = this.decryptToken<OAuthStateData>(state);
    if (!stateData) {
      throw new Error('Invalid, tampered, or malformed OAuth state parameter. Please re-initiate authorization.');
    }

    // Enforce 10-minute maximum state lifetime
    if (Date.now() - stateData.createdAt > 10 * 60 * 1000) {
      throw new Error('OAuth authorization state expired (lifetime exceeded 10 minutes). Please re-initiate.');
    }

    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    const redirectUri = this.getRedirectUri();

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials (CLIENT_ID / CLIENT_SECRET) are not configured on server.');
    }

    // 2. Exchange authorization code with Google token endpoint
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: stateData.codeVerifier
    });

    const tokenResponse = await this.fetchImpl(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error('[Google OAuth] Token exchange failed:', errBody);
      throw new Error(`Google token exchange failed: ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string;
      expires_in?: number;
      token_type?: string;
      refresh_token?: string;
      id_token?: string;
    };

    if (!tokenData.access_token) {
      throw new Error('Google token response did not contain an access_token.');
    }

    // 3. Fetch authenticated Google user info to verify email identity
    const userInfoResponse = await this.fetchImpl('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!userInfoResponse.ok) {
      const errText = await userInfoResponse.text().catch(() => '');
      console.error('[Google OAuth] Userinfo request failed:', userInfoResponse.status, errText);
      throw new Error(`Failed to retrieve user profile from Google userinfo API (${userInfoResponse.status}: ${userInfoResponse.statusText}).`);
    }

    const userInfo = await userInfoResponse.json() as { email?: string };
    const authenticatedGoogleEmail = (userInfo.email || '').trim().toLowerCase();

    // 4. Strict Identity & Domain Verification
    if (!authenticatedGoogleEmail.endsWith('@tsjoinery.co.za')) {
      throw new Error(
        `Unauthorized domain: Google account (${authenticatedGoogleEmail}) is not a verified @tsjoinery.co.za Workspace account.`
      );
    }

    if (authenticatedGoogleEmail !== stateData.employeeEmail) {
      throw new Error(
        `Google account mismatch: The authenticated Google account (${authenticatedGoogleEmail}) does not match your TS Hub profile (${stateData.employeeEmail}).`
      );
    }

    // 5. Phase B: Resolve Authoritative TS Hub User from Firestore
    const userLookupRes = await this.userLookupInstance.lookupUser(authenticatedGoogleEmail);
    if (userLookupRes.success === false) {
      throw new Error(
        `TS Hub authoritative user lookup failed (${userLookupRes.code}): ${userLookupRes.error}`
      );
    }
    const authoritativeUser = userLookupRes.user;

    // 6. Durable Credential Storage: Encrypt refresh token at rest if provided
    if (tokenData.refresh_token) {
      const encryptedRefreshToken = this.encryptToken({
        refreshToken: tokenData.refresh_token,
        googleEmail: authenticatedGoogleEmail,
        userId: authoritativeUser.id,
        createdAt: Date.now()
      });

      try {
        await this.sessionStoreInstance.saveCredential({
          userId: authoritativeUser.id,
          googleEmail: authenticatedGoogleEmail,
          employeeEmail: authoritativeUser.email,
          encryptedRefreshToken,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'active'
        });
      } catch (saveErr: any) {
        console.warn('[Google OAuth] Notice: Could not save durable credential:', saveErr.message);
      }
    }

    // 7. Phase A: Create Shared Server-Side Firestore Session
    const expiresInSeconds = tokenData.expires_in || 3600;
    const expiresAt = Date.now() + (expiresInSeconds * 1000) - (60 * 1000); // 1-minute safety buffer

    const sessionDoc = await this.sessionStoreInstance.createSession({
      userId: authoritativeUser.id,
      googleEmail: authenticatedGoogleEmail,
      employeeEmail: authoritativeUser.email,
      ttlSeconds: expiresInSeconds,
      accessToken: tokenData.access_token,
      tokenExpiresAt: expiresAt
    });

    // 8. Return ONLY the opaque random session ID
    return {
      sessionId: sessionDoc.sessionId,
      googleEmail: authenticatedGoogleEmail,
      appReturnUrl: this.sanitizeReturnUrl(stateData.appReturnUrl),
      user: authoritativeUser
    };
  }

  /**
   * Refreshes an expired Google access token using the stored encrypted refresh token.
   * Server-to-server exchange against Google's token endpoint.
   */
  public async refreshAccessToken(encryptedRefreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const decrypted = this.decryptToken<{
      refreshToken?: string;
      googleEmail?: string;
      userId?: string;
    }>(encryptedRefreshToken);

    const rawRefreshToken = decrypted?.refreshToken;
    if (!rawRefreshToken) {
      throw new Error('Failed to decrypt stored Google refresh token.');
    }

    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured on server.');
    }

    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: rawRefreshToken,
      grant_type: 'refresh_token'
    });

    const tokenResponse = await this.fetchImpl(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text().catch(() => '');
      console.error('[Google OAuth] Token refresh failed:', errBody);
      throw new Error(`Google token refresh failed: ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string;
      expires_in?: number;
      token_type?: string;
    };

    if (!tokenData.access_token) {
      throw new Error('Google refresh response did not contain an access_token.');
    }

    return {
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in || 3600
    };
  }

  /**
   * Transparently mints a fresh active session using the user's stored durable credential
   */
  public async restoreSessionFromCredential(employeeEmail: string): Promise<OAuthSessionDoc | null> {
    const normalized = (employeeEmail || '').trim().toLowerCase();
    if (!normalized || !normalized.endsWith('@tsjoinery.co.za')) {
      return null;
    }

    const userLookupRes = await this.userLookupInstance.lookupUser(normalized);
    if (!userLookupRes.success || !userLookupRes.user) {
      return null;
    }
    const user = userLookupRes.user;

    const cred = await this.sessionStoreInstance.getCredential(user.id);
    if (!cred || cred.status !== 'active' || !cred.encryptedRefreshToken) {
      return null;
    }

    // Verify RBAC
    const authDecision = await this.permissionServiceInstance.authorizePurchaseOrderSend(user);
    if (!authDecision.authorized) {
      return null;
    }

    try {
      const { accessToken, expiresIn } = await this.refreshAccessToken(cred.encryptedRefreshToken);
      const expiresAt = Date.now() + (expiresIn * 1000) - (60 * 1000);
      const sessionDoc = await this.sessionStoreInstance.createSession({
        userId: user.id,
        googleEmail: cred.googleEmail,
        employeeEmail: user.email,
        ttlSeconds: expiresIn,
        accessToken,
        tokenExpiresAt: expiresAt
      });
      return sessionDoc;
    } catch (err: any) {
      console.warn('[GmailOAuthService] restoreSessionFromCredential failed:', err.message);
      return null;
    }
  }

  /**
   * Retrieves safe client status for the session or stored credentials without exposing secrets.
   */
  public async getSessionStatus(
    sessionId?: string,
    employeeEmail?: string
  ): Promise<ClientSafeSessionStatus> {
    if (sessionId && this.sessionStoreInstance.isValidSessionId(sessionId)) {
      const session = await this.sessionStoreInstance.getSession(sessionId);
      if (session) {
        return this.sessionStoreInstance.toClientSafeStatus(session);
      }
    }

    // Check durable stored credentials for employeeEmail
    const normalized = (employeeEmail || '').trim().toLowerCase();
    if (normalized && normalized.endsWith('@tsjoinery.co.za')) {
      try {
        const userLookup = await this.userLookupInstance.lookupUser(normalized);
        if (userLookup.success && userLookup.user) {
          const cred = await this.sessionStoreInstance.getCredential(userLookup.user.id);
          if (cred && cred.status === 'active' && cred.encryptedRefreshToken) {
            const authDecision = await this.permissionServiceInstance.authorizePurchaseOrderSend(userLookup.user);
            return {
              connected: true,
              googleEmail: cred.googleEmail,
              canSend: authDecision.authorized
            };
          }
        }
      } catch {}
    }

    return { connected: false, googleEmail: null, canSend: false };
  }

  /**
   * Revokes the active session and stored credential in Firestore.
   */
  public async logout(sessionId?: string, employeeEmail?: string): Promise<boolean> {
    let success = false;
    if (sessionId && this.sessionStoreInstance.isValidSessionId(sessionId)) {
      try {
        const session = await this.sessionStoreInstance.getSession(sessionId);
        if (session) {
          await this.sessionStoreInstance.revokeCredential(session.userId);
        }
        success = await this.sessionStoreInstance.revokeSession(sessionId);
      } catch (e: any) {
        console.warn('[GmailOAuthService] Logout revocation notice:', e.message);
      }
    }

    if (employeeEmail) {
      try {
        const userRes = await this.userLookupInstance.lookupUser(employeeEmail);
        if (userRes.success && userRes.user) {
          await this.sessionStoreInstance.revokeCredential(userRes.user.id);
          success = true;
        }
      } catch {}
    }

    return success;
  }

  /**
   * Complete runtime pipeline for sending a Purchase Order via Gmail API:
   * 1. Enforces server-side Preview Safety.
   * 2. Validates session ID format (strict 64-hex).
   * 3. Retrieves session from Firestore and verifies active/unexpired status.
   * 4. Resolves authoritative TS Hub user from verified Google email (Phase B).
   * 5. Enforces server-side RBAC for Purchase Orders + Edit/Approve (Phase C).
   * 6. Validates payload & PDF.
   * 7. Transmits message using server-side access token from Firestore session.
   * 8. Returns minimal safe result.
   */
  public async executePurchaseOrderSend(
    sessionId: string,
    payload: SendPOPayload,
    req?: any
  ): Promise<SendPOResult> {
    // 1. Server-side Preview Safety Guard
    if (!canSendLiveGmailServer(req)) {
      throw new Error('[PreviewSafety] Live Google Workspace sending is blocked in Preview / development environment to protect live suppliers.');
    }

    // 2 & 3. Session Validation in Firestore
    if (!sessionId || !this.sessionStoreInstance.isValidSessionId(sessionId)) {
      throw new Error('Unauthorized: No active Google Workspace session found. Please connect Google Workspace.');
    }

    const session = await this.sessionStoreInstance.getSession(sessionId);
    if (!session || !session.accessToken) {
      throw new Error('Unauthorized: Active Google Workspace session not found, expired, or revoked. Please reconnect.');
    }

    // 4. Phase B: Authoritative User Lookup
    const userLookupRes = await this.userLookupInstance.lookupUser(session.googleEmail);
    if (userLookupRes.success === false) {
      throw new Error(`Forbidden: TS Hub authoritative user lookup failed (${userLookupRes.code}): ${userLookupRes.error}`);
    }
    const authoritativeUser = userLookupRes.user;

    // 5. Phase C: Authoritative Server-Side RBAC Enforcement
    const authDecision = await this.permissionServiceInstance.authorizePurchaseOrderSend(authoritativeUser);
    if (!authDecision.authorized) {
      throw new Error(`Forbidden: User ${authoritativeUser.email} is not authorized to send Purchase Orders. ${authDecision.reason}`);
    }

    // Automatic server-side access token refresh if near or past expiration
    let activeAccessToken = session.accessToken;
    const now = Date.now();
    if (session.tokenExpiresAt && now >= (session.tokenExpiresAt - 60000)) {
      const cred = await this.sessionStoreInstance.getCredential(authoritativeUser.id);
      if (cred && cred.status === 'active' && cred.encryptedRefreshToken) {
        try {
          const refreshed = await this.refreshAccessToken(cred.encryptedRefreshToken);
          activeAccessToken = refreshed.accessToken;
          const newExpiresAt = now + (refreshed.expiresIn * 1000) - 60000;
          await this.sessionStoreInstance.updateSessionToken(sessionId, activeAccessToken, newExpiresAt);
        } catch (refreshErr: any) {
          console.warn('[GmailOAuthService] Token refresh attempt notice:', refreshErr.message);
        }
      }
    }

    // 6 & 7. Construct & Transmit MIME message using server-side access token
    return await this.sendMimeMessage(activeAccessToken, session.googleEmail, payload);
  }

  /**
   * Assembles RFC 2822 MIME message and transmits via Gmail API messages.send.
   */
  public async sendMimeMessage(
    accessToken: string,
    senderEmail: string,
    payload: SendPOPayload
  ): Promise<SendPOResult> {
    if (!accessToken) {
      throw new Error('Internal server error: Missing Google access token.');
    }
    if (!senderEmail || !senderEmail.includes('@')) {
      throw new Error('Internal server error: Missing verified sender email.');
    }

    const recipient = (payload.to || '').trim().toLowerCase();
    if (!recipient || !recipient.includes('@')) {
      throw new Error('Valid recipient email address (to) is required.');
    }

    if (!payload.subject || !payload.subject.trim()) {
      throw new Error('Email subject is required.');
    }

    if (!payload.message || !payload.message.trim()) {
      throw new Error('Email message body is required.');
    }

    if (!payload.pdfBase64 || !payload.pdfBase64.trim()) {
      throw new Error('Purchase Order PDF payload (pdfBase64) is required.');
    }

    const cleanPdfBase64 = payload.pdfBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
    const pdfFileName = payload.pdfFileName || `Purchase_Order_${payload.poNumber || 'PO'}.pdf`;

    // Filter valid CC addresses
    const validCcList = (payload.cc || [])
      .map(c => c.trim().toLowerCase())
      .filter(c => c && c.includes('@') && c !== recipient);

    // Build RFC 2822 MIME Message
    const boundary = `ts_hub_po_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
    const encodedSubject = `=?UTF-8?B?${Buffer.from(payload.subject.trim()).toString('base64')}?=`;

    const headers: string[] = [
      `From: ${senderEmail}`,
      `To: ${recipient}`,
      validCcList.length > 0 ? `Cc: ${validCcList.join(', ')}` : '',
      `Subject: ${encodedSubject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`
    ].filter(Boolean);

    // Format HTML email body
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; font-size: 13px; color: #1e293b; line-height: 1.6;">
        <div style="margin-bottom: 16px; white-space: pre-wrap;">${escapeHtml(payload.message.trim())}</div>
        <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 20px 0 12px 0;" />
        <div style="font-size: 11px; color: #64748b;">
          <strong>TS Joinery & Timber Works</strong> • Official Procurement Dispatch<br />
          Purchase Order: <strong>${escapeHtml(payload.poNumber)}</strong> • Attached: <em>${escapeHtml(pdfFileName)}</em>
        </div>
      </div>
    `.trim();

    const mimeParts: string[] = [
      headers.join('\r\n'),
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      '',
      htmlBody,
      '',
      `--${boundary}`,
      `Content-Type: application/pdf; name="${pdfFileName}"`,
      `Content-Disposition: attachment; filename="${pdfFileName}"`,
      `Content-Transfer-Encoding: base64`,
      '',
      cleanPdfBase64,
      '',
      `--${boundary}--`
    ];

    const rawMime = mimeParts.join('\r\n');
    const urlSafeRaw = Buffer.from(rawMime).toString('base64url');

    // Transmit to Gmail API standard endpoint with JSON { raw: urlSafeRaw }
    const gmailSendUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
    const sendResponse = await this.fetchImpl(gmailSendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: urlSafeRaw })
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error('[Gmail API] Message send failed:', errorText);
      throw new Error(`Gmail API rejected message: ${sendResponse.statusText} (${errorText})`);
    }

    const sendResult = await sendResponse.json() as { id?: string };
    const gmailMessageId = sendResult.id || `msg_${Date.now().toString(36)}`;

    return {
      success: true,
      status: 'sent',
      gmailMessageId,
      senderGoogleEmail: senderEmail,
      recipient,
      sentAt: new Date().toISOString()
    };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const gmailOAuthService = new GmailOAuthService();
