import firebase from 'firebase/compat/app';
import { db, APP_ID_PATH } from '../firebase';
import { InventoryItem, InventoryHistoryItem } from '../types';
import { notificationService } from './notificationService';

const INVENTORY_STORAGE_KEY = 'tsj_inventory_v1';
const INVENTORY_HISTORY_STORAGE_KEY = 'tsj_inventory_history_v1';

type InventoryListener = (items: InventoryItem[]) => void;
type HistoryListener = (items: InventoryHistoryItem[]) => void;

const inventoryListeners = new Set<InventoryListener>();
const historyListeners = new Set<HistoryListener>();

function notifyInventoryListeners(items: InventoryItem[]) {
  inventoryListeners.forEach(cb => {
    try { cb(items); } catch (e) { console.error('Inventory listener error:', e); }
  });
}

function notifyHistoryListeners(items: InventoryHistoryItem[]) {
  historyListeners.forEach(cb => {
    try { cb(items); } catch (e) { console.error('History listener error:', e); }
  });
}

// Pre-seeded sample inventory items for initial demonstration if storage is empty
const INITIAL_SAMPLE_INVENTORY: InventoryItem[] = [
  {
    id: 'K-101',
    productId: 'K-101',
    productName: 'Oak Board 20mm (1220x2440)',
    supplier: 'Sondor Wood',
    supplierPartNumber: 'OAK-20-A',
    location: 'A12 (Red)',
    imageUrl: '',
    currentQuantity: 28,
    minimumQuantity: 15,
    maximumQuantity: 100,
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: 'System'
  },
  {
    id: 'K-102',
    productId: 'K-102',
    productName: 'Wood Screws 4x30 Box 1000',
    supplier: 'Fasteners SA',
    supplierPartNumber: 'SCR-430-B',
    location: 'B04 (Yellow)',
    imageUrl: '',
    currentQuantity: 8,
    minimumQuantity: 12,
    maximumQuantity: 50,
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: 'System'
  },
  {
    id: 'K-103',
    productId: 'K-103',
    productName: 'Drawer Runner Soft-Close 500mm',
    supplier: 'Blum Hardware',
    supplierPartNumber: 'BLUM-500-SC',
    location: 'C08 (Green)',
    imageUrl: '',
    currentQuantity: 18,
    minimumQuantity: 25,
    maximumQuantity: 120,
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: 'System'
  }
];

