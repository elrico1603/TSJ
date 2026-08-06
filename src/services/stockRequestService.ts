import { db, APP_ID_PATH } from '../firebase';
import { StockRequest, StockRequestItem, StockRequestHistoryItem } from '../types';
import { notificationService } from './notificationService';
import { inventoryService } from './inventoryService';

const STOCK_REQUESTS_STORAGE_KEY = 'tsj_stock_requests_v1';

type StockRequestListener = (requests: StockRequest[]) => void;
const listeners = new Set<StockRequestListener>();

function notifyListeners(items: StockRequest[]) {
  listeners.forEach(cb => {
    try {
      cb(items);
    } catch (e) {
      console.error('Error notifying stock request listener:', e);
    }
  });
}

// Allowed status transitions:
// Pending -> Ordered or Cancelled
// Ordered -> Partially Received or Received or Cancelled
// Partially Received -> Partially Received or Received or Cancelled
// Received -> Completed or Cancelled
export function isValidStatusTransition(currentStatus: StockRequest['status'], nextStatus: StockRequest['status']): boolean {
  if (currentStatus === nextStatus) return true;
  if (currentStatus === 'Pending') return nextStatus === 'Ordered' || nextStatus === 'Cancelled';
  if (currentStatus === 'Ordered') return nextStatus === 'Partially Received' || nextStatus === 'Received' || nextStatus === 'Cancelled';
  if (currentStatus === 'Partially Received') return nextStatus === 'Partially Received' || nextStatus === 'Received' || nextStatus === 'Cancelled';
  if (currentStatus === 'Received') return nextStatus === 'Completed' || nextStatus === 'Cancelled';
  return false;
}

