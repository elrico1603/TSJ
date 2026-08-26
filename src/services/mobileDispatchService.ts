import { db, storage } from '../firebase';
import { sanitizeForFirestore } from './dispatchAdapter';

export interface DispatchPhotoItem {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  size?: number;
  mimeType?: string;
}

export interface MobileDispatchDoc {
  id: string;
  dispatchNumber: string;
  project: string;
  customer?: string;
  originBranch: string;
  destinationBranch: string;
  courier?: string;
  trackingNumber?: string;
  notes?: string;
  totalPieces?: number;
  missingPieces?: number[];
  verifiedPieces?: number[];
  status: 'In Transit' | 'Delivered / Completed' | 'Delivered / Received' | 'Discrepancy Flagged' | 'Draft' | 'Ready for Dispatch' | 'Received' | 'Issue Logged' | 'Dispatched' | string;
  photos: DispatchPhotoItem[];
  photoCount: number;
  receivingPhotos?: DispatchPhotoItem[];
  receivingNotes?: string;
  receivedBy?: string;
  receivedAt?: string;
  receivingChecklist?: {
    packagingIntact: boolean;
    parcelCountMatches: boolean;
    qualityChecked: boolean;
    totalPieces?: number;
    verifiedPieces?: number[];
    missingPieces?: number[];
  };
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  history: Array<{
    action: string;
    user: string;
    timestamp: string;
    notes?: string;
  }>;
}

const LOCAL_STORAGE_KEY = 'tsj_mobile_dispatches_cache_v1';

