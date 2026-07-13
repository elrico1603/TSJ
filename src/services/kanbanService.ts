import { db, APP_ID_PATH } from './firebase';
import { getKanbanQRCodeImageUrl } from './qrService';

export type KanbanStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';

export interface KanbanLocation {
  letter: string;
  number: string;
  colour: string;
}

export interface KanbanCardMaster {
  id?: string;
  kanbanId: string; // Unique human-readable code like KAN-000001
  productDescription: string;
  imageUrl: string; // Stored in Firebase storage, Firestore has URL
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
 * Saves (creates or updates) a Kanban card.
 * Integrates perfectly with legacy fields as a wrapper.
 */
export async function saveKanbanCard(card: KanbanCardMaster): Promise<string> {
  const id = card.id;
  
  // Fill missing QR Code URL if empty
  const qrCodeUrl = card.qrCodeUrl || getKanbanQRCodeImageUrl(card.kanbanId);
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

  return {
    id,
    kanbanId: kanbanId,
    productDescription: cardData.productDescription || cardData.partDescription || 'No description',
    imageUrl: cardData.imageUrl || cardData.productImage || '',
    supplierPartNumber: cardData.supplierPartNumber || cardData.partNumber || '',
    supplierName: cardData.supplierName || cardData.supplier || '',
    orderQuantity: cardData.orderQuantity || '',
    binQuantity: cardData.binQuantity || '1 Bin',
    deliveryTime: cardData.deliveryTime || 'N/A',
    location,
    qrCodeUrl: cardData.qrCodeUrl || getKanbanQRCodeImageUrl(kanbanId),
    activeTemplateId: data.templateId || cardData.activeTemplate || '',
    createdDate: cardData.dateCreated || data.createdAt || new Date().toISOString(),
    createdBy: cardData.createdBy || 'unknown',
    lastModifiedDate: cardData.lastModified || new Date().toISOString(),
    lastModifiedBy: cardData.lastModifiedBy || 'unknown',
    status: (cardData.status as KanbanStatus) || 'ACTIVE'
  };
}
