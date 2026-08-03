import firebase from 'firebase/compat/app';
import { db, APP_ID_PATH } from '../firebase';
import {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  StockRequest,
  StockRequestItem
} from '../types';
import { productMasterService } from './productMasterService';

const STORAGE_PO_KEY = 'tsj_purchase_orders_v1';

// Initial Sample Purchase Orders
const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'PO-2026-000001',
    poNumber: 'PO-2026-000001',
    companyId: 'TS-JOINERY-CPT',
    branchId: 'MAIN-BRANCH',
    linkedRequestId: 'SR-001',
    linkedRequestNumber: 'SR-001',
    supplierId: 'SUP-001',
    supplierName: 'Sondor Wood & Boards',
    supplierCode: 'SONDOR',
    supplierContactPerson: 'David Miller',
    supplierTelephone: '+27 21 555 0192',
    supplierEmail: 'orders@sondorwood.co.za',
    supplierAddress: '12 Timber Way, Paarden Eiland, Cape Town',
    deliveryAddress: 'TS Joinery Factory, 14 Factory Rd, Montague Gardens, Cape Town',
    deliveryInstructions: 'Deliver to Warehouse Gate B. Attn: Receiving Bay.',
    expectedDeliveryDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0],
    items: [
      {
        id: 'poi-1',
        productId: 'PRD-0001',
        productName: 'Oak Board 20mm (1220x2440)',
        internalProductCode: 'PRD-0001',
        supplierPartNumber: 'OAK-20-A',
        unit: 'ea',
        orderQuantity: 20,
        receivedQuantity: 0,
        unitPrice: 450,
        totalPrice: 9000,
        location: 'A-04-B-12',
        category: 'Board'
      },
      {
        id: 'poi-2',
        productId: 'PRD-0003',
        productName: 'MDF 16mm Standard Sheet',
        internalProductCode: 'PRD-0003',
        supplierPartNumber: 'MDF-16-S',
        unit: 'ea',
        orderQuantity: 15,
        receivedQuantity: 0,
        unitPrice: 280,
        totalPrice: 4200,
        location: 'A-02-A-01',
        category: 'Board'
      }
    ],
    totalProducts: 2,
    totalQuantity: 35,
    estimatedTotalValue: 13200,
    status: 'Approved',
    approvedBy: 'Janah (Procurement Manager)',
    approvedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    createdUser: 'Janah',
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    updatedUser: 'Janah',
    updatedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    auditTrail: [
      {
        id: 'aud-1',
        action: 'Created',
        user: 'Janah',
        timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        notes: 'Generated from Stock Request SR-001'
      },
      {
        id: 'aud-2',
        action: 'Approved',
        user: 'Janah (Procurement Manager)',
        timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        notes: 'PO Approved and issued to Sondor Wood & Boards'
      }
    ]
  },
  {
    id: 'PO-2026-000002',
    poNumber: 'PO-2026-000002',
    companyId: 'TS-JOINERY-CPT',
    branchId: 'MAIN-BRANCH',
    linkedRequestId: 'SR-002',
    linkedRequestNumber: 'SR-002',
    supplierId: 'SUP-002',
    supplierName: 'Fasteners SA',
    supplierCode: 'FASTENERS',
    supplierContactPerson: 'Sarah Jenkins',
    supplierTelephone: '+27 21 555 8821',
    supplierEmail: 'sales@fastenerssa.co.za',
    supplierAddress: '45 Industrial Crescent, Epping, Cape Town',
    deliveryAddress: 'TS Joinery Factory, 14 Factory Rd, Montague Gardens, Cape Town',
    deliveryInstructions: 'Small box delivery - leave at reception or bin A-01.',
    expectedDeliveryDate: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().split('T')[0],
    items: [
      {
        id: 'poi-3',
        productId: 'PRD-0002',
        productName: 'Blum Soft-Close Hinge 110deg',
        internalProductCode: 'PRD-0002',
        supplierPartNumber: 'BLUM-HC-110',
        unit: 'box',
        orderQuantity: 5,
        receivedQuantity: 0,
        unitPrice: 320,
        totalPrice: 1600,
        location: 'A-01-A-04',
        category: 'Hardware'
      }
    ],
    totalProducts: 1,
    totalQuantity: 5,
    estimatedTotalValue: 1600,
    status: 'Pending Approval',
    createdUser: 'Warehouse Operator',
    createdAt: new Date().toISOString(),
    updatedUser: 'Warehouse Operator',
    updatedAt: new Date().toISOString(),
    auditTrail: [
      {
        id: 'aud-3',
        action: 'Created',
        user: 'Warehouse Operator',
        timestamp: new Date().toISOString(),
        notes: 'Submitted for Janah approval'
      }
    ]
  }
];

