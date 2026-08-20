/**
 * Client-side Cloud Storage Service for TimberSmith Hub
 * Evidence Photo upload and retrieval via secure backend proxy
 * 
 * ZERO SERVICE ACCOUNT CREDENTIALS OR STORAGE SECRETS IN CLIENT
 */

import { EvidencePhoto, StorageUploadRequest, StorageUploadResponse, SignedUrlResponse } from '../types/storage';

export class CloudStorageService {
  private static instance: CloudStorageService;

  public static getInstance(): CloudStorageService {
    if (!CloudStorageService.instance) {
      CloudStorageService.instance = new CloudStorageService();
    }
    return CloudStorageService.instance;
  }

  /**
   * Uploads an evidence photograph (File or Blob) to Google Cloud Storage via the secure backend
   * Returns metadata only (no Base64 in Firestore)
   */
  public async uploadEvidencePhoto(
    file: File | Blob,
    metadata: Omit<StorageUploadRequest, 'mimeType' | 'size' | 'originalFileName'> & { originalFileName?: string }
  ): Promise<EvidencePhoto> {
    const originalFileName = metadata.originalFileName || (file instanceof File ? file.name : 'evidence_photo.jpg');
    const mimeType = file.type || 'image/jpeg';
    const size = file.size;

    // Convert file to base64 for transmission to backend endpoint
    const base64Data = await this.fileToBase64(file);

    const payload = {
      fileBase64: base64Data,
      dispatchNumber: metadata.dispatchNumber,
      customer: metadata.customer,
      project: metadata.project,
      item: metadata.item || 'General',
      stage: metadata.stage,
      packageNumber: metadata.packageNumber || 1,
      totalPackages: metadata.totalPackages || 1,
      evidenceType: metadata.evidenceType || 'package_condition',
      originalFileName,
      mimeType,
      size,
      uploadedBy: metadata.uploadedBy || 'User',
      packageId: metadata.packageId
    };

    const response = await fetch('/api/storage/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorMsg = `Upload failed with HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error) errorMsg = errorData.error;
      } catch (_) {}
      throw new Error(errorMsg);
    }

    const result: StorageUploadResponse = await response.json();
    if (!result.success || !result.photo) {
      throw new Error(result.error || 'Server rejected photo upload');
    }

    return result.photo;
  }

  /**
   * Requests a fresh short-lived signed URL for an existing evidence photo
   */
  public async getSignedUrl(storagePath: string, storageObjectName: string): Promise<string> {
    const response = await fetch('/api/storage/signed-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ storagePath, storageObjectName })
    });

    if (!response.ok) {
      throw new Error(`Signed URL request failed with HTTP ${response.status}`);
    }

    const result: SignedUrlResponse = await response.json();
    if (!result.success || !result.url) {
      throw new Error(result.error || 'Could not obtain signed URL');
    }

    return result.url;
  }

  /**
   * Helper to convert File/Blob to Base64 transmission string
   */
  private fileToBase64(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('FileReader result is not a string'));
        }
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }
}

export const cloudStorage = CloudStorageService.getInstance();
