import { db, APP_ID_PATH } from './firebase';

export interface TextCustomizationSettings {
  fontSize?: number; // in px
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  letterSpacing?: string;
  lineHeight?: string;
  color?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textTransform?: 'normal' | 'uppercase' | 'lowercase' | 'capitalize';
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  strokeEnabled?: boolean;
  strokeWidth?: number;
  strokeColor?: string;
  marginTop?: number; // in px
  marginBottom?: number; // in px
  padding?: number; // in px
  rotation?: number; // degrees
  horizontalPosition?: number; // px offset
  verticalPosition?: number; // px offset
}

export interface KanbanSectionConfig {
  id: string; // e.g. 'master_info' | 'kanban_pulled' | 'warehouse_id' | 'warehouse_display'
  name: string; // display name
  width: number; // mm
  height: number; // mm
  x: number; // mm
  y: number; // mm
  visible: boolean;
  borderWidth: number; // mm
  borderColor: string;
  borderStyle: 'solid' | 'dashed' | 'none';
  backgroundColor: string;
  cornerRadius: number; // mm
  padding: number; // mm
  rotation: number; // degrees
  zIndex: number;
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
  textSettings?: Record<string, TextCustomizationSettings>;
}

export interface KanbanTemplateV2 {
  id?: string;
  kanbanId?: string;
  templateName: string;
  paperSize: 'A4' | 'A5' | 'A6' | 'Custom';
  orientation: 'Portrait' | 'Landscape';
  margins: number; // in mm
  sections: KanbanSectionConfig[];
  productName?: string;
  category?: string;
  description?: string;
  supplier?: string;
  supplierPartNumber?: string;
  orderQuantity?: string;
  deliveryTime?: string;
  location?: string;
  locationColour?: string;
  binQuantity?: string;
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
  meta: {
    createdBy: string;
    createdDate: string;
    lastModifiedBy: string;
    lastModifiedDate: string;
  };
}

/**
 * Gets the standard Firestore collection path for Kanban templates under sandbox namespace.
 */
function getTemplatesCollection() {
  return db
    .collection('artifacts')
    .doc(APP_ID_PATH)
    .collection('public')
    .doc('data')
    .collection('kanbanTemplates');
}

/**
 * Fetch all templates from Firestore.
 * Supports legacy format conversion gracefully.
 */
export async function getTemplates(): Promise<KanbanTemplateV2[]> {
  const snapshot = await getTemplatesCollection().orderBy('templateName').get();
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return mapToTemplateV2(doc.id, data);
  });
}

/**
 * Save or create a Kanban Template.
 */
export async function saveTemplate(template: KanbanTemplateV2): Promise<string> {
  const data = { ...template };
  const id = data.id;
  delete data.id;

  const collectionRef = getTemplatesCollection();
  if (id) {
    await collectionRef.doc(id).set(data, { merge: true });
    return id;
  } else {
    const docRef = await collectionRef.add(data);
    return docRef.id;
  }
}

/**
 * Delete a Kanban Template by ID.
 */
export async function deleteTemplate(id: string): Promise<void> {
  await getTemplatesCollection().doc(id).delete();
}

/**
 * Helper to safely map legacy templates or incomplete templates to V2 format
 */
