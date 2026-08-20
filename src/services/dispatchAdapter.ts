/**
 * Backwards-Compatible Dispatch Record Adapter & Normalizer
 * TimberSmith Hub — Phase 2 Checkpoint C (v1.0.2.001)
 * 
 * Guarantees safe migration, lossless legacy handling, and Firestore/localStorage serialization.
 */

import { DispatchRecord } from '../components/DispatchDetails';
import {
  DispatchPackage,
  formatPackageCode,
  calculatePackageSummary,
  validatePackages
} from '../types/dispatchPackage';

/**
 * Normalizes an incoming raw dispatch record (from Firestore snapshot, localStorage, or form inputs)
 * into a strongly-typed, backwards-compatible DispatchRecord.
 * 
 * FALSE EVIDENCE RULE:
 * - If packages are absent, NEVER invent synthetic package evidence or claim package contents are known.
 * - If legacy photos or mock Drive fields are present, preserve them untouched.
 */
export function normalizeDispatchRecord(raw: any): DispatchRecord {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Cannot normalize non-object dispatch record');
  }

  const dispatchNumber = String(raw.dispatchNumber || 'DSP-UNKNOWN').trim();

  // Normalize packages array if present
  let normalizedPackages: DispatchPackage[] | undefined = undefined;

  if (Array.isArray(raw.packages) && raw.packages.length > 0) {
    const totalCount = raw.packages.length;
    normalizedPackages = raw.packages.map((pkg: any, idx: number) => {
      const pkgNum = typeof pkg.packageNumber === 'number' && pkg.packageNumber > 0 ? pkg.packageNumber : (idx + 1);
      const pkgTotal = typeof pkg.totalPackages === 'number' && pkg.totalPackages > 0 ? pkg.totalPackages : totalCount;
      const packageCode = pkg.packageCode || formatPackageCode(dispatchNumber, pkgNum, pkgTotal);

      return {
        id: String(pkg.id || `pkg-${dispatchNumber.toLowerCase()}-${pkgNum}`),
        dispatchId: pkg.dispatchId ? String(pkg.dispatchId) : (raw.id ? String(raw.id) : undefined),
        dispatchNumber,
        packageNumber: pkgNum,
        totalPackages: pkgTotal,
        packageCode,
        stickerCode: pkg.stickerCode ? String(pkg.stickerCode) : undefined,
        description: pkg.description ? String(pkg.description) : undefined,
        itemId: pkg.itemId ? String(pkg.itemId) : undefined,
        productCode: pkg.productCode ? String(pkg.productCode) : undefined,
        productName: pkg.productName ? String(pkg.productName) : undefined,
        quantity: typeof pkg.quantity === 'number' ? pkg.quantity : 1,
        weightKg: typeof pkg.weightKg === 'number' ? pkg.weightKg : undefined,
        dimensions: pkg.dimensions && typeof pkg.dimensions === 'object' ? {
          lengthMm: pkg.dimensions.lengthMm,
          widthMm: pkg.dimensions.widthMm,
          heightMm: pkg.dimensions.heightMm
        } : undefined,
        status: pkg.status || 'UNVERIFIED',
        dispatchStatus: pkg.dispatchStatus || 'pending',
        receivingStatus: pkg.receivingStatus || 'unverified',
        dispatchPhotos: Array.isArray(pkg.dispatchPhotos) ? pkg.dispatchPhotos : [],
        receivingPhotos: Array.isArray(pkg.receivingPhotos) ? pkg.receivingPhotos : [],
        notes: pkg.notes ? String(pkg.notes) : undefined,
        receivingNotes: pkg.receivingNotes ? String(pkg.receivingNotes) : undefined,
        verifiedBy: pkg.verifiedBy ? String(pkg.verifiedBy) : undefined,
        verifiedAt: pkg.verifiedAt ? String(pkg.verifiedAt) : undefined,
        receivedBy: pkg.receivedBy ? String(pkg.receivedBy) : undefined,
        receivedAt: pkg.receivedAt ? String(pkg.receivedAt) : undefined,
        createdAt: pkg.createdAt || raw.createdAt || new Date().toISOString(),
        updatedAt: pkg.updatedAt || raw.updatedAt || new Date().toISOString()
      };
    });
  }

  // Preserve all legacy properties cleanly
  const record: DispatchRecord = {
    id: String(raw.id || `dsp-${Date.now()}`),
    dispatchNumber,
    customer: String(raw.customer || '').trim(),
    project: String(raw.project || '').trim(),
    destinationBranch: String(raw.destinationBranch || '').trim(),
    installer: raw.installer ? String(raw.installer).trim() : undefined,
    courier: raw.courier ? String(raw.courier).trim() : undefined,
    courierCompany: raw.courierCompany ? String(raw.courierCompany).trim() : undefined,
    trackingNumber: raw.trackingNumber ? String(raw.trackingNumber).trim() : undefined,
    trackingUrl: raw.trackingUrl ? String(raw.trackingUrl).trim() : undefined,
    parcelCount: raw.parcelCount !== undefined ? String(raw.parcelCount) : undefined,
    notes: raw.notes ? String(raw.notes).trim() : undefined,
    status: raw.status || 'Draft',
    items: Array.isArray(raw.items) ? raw.items : [],
    
    // New package model (if present in record)
    packages: normalizedPackages,

    // Legacy Google Drive fields (preserved for backwards-compatibility)
    googleDriveFolderId: raw.googleDriveFolderId ? String(raw.googleDriveFolderId) : undefined,
    googleDriveFolderName: raw.googleDriveFolderName ? String(raw.googleDriveFolderName) : undefined,
    googleDriveFolderUrl: raw.googleDriveFolderUrl ? String(raw.googleDriveFolderUrl) : undefined,
    googleDriveReceivingFolderId: raw.googleDriveReceivingFolderId ? String(raw.googleDriveReceivingFolderId) : undefined,
    googleDriveReceivingFolderUrl: raw.googleDriveReceivingFolderUrl ? String(raw.googleDriveReceivingFolderUrl) : undefined,

    // Legacy Flat Photos (preserved for backwards-compatibility)
    photoCount: typeof raw.photoCount === 'number' ? raw.photoCount : (Array.isArray(raw.photos) ? raw.photos.length : 0),
    photos: Array.isArray(raw.photos) ? raw.photos : [],
    receivingPhotos: Array.isArray(raw.receivingPhotos) ? raw.receivingPhotos : [],
    
    // Receiving checklist & notes
    receivingChecklist: raw.receivingChecklist ? {
      packagingIntact: Boolean(raw.receivingChecklist.packagingIntact),
      parcelCountMatches: Boolean(raw.receivingChecklist.parcelCountMatches),
      correctProducts: Boolean(raw.receivingChecklist.correctProducts),
      qualityChecked: Boolean(raw.receivingChecklist.qualityChecked)
    } : undefined,
    receivingNotes: raw.receivingNotes ? String(raw.receivingNotes).trim() : undefined,
    receivedBy: raw.receivedBy ? String(raw.receivedBy).trim() : undefined,
    receivedAt: raw.receivedAt ? String(raw.receivedAt) : undefined,

    createdBy: String(raw.createdBy || 'System').trim(),
    createdAt: raw.createdAt ? String(raw.createdAt) : new Date().toISOString(),
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : new Date().toISOString(),
    history: Array.isArray(raw.history) ? raw.history : []
  };

  return record;
}

