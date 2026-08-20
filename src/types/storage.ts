/**
 * Evidence Photo and Storage Types for Dispatch & Receiving
 * TimberSmith Hub — Phase 1 Storage & Backend Foundation
 */

export type EvidenceStage = 'dispatch' | 'receiving';

export type EvidenceType = 
  | 'package_condition'
  | 'delivery_note'
  | 'unpacked_items'
  | 'damage_report'
  | 'sticker_label'
  | 'general_evidence';

export interface StoragePathParams {
  year?: string | number;
  customer: string;
  project: string;
  item?: string;
  dispatchNumber: string;
  stage: EvidenceStage;
  packageNumber: number;
  totalPackages: number;
}

export interface EvidencePhoto {
  id: string;
  dispatchNumber: string;
  packageId?: string;
  packageNumber: number;
  totalPackages: number;
  evidenceStage: EvidenceStage;
  evidenceType: EvidenceType;
  originalFileName: string;
  storagePath: string;
  storageObjectName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  viewUrl?: string; // Short-lived signed URL or proxy URL for viewing
}

export interface StorageUploadRequest {
  dispatchNumber: string;
  customer: string;
  project: string;
  item?: string;
  stage: EvidenceStage;
  packageNumber: number;
  totalPackages: number;
  evidenceType?: EvidenceType;
  originalFileName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  packageId?: string;
}

export interface StorageUploadResponse {
  success: boolean;
  photo?: EvidencePhoto;
  error?: string;
}

export interface SignedUrlResponse {
  success: boolean;
  url?: string;
  expiresAt?: string;
  error?: string;
}
