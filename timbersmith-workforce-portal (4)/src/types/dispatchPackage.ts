/**
 * Package-Level Data Model & Types for TimberSmith Hub Dispatch & Receiving
 * Phase 2 — Checkpoint C (v1.0.2.001)
 */

import { EvidencePhoto } from './storage';

export type PackageStatus =
  | 'UNVERIFIED'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'MISSING'
  | 'DAMAGED'
  | 'INCORRECT'
  | 'PARTIALLY_RECEIVED';

export type PackageReceivingStatus =
  | 'unverified'
  | 'received'
  | 'missing'
  | 'damaged'
  | 'incorrect';

export type PackageDispatchStatus =
  | 'pending'
  | 'verified'
  | 'dispatched';

export interface PackageDimensions {
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
}

export interface DispatchPackage {
  id: string;
  dispatchId?: string;
  dispatchNumber: string;
  packageNumber: number; // 1-based index (e.g. 1 of 7)
  totalPackages: number; // Total package count in dispatch (e.g. 7)
  packageCode: string; // Deterministic code: e.g. "DSP-2026-0001-P01"
  stickerCode?: string; // QR or barcode sticker identifier (e.g. "STK-DSP-2026-0001-P01")
  description?: string; // e.g. "Bedside Pedestal - Left (Walnut Veneer)"
  
  // Product / Item reference
  itemId?: string;
  productCode?: string;
  productName?: string;
  quantity?: number;
  
  // Physical properties
  weightKg?: number;
  dimensions?: PackageDimensions;
  
  // Status tracking
  status: PackageStatus;
  dispatchStatus?: PackageDispatchStatus;
  receivingStatus?: PackageReceivingStatus;
  
  // Evidence references (Cloud Storage metadata, NO Base64)
  dispatchPhotos?: EvidencePhoto[];
  receivingPhotos?: EvidencePhoto[];
  
  // Notes and Verification details
  notes?: string;
  receivingNotes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  
  createdAt?: string;
  updatedAt?: string;
}

export interface PackageSummary {
  total: number;
  received: number;
  missing: number;
  damaged: number;
  incorrect: number;
  unverified: number;
  isComplete: boolean;
  hasIssues: boolean;
}

/**
 * Formats a standardized, deterministic package code.
 * Example: dispatchNumber "DSP-2026-0001", packageNumber 1, total 7 => "DSP-2026-0001-P01"
 */
export function formatPackageCode(
  dispatchNumber: string,
  packageNumber: number,
  totalPackages: number = 1
): string {
  const cleanDispatch = (dispatchNumber || 'DSP-UNKNOWN').trim();
  const pNum = Math.max(1, packageNumber || 1);
  const tNum = Math.max(pNum, totalPackages || 1);
  
  const padLength = tNum >= 100 ? 3 : 2;
  const pStr = String(pNum).padStart(padLength, '0');
  
  return `${cleanDispatch}-P${pStr}`;
}

/**
 * Formats a standardized sticker / label code for physical package labelling.
 * Example: "STK-DSP-2026-0001-P01"
 */
export function generateStickerCode(
  dispatchNumber: string,
  packageNumber: number,
  totalPackages: number = 1
): string {
  const pkgCode = formatPackageCode(dispatchNumber, packageNumber, totalPackages);
  return `STK-${pkgCode}`;
}

/**
 * Validates package numbering rules:
 * - 1-indexed from 1 to totalPackages
 * - No 0, negative numbers, or numbers exceeding totalPackages
 * - No duplicate package numbers
 */
export function validatePackageNumbering(packages: DispatchPackage[]): { valid: boolean; error?: string } {
  if (!packages || packages.length === 0) {
    return { valid: true };
  }

  const expectedTotal = packages[0].totalPackages || packages.length;
  const seenNumbers = new Set<number>();

  for (const pkg of packages) {
    if (typeof pkg.packageNumber !== 'number' || isNaN(pkg.packageNumber)) {
      return { valid: false, error: `Invalid package number: ${pkg.packageNumber}` };
    }

    if (pkg.packageNumber < 1) {
      return { valid: false, error: `Package number must be >= 1 (got ${pkg.packageNumber})` };
    }

    if (pkg.packageNumber > expectedTotal) {
      return { valid: false, error: `Package number ${pkg.packageNumber} exceeds total packages (${expectedTotal})` };
    }

    if (seenNumbers.has(pkg.packageNumber)) {
      return { valid: false, error: `Duplicate package number detected: ${pkg.packageNumber}` };
    }

    seenNumbers.add(pkg.packageNumber);
  }

  return { valid: true };
}

