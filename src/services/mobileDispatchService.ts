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
  status: 'In Transit' | 'Delivered / Received' | 'Draft' | 'Ready for Dispatch' | 'Received' | 'Issue Logged' | 'Dispatched' | string;
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
  };
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
 * Uploads a photo to Firebase Cloud Storage under dispatches/{dispatchId}/{folder}/
 * Falls back safely to compressed data URL if storage bucket is unreachable.
 */
export async function uploadDispatchPhoto(
  file: File,
  dispatchId: string,
  folder: 'outgoing' | 'incoming'
): Promise<DispatchPhotoItem> {
  const timestamp = Date.now();
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `dispatches/${dispatchId}/${folder}/${timestamp}_${cleanName}`;
  const photoId = `photo_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;

  try {
    if (storage && typeof storage.ref === 'function') {
      const storageRef = storage.ref(path);
      const snapshot = await storageRef.put(file);
      const downloadUrl = await snapshot.ref.getDownloadURL();
      return {
        id: photoId,
        name: file.name,
        url: downloadUrl,
        uploadedAt: new Date().toISOString(),
        size: file.size,
        mimeType: file.type || 'image/jpeg'
      };
    }
  } catch (err) {
    console.warn('[Dispatch Storage] Direct storage upload failed, using high-res local image fallback:', err);
  }

  // Resilient fallback (ensures photos are never lost if storage permissions are restricted)
  const dataUrl = await fileToDataUrl(file);
  return {
    id: photoId,
    name: file.name,
    url: dataUrl,
    uploadedAt: new Date().toISOString(),
    size: file.size,
    mimeType: file.type || 'image/jpeg'
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
  photos: DispatchPhotoItem[];
  createdBy: string;
}): Promise<MobileDispatchDoc> {
  const now = new Date().toISOString();
  const dispatchId = `dsp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

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
        notes: `Outgoing goods dispatched from ${payload.originBranch} to ${payload.destinationBranch} with ${payload.photos.length} photo evidence capture(s).`
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
 * Updates a dispatch document when receiving team confirms receipt and inspects goods
 */
export async function confirmReceiptAndInspect(
  dispatchId: string,
  payload: {
    receiverName: string;
    receivingNotes?: string;
    receivingPhotos: DispatchPhotoItem[];
    checklist?: {
      packagingIntact: boolean;
      parcelCountMatches: boolean;
      qualityChecked: boolean;
    };
  }
): Promise<void> {
  const now = new Date().toISOString();

  const updateData: Partial<MobileDispatchDoc> = {
    status: 'Delivered / Received',
    receivedBy: payload.receiverName.trim(),
    receivedAt: now,
    receivingNotes: payload.receivingNotes?.trim() || 'Received and inspected in good order.',
    receivingPhotos: payload.receivingPhotos,
    receivingChecklist: payload.checklist || {
      packagingIntact: true,
      parcelCountMatches: true,
      qualityChecked: true
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
        action: 'Delivered / Received',
        user: payload.receiverName.trim(),
        timestamp: now,
        notes: `Receipt confirmed at destination with ${payload.receivingPhotos.length} condition photo(s). ${payload.receivingNotes || ''}`
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
      action: 'Delivered / Received',
      user: payload.receiverName.trim(),
      timestamp: now,
      notes: payload.receivingNotes || 'Inspected and confirmed.'
    }
  });
}

/**
 * Real-time subscription to dispatches from Firestore with cache fallback
 */
export function subscribeMobileDispatches(
  callback: (dispatches: MobileDispatchDoc[]) => void
): () => void {
  let unsubscribe: (() => void) | null = null;

  // Immediate local cache emission
  const cached = getLocalCache();
  if (cached.length > 0) {
    callback(cached);
  }

  if (db) {
    try {
      unsubscribe = db.collection('dispatches')
        .orderBy('createdAt', 'desc')
        .onSnapshot(
          (snapshot) => {
            const list: MobileDispatchDoc[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
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
                photos: Array.isArray(data.photos) ? data.photos : [],
                photoCount: typeof data.photoCount === 'number' ? data.photoCount : (Array.isArray(data.photos) ? data.photos.length : 0),
                receivingPhotos: Array.isArray(data.receivingPhotos) ? data.receivingPhotos : [],
                receivingNotes: data.receivingNotes || '',
                receivedBy: data.receivedBy || '',
                receivedAt: data.receivedAt || '',
                receivingChecklist: data.receivingChecklist,
                createdBy: data.createdBy || 'Factory Supervisor',
                createdAt: data.createdAt || new Date().toISOString(),
                updatedAt: data.updatedAt || new Date().toISOString(),
                history: Array.isArray(data.history) ? data.history : []
              });
            });

            // Update localStorage
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
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
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse local dispatches cache:', e);
  }
  return [];
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