export function mapToTemplateV2(id: string, data: any): KanbanTemplateV2 {
  const kanbanId = data.kanbanId || data.internalProductNumber || '';

  // Check if it has the newer sections array format
  if (data.sections && Array.isArray(data.sections)) {
    return {
      id,
      kanbanId,
      templateName: data.templateName || 'Unnamed Template',
      paperSize: data.paperSize || 'A4',
      orientation: data.orientation || 'Portrait',
      margins: 0,
      sections: data.sections.map((sec: any) => ({
        ...sec,
        picture: sec.picture || { x: 15, y: 15, width: 110, height: 110 },
        qr: sec.qr || { x: 210, y: 15, width: 110, height: 110 }
      })),
      productName: data.productName || '',
      category: data.category || '',
      description: data.description || '',
      supplier: data.supplier || '',
      supplierPartNumber: data.supplierPartNumber || '',
      orderQuantity: data.orderQuantity || '',
      deliveryTime: data.deliveryTime || '',
      location: data.location || '',
      locationColour: data.locationColour || '',
      binQuantity: data.binQuantity || '',
      picture: data.picture || { x: 15, y: 15, width: 110, height: 110 },
      qr: data.qr || { x: 210, y: 15, width: 110, height: 110 },
      meta: {
        createdBy: data.meta?.createdBy || 'system',
        createdDate: data.meta?.createdDate || new Date().toISOString(),
        lastModifiedBy: data.meta?.lastModifiedBy || 'system',
        lastModifiedDate: data.meta?.lastModifiedDate || new Date().toISOString()
      }
    };
  }

  // Legacy fallback mapping from legacy layout format (if applicable)
  const defaultSections: KanbanSectionConfig[] = [
    {
      id: 'master_info',
      name: 'Master Information',
      width: 190,
      height: 70,
      x: 10,
      y: 15,
      visible: true,
      borderWidth: 1,
      borderColor: '#000000',
      borderStyle: 'solid',
      backgroundColor: '#ffffff',
      cornerRadius: 4,
      padding: 5,
      rotation: 0,
      zIndex: 1,
      picture: { x: 15, y: 15, width: 110, height: 110 },
      qr: { x: 210, y: 15, width: 110, height: 110 }
    },
    {
      id: 'kanban_pulled',
      name: 'Kanban Pulled Indicator',
      width: 190,
      height: 30,
      x: 10,
      y: 90,
      visible: true,
      borderWidth: 1,
      borderColor: '#000000',
      borderStyle: 'solid',
      backgroundColor: '#ffffff',
      cornerRadius: 4,
      padding: 5,
      rotation: 0,
      zIndex: 2,
      picture: { x: 15, y: 15, width: 110, height: 110 },
      qr: { x: 210, y: 15, width: 110, height: 110 }
    },
    {
      id: 'warehouse_id',
      name: 'Warehouse Identification',
      width: 190,
      height: 50,
      x: 10,
      y: 125,
      visible: true,
      borderWidth: 1,
      borderColor: '#000000',
      borderStyle: 'solid',
      backgroundColor: '#f3f4f6',
      cornerRadius: 4,
      padding: 5,
      rotation: 0,
      zIndex: 3,
      picture: { x: 15, y: 15, width: 110, height: 110 },
      qr: { x: 210, y: 15, width: 110, height: 110 }
    },
    {
      id: 'warehouse_display',
      name: 'Warehouse Display Shelf',
      width: 190,
      height: 50,
      x: 10,
      y: 180,
      visible: true,
      borderWidth: 1,
      borderColor: '#000000',
      borderStyle: 'solid',
      backgroundColor: '#ffffff',
      cornerRadius: 4,
      padding: 5,
      rotation: 0,
      zIndex: 4,
      picture: { x: 15, y: 15, width: 110, height: 110 },
      qr: { x: 210, y: 15, width: 110, height: 110 }
    }
  ];

  return {
    id,
    kanbanId,
    templateName: data.templateName || 'Legacy Template fallback',
    paperSize: 'A4',
    orientation: 'Portrait',
    margins: 0,
    sections: defaultSections,
    productName: data.productName || '',
    category: data.category || '',
    description: data.description || '',
    supplier: data.supplier || '',
    supplierPartNumber: data.supplierPartNumber || '',
    orderQuantity: data.orderQuantity || '',
    deliveryTime: data.deliveryTime || '',
    location: data.location || '',
    locationColour: data.locationColour || '',
    binQuantity: data.binQuantity || '',
    picture: { x: 15, y: 15, width: 110, height: 110 },
    qr: { x: 210, y: 15, width: 110, height: 110 },
    meta: {
      createdBy: data.meta?.createdBy || 'system',
      createdDate: data.meta?.createdDate || new Date().toISOString(),
      lastModifiedBy: data.meta?.createdBy || 'system',
      lastModifiedDate: data.meta?.createdDate || new Date().toISOString()
    }
  };
}

/**
 * Creates a default, beautiful template blueprint configuration
 */