/**
 * Validates that all package codes in a dispatch are unique and well-formed.
 */
export function validatePackageCodes(packages: DispatchPackage[]): { valid: boolean; error?: string } {
  if (!packages || packages.length === 0) {
    return { valid: true };
  }

  const seenCodes = new Set<string>();

  for (const pkg of packages) {
    if (!pkg.packageCode || typeof pkg.packageCode !== 'string' || pkg.packageCode.trim().length === 0) {
      return { valid: false, error: `Package at index ${pkg.packageNumber} has missing or empty packageCode` };
    }

    const code = pkg.packageCode.trim();
    if (seenCodes.has(code)) {
      return { valid: false, error: `Duplicate package code detected: ${code}` };
    }

    seenCodes.add(code);
  }

  return { valid: true };
}

/**
 * Full package collection validation suite.
 */
export function validatePackages(packages: DispatchPackage[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const numValidation = validatePackageNumbering(packages);
  if (!numValidation.valid && numValidation.error) {
    errors.push(numValidation.error);
  }

  const codeValidation = validatePackageCodes(packages);
  if (!codeValidation.valid && codeValidation.error) {
    errors.push(codeValidation.error);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculates a summary of receiving progress from package array.
 */
export function calculatePackageSummary(packages?: DispatchPackage[]): PackageSummary {
  if (!packages || packages.length === 0) {
    return {
      total: 0,
      received: 0,
      missing: 0,
      damaged: 0,
      incorrect: 0,
      unverified: 0,
      isComplete: false,
      hasIssues: false
    };
  }

  const total = packages.length;
  let received = 0;
  let missing = 0;
  let damaged = 0;
  let incorrect = 0;
  let unverified = 0;

  for (const pkg of packages) {
    const recStatus = pkg.receivingStatus || (
      pkg.status === 'RECEIVED' ? 'received' :
      pkg.status === 'MISSING' ? 'missing' :
      pkg.status === 'DAMAGED' ? 'damaged' :
      pkg.status === 'INCORRECT' ? 'incorrect' : 'unverified'
    );

    switch (recStatus) {
      case 'received':
        received++;
        break;
      case 'missing':
        missing++;
        break;
      case 'damaged':
        damaged++;
        break;
      case 'incorrect':
        incorrect++;
        break;
      default:
        unverified++;
        break;
    }
  }

  const hasIssues = missing > 0 || damaged > 0 || incorrect > 0;
  const isComplete = total > 0 && received === total && !hasIssues;

  return {
    total,
    received,
    missing,
    damaged,
    incorrect,
    unverified,
    isComplete,
    hasIssues
  };
}

/**
 * Factory helper to create a clean new array of N packages for a new dispatch.
 */
export function createDefaultPackages(
  dispatchNumber: string,
  totalPackages: number,
  baseDescription?: string
): DispatchPackage[] {
  const count = Math.max(1, totalPackages || 1);
  const cleanDispatch = (dispatchNumber || 'DSP-NEW').trim();
  const packages: DispatchPackage[] = [];
  const now = new Date().toISOString();

  for (let i = 1; i <= count; i++) {
    const packageCode = formatPackageCode(cleanDispatch, i, count);
    const stickerCode = generateStickerCode(cleanDispatch, i, count);

    packages.push({
      id: `pkg-${cleanDispatch.toLowerCase()}-${i}-${Date.now().toString(36)}`,
      dispatchNumber: cleanDispatch,
      packageNumber: i,
      totalPackages: count,
      packageCode,
      stickerCode,
      description: baseDescription ? `${baseDescription} (Package ${i} of ${count})` : `Package ${i} of ${count}`,
      status: 'UNVERIFIED',
      dispatchStatus: 'pending',
      receivingStatus: 'unverified',
      dispatchPhotos: [],
      receivingPhotos: [],
      createdAt: now,
      updatedAt: now
    });
  }

  return packages;
}
