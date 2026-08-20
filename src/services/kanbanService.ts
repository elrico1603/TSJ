import { db, APP_ID_PATH } from './firebase';

export type KanbanStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';

export interface KanbanLocation {
  letter: string;
  number: string;
  colour: string;
}

const KANBAN_MAX_SEQ_KEY = 'kanban_max_issued_sequence';

export function getStoredMaxSequence(): number {
  try {
    const val = localStorage.getItem(KANBAN_MAX_SEQ_KEY);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function updateStoredMaxSequence(num: number): void {
  try {
    const current = getStoredMaxSequence();
    if (num > current) {
      localStorage.setItem(KANBAN_MAX_SEQ_KEY, num.toString());
    }
  } catch {
    // Ignore local storage errors in restricted contexts
  }
}

/**
 * Generates the next sequential Kanban Number (e.g. KAN-000001).
 * Inspects all existing cards and the persisted highest sequence counter
 * to ensure deleted/archived numbers are NEVER reused.
 */
export function generateNextKanbanNumber(existingCards: any[] = []): string {
  let maxNum = getStoredMaxSequence();

  if (Array.isArray(existingCards)) {
    existingCards.forEach(c => {
      const kid = c.kanbanId || c.cardData?.kanbanId || c.cardData?.partNumber || c.partNumber;
      if (kid) {
        const match = kid.match(/(?:TSJ-)?KAN-(\d+)/i);
        if (match) {
          const numPart = parseInt(match[1], 10);
          if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
          }
        }
      }
    });
  }

  const nextNum = maxNum + 1;
  updateStoredMaxSequence(nextNum);

  return `KAN-${String(nextNum).padStart(6, '0')}`;
}

export interface KanbanCardMaster {
  id?: string;
  kanbanId: string; // Unique human-readable code like KAN-000001
  productDescription: string;
  productName?: string;
  imageUrl: string; // Stored in Firebase storage, Firestore has URL
  productImage?: string;
  supplierPartNumber: string;
  supplierName: string;
  orderQuantity: string;
  binQuantity: string;
  deliveryTime: string;
  location: KanbanLocation;
  qrCodeUrl: string; // Dynamically generated or cached
  activeTemplateId: string; // ID of the template layout applied to this card
  createdDate: string;
  createdBy: string;
  lastModifiedDate: string;
  lastModifiedBy: string;
  status: KanbanStatus;
  cardColour?: string;
  cardColor?: string;
  picture?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  qr?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Gets the Firestore collection reference for Kanban master records
 */
function getKanbanCollection() {
  return db
    .collection('artifacts')
    .doc(APP_ID_PATH)
    .collection('public')
    .doc('data')
    .collection('kanbanCards');
}

/**
 * Retrieves all Kanban cards from Firestore.
 */
export async function getKanbanCards(): Promise<KanbanCardMaster[]> {
  const snapshot = await getKanbanCollection().get();
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return mapToKanbanCardMaster(doc.id, data);
  });
}

/**
 * Gets a single Kanban card by ID (internal document ID or human-readable kanbanId)
 */
export async function getKanbanCard(id: string): Promise<KanbanCardMaster | null> {
  // First attempt: try direct document ID
  const doc = await getKanbanCollection().doc(id).get();
  if (doc.exists) {
    return mapToKanbanCardMaster(doc.id, doc.data());
  }

  // Second attempt: query by human-readable kanbanId
  const query = await getKanbanCollection().where('cardData.kanbanId', '==', id).get();
  if (!query.empty) {
    const match = query.docs[0];
    return mapToKanbanCardMaster(match.id, match.data());
  }

  const queryDirect = await getKanbanCollection().where('kanbanId', '==', id).get();
  if (!queryDirect.empty) {
    const match = queryDirect.docs[0];
    return mapToKanbanCardMaster(match.id, match.data());
  }

  return null;
}

/**
 * Generates the raw mailto link as requested.
 */