export function createDefaultTemplateBlueprint(name: string, type: 'standard' | 'single_card' | 'warehouse_only' | 'custom' = 'standard'): KanbanTemplateV2 {
  const sections: KanbanSectionConfig[] = [];

  if (type === 'standard' || type === 'custom') {
    sections.push(
      {
        id: 'master_info',
        name: 'Master Information',
        width: 180,
        height: 75,
        x: 15,
        y: 20,
        visible: true,
        borderWidth: 0.5,
        borderColor: '#000000',
        borderStyle: 'solid',
        backgroundColor: '#ffffff',
        cornerRadius: 2,
        padding: 4,
        rotation: 0,
        zIndex: 1,
        picture: { x: 15, y: 15, width: 110, height: 110 },
        qr: { x: 210, y: 15, width: 110, height: 110 }
      },
      {
        id: 'kanban_pulled',
        name: 'Kanban Pulled',
        width: 180,
        height: 35,
        x: 15,
        y: 100,
        visible: true,
        borderWidth: 0.5,
        borderColor: '#000000',
        borderStyle: 'solid',
        backgroundColor: '#ffffff',
        cornerRadius: 2,
        padding: 3,
        rotation: 0,
        zIndex: 2,
        picture: { x: 15, y: 15, width: 110, height: 110 },
        qr: { x: 210, y: 15, width: 110, height: 110 }
      },
      {
        id: 'warehouse_id',
        name: 'Warehouse Identification',
        width: 180,
        height: 55,
        x: 15,
        y: 140,
        visible: true,
        borderWidth: 0.5,
        borderColor: '#000000',
        borderStyle: 'solid',
        backgroundColor: '#f8fafc',
        cornerRadius: 2,
        padding: 4,
        rotation: 0,
        zIndex: 3,
        picture: { x: 15, y: 15, width: 110, height: 110 },
        qr: { x: 210, y: 15, width: 110, height: 110 }
      },
      {
        id: 'warehouse_display',
        name: 'Warehouse Display',
        width: 180,
        height: 55,
        x: 15,
        y: 200,
        visible: true,
        borderWidth: 0.5,
        borderColor: '#000000',
        borderStyle: 'solid',
        backgroundColor: '#ffffff',
        cornerRadius: 2,
        padding: 4,
        rotation: 0,
        zIndex: 4,
        picture: { x: 15, y: 15, width: 110, height: 110 },
        qr: { x: 210, y: 15, width: 110, height: 110 }
      }
    );
  } else if (type === 'single_card') {
    sections.push({
      id: 'master_info',
      name: 'Master Information',
      width: 180,
      height: 120,
      x: 15,
      y: 25,
      visible: true,
      borderWidth: 1,
      borderColor: '#000000',
      borderStyle: 'solid',
      backgroundColor: '#ffffff',
      cornerRadius: 4,
      padding: 6,
      rotation: 0,
      zIndex: 1,
      picture: { x: 15, y: 15, width: 110, height: 110 },
      qr: { x: 210, y: 15, width: 110, height: 110 }
    });
  } else if (type === 'warehouse_only') {
    sections.push(
      {
        id: 'warehouse_id',
        name: 'Warehouse Identification',
        width: 180,
        height: 90,
        x: 15,
        y: 25,
        visible: true,
        borderWidth: 1,
        borderColor: '#1e293b',
        borderStyle: 'solid',
        backgroundColor: '#f8fafc',
        cornerRadius: 4,
        padding: 6,
        rotation: 0,
        zIndex: 1,
        picture: { x: 15, y: 15, width: 110, height: 110 },
        qr: { x: 210, y: 15, width: 110, height: 110 }
      },
      {
        id: 'warehouse_display',
        name: 'Warehouse Display',
        width: 180,
        height: 90,
        x: 15,
        y: 125,
        visible: true,
        borderWidth: 1,
        borderColor: '#1e293b',
        borderStyle: 'solid',
        backgroundColor: '#ffffff',
        cornerRadius: 4,
        padding: 6,
        rotation: 0,
        zIndex: 2,
        picture: { x: 15, y: 15, width: 110, height: 110 },
        qr: { x: 210, y: 15, width: 110, height: 110 }
      }
    );
  }

  return {
    templateName: name,
    paperSize: 'A4',
    orientation: 'Portrait',
    margins: 0,
    sections,
    picture: { x: 15, y: 15, width: 110, height: 110 },
    qr: { x: 210, y: 15, width: 110, height: 110 },
    meta: {
      createdBy: 'system',
      createdDate: new Date().toISOString(),
      lastModifiedBy: 'system',
      lastModifiedDate: new Date().toISOString()
    }
  };
}