export const stockRequestService = {
  getLocalRequests(): StockRequest[] {
    try {
      const stored = localStorage.getItem(STOCK_REQUESTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse local stock requests:', e);
    }
    return [];
  },

  saveLocalRequests(items: StockRequest[]): void {
    try {
      localStorage.setItem(STOCK_REQUESTS_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save local stock requests:', e);
    }
  },

  async createStockRequest(params: {
    requestedByUid: string;
    requestedByName: string;
    requestedByRole: string;
    branchId: string;
    branchName: string;
    notes?: string;
    items: StockRequestItem[];
  }): Promise<StockRequest> {
    const existing = this.getLocalRequests();
    const count = existing.length + 1;
    const year = new Date().getFullYear();
    const requestNumber = `TSJ-${year}-${String(count).padStart(6, '0')}`;
    const id = `sr_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const totalProducts = params.items.length;
    const totalQuantity = params.items.reduce((sum, item) => sum + item.quantity, 0);
    const nowIso = new Date().toISOString();

    const initialHistoryItem: StockRequestHistoryItem = {
      id: `hist_${Date.now()}_0`,
      action: 'Submitted',
      userId: params.requestedByUid || 'sm_user',
      userName: params.requestedByName || 'Stock Manager',
      role: params.requestedByRole || 'Stock Manager',
      timestamp: nowIso,
      notes: params.notes || 'Stock Request created & submitted'
    };

    const newRequest: StockRequest = {
      id,
      requestNumber,
      requestedByUid: params.requestedByUid || 'sm_user',
      requestedByName: params.requestedByName || 'Stock Manager',
      requestedByRole: params.requestedByRole || 'Stock Manager',
      branchId: params.branchId || 'BR-01',
      branchName: params.branchName || 'TS Joinery Main Workshop',
      status: 'Pending',
      createdAt: nowIso,
      totalProducts,
      totalQuantity,
      notes: params.notes || '',
      items: params.items,
      history: [initialHistoryItem]
    };

    // 1. Save local
    const updated = [newRequest, ...existing];
    this.saveLocalRequests(updated);
    notifyListeners(updated);

    // 2. Save Firebase
    if (db && APP_ID_PATH) {
      try {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('data')
          .collection('stockRequests')
          .doc(id)
          .set(newRequest);

        await db.collection('stockRequests').doc(id).set(newRequest).catch(() => {});
      } catch (err) {
        console.error('Failed to save StockRequest to Firebase:', err);
      }
    }

    // 3. Trigger ONE notification for the whole request
    try {
      const itemSummaries = params.items.map(i => `Product: ${i.productName} (Code: ${i.productId})`).join(' | ');
      await notificationService.addNotification({
        category: 'stock_order',
        categoryLabel: 'Stock Request',
        title: `New Stock Request: ${requestNumber}`,
        description: `${totalProducts} Products (${totalQuantity} items): ${itemSummaries}. Submitted by ${newRequest.requestedByName}.`,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        priority: 'high',
        relatedPage: 'orders',
        targetEmails: ['janah@tsjoinery.co.za', 'elrico@tsjoinery.co.za'],
        targetRoles: ['Purchasing', 'Admin', 'HR']
      });
    } catch (e) {
      console.warn('Notification error on stock request:', e);
    }

    return newRequest;
  },

  async updateRequestStatus(
    id: string, 
    newStatus: StockRequest['status'], 
    userContext?: { userId?: string; userName?: string; role?: string },
    notes?: string
  ): Promise<void> {
    const current = this.getLocalRequests();
    const reqIndex = current.findIndex(r => r.id === id);
    if (reqIndex === -1) return;

    const currentReq = current[reqIndex];
    if (!isValidStatusTransition(currentReq.status, newStatus)) {
      throw new Error(`Invalid status transition from ${currentReq.status} to ${newStatus}`);
    }

    const nowIso = new Date().toISOString();

    const historyItem: StockRequestHistoryItem = {
      id: `hist_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      action: newStatus === 'Ordered' ? 'Ordered' : newStatus === 'Received' ? 'Received' : newStatus === 'Completed' ? 'Completed' : newStatus === 'Cancelled' ? 'Cancelled' : 'Submitted',
      userId: userContext?.userId || 'janah_p',
      userName: userContext?.userName || 'Janah',
      role: userContext?.role || 'Purchasing',
      timestamp: nowIso,
      notes: notes || `Request marked as ${newStatus}`
    };

    const updatedHistory = [...(currentReq.history || []), historyItem];

    const patch: Partial<StockRequest> = {
      status: newStatus,
      history: updatedHistory
    };

    if (newStatus === 'Ordered') patch.orderedAt = nowIso;
    if (newStatus === 'Received') patch.receivedAt = nowIso;
    if (newStatus === 'Completed') patch.completedAt = nowIso;
    if (newStatus === 'Cancelled') patch.cancelledAt = nowIso;

    const updatedReq = { ...currentReq, ...patch };
    const updatedList = [...current];
    updatedList[reqIndex] = updatedReq;

    this.saveLocalRequests(updatedList);
    notifyListeners(updatedList);

    // If marked Ordered, remove corresponding notification automatically
    if (newStatus === 'Ordered') {
      try {
        await notificationService.dismissStockRequestNotification(currentReq.requestNumber);
      } catch (e) {
        console.warn('Failed to dismiss stock request notification:', e);
      }
    }

    if (db && APP_ID_PATH) {
      try {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('data')
          .collection('stockRequests')
          .doc(id)
          .update(patch);

        await db.collection('stockRequests').doc(id).update(patch).catch(() => {});
      } catch (err) {
        console.error('Failed to update stock request status in Firebase:', err);
      }
    }
  },

  async receiveGoodsForRequest(params: {
    requestId: string;
    itemsReceived: {
      productId: string;
      receivedQtyNow: number;
      notes?: string;
    }[];
    userContext?: { userId?: string; userName?: string; role?: string };
    notes?: string;
  }): Promise<{
    updatedRequest: StockRequest;
    newStatus: StockRequest['status'];
    updatedProductsCount: number;
    totalUnitsReceived: number;
  }> {
    const current = this.getLocalRequests();
    const reqIndex = current.findIndex(r => r.id === params.requestId);
    if (reqIndex === -1) throw new Error('Stock request not found');

    const currentReq = current[reqIndex];
    if (currentReq.status !== 'Ordered' && currentReq.status !== 'Partially Received') {
      throw new Error(`Cannot receive goods for request with status: ${currentReq.status}`);
    }

    const nowIso = new Date().toISOString();

    // 1. Update items received quantities
    const itemsForInventoryService: {
      productId: string;
      productName: string;
      supplier: string;
      supplierPartNumber: string;
      location: string;
      imageUrl?: string;
      quantityReceived: number;
      notes?: string;
    }[] = [];

    const updatedItems: StockRequestItem[] = currentReq.items.map(item => {
      const match = params.itemsReceived.find(
        ir => ir.productId === item.productId || ir.productId === item.supplierPartNumber
      );
      const qtyNow = match ? Math.max(0, match.receivedQtyNow) : 0;
      const prevReceived = item.receivedQuantity || 0;
      const newAccumulated = prevReceived + qtyNow;

      if (qtyNow > 0) {
        itemsForInventoryService.push({
          productId: item.productId,
          productName: item.productName,
          supplier: item.supplier,
          supplierPartNumber: item.supplierPartNumber,
          location: item.location,
          imageUrl: item.imageUrl,
          quantityReceived: qtyNow,
          notes: match?.notes || item.notes
        });
      }

      return {
        ...item,
        receivedQuantity: newAccumulated,
        notes: match?.notes || item.notes
      };
    });

    // 2. Check if all items are fully received
    let isFullyReceived = true;
    for (const item of updatedItems) {
      if ((item.receivedQuantity || 0) < item.quantity) {
        isFullyReceived = false;
        break;
      }
    }

    const newStatus: StockRequest['status'] = isFullyReceived ? 'Received' : 'Partially Received';

    // 3. Process inventory updates & history
    const { updatedProductsCount, totalUnitsReceived } = await inventoryService.processGoodsReceipt({
      requestNumber: currentReq.requestNumber,
      itemsReceived: itemsForInventoryService,
      performedBy: params.userContext?.userName || 'Purchasing Manager'
    });

    // 4. Record history record
    const historyAction = newStatus === 'Received' ? 'Received' : 'Partially Received';
    const historyItem: StockRequestHistoryItem = {
      id: `hist_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      action: historyAction,
      userId: params.userContext?.userId || 'purchasing_user',
      userName: params.userContext?.userName || 'Purchasing',
      role: params.userContext?.role || 'Purchasing',
      timestamp: nowIso,
      notes: params.notes || `Goods Received: ${totalUnitsReceived} units across ${updatedProductsCount} items (${newStatus})`
    };

    const updatedHistory = [...(currentReq.history || []), historyItem];

    const patch: Partial<StockRequest> = {
      status: newStatus,
      items: updatedItems,
      history: updatedHistory
    };

    if (newStatus === 'Received') patch.receivedAt = nowIso;
    if (newStatus === 'Partially Received') patch.partiallyReceivedAt = nowIso;

    const updatedReq = { ...currentReq, ...patch };
    const updatedList = [...current];
    updatedList[reqIndex] = updatedReq;

    this.saveLocalRequests(updatedList);
    notifyListeners(updatedList);

    if (db && APP_ID_PATH) {
      try {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('data')
          .collection('stockRequests')
          .doc(params.requestId)
          .set(updatedReq, { merge: true });

        await db.collection('stockRequests').doc(params.requestId).set(updatedReq, { merge: true }).catch(() => {});
      } catch (err) {
        console.error('Failed to update stock request in Firebase on receive goods:', err);
      }
    }

    return {
      updatedRequest: updatedReq,
      newStatus,
      updatedProductsCount,
      totalUnitsReceived
    };
  },

  subscribeRequests(callback: (requests: StockRequest[]) => void) {
    listeners.add(callback);
    callback(this.getLocalRequests());

    let firebaseUnsub: (() => void) | null = null;

    if (db && APP_ID_PATH) {
      try {
        firebaseUnsub = db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('data')
          .collection('stockRequests')
          .onSnapshot(
            snap => {
              if (snap && !snap.empty) {
                const firebaseItems: StockRequest[] = [];
                snap.forEach(doc => {
                  firebaseItems.push({ id: doc.id, ...doc.data() } as StockRequest);
                });
                firebaseItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                this.saveLocalRequests(firebaseItems);
                notifyListeners(firebaseItems);
              }
            },
            err => {
              console.warn('Firebase stockRequests subscription error:', err);
            }
          );
      } catch (e) {
        console.warn('Unable to subscribe to Firebase stockRequests:', e);
      }
    }

    return () => {
      listeners.delete(callback);
      if (firebaseUnsub) {
        firebaseUnsub();
      }
    };
  },

  getStockRequests(): StockRequest[] {
    return this.getLocalRequests();
  },

  async deleteStockRequest(requestId: string): Promise<boolean> {
    const current = this.getLocalRequests();
    const filtered = current.filter(r => r.id !== requestId && r.requestNumber !== requestId);
    this.saveLocalRequests(filtered);
    notifyListeners(filtered);

    if (db && APP_ID_PATH) {
      try {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('data')
          .collection('stockRequests')
          .doc(requestId)
          .delete();

        await db.collection('stockRequests').doc(requestId).delete().catch(() => {});
      } catch (e) {
        console.warn('Failed to delete stock request in Firebase:', e);
      }
    }

    return true;
  }
};
