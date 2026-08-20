/**
 * TimberSmith Hub — Production Backend Entry Point
 * Phase 1: Google Cloud Storage & Secure Evidence Backend Foundation
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { serverStorage, ALLOWED_IMAGE_MIME_TYPES, MAX_PHOTO_FILE_SIZE_BYTES } from './server/storageService';
import { serverGemini } from './server/geminiService';
import { StorageUploadRequest } from './src/types/storage';
import { ChatGenerateRequest } from './src/types/chat';

async function startServer() {
  const app = express();
  const PORT = 3000;

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