export const inventoryService = {
  getLocalInventory(): InventoryItem[] {
    try {
      const stored = localStorage.getItem(INVENTORY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse local inventory:', e);
    }
    // Default fallback
    this.saveLocalInventory(INITIAL_SAMPLE_INVENTORY);
    return INITIAL_SAMPLE_INVENTORY;
  },

  saveLocalInventory(items: InventoryItem[]): void {
    try {
      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save local inventory:', e);
    }
  },

  getLocalInventoryHistory(): InventoryHistoryItem[] {
    try {
      const stored = localStorage.getItem(INVENTORY_HISTORY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse local inventory history:', e);
    }
    return [];
  },

  saveLocalInventoryHistory(items: InventoryHistoryItem[]): void {
    try {
      localStorage.setItem(INVENTORY_HISTORY_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save local inventory history:', e);
    }
  },

  /**
   * Process Goods Receipt & Automatically Update Inventory & Record Movement History
   */
  async processGoodsReceipt(params: {
    requestNumber: string;
    itemsReceived: {
      productId: string;
      productName: string;
      supplier: string;
      supplierPartNumber: string;
      location: string;
      imageUrl?: string;
      quantityReceived: number;
      notes?: string;
    }[];
    performedBy: string;
  }): Promise<{ updatedProductsCount: number; totalUnitsReceived: number }> {
    const currentInventory = this.getLocalInventory();
    const currentHistory = this.getLocalInventoryHistory();

    const updatedInventoryList = [...currentInventory];
    const newHistoryItems: InventoryHistoryItem[] = [];

    let totalUnitsReceived = 0;
    let updatedProductsCount = 0;

    const isCloudLive = Boolean(db && APP_ID_PATH);
    const timestampValue = isCloudLive 
      ? firebase.firestore.FieldValue.serverTimestamp() 
      : new Date().toISOString();
    const isoNow = new Date().toISOString();

    for (const item of params.itemsReceived) {
      if (item.quantityReceived <= 0) continue;

      totalUnitsReceived += item.quantityReceived;
      updatedProductsCount += 1;

      // Locate item in inventory by productId or supplierPartNumber
      const invIndex = updatedInventoryList.findIndex(
        inv => inv.productId === item.productId || inv.supplierPartNumber === item.supplierPartNumber
      );

      let beforeQty = 0;
      let afterQty = 0;
      let targetProduct: InventoryItem;

      if (invIndex !== -1) {
        beforeQty = updatedInventoryList[invIndex].currentQuantity;
        afterQty = beforeQty + item.quantityReceived;
        
        targetProduct = {
          ...updatedInventoryList[invIndex],
          currentQuantity: afterQty,
          lastUpdated: isoNow,
          lastUpdatedBy: params.performedBy
        };
        updatedInventoryList[invIndex] = targetProduct;
      } else {
        beforeQty = 0;
        afterQty = item.quantityReceived;

        targetProduct = {
          id: item.productId || `prod_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          productId: item.productId || item.supplierPartNumber || 'PART-UNKNOWN',
          productName: item.productName,
          supplier: item.supplier,
          supplierPartNumber: item.supplierPartNumber,
          location: item.location || 'Warehouse Storage',
          imageUrl: item.imageUrl || '',
          currentQuantity: afterQty,
          minimumQuantity: 10,
          maximumQuantity: 100,
          lastUpdated: isoNow,
          lastUpdatedBy: params.performedBy
        };
        updatedInventoryList.push(targetProduct);
      }

      // Create history record
      const historyItem: InventoryHistoryItem = {
        id: `invhist_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        movementId: `MOV-${Date.now()}-${Math.floor(Math.random() * 100)}`,
        productId: targetProduct.productId,
        productName: targetProduct.productName,
        requestNumber: params.requestNumber,
        movementType: 'Received',
        quantity: item.quantityReceived,
        beforeQuantity: beforeQty,
        afterQuantity: afterQty,
        timestamp: isoNow,
        performedBy: params.performedBy,
        notes: item.notes || `Received for Request ${params.requestNumber}`
      };
      newHistoryItems.push(historyItem);

      // Check Low Stock Alert requirement
      if (afterQty <= targetProduct.minimumQuantity) {
        await this.checkAndTriggerLowStockAlert(targetProduct, afterQty);
      }

      // Save to Firebase if live
      if (isCloudLive) {
        try {
          // 1. Update inventory document
          const docRef = db
            .collection('artifacts')
            .doc(APP_ID_PATH)
            .collection('public')
            .doc('data')
            .collection('inventory')
            .doc(targetProduct.id);

          await docRef.set({
            ...targetProduct,
            lastUpdated: timestampValue
          }, { merge: true });

          // 2. Add history record
          await db
            .collection('artifacts')
            .doc(APP_ID_PATH)
            .collection('public')
            .doc('data')
            .collection('inventory_history')
            .doc(historyItem.id)
            .set({
              ...historyItem,
              timestamp: timestampValue
            });
        } catch (err) {
          console.error('Failed to sync inventory update to Firebase:', err);
        }
      }
    }

    // Save local state
    this.saveLocalInventory(updatedInventoryList);
    notifyInventoryListeners(updatedInventoryList);

    const updatedHistoryList = [...newHistoryItems, ...currentHistory];
    this.saveLocalInventoryHistory(updatedHistoryList);
    notifyHistoryListeners(updatedHistoryList);

    return { updatedProductsCount, totalUnitsReceived };
  },

  /**
   * Check & trigger single low stock alert (prevents duplicate active alerts for same product)
   */
  async checkAndTriggerLowStockAlert(product: InventoryItem, currentQty: number): Promise<void> {
    try {
      const activeNotifs = notificationService.getLocalNotifications();
      const duplicateExists = activeNotifs.some(
        n => (n.category === 'stock_order' || n.category === 'inventory') &&
             n.title.includes('Low Stock') &&
             (n.title.includes(product.productName) || (n.description && n.description.includes(product.productId)))
      );

      if (!duplicateExists) {
        await notificationService.addNotification({
          category: 'stock_order',
          categoryLabel: 'Inventory Alert',
          title: `Low Stock: ${product.productName}`,
          description: `Current: ${currentQty} | Minimum: ${product.minimumQuantity}. Bin Location: ${product.location}. Supplier: ${product.supplier}`,
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          priority: 'high',
          relatedPage: 'orders',
          targetEmails: ['janah@tsjoinery.co.za', 'elrico@tsjoinery.co.za'],
          targetRoles: ['Purchasing', 'Admin', 'HR', 'Supervisor']
        });
      }
    } catch (err) {
      console.warn('Low stock notification creation failed:', err);
    }
  },

  /**
   * Manual Stock Adjustment
   */
  async adjustStock(params: {
    productId: string;
    newQuantity: number;
    performedBy: string;
    notes: string;
  }): Promise<void> {
    const currentInventory = this.getLocalInventory();
    const invIndex = currentInventory.findIndex(i => i.productId === params.productId || i.id === params.productId);
    if (invIndex === -1) throw new Error('Product not found in inventory');

    const item = currentInventory[invIndex];
    const beforeQty = item.currentQuantity;
    const qtyDiff = params.newQuantity - beforeQty;
    const isoNow = new Date().toISOString();

    const updatedItem: InventoryItem = {
      ...item,
      currentQuantity: params.newQuantity,
      lastUpdated: isoNow,
      lastUpdatedBy: params.performedBy
    };

    currentInventory[invIndex] = updatedItem;
    this.saveLocalInventory(currentInventory);
    notifyInventoryListeners(currentInventory);

    const historyItem: InventoryHistoryItem = {
      id: `invhist_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      movementId: `MOV-ADJ-${Date.now()}`,
      productId: item.productId,
      productName: item.productName,
      movementType: 'Adjusted',
      quantity: qtyDiff,
      beforeQuantity: beforeQty,
      afterQuantity: params.newQuantity,
      timestamp: isoNow,
      performedBy: params.performedBy,
      notes: params.notes || 'Manual inventory adjustment'
    };

    const currentHistory = [historyItem, ...this.getLocalInventoryHistory()];
    this.saveLocalInventoryHistory(currentHistory);
    notifyHistoryListeners(currentHistory);

    if (updatedItem.currentQuantity <= updatedItem.minimumQuantity) {
      await this.checkAndTriggerLowStockAlert(updatedItem, updatedItem.currentQuantity);
    }

    if (db && APP_ID_PATH) {
      try {
        const isCloudLive = true;
        const ts = firebase.firestore.FieldValue.serverTimestamp();

        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('data')
          .collection('inventory')
          .doc(item.id)
          .set({ ...updatedItem, lastUpdated: ts }, { merge: true });

        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('data')
          .collection('inventory_history')
          .doc(historyItem.id)
          .set({ ...historyItem, timestamp: ts });
      } catch (err) {
        console.error('Firebase adjust stock failed:', err);
      }
    }
  },

  /**
   * Subscriptions
   */
  subscribeInventory(callback: (items: InventoryItem[]) => void) {
    inventoryListeners.add(callback);
    callback(this.getLocalInventory());

    let unsub: (() => void) | null = null;
    if (db && APP_ID_PATH) {
      try {
        unsub = db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('data')
          .collection('inventory')
          .onSnapshot(
            snap => {
              if (snap && !snap.empty) {
                const list: InventoryItem[] = [];
                snap.forEach(doc => {
                  list.push({ id: doc.id, ...doc.data() } as InventoryItem);
                });
                this.saveLocalInventory(list);
                notifyInventoryListeners(list);
              }
            },
            err => console.warn('Firebase inventory subscribe error:', err)
          );
      } catch (e) {
        console.warn('Unable to subscribe to Firebase inventory:', e);
      }
    }

    return () => {
      inventoryListeners.delete(callback);
      if (unsub) unsub();
    };
  },

  subscribeInventoryHistory(callback: (items: InventoryHistoryItem[]) => void) {
    historyListeners.add(callback);
    callback(this.getLocalInventoryHistory());

    let unsub: (() => void) | null = null;
    if (db && APP_ID_PATH) {
      try {
        unsub = db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('data')
          .collection('inventory_history')
          .onSnapshot(
            snap => {
              if (snap && !snap.empty) {
                const list: InventoryHistoryItem[] = [];
                snap.forEach(doc => {
                  list.push({ id: doc.id, ...doc.data() } as InventoryHistoryItem);
                });
                list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                this.saveLocalInventoryHistory(list);
                notifyHistoryListeners(list);
              }
            },
            err => console.warn('Firebase inventory_history subscribe error:', err)
          );
      } catch (e) {
        console.warn('Unable to subscribe to Firebase inventory_history:', e);
      }
    }

    return () => {
      historyListeners.delete(callback);
      if (unsub) unsub();
    };
  }
};
