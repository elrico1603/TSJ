/**
 * Deterministic Storage Path Generator and Validator for TimberSmith Hub
 * Evidence Root: TimberSmith-Evidence/
 * 
 * Path Pattern:
 * TimberSmith-Evidence/{year}/{customer}/{project}/{item}/{dispatchNumber}/{stage}/Package-{N}-of-{total}/
 */

import { StoragePathParams } from './storage';

export const EVIDENCE_STORAGE_ROOT = 'TimberSmith-Evidence';

/**
 * Sanitizes a path segment to prevent directory traversal and invalid characters.
 * Replaces slashes, backslashes, dots, and control characters with clean hyphens.
 */
export function sanitizePathSegment(segment: string | undefined | null, fallback = 'General'): string {
  if (!segment) return fallback;
  
  // Convert to string and trim
  let clean = String(segment).trim();
  
  // Replace slashes, backslashes, and path traversal sequences
  clean = clean.replace(/[/\\?%*:|"<>]/g, '-');
  clean = clean.replace(/\.{2,}/g, '-'); // Remove ..
  clean = clean.replace(/^\.+|\.+$/g, ''); // Remove leading/trailing dots
  clean = clean.replace(/\s+/g, '-'); // Replace spaces with hyphens
  clean = clean.replace(/-+/g, '-'); // Collapse multiple hyphens
  clean = clean.replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens

  return clean.length > 0 ? clean : fallback;
}

/**
 * Formats a package index into a standardized two-digit representation.
 * Example: packageNumber 1, total 7 => "Package-01-of-07"
 */
export function formatPackageFolder(packageNumber: number, totalPackages: number): string {
  const pNum = Math.max(1, packageNumber || 1);
  const tNum = Math.max(pNum, totalPackages || 1);
  
  const padLength = tNum >= 100 ? 3 : 2;
  const pStr = String(pNum).padStart(padLength, '0');
  const tStr = String(tNum).padStart(padLength, '0');
  
  return `Package-${pStr}-of-${tStr}`;
}

/**
 * Generates the deterministic Cloud Storage folder path for dispatch/receiving evidence.
 */
export function generateEvidenceStoragePath(params: StoragePathParams): string {
  const currentYear = new Date().getFullYear();
  const year = sanitizePathSegment(String(params.year || currentYear), String(currentYear));
  const customer = sanitizePathSegment(params.customer, 'Customer');
  const project = sanitizePathSegment(params.project, 'Project');
  const item = sanitizePathSegment(params.item, 'General-Item');
  const dispatchNumber = sanitizePathSegment(params.dispatchNumber, 'DSP-UNKNOWN');
  
  const stage = params.stage === 'receiving' ? 'Receiving' : 'Dispatch';
  const packageFolder = formatPackageFolder(params.packageNumber, params.totalPackages);

  return `${EVIDENCE_STORAGE_ROOT}/${year}/${customer}/${project}/${item}/${dispatchNumber}/${stage}/${packageFolder}`;
}

/**
 * Generates a unique, non-colliding storage object name.
 * Example: 20260817T101530Z-package-condition-a1b2c3d4.jpg
 */
export function generateStorageObjectName(
  evidenceType: string = 'package-condition',
  originalFileName: string = 'photo.jpg'
): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
  const cleanType = sanitizePathSegment(evidenceType, 'photo');
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  
  // Extract extension
  const extMatch = originalFileName.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '.jpg';

  return `${timestamp}-${cleanType}-${randomSuffix}${ext}`;
}

/**
 * Validates that a storage path resides safely inside the EVIDENCE_STORAGE_ROOT hierarchy.
 */
export function validateStoragePath(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  if (!path.startsWith(`${EVIDENCE_STORAGE_ROOT}/`)) return false;
  if (path.includes('..')) return false;
  if (path.includes('\\')) return false;
  return true;
}