type POListener = (pos: PurchaseOrder[]) => void;

class PurchaseOrderService {
  private listeners: POListener[] = [];
  private localPOs: PurchaseOrder[] = [];
  private isFirebaseConfigured = false;

  constructor() {
    this.initLocalData();
    this.initFirebase();
  }

  private initLocalData() {
    try {
      const stored = localStorage.getItem(STORAGE_PO_KEY);
      if (stored) {
        this.localPOs = JSON.parse(stored);
      } else {
        this.localPOs = INITIAL_PURCHASE_ORDERS;
        this.saveLocal();
      }
    } catch (e) {
      this.localPOs = INITIAL_PURCHASE_ORDERS;
    }
  }

  private saveLocal() {
    try {
      localStorage.setItem(STORAGE_PO_KEY, JSON.stringify(this.localPOs));
    } catch (e) {
      console.error('Failed to save POs to localStorage', e);
    }
  }

  private initFirebase() {
    try {
      const docRef = db.collection(APP_ID_PATH).doc('purchase_orders_data');
      this.isFirebaseConfigured = true;

      docRef.collection('purchaseOrders').onSnapshot(snapshot => {
        if (snapshot && !snapshot.empty) {
          const cloudPOs: PurchaseOrder[] = [];
          snapshot.forEach(doc => {
            cloudPOs.push({ id: doc.id, ...doc.data() } as PurchaseOrder);
          });
          
          cloudPOs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          this.localPOs = cloudPOs;
          this.saveLocal();
          this.notify();
        } else {
          // Seed Firebase with initial POs if empty
          this.seedFirebase();
        }
      }, err => {
        console.warn('Firestore subscription error for purchase orders, using local fallback:', err);
        this.notify();
      });
    } catch (e) {
      console.warn('Firebase not ready for Purchase Orders, using localStorage fallback');
      this.notify();
    }
  }

  private async seedFirebase() {
    if (!this.isFirebaseConfigured) return;
    try {
      const batch = db.batch();
      const colRef = db.collection(APP_ID_PATH).doc('purchase_orders_data').collection('purchaseOrders');
      
      this.localPOs.forEach(po => {
        const ref = colRef.doc(po.id);
        batch.set(ref, po, { merge: true });
      });
      await batch.commit();
    } catch (e) {
      console.warn('Failed to seed purchase orders to Firebase:', e);
    }
  }

  public subscribe(listener: POListener): () => void {
    this.listeners.push(listener);
    listener(this.getPOs());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    const data = this.getPOs();
    this.listeners.forEach(l => l(data));
  }