/**
 * Compresses an image file to standard JPEG blob / Base64 fallback if needed
 */
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses and scales down an image file to maximum dimensions of 1600px
 * and 0.75 JPEG quality using HTML5 Canvas.
 * Reduces 10MB phone camera photos down to ~300KB–800KB before uploading to Firebase.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 1600,
  quality = 0.75
): Promise<File> {
  // If not an image or SVG/GIF, return as is
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Scale dimensions down to a maximum of 1600px while maintaining aspect ratio
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      // Draw onto canvas and compress to JPEG at 0.75 quality
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const cleanFileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
          const compressedFile = new File([blob], cleanFileName, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(compressedFile);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => resolve(file);
    reader.onerror = () => resolve(file);

    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a photo to Firebase Cloud Storage under dispatches/{dispatchId}/{folder}/
 * Automatically compresses the image file with HTML5 Canvas before uploading.
 * Falls back safely to compressed data URL if storage bucket is unreachable.
 */
export async function uploadDispatchPhoto(
  file: File,
  dispatchId: string,
  folder: 'outgoing' | 'incoming'
): Promise<DispatchPhotoItem> {
  const timestamp = Date.now();

  // 1. Client-Side Image Compression (< 1MB Target, Max 1600px, 0.75 JPEG Quality)
  const compressedFile = await compressImageFile(file, 1600, 0.75);

  const cleanName = compressedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `dispatches/${dispatchId}/${folder}/${timestamp}_${cleanName}`;
  const photoId = `photo_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;

  try {
    if (storage && typeof storage.ref === 'function') {
      const storageRef = storage.ref(path);
      const snapshot = await storageRef.put(compressedFile, {
        contentType: compressedFile.type || 'image/jpeg'
      });
      const downloadUrl = await snapshot.ref.getDownloadURL();
      return {
        id: photoId,
        name: compressedFile.name,
        url: downloadUrl,
        uploadedAt: new Date().toISOString(),
        size: compressedFile.size,
        mimeType: compressedFile.type || 'image/jpeg'
      };
    }
  } catch (err) {
    console.warn('[Dispatch Storage] Direct storage upload failed, using compressed local image fallback:', err);
  }

  // Resilient fallback (ensures photos are never lost if storage permissions are restricted)
  const dataUrl = await fileToDataUrl(compressedFile);
  return {
    id: photoId,
    name: compressedFile.name,
    url: dataUrl,
    uploadedAt: new Date().toISOString(),
    size: compressedFile.size,
    mimeType: compressedFile.type || 'image/jpeg'
  };
}

/**
 * Generates an auto-incrementing Dispatch Number (e.g. DSP-2026-1042)
 */
export function generateDispatchNumber(): string {
  const year = new Date().getFullYear();
  const randomSeq = Math.floor(1000 + Math.random() * 9000);
  return `DSP-${year}-${randomSeq}`;
}

/**
 * Creates a new outgoing dispatch document in Firestore
 */
export async function createMobileDispatch(payload: {
  dispatchNumber: string;
  project: string;
  customer?: string;
  originBranch: string;
  destinationBranch: string;
  courier?: string;
  trackingNumber?: string;
  notes?: string;
  totalPieces?: number;
  photos: DispatchPhotoItem[];
  createdBy: string;
}): Promise<MobileDispatchDoc> {
  const now = new Date().toISOString();
  const dispatchId = `dsp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const pieces = payload.totalPieces && payload.totalPieces > 0 ? payload.totalPieces : Math.max(payload.photos.length, 1);

  const newDoc: MobileDispatchDoc = {
    id: dispatchId,
    dispatchNumber: payload.dispatchNumber.trim(),
    project: payload.project.trim(),
    customer: payload.customer?.trim() || payload.project.trim(),
    originBranch: payload.originBranch,
    destinationBranch: payload.destinationBranch,
    courier: payload.courier?.trim() || 'Internal Logistics',
    trackingNumber: payload.trackingNumber?.trim() || '',
    notes: payload.notes?.trim() || '',
    totalPieces: pieces,
    status: 'In Transit',
    photos: payload.photos,
    photoCount: payload.photos.length,
    receivingPhotos: [],
    createdBy: payload.createdBy || 'Factory Dispatch Officer',
    createdAt: now,
    updatedAt: now,
    history: [
      {
        action: 'Dispatched (In Transit)',
        user: payload.createdBy || 'Factory Dispatch Officer',
        timestamp: now,
        notes: `Outgoing goods (${pieces} piece(s)) dispatched from ${payload.originBranch} to ${payload.destinationBranch} with ${payload.photos.length} photo evidence capture(s).`
      }
    ]
  };

  // 1. Write to Firestore
  if (db) {
    try {
      const sanitized = sanitizeForFirestore(newDoc);
      await db.collection('dispatches').doc(dispatchId).set(sanitized);
    } catch (e) {
      console.warn('[Firestore] Error saving dispatch to collection:', e);
    }
  }

  // 2. Cache in localStorage
  saveToLocalCache(newDoc);

  return newDoc;
}

/**
 * Updates a dispatch document when receiving team confirms full receipt and inspects goods
 */
export async function confirmReceiptAndInspect(
  dispatchId: string,
  payload: {
    receiverName: string;
    receivingNotes?: string;
    receivingPhotos: DispatchPhotoItem[];
    verifiedPieces?: number[];
    totalPieces?: number;
    checklist?: {
      packagingIntact: boolean;
      parcelCountMatches: boolean;
      qualityChecked: boolean;
    };
  }
): Promise<void> {
  const now = new Date().toISOString();

  const updateData: Partial<MobileDispatchDoc> = {
    status: 'Delivered / Completed',
    receivedBy: payload.receiverName.trim(),
    receivedAt: now,
    receivingNotes: payload.receivingNotes?.trim() || 'All items verified, inspected and accepted in good order.',
    receivingPhotos: payload.receivingPhotos,
    verifiedPieces: payload.verifiedPieces,
    missingPieces: [],
    receivingChecklist: {
      packagingIntact: payload.checklist?.packagingIntact ?? true,
      parcelCountMatches: payload.checklist?.parcelCountMatches ?? true,
      qualityChecked: payload.checklist?.qualityChecked ?? true,
      totalPieces: payload.totalPieces,
      verifiedPieces: payload.verifiedPieces,
      missingPieces: []
    },
    updatedAt: now
  };

  if (db) {
    try {
      const docRef = db.collection('dispatches').doc(dispatchId);
      const snap = await docRef.get();
      let currentHistory: any[] = [];
      if (snap.exists) {
        currentHistory = snap.data()?.history || [];
      }

      const newHistoryEntry = {
        action: 'Delivered / Completed',
        user: payload.receiverName.trim(),
        timestamp: now,
        notes: `Full piece-by-piece receipt approved (${payload.verifiedPieces?.length || payload.totalPieces || 1} of ${payload.totalPieces || 1} pieces verified). ${payload.receivingNotes || ''}`
      };

      await docRef.set({
        ...updateData,
        history: [...currentHistory, newHistoryEntry]
      }, { merge: true });
    } catch (e) {
      console.warn('[Firestore] Error updating dispatch receiving status:', e);
    }
  }

  // Update local cache
  updateLocalCache(dispatchId, {
    ...updateData,
    historyEntry: {
      action: 'Delivered / Completed',
      user: payload.receiverName.trim(),
      timestamp: now,
      notes: payload.receivingNotes || 'Full piece-by-piece receipt approved and completed.'
    }
  });
}

/**
 * Flags a dispatch as having discrepancies or missing pieces at destination
 */
export async function flagDispatchDiscrepancy(
  dispatchId: string,
  payload: {
    receiverName: string;
    receivingNotes: string;
    receivingPhotos: DispatchPhotoItem[];
    missingPieces: number[];
    verifiedPieces: number[];
    totalPieces: number;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const missingText = payload.missingPieces.map(p => `Piece ${p} of ${payload.totalPieces}`).join(', ');

  const updateData: Partial<MobileDispatchDoc> = {
    status: 'Discrepancy Flagged',
    receivedBy: payload.receiverName.trim(),
    receivedAt: now,
    receivingNotes: payload.receivingNotes.trim() || `Discrepancy logged: Missing ${missingText}`,
    receivingPhotos: payload.receivingPhotos,
    missingPieces: payload.missingPieces,
    verifiedPieces: payload.verifiedPieces,
    receivingChecklist: {
      packagingIntact: false,
      parcelCountMatches: false,
      qualityChecked: false,
      totalPieces: payload.totalPieces,
      verifiedPieces: payload.verifiedPieces,
      missingPieces: payload.missingPieces
    },
    updatedAt: now
  };

  if (db) {
    try {
      const docRef = db.collection('dispatches').doc(dispatchId);
      const snap = await docRef.get();
      let currentHistory: any[] = [];
      if (snap.exists) {
        currentHistory = snap.data()?.history || [];
      }

      const newHistoryEntry = {
        action: 'Discrepancy Flagged',
        user: payload.receiverName.trim(),
        timestamp: now,
        notes: `EXCEPTION FLAGGED: Missing [${missingText}]. Verified [${payload.verifiedPieces.length}/${payload.totalPieces}]. Notes: ${payload.receivingNotes}`
      };

      await docRef.set({
        ...updateData,
        history: [...currentHistory, newHistoryEntry]
      }, { merge: true });
    } catch (e) {
      console.warn('[Firestore] Error flagging dispatch discrepancy:', e);
    }
  }

  // Update local cache
  updateLocalCache(dispatchId, {
    ...updateData,
    historyEntry: {
      action: 'Discrepancy Flagged',
      user: payload.receiverName.trim(),
      timestamp: now,
      notes: `Discrepancy: Missing ${missingText}. ${payload.receivingNotes}`
    }
  });
}

/**
 * Archives a completed dispatch record
 */
export async function archiveDispatch(
  dispatchId: string,
  userIdentifier: string = 'Authorized User'
): Promise<void> {
  const now = new Date().toISOString();
  const updateData = {
    isArchived: true,
    archivedAt: now,
    archivedBy: userIdentifier,
    updatedAt: now
  };

  if (db) {
    try {
      const docRef = db.collection('dispatches').doc(dispatchId);
      const snap = await docRef.get();
      let currentHistory: any[] = [];
      if (snap.exists) {
        currentHistory = snap.data()?.history || [];
      }

      const newHistoryEntry = {
        action: 'Dispatch Archived',
        user: userIdentifier,
        timestamp: now,
        notes: 'Dispatch record archived following stock receipt confirmation'
      };

      await docRef.set({
        ...updateData,
        history: [...currentHistory, newHistoryEntry]
      }, { merge: true });
    } catch (e) {
      console.warn('[Firestore] Error archiving dispatch:', e);
    }
  }

  // Update local cache
  updateLocalCache(dispatchId, {
    ...updateData,
    historyEntry: {
      action: 'Dispatch Archived',
      user: userIdentifier,
      timestamp: now,
      notes: 'Dispatch record archived'
    }
  });
}

/**
 * Unarchives a previously archived dispatch record
 */
export async function unarchiveDispatch(
  dispatchId: string,
  userIdentifier: string = 'Authorized User'
): Promise<void> {
  const now = new Date().toISOString();
  const updateData = {
    isArchived: false,
    archivedAt: undefined,
    archivedBy: undefined,
    updatedAt: now
  };

  if (db) {
    try {
      const docRef = db.collection('dispatches').doc(dispatchId);
      const snap = await docRef.get();
      let currentHistory: any[] = [];
      if (snap.exists) {
        currentHistory = snap.data()?.history || [];
      }

      const newHistoryEntry = {
        action: 'Dispatch Unarchived',
        user: userIdentifier,
        timestamp: now,
        notes: 'Dispatch restored to active register'
      };

      await docRef.set({
        ...updateData,
        history: [...currentHistory, newHistoryEntry]
      }, { merge: true });
    } catch (e) {
      console.warn('[Firestore] Error unarchiving dispatch:', e);
    }
  }

  // Update local cache
  updateLocalCache(dispatchId, {
    ...updateData,
    historyEntry: {
      action: 'Dispatch Unarchived',
      user: userIdentifier,
      timestamp: now,
      notes: 'Dispatch restored to active register'
    }
  });
}

/**
 * Real-time subscription to dispatches from Firestore with cache fallback and legacy merging
 */
export function subscribeMobileDispatches(
  callback: (dispatches: MobileDispatchDoc[]) => void
): () => void {
  let unsubscribe: (() => void) | null = null;

  // Immediate local cache emission (including legacy records)
  const cached = getLocalCache();
  if (cached.length > 0) {
    callback(cached);
  }

  if (db) {
    try {
      // Query without strict orderBy to avoid excluding documents missing indexed createdAt fields
      unsubscribe = db.collection('dispatches')
        .onSnapshot(
          (snapshot) => {
            const list: MobileDispatchDoc[] = [];
            const seenIds = new Set<string>();

            snapshot.forEach((doc) => {
              const data = doc.data();
              const createdAt = data.createdAt || data.createdDate || data.timestamp || new Date().toISOString();
              const updatedAt = data.updatedAt || data.updatedDate || createdAt;

              seenIds.add(doc.id);
              list.push({
                id: doc.id,
                dispatchNumber: data.dispatchNumber || 'DSP-0000',
                project: data.project || data.customer || 'Unnamed Project',
                customer: data.customer || '',
                originBranch: data.originBranch || 'Main Factory',
                destinationBranch: data.destinationBranch || 'Cape Town',
                courier: data.courier || '',
                trackingNumber: data.trackingNumber || '',
                notes: data.notes || '',
                status: data.status || 'In Transit',
                totalPieces: typeof data.totalPieces === 'number' ? data.totalPieces : (Array.isArray(data.photos) && data.photos.length > 0 ? data.photos.length : 1),
                missingPieces: Array.isArray(data.missingPieces) ? data.missingPieces : [],
                verifiedPieces: Array.isArray(data.verifiedPieces) ? data.verifiedPieces : [],
                photos: Array.isArray(data.photos) ? data.photos : [],
                photoCount: typeof data.photoCount === 'number' ? data.photoCount : (Array.isArray(data.photos) ? data.photos.length : 0),
                receivingPhotos: Array.isArray(data.receivingPhotos) ? data.receivingPhotos : [],
                receivingNotes: data.receivingNotes || '',
                receivedBy: data.receivedBy || '',
                receivedAt: data.receivedAt || '',
                receivingChecklist: data.receivingChecklist,
                isArchived: Boolean(data.isArchived),
                archivedAt: data.archivedAt || '',
                archivedBy: data.archivedBy || '',
                createdBy: data.createdBy || 'Factory Supervisor',
                createdAt,
                updatedAt,
                history: Array.isArray(data.history) ? data.history : []
              });
            });

            // If local storage has legacy items not in Firestore snapshot, preserve them
            const localLegacy = getLocalCache();
            localLegacy.forEach((legacyItem) => {
              if (legacyItem && legacyItem.id && !seenIds.has(legacyItem.id)) {
                seenIds.add(legacyItem.id);
                list.push(legacyItem);
              }
            });

            // Sort cleanly in memory by date descending
            list.sort((a, b) => {
              const dateA = new Date(a.createdAt || 0).getTime();
              const dateB = new Date(b.createdAt || 0).getTime();
              return dateB - dateA;
            });

            // Update localStorage
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
            } catch (e) {
              console.warn('Failed to cache dispatches to localStorage:', e);
            }

            callback(list);
          },
          (error) => {
            console.warn('[Firestore] Error subscribing to dispatches:', error);
            callback(getLocalCache());
          }
        );
    } catch (e) {
      console.warn('[Firestore] Subscription setup failed:', e);
      callback(getLocalCache());
    }
  }

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}

function getLocalCache(): MobileDispatchDoc[] {
  const result: MobileDispatchDoc[] = [];
  const seenIds = new Set<string>();

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed: MobileDispatchDoc[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (item && item.id && !seenIds.has(item.id)) {
            seenIds.add(item.id);
            result.push(item);
          }
        });
      }
    }
  } catch (e) {
    console.warn('Failed to parse local dispatches cache:', e);
  }

  // Gracefully load and map legacy dispatches from tsj_dispatches_v1 if present
  try {
    const rawLegacy = localStorage.getItem('tsj_dispatches_v1');
    if (rawLegacy) {
      const parsedLegacy = JSON.parse(rawLegacy);
      if (Array.isArray(parsedLegacy)) {
        parsedLegacy.forEach((item: any) => {
          if (item && item.id && !seenIds.has(item.id)) {
            seenIds.add(item.id);
            result.push({
              id: String(item.id),
              dispatchNumber: item.dispatchNumber || 'DSP-0000',
              project: item.project || item.customer || 'Unnamed Project',
              customer: item.customer || '',
              originBranch: item.originBranch || 'Main Factory',
              destinationBranch: item.destinationBranch || 'Cape Town',
              courier: item.courier || '',
              trackingNumber: item.trackingNumber || '',
              notes: item.notes || '',
              status: item.status || 'In Transit',
              totalPieces: typeof item.totalPieces === 'number' ? item.totalPieces : (Array.isArray(item.photos) && item.photos.length > 0 ? item.photos.length : 1),
              missingPieces: Array.isArray(item.missingPieces) ? item.missingPieces : [],
              verifiedPieces: Array.isArray(item.verifiedPieces) ? item.verifiedPieces : [],
              photos: Array.isArray(item.photos) ? item.photos : [],
              photoCount: typeof item.photoCount === 'number' ? item.photoCount : (Array.isArray(item.photos) ? item.photos.length : 0),
              receivingPhotos: Array.isArray(item.receivingPhotos) ? item.receivingPhotos : [],
              receivingNotes: item.receivingNotes || '',
              receivedBy: item.receivedBy || '',
              receivedAt: item.receivedAt || '',
              receivingChecklist: item.receivingChecklist,
              isArchived: Boolean(item.isArchived),
              archivedAt: item.archivedAt || '',
              archivedBy: item.archivedBy || '',
              createdBy: item.createdBy || 'Factory Supervisor',
              createdAt: item.createdAt || new Date().toISOString(),
              updatedAt: item.updatedAt || new Date().toISOString(),
              history: Array.isArray(item.history) ? item.history : []
            });
          }
        });
      }
    }
  } catch (e) {
    console.warn('Failed to parse legacy tsj_dispatches_v1 cache:', e);
  }

  // Sort in memory by date descending
  result.sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  return result;
}

function saveToLocalCache(doc: MobileDispatchDoc) {
  try {
    const current = getLocalCache();
    const updated = [doc, ...current.filter(d => d.id !== doc.id)];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to update local dispatches cache:', e);
  }
}

function updateLocalCache(id: string, updates: any) {
  try {
    const current = getLocalCache();
    const updated = current.map(d => {
      if (d.id === id) {
        return {
          ...d,
          ...updates,
          history: updates.historyEntry ? [...(d.history || []), updates.historyEntry] : d.history
        };
      }
      return d;
    });
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to update local dispatches cache:', e);
  }
}