/**
 * Evaluates receiving completion from a package list.
 * Enforces the false completion prevention rule (e.g. 6/7 packages cannot be marked 'Received').
 */
export function deriveReceivingStatus(
  packages?: DispatchPackage[],
  fallbackStatus: DispatchRecord['status'] = 'Dispatched'
): DispatchRecord['status'] {
  if (!packages || packages.length === 0) {
    return fallbackStatus;
  }

  const summary = calculatePackageSummary(packages);

  // If no packages verified yet, maintain current status or In Transit / Dispatched
  if (summary.unverified === summary.total) {
    return fallbackStatus;
  }

  // All packages verified and 100% received with no issues
  if (summary.isComplete) {
    return 'Received';
  }

  // If any packages are missing, damaged, or incorrect -> Issue Logged or Partially Received
  if (summary.missing > 0 || summary.damaged > 0 || summary.incorrect > 0) {
    if (summary.damaged > 0 || summary.incorrect > 0) {
      return 'Issue Logged';
    }
    return 'Partially Received';
  }

  // If some are received and some unverified
  if (summary.received > 0 && summary.received < summary.total) {
    return 'Partially Received';
  }

  return fallbackStatus;
}

/**
 * Recursively strips undefined keys and ensures payloads are 100% valid for Firestore writes
 * (Firestore throws exceptions if object keys have value `undefined`).
 */
export function sanitizeForFirestore<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item)) as any;
  }

  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const clean: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        clean[key] = sanitizeForFirestore(val);
      }
    }
    return clean as T;
  }

  return obj;
}

/**
 * Validates a DispatchRecord before Firestore or localStorage persistence.
 */
export function validateDispatchRecord(record: Partial<DispatchRecord>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!record.dispatchNumber || !record.dispatchNumber.trim()) {
    errors.push('Dispatch number is required');
  }

  if (!record.customer || !record.customer.trim()) {
    errors.push('Customer is required');
  }

  if (!record.project || !record.project.trim()) {
    errors.push('Project is required');
  }

  if (record.packages && record.packages.length > 0) {
    const pkgValidation = validatePackages(record.packages);
    if (!pkgValidation.valid) {
      errors.push(...pkgValidation.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