export function getKanbanMailtoLink(info: {
  internalProductNumber: string;
  productName: string;
  supplierPartNumber: string;
  supplier: string;
  orderQuantity: string;
  binQuantity: string;
  location: string;
  deliveryTime: string;
}): string {
  const email = 'janah@tsjoinery.co.za';
  const subject = 'KANBAN STOCK REQUEST';
  const body = `Hello Janah,

Please order the following stock.

-------------------------------------

Template ID:
${info.internalProductNumber || ''}

Product:
${info.productName || ''}

Supplier Number:
${info.supplierPartNumber || ''}

Supplier:
${info.supplier || ''}

Recommended Order:
${info.orderQuantity || ''}

Bin Quantity:
${info.binQuantity || ''}

Location:
${info.location || ''}

Delivery:
${info.deliveryTime || ''}

-------------------------------------

Requested By:

____________________

Comments:

____________________

Thank you.`;

  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Generates the QR Code content containing ONLY the unique, permanent Template ID.
 * 
 * ARCHITECTURAL DESIGN FOR FUTURE EXTENSIBILITY:
 * The physical QR code printed on the Kanban cards represents *only* the permanent human-readable
 * Template ID (e.g. "KAN-000001" or "K-101"). 
 * By encoding only this static primary key on the physical printout, the physical cards are
 * completely decoupled from the software workflows.
 * 
 * Today, scanning this ID triggers a digital Kanban checkout basket that generates email/mailto requests.
 * In the future, the same physical card scans can be integrated seamlessly with other enterprise engines:
 *  - Purchase Orders: Generating official PO drafts automatically in an ERP system.
 *  - Inventory Management: Tracking real-time stock levels, check-ins, and checkout audits.
 *  - Supplier Portals: Relaying replenishment signals directly to suppliers without email proxy.
 *  - Warehouse Picking: Displaying location routing checklists for warehouse picking staff.
 * 
 * All of this will be possible WITHOUT changing or re-printing any physical QR Codes.
 */
export function getKanbanPermanentTemplateIdQRCodeUrl(info: {
  internalProductNumber: string;
  [key: string]: any; // Allow other properties for backward compatibility
}): string {
  return info.internalProductNumber || '';
}

// Keep the legacy name as an alias so existing components don't break
export const getKanbanMailtoQRCodeUrl = getKanbanPermanentTemplateIdQRCodeUrl;

/**
 * Saves (creates or updates) a Kanban card.
 * Integrates perfectly with legacy fields as a wrapper.
 */
export async function saveKanbanCard(card: KanbanCardMaster): Promise<string> {
  const id = card.id;
  const locStr = `${card.location?.letter || ''}${card.location?.number || ''}`.trim();
  
  // Fill missing QR Code URL or regenerate based on mailto specs
  const qrCodeUrl = getKanbanMailtoQRCodeUrl({
    internalProductNumber: card.kanbanId || '',
    productName: card.productDescription || '',
    supplierPartNumber: card.supplierPartNumber || '',
    supplier: card.supplierName || '',
    orderQuantity: card.orderQuantity || '',
    binQuantity: card.binQuantity || '1 Bin',
    location: locStr,
    deliveryTime: card.deliveryTime || 'N/A'
  });

  const cardWithQR = { ...card, qrCodeUrl };

  // For compatibility with the legacy structure (which wraps fields in cardData and templateId directly)
  const legacyStructure = {
    id: id || '',
    templateId: card.activeTemplateId,
    createdAt: card.createdDate,
    cardData: {
      kanbanId: card.kanbanId,
      productDescription: card.productDescription,
      imageUrl: card.imageUrl,
      supplierPartNumber: card.supplierPartNumber,
      supplierName: card.supplierName,
      orderQuantity: card.orderQuantity,
      binQuantity: card.binQuantity,
      deliveryTime: card.deliveryTime,
      location: card.location,
      qrCodeUrl: qrCodeUrl,
      activeTemplate: card.activeTemplateId,
      dateCreated: card.createdDate,
      createdBy: card.createdBy,
      lastModified: card.lastModifiedDate,
      lastModifiedBy: card.lastModifiedBy,
      status: card.status,
      // Mirroring legacy fields so legacy components don't crash
      partDescription: card.productDescription,
      partNumber: card.kanbanId,
      productImage: card.imageUrl,
      supplier: card.supplierName,
      locationRaw: `${card.location.letter}${card.location.number} ${card.location.colour}`.trim()
    }
  };

  const collectionRef = getKanbanCollection();
  if (id) {
    await collectionRef.doc(id).set(legacyStructure, { merge: true });
    return id;
  } else {
    const docRef = await collectionRef.add(legacyStructure);
    // Update document ID back into record
    await collectionRef.doc(docRef.id).update({ id: docRef.id });
    return docRef.id;
  }
}

/**
 * Delete a Kanban master card
 */
export async function deleteKanbanCard(id: string): Promise<void> {
  await getKanbanCollection().doc(id).delete();
}

/**
 * Normalizes legacy Firestore data into clean KanbanCardMaster type
 */
export function mapToKanbanCardMaster(id: string, data: any): KanbanCardMaster {
  const cardData = data.cardData || {};
  
  // Extract location
  const location: KanbanLocation = {
    letter: cardData.location?.letter || '',
    number: cardData.location?.number || '',
    colour: cardData.location?.colour || ''
  };

  // If location has no components, try to parse from raw
  if (!location.letter && !location.number && cardData.locationRaw) {
    const match = cardData.locationRaw.match(/^([A-Za-z]+)?(\d+)?(.*)$/);
    if (match) {
      location.letter = match[1] || '';
      location.number = match[2] || '';
      location.colour = (match[3] || '').trim();
    }
  }

  const kanbanId = cardData.kanbanId || data.id || id;
  const locStr = `${location.letter || ''}${location.number || ''}`.trim();

  const qrCodeUrl = getKanbanMailtoQRCodeUrl({
    internalProductNumber: kanbanId,
    productName: cardData.productDescription || cardData.partDescription || 'No description',
    supplierPartNumber: cardData.supplierPartNumber || cardData.partNumber || '',
    supplier: cardData.supplierName || cardData.supplier || '',
    orderQuantity: cardData.orderQuantity || '',
    binQuantity: cardData.binQuantity || '1 Bin',
    location: locStr,
    deliveryTime: cardData.deliveryTime || 'N/A'
  });

  return {
    id,
    kanbanId: kanbanId,
    productDescription: cardData.productDescription || cardData.partDescription || 'No description',
    productName: cardData.productName || cardData.productDescription || cardData.partDescription || 'No description',
    imageUrl: cardData.imageUrl || cardData.productImage || '',
    supplierPartNumber: cardData.supplierPartNumber || cardData.partNumber || '',
    supplierName: cardData.supplierName || cardData.supplier || '',
    orderQuantity: cardData.orderQuantity || '',
    binQuantity: cardData.binQuantity || '1 Bin',
    deliveryTime: cardData.deliveryTime || 'N/A',
    location,
    qrCodeUrl: qrCodeUrl,
    activeTemplateId: data.templateId || cardData.activeTemplate || '',
    createdDate: cardData.dateCreated || data.createdAt || new Date().toISOString(),
    createdBy: cardData.createdBy || 'unknown',
    lastModifiedDate: cardData.lastModified || new Date().toISOString(),
    lastModifiedBy: cardData.lastModifiedBy || 'unknown',
    status: (cardData.status as KanbanStatus) || 'ACTIVE',
    cardColour: cardData.cardColour || '#ffffff'
  };
}

import { MasterInformation } from '../types';

/**
 * Maps a KanbanCardMaster and its template parameters to a MasterInformation object.
 * This guarantees Sections 1 to 4 reference the identical, single source of truth.
 */
export function mapCardToMasterInfo(
  card: KanbanCardMaster,
  templateName = '',
  templateType = ''
): MasterInformation {
  const locStr = `${card.location?.letter || ''}${card.location?.number || ''}`.trim();
  
  const qrCodeUrl = getKanbanMailtoQRCodeUrl({
    internalProductNumber: card.kanbanId || '',
    productName: card.productDescription || '',
    supplierPartNumber: card.supplierPartNumber || '',
    supplier: card.supplierName || '',
    orderQuantity: card.orderQuantity || '',
    binQuantity: card.binQuantity || '1 Bin',
    location: locStr,
    deliveryTime: card.deliveryTime || 'N/A'
  });

  return {
    productName: card.productName || card.productDescription || '',
    supplier: card.supplierName || '',
    supplierPartNumber: card.supplierPartNumber || '',
    orderQuantity: card.orderQuantity || '',
    deliveryTime: card.deliveryTime || '',
    location: locStr,
    locationColour: card.location?.colour || '',
    internalProductNumber: card.kanbanId || '',
    productImage: card.imageUrl || '',
    qrCode: qrCodeUrl,
    templateName: templateName,
    templateType: templateType,
    binQuantity: card.binQuantity || '',
    cardColour: card.cardColour || '#ffffff',
    status: card.status || 'ACTIVE'
  };
}