  public getPOs(): PurchaseOrder[] {
    return [...this.localPOs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getPOById(id: string): PurchaseOrder | undefined {
    return this.localPOs.find(p => p.id === id || p.poNumber === id);
  }

  // Auto-generate PO Number: e.g. PO-2026-000003
  public generateNextPONumber(): string {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;
    const existingNum = this.localPOs
      .map(p => {
        if (p.poNumber.startsWith(prefix)) {
          const numPart = p.poNumber.replace(prefix, '');
          return parseInt(numPart, 10) || 0;
        }
        return 0;
      })
      .reduce((max, curr) => Math.max(max, curr), 0);

    const nextSeq = String(existingNum + 1).padStart(6, '0');
    return `${prefix}${nextSeq}`;
  }

  // Create Purchase Order manually or from Stock Request
  public async createPurchaseOrder(
    poData: Partial<PurchaseOrder>,
    currentUser: string = 'Admin User'
  ): Promise<PurchaseOrder> {
    const poNumber = poData.poNumber || this.generateNextPONumber();
    const now = new Date().toISOString();

    const items = poData.items || [];
    const totalProducts = items.length;
    const totalQuantity = items.reduce((acc, item) => acc + (item.orderQuantity || 0), 0);
    const estimatedTotalValue = items.reduce((acc, item) => acc + ((item.unitPrice || 0) * (item.orderQuantity || 0)), 0);

    const newPO: PurchaseOrder = {
      id: poNumber,
      poNumber: poNumber,
      companyId: poData.companyId || 'TS-JOINERY-CPT',
      branchId: poData.branchId || 'MAIN-BRANCH',
      linkedRequestId: poData.linkedRequestId || '',
      linkedRequestNumber: poData.linkedRequestNumber || '',
      supplierId: poData.supplierId || '',
      supplierName: poData.supplierName || 'General Supplier',
      supplierCode: poData.supplierCode || '',
      supplierContactPerson: poData.supplierContactPerson || '',
      supplierTelephone: poData.supplierTelephone || '',
      supplierEmail: poData.supplierEmail || '',
      supplierAddress: poData.supplierAddress || '',
      deliveryAddress: poData.deliveryAddress || 'TS Joinery Factory, 14 Factory Rd, Montague Gardens, Cape Town',
      deliveryInstructions: poData.deliveryInstructions || 'Deliver to Receiving Bay Gate B.',
      expectedDeliveryDate: poData.expectedDeliveryDate || new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0],
      items: items,
      totalProducts,
      totalQuantity,
      estimatedTotalValue,
      status: poData.status || 'Pending Approval',
      createdUser: currentUser,
      createdAt: now,
      updatedUser: currentUser,
      updatedAt: now,
      auditTrail: [
        {
          id: `aud-${Date.now()}`,
          action: 'Created',
          user: currentUser,
          timestamp: now,
          notes: poData.linkedRequestNumber ? `Created from Stock Request ${poData.linkedRequestNumber}` : 'Manual Purchase Order creation'
        }
      ]
    };

    // Update local state
    this.localPOs.unshift(newPO);
    this.saveLocal();
    this.notify();

    // Firebase Sync
    try {
      if (this.isFirebaseConfigured) {
        await db.collection(APP_ID_PATH).doc('purchase_orders_data').collection('purchaseOrders').doc(newPO.id).set(newPO);
      }
    } catch (e) {
      console.warn('Failed to write PO to Firebase, saved locally:', e);
    }

    return newPO;
  }

  // Convenience helper: Convert a Stock Request directly to a Purchase Order
  public async createPOFromStockRequest(
    stockRequest: StockRequest,
    supplierId?: string,
    currentUser: string = 'Janah (Procurement Manager)'
  ): Promise<PurchaseOrder> {
    // Look up supplier details if supplierId provided or from Product Master
    const suppliers = productMasterService.getSuppliers();
    const products = productMasterService.getProducts();

    const requestItems = stockRequest.items || [];
    const firstSupplierName = requestItems[0]?.supplier || '';

    let matchedSupplier = suppliers.find(s => s.id === supplierId || (firstSupplierName && s.supplierName.toLowerCase() === firstSupplierName.toLowerCase()));

    const poItems: PurchaseOrderItem[] = requestItems.map((item, idx) => {
      const matchedProduct = products.find(p => p.id === item.productId || p.internalProductCode === item.productId || p.productName.toLowerCase() === item.productName.toLowerCase());

      if (!matchedSupplier && matchedProduct) {
        matchedSupplier = suppliers.find(s => s.id === matchedProduct?.supplierId || s.supplierName === matchedProduct?.supplier);
      }

      return {
        id: `poi-${Date.now()}-${idx}`,
        productId: matchedProduct?.id || item.productId || `PRD-${idx}`,
        productName: item.productName,
        internalProductCode: matchedProduct?.internalProductCode || item.productId || 'PRD-000',
        supplierPartNumber: matchedProduct?.supplierPartNumber || item.supplierPartNumber || 'N/A',
        unit: matchedProduct?.unit || 'ea',
        orderQuantity: Number(item.quantity) || 1,
        receivedQuantity: item.receivedQuantity || 0,
        unitPrice: 0,
        totalPrice: 0,
        location: item.location || matchedProduct?.location || 'A-01-A-01',
        category: matchedProduct?.category || 'General'
      };
    });

    const supplierName = matchedSupplier?.supplierName || firstSupplierName || 'Selected Supplier';

    return this.createPurchaseOrder({
      linkedRequestId: stockRequest.id,
      linkedRequestNumber: stockRequest.requestNumber || stockRequest.id,
      supplierId: matchedSupplier?.id || '',
      supplierName: supplierName,
      supplierCode: matchedSupplier?.supplierCode || '',
      supplierContactPerson: matchedSupplier?.contactPerson || '',
      supplierTelephone: matchedSupplier?.telephone || '',
      supplierEmail: matchedSupplier?.email || '',
      supplierAddress: matchedSupplier?.physicalAddress || '',
      expectedDeliveryDate: matchedSupplier ? new Date(Date.now() + (matchedSupplier.leadTimeDays || 3) * 24 * 3600 * 1000).toISOString().split('T')[0] : undefined,
      items: poItems,
      status: 'Pending Approval'
    }, currentUser);
  }

  // Approve Purchase Order
  public async approvePO(poId: string, currentUser: string = 'Janah (Procurement Manager)', notes?: string): Promise<boolean> {
    const poIndex = this.localPOs.findIndex(p => p.id === poId || p.poNumber === poId);
    if (poIndex === -1) return false;

    const now = new Date().toISOString();
    const target = { ...this.localPOs[poIndex] };

    target.status = 'Approved';
    target.approvedBy = currentUser;
    target.approvedAt = now;
    target.updatedUser = currentUser;
    target.updatedAt = now;

    target.auditTrail.unshift({
      id: `aud-${Date.now()}`,
      action: 'Approved',
      user: currentUser,
      timestamp: now,
      notes: notes || 'Purchase Order approved and issued to supplier.'
    });

    this.localPOs[poIndex] = target;
    this.saveLocal();
    this.notify();

    try {
      if (this.isFirebaseConfigured) {
        await db.collection(APP_ID_PATH).doc('purchase_orders_data').collection('purchaseOrders').doc(target.id).update({
          status: 'Approved',
          approvedBy: currentUser,
          approvedAt: now,
          updatedUser: currentUser,
          updatedAt: now,
          auditTrail: target.auditTrail
        });
      }
    } catch (e) {
      console.warn('Failed to update PO in Firebase:', e);
    }

    return true;
  }

  // Update Status
  public async updatePOStatus(
    poId: string,
    newStatus: PurchaseOrderStatus,
    currentUser: string = 'Admin User',
    notes?: string
  ): Promise<boolean> {
    const poIndex = this.localPOs.findIndex(p => p.id === poId || p.poNumber === poId);
    if (poIndex === -1) return false;

    const now = new Date().toISOString();
    const target = { ...this.localPOs[poIndex] };

    target.status = newStatus;
    target.updatedUser = currentUser;
    target.updatedAt = now;

    target.auditTrail.unshift({
      id: `aud-${Date.now()}`,
      action: `Status changed to ${newStatus}`,
      user: currentUser,
      timestamp: now,
      notes: notes || `Status updated to ${newStatus}`
    });

    this.localPOs[poIndex] = target;
    this.saveLocal();
    this.notify();

    try {
      if (this.isFirebaseConfigured) {
        await db.collection(APP_ID_PATH).doc('purchase_orders_data').collection('purchaseOrders').doc(target.id).update({
          status: newStatus,
          updatedUser: currentUser,
          updatedAt: now,
          auditTrail: target.auditTrail
        });
      }
    } catch (e) {
      console.warn('Failed to update PO status in Firebase:', e);
    }

    return true;
  }
}

export const purchaseOrderService = new PurchaseOrderService();
