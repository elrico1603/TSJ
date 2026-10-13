/**
 * Server-side Google Cloud Storage Service
 * TimberSmith Hub — Phase 1 Backend Storage Foundation
 * 
 * Privileged operations:
 * - Direct GCS upload via authenticated service account / Application Default Credentials
 * - Secure short-lived signed URL generation
 * - MIME & size validation
 */

import { Storage } from '@google-cloud/storage';
import { EvidencePhoto, StorageUploadRequest } from '../src/types/storage';
import { generateEvidenceStoragePath, generateStorageObjectName, validateStoragePath } from '../src/types/storagePath';

// Supported MIME types for evidence photographs
export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
]);

// Maximum file size: 25 MB per evidence photograph
export const MAX_PHOTO_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export class ServerStorageService {
  private storage: Storage | null = null;
  private bucketName: string;
  private isConfigured: boolean = false;

  constructor() {
    this.bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'timbersmith-evidence-bucket';
    this.initClient();
  }

  private initClient(): void {
    try {
      const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
      
      // Initialize GCS client using standard Application Default Credentials (ADC)
      // or explicit project configuration if supplied via environment
      if (projectId) {
        this.storage = new Storage({ projectId });
      } else {
        this.storage = new Storage();
      }
      
      this.isConfigured = true;
    } catch (err) {
      console.warn('[ServerStorageService] Google Cloud Storage client initialized in unconfigured mode:', err);
      this.isConfigured = false;
    }
  }

  /**
   * Health status of Google Cloud Storage backend integration
   */
  public getStatus(): { configured: boolean; bucket: string; projectId?: string } {
    return {
      configured: this.isConfigured,
      bucket: this.bucketName,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    };
  }

  /**
   * Validates upload metadata and file characteristics
   */
  public validateUploadParams(metadata: Partial<StorageUploadRequest>, fileSize: number): { valid: boolean; error?: string } {
    if (!metadata.dispatchNumber || !metadata.customer || !metadata.project) {
      return { valid: false, error: 'Missing required dispatch metadata (dispatchNumber, customer, project)' };
    }

    if (!metadata.mimeType || !ALLOWED_IMAGE_MIME_TYPES.has(metadata.mimeType.toLowerCase())) {
      return { valid: false, error: `Invalid or unsupported MIME type: ${metadata.mimeType}. Allowed: JPEG, PNG, WEBP, HEIC` };
    }

    if (fileSize <= 0) {
      return { valid: false, error: 'Empty file payload' };
    }

    if (fileSize > MAX_PHOTO_FILE_SIZE_BYTES) {
      return { valid: false, error: `File size exceeds maximum allowed limit of ${MAX_PHOTO_FILE_SIZE_BYTES / (1024 * 1024)}MB` };
    }

    return { valid: true };
  }

  /**
   * Uploads an evidence photograph buffer directly to Google Cloud Storage
   */
  public async uploadPhoto(
    fileBuffer: Buffer,
    req: StorageUploadRequest
  ): Promise<{ photo: EvidencePhoto; signedUrl?: string }> {
    const validation = this.validateUploadParams(req, fileBuffer.length);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Generate deterministic storage folder path
    const storagePath = generateEvidenceStoragePath({
      customer: req.customer,
      project: req.project,
      item: req.item,
      dispatchNumber: req.dispatchNumber,
      stage: req.stage,
      packageNumber: req.packageNumber || 1,
      totalPackages: req.totalPackages || 1
    });

    if (!validateStoragePath(storagePath)) {
      throw new Error('Generated storage path failed security traversal validation');
    }

    // Generate unique object name
    const storageObjectName = generateStorageObjectName(
      req.evidenceType || 'package-condition',
      req.originalFileName || 'evidence.jpg'
    );

    const fullObjectPath = `${storagePath}/${storageObjectName}`;
    const photoId = `photo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    let signedUrl: string | undefined;

    if (this.storage && this.isConfigured) {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fullObjectPath);

      // Upload file to GCS
      await file.save(fileBuffer, {
        metadata: {
          contentType: req.mimeType,
          metadata: {
            photoId,
            dispatchNumber: req.dispatchNumber,
            packageNumber: String(req.packageNumber),
            totalPackages: String(req.totalPackages),
            stage: req.stage,
            uploadedBy: req.uploadedBy,
            uploadedAt: new Date().toISOString()
          }
        },
        resumable: false
      });

      // Generate a short-lived read URL (valid for 2 hours)
      try {
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
        });
        signedUrl = url;
      } catch (signErr) {
        console.warn('[ServerStorageService] Signed URL generation skipped (no signing key configured):', signErr);
      }
    } else {
      console.warn('[ServerStorageService] GCS not configured; simulation mode used for path validation');
    }

    const evidencePhoto: EvidencePhoto = {
      id: photoId,
      dispatchNumber: req.dispatchNumber,
      packageId: req.packageId,
      packageNumber: req.packageNumber || 1,
      totalPackages: req.totalPackages || 1,
      evidenceStage: req.stage,
      evidenceType: req.evidenceType || 'package_condition',
      originalFileName: req.originalFileName,
      storagePath,
      storageObjectName,
      mimeType: req.mimeType,
      size: fileBuffer.length,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.uploadedBy,
      viewUrl: signedUrl
    };

    return { photo: evidencePhoto, signedUrl };
  }

  /**
   * Generates a short-lived signed URL for viewing an existing evidence photograph
   */
  public async getSignedReadUrl(storagePath: string, storageObjectName: string): Promise<string> {
    const fullPath = `${storagePath}/${storageObjectName}`;
    if (!validateStoragePath(storagePath) || !validateStoragePath(fullPath)) {
      throw new Error('Invalid storage path or object name');
    }

    if (!this.storage || !this.isConfigured) {
      throw new Error('Google Cloud Storage client is not configured on this server');
    }

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(fullPath);

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
    });

    return url;
  }
}

export const serverStorage = new ServerStorageService();
