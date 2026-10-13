/**
 * TimberSmith Hub — Production Backend Entry Point
 * Phase 1: Google Cloud Storage & Secure Evidence Backend Foundation
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { serverStorage, ALLOWED_IMAGE_MIME_TYPES, MAX_PHOTO_FILE_SIZE_BYTES } from './server/storageService';
import { serverGemini } from './server/geminiService';
import { gmailOAuthService, SendPOPayload } from './server/gmailOAuthService';
import { StorageUploadRequest } from './src/types/storage';
import { ChatGenerateRequest } from './src/types/chat';

function parseCookies(req: express.Request): Record<string, string> {
  const list: Record<string, string> = {};
  const rc = req.headers.cookie;
  if (!rc) return list;
  rc.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const key = parts.shift()?.trim();
    if (key) list[key] = decodeURIComponent(parts.join('='));
  });
  return list;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Canonical trusted frontend origins allowlist (no wildcard suffixes permitted)
  const TRUSTED_ORIGINS = new Set([
    'https://timbersmith-terminal.netlify.app',
    'https://tsjoinery.co.za',
    'https://www.tsjoinery.co.za',
    'http://localhost:3000',
    'http://localhost:5173'
  ]);

  // Cross-Origin Resource Sharing (CORS) with credentials support
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && TRUSTED_ORIGINS.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // JSON and URL-encoded body parser with 30MB limit for evidence handling
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ extended: true, limit: '30mb' }));

  // ==========================================
  // API ROUTES (FIRST)
  // ==========================================

  // 1. Backend Health & Service Status
  app.get('/api/health', (req, res) => {
    const storageStatus = serverStorage.getStatus();
    res.json({
      status: 'ok',
      service: 'TimberSmith Hub API',
      version: 'v1.0.5.001',
      storage: {
        engine: 'Google Cloud Storage',
        root: 'TimberSmith-Evidence',
        configured: storageStatus.configured,
        bucket: storageStatus.bucket,
        allowedMimeTypes: Array.from(ALLOWED_IMAGE_MIME_TYPES),
        maxFileSizeBytes: MAX_PHOTO_FILE_SIZE_BYTES
      },
      ai: {
        engine: 'Google Gemini AI',
        configured: serverGemini.isConfigured(),
        defaultModel: 'gemini-3.7-flash'
      },
      timestamp: new Date().toISOString()
    });
  });

  // 2. Secure Evidence Photo Upload
  // Accepts multipart/JSON buffer payload with validated metadata
  app.post('/api/storage/upload', async (req, res) => {
    try {
      const { fileBase64, ...metadata } = req.body as { fileBase64: string } & StorageUploadRequest;

      if (!fileBase64) {
        return res.status(400).json({ success: false, error: 'Missing file payload (fileBase64 required in JSON body)' });
      }

      // Strip data URL prefix if present
      const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
      const fileBuffer = Buffer.from(cleanBase64, 'base64');

      const result = await serverStorage.uploadPhoto(fileBuffer, metadata);

      return res.status(200).json({
        success: true,
        photo: result.photo,
        signedUrl: result.signedUrl
      });
    } catch (err: any) {
      console.error('[API /api/storage/upload] Error:', err.message);
      return res.status(400).json({
        success: false,
        error: err.message || 'Storage upload failed'
      });
    }
  });

  // 3. Short-lived Signed URL for Secure Evidence Viewing
  app.post('/api/storage/signed-url', async (req, res) => {
    try {
      const { storagePath, storageObjectName } = req.body as { storagePath: string; storageObjectName: string };

      if (!storagePath || !storageObjectName) {
        return res.status(400).json({ success: false, error: 'Missing storagePath or storageObjectName' });
      }

      const url = await serverStorage.getSignedReadUrl(storagePath, storageObjectName);
      return res.status(200).json({
        success: true,
        url,
        expiresInSeconds: 7200
      });
    } catch (err: any) {
      console.error('[API /api/storage/signed-url] Error:', err.message);
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to generate signed URL'
      });
    }
  });

  // 4. Secure Gemini Chat Proxy Endpoint
  // Receives prompts/conversation history, calls @google/genai server-side, and returns the response safely
  app.post('/api/chat/generate', async (req, res) => {
    try {
      const { prompt, messages, model, systemInstruction } = req.body as ChatGenerateRequest;

      if (!prompt && (!messages || messages.length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'Either "prompt" or "messages" array is required.'
        });
      }

      const result = await serverGemini.generateChatResponse({
        prompt,
        messages,
        model,
        systemInstruction
      });

      return res.status(200).json({
        success: true,
        text: result.text,
        model: result.model,
        usage: result.usage
      });
    } catch (err: any) {
      console.error('[API /api/chat/generate] Error:', err.message);
      return res.status(500).json({
        success: false,
        error: err.message || 'Gemini AI generation failed'
      });
    }
  });

  // ==========================================
  // 5. GOOGLE WORKSPACE OAUTH & GMAIL API (PHASE 4B)
  // ==========================================

  // 5.1 Initiate Google OAuth Authorization Flow
  // Accepts employeeEmail, validates @tsjoinery.co.za, generates state + PKCE, redirects to Google
  app.get('/api/auth/google/authorize', (req, res) => {
    try {
      const employeeEmail = String(req.query.employeeEmail || '').trim();
      const returnUrl = String(req.query.returnUrl || req.headers.referer || 'https://timbersmith-terminal.netlify.app/');

      if (!employeeEmail) {
        return res.status(400).json({
          error: 'Missing required query parameter "employeeEmail".'
        });
      }

      const { url } = gmailOAuthService.generateAuthorizationUrl(employeeEmail, returnUrl);

      // Support direct redirect or JSON response
      if (req.query.format === 'json' || req.headers.accept?.includes('application/json')) {
        return res.json({ url });
      }

      return res.redirect(url);
    } catch (err: any) {
      console.error('[API /api/auth/google/authorize] Error:', err.message);
      return res.status(400).json({ error: err.message || 'Authorization initiation failed' });
    }
  });

  // 5.2 Google OAuth Callback Handler
  // Validates state, exchanges authorization code, strictly validates @tsjoinery.co.za match, sets secure cookie
  app.get('/api/auth/google/callback', async (req, res) => {
    try {
      const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

      if (error) {
        console.warn('[API /api/auth/google/callback] Google reported error:', error);
        return res.redirect(`https://timbersmith-terminal.netlify.app/?oauth_error=${encodeURIComponent(error)}`);
      }

      if (!code || !state) {
        return res.redirect(`https://timbersmith-terminal.netlify.app/?oauth_error=${encodeURIComponent('Missing authorization code or state parameter.')}`);
      }

      const result = await gmailOAuthService.handleCallback(code, state);

      // Set short-lived secure HTTP-only session cookie (1 hour) containing ONLY the opaque random session ID
      const isSecure = process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https';
      const cookieParts = [
        `ts_gmail_session=${result.sessionId}`,
        'Path=/',
        'HttpOnly',
        isSecure ? 'SameSite=None' : 'SameSite=Lax',
        'Max-Age=3600'
      ];
      if (isSecure) {
        cookieParts.push('Secure');
        cookieParts.push('Partitioned');
      }
      res.setHeader('Set-Cookie', cookieParts.join('; '));

      // Redirect cleanly back to the application WITHOUT session ID or any sensitive credentials in the URL
      const targetUrl = new URL(result.appReturnUrl || 'https://timbersmith-terminal.netlify.app/');
      targetUrl.searchParams.set('google_auth', 'success');
      targetUrl.searchParams.set('google_email', result.googleEmail);

      return res.redirect(targetUrl.toString());
    } catch (err: any) {
      console.error('[API /api/auth/google/callback] Callback failure:', err.message);
      return res.redirect(
        `https://timbersmith-terminal.netlify.app/?oauth_error=${encodeURIComponent(err.message || 'Callback failed')}`
      );
    }
  });

  // 5.3 Google Account Connection Status
  // Returns safe boolean and email without exposing credentials
  app.get('/api/auth/google/status', async (req, res) => {
    try {
      const cookies = parseCookies(req);
      const sessionId = cookies.ts_gmail_session;
      const status = await gmailOAuthService.getSessionStatus(sessionId);
      return res.json(status);
    } catch (err: any) {
      console.error('[API /api/auth/google/status] Error:', err.message);
      return res.status(500).json({ connected: false, googleEmail: null, canSend: false });
    }
  });

  // 5.4 Disconnect / Logout Active Google Session
  app.post('/api/auth/google/logout', async (req, res) => {
    try {
      const cookies = parseCookies(req);
      const sessionId = cookies.ts_gmail_session;
      if (sessionId) {
        await gmailOAuthService.logout(sessionId);
      }
      const isSecure = process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https';
      const cookieParts = [
        'ts_gmail_session=',
        'Path=/',
        'HttpOnly',
        isSecure ? 'SameSite=None' : 'SameSite=Lax',
        'Max-Age=0'
      ];
      if (isSecure) {
        cookieParts.push('Secure');
        cookieParts.push('Partitioned');
      }
      res.setHeader('Set-Cookie', cookieParts.join('; '));
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[API /api/auth/google/logout] Error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5.5 Send Purchase Order via Gmail API
  app.post('/api/mail/send-purchase-order', async (req, res) => {
    try {
      const cookies = parseCookies(req);
      const sessionId = cookies.ts_gmail_session;

      if (!sessionId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: No active Google Workspace session found. Please connect Google Workspace.'
        });
      }

      const payload = req.body as SendPOPayload;
      if (!payload) {
        return res.status(400).json({ success: false, error: 'Missing request body payload.' });
      }

      const sendResult = await gmailOAuthService.executePurchaseOrderSend(sessionId, payload, req);
      return res.status(200).json(sendResult);
    } catch (err: any) {
      console.error('[API /api/mail/send-purchase-order] Transmission error:', err.message);
      const msg = err.message || 'Failed to send Purchase Order via Gmail API';
      const statusCode = msg.startsWith('Unauthorized')
        ? 401
        : msg.startsWith('Forbidden') || msg.includes('[PreviewSafety]')
        ? 403
        : 400;
      return res.status(statusCode).json({
        success: false,
        error: msg
      });
    }
  });

  // ==========================================
  // VITE MIDDLEWARE / STATIC ASSETS
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TimberSmith Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[TimberSmith Server] Fatal startup failure:', err);
  process.exit(1);
});
