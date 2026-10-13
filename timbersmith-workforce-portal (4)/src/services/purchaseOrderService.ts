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
import { companyService, DEFAULT_COMPANY_INFO } from './companyService';

const STORAGE_PO_KEY = 'tsj_purchase_orders_v1';

// Initial Sample Purchase Orders
const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'PO-2026-000001',
    poNumber: 'PO-2026-000001',
    masterPoNumber: 'MPO-2026-000001',
    companyId: DEFAULT_COMPANY_INFO.registrationNumber,
    branchId: 'BR-001',
    branchName: 'Bloemfontein Central',
    linkedRequestId: 'SR-001',
    linkedRequestNumber: 'SR-001',
    supplierId: 'SUP-001',
    supplierName: 'Sondor Wood & Boards',
    supplierCode: 'SONDOR',
    supplierContactPerson: 'David Miller',
    supplierTelephone: '+27 21 555 0192',
    supplierEmail: 'orders@sondorwood.co.za',
    supplierAddress: '12 Timber Way, Paarden Eiland, Cape Town',
    deliveryAddress: '14 Joiners Street, Industrial Area, Bloemfontein, 9301',
    deliveryInstructions: 'Deliver to Receiving Bay Gate B. Attn: Workshop Receiving.',
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
    approvedBy: 'Elrico Greyvenstein',
    approvedByUserId: 'usr-admin-elrico',
    approvedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    createdUser: 'Janah Posthumus',
    createdByUserId: 'usr-manager-janah',
    userId: 'usr-manager-janah',
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    updatedUser: 'Elrico Greyvenstein',
    updatedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    auditTrail: [
      {
        id: 'aud-1',
        action: 'Created',
        user: 'Janah Posthumus',
        timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        notes: 'Generated from Stock Request SR-001'
      },
      {
        id: 'aud-2',
        action: 'Approved',
        user: 'Elrico Greyvenstein',
        timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        notes: 'PO Approved and issued to Sondor Wood & Boards'
      }
    ]
  },
  {
    id: 'PO-2026-000002',
    poNumber: 'PO-2026-000002',
    masterPoNumber: 'MPO-2026-000002',
    companyId: DEFAULT_COMPANY_INFO.registrationNumber,
    branchId: 'BR-001',
    branchName: 'Bloemfontein Central',
    linkedRequestId: 'SR-002',
    linkedRequestNumber: 'SR-002',
    supplierId: 'SUP-002',
    supplierName: 'Fasteners SA',
    supplierCode: 'FASTENERS',
    supplierContactPerson: 'Sarah Jenkins',
    supplierTelephone: '+27 21 555 8821',
    supplierEmail: 'sales@fastenerssa.co.za',
    supplierAddress: '45 Industrial Crescent, Epping, Cape Town',
    deliveryAddress: '14 Joiners Street, Industrial Area, Bloemfontein, 9301',
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
    createdUser: 'Juan de Lange',
    createdByUserId: 'usr-depot-juan',
    userId: 'usr-depot-juan',
    createdAt: new Date().toISOString(),
    updatedUser: 'Juan de Lange',
    updatedAt: new Date().toISOString(),
    auditTrail: [
      {
        id: 'aud-3',
        action: 'Created',
        user: 'Juan de Lange',
        timestamp: new Date().toISOString(),
        notes: 'Submitted for procurement approval'
      }
    ]
  },
  {
    id: 'PO-2026-000005',
    poNumber: 'PO-2026-000005',
    masterPoNumber: 'MPO-2026-000005',
    companyId: DEFAULT_COMPANY_INFO.registrationNumber,
    branchId: 'BR-001',
    branchName: 'Bloemfontein Central',
    linkedRequestId: 'SR-005',
    linkedRequestNumber: 'SR-005',
    supplierId: 'SUP-001',
    supplierName: 'Sondor Wood & Boards',
    supplierCode: 'SONDOR',
    supplierContactPerson: 'David Miller',
    supplierTelephone: '+27 21 555 0192',
    supplierEmail: 'orders@sondorwood.co.za',
    supplierAddress: '12 Timber Way, Paarden Eiland, Cape Town',
    deliveryAddress: '14 Joiners Street, Industrial Area, Bloemfontein, 9301',
    deliveryInstructions: 'Deliver to Receiving Bay Gate B. Attn: Workshop Receiving.',
    expectedDeliveryDate: '2026-02-18',
    items: [
      {
        id: 'poi-5',
        productId: 'PRD-0001',
        productName: 'Oak Board 20mm (1220x2440)',
        internalProductCode: 'PRD-0001',
        supplierPartNumber: 'OAK-20-A',
        unit: 'ea',
        orderQuantity: 10,
        receivedQuantity: 10,
        unitPrice: 450,
        totalPrice: 4500,
        location: 'A-04-B-12',
        category: 'Board'
      }
    ],
    totalProducts: 1,
    totalQuantity: 10,
    estimatedTotalValue: 4500,
    status: 'Approved',
    approvedBy: 'Elrico Greyvenstein',
    approvedByUserId: 'usr-admin-elrico',
    approvedAt: '2026-02-15T10:00:00.000Z',
    createdUser: 'Janah Posthumus',
    createdByUserId: 'usr-manager-janah',
    userId: 'usr-manager-janah',
    createdAt: '2026-02-15T09:30:00.000Z',
    updatedUser: 'Elrico Greyvenstein',
    updatedAt: '2026-02-15T10:00:00.000Z',
    auditTrail: [
      {
        id: 'aud-5a',
        action: 'Created',
        user: 'Janah Posthumus',
        timestamp: '2026-02-15T09:30:00.000Z',
        notes: 'Stock replenishment order for Oak Boards'
      },
      {
        id: 'aud-5b',
        action: 'Approved',
        user: 'Elrico Greyvenstein',
        timestamp: '2026-02-15T10:00:00.000Z',
        notes: 'Approved for manufacturing job #4401'
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
        const parsed: PurchaseOrder[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(parsed.map(p => p.id));
          const missing = INITIAL_PURCHASE_ORDERS.filter(p => !existingIds.has(p.id));
          this.localPOs = [...parsed, ...missing];
          if (missing.length > 0) {
            this.saveLocal();
          }
        } else {
          this.localPOs = INITIAL_PURCHASE_ORDERS;
          this.saveLocal();
        }
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
    const target = id.trim().toUpperCase();
    const targetUnpadded = target.replace(/-0+/, '-');
    return this.localPOs.find(p => {
      if (p.id.toUpperCase() === target || p.poNumber.toUpperCase() === target) return true;
      const pUnpadded = p.poNumber.toUpperCase().replace(/-0+/, '-');
      const pIdUnpadded = p.id.toUpperCase().replace(/-0+/, '-');
      return pUnpadded === targetUnpadded || pIdUnpadded === targetUnpadded;
    });
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
    currentUser?: any
  ): Promise<PurchaseOrder> {
    const poNumber = poData.poNumber || this.generateNextPONumber();
    const now = new Date().toISOString();

    // Resolve creator identity from currentUser or poData
    const createdByUserId = (typeof currentUser === 'object' && currentUser?.id)
      ? currentUser.id
      : (poData.createdByUserId || (typeof currentUser === 'string' && currentUser ? currentUser : 'system'));
    const createdUserName = (typeof currentUser === 'object' && (currentUser?.name || currentUser?.email))
      ? (currentUser.name || currentUser.email)
      : (typeof currentUser === 'string' && currentUser ? currentUser : (poData.createdUser || 'System User'));

    // Resolve branch and delivery address dynamically from Branch Master
    const companyInfo = companyService.getLocalCompanyInfo();
    const branches = companyService.getLocalBranches();

    let resolvedBranchId = poData.branchId;
    if (!resolvedBranchId && typeof currentUser === 'object' && currentUser?.branchId) {
      resolvedBranchId = currentUser.branchId;
    }
    const matchedBranch = branches.find(b => b.id === resolvedBranchId || b.branchCode === resolvedBranchId);
    const branchId = matchedBranch?.id || resolvedBranchId || (branches[0]?.id || 'BR-001');
    const branchName = matchedBranch?.branchName || poData.branchName || (branches[0]?.branchName || 'Bloemfontein Central');

    // Authoritative delivery address resolution:
    // If explicitly provided (and not the legacy hardcoded Cape Town default), preserve it;
    // Otherwise resolve directly from the branch record's physical address, falling back to company address
    let deliveryAddress = poData.deliveryAddress;
    if (!deliveryAddress || deliveryAddress.includes('14 Factory Rd, Montague Gardens, Cape Town')) {
      deliveryAddress = matchedBranch?.physicalAddress || companyInfo.physicalAddress || DEFAULT_COMPANY_INFO.physicalAddress || '';
    }

    const items = poData.items || [];
    const totalProducts = items.length;
    const totalQuantity = items.reduce((acc, item) => acc + (item.orderQuantity || 0), 0);
    const estimatedTotalValue = items.reduce((acc, item) => acc + ((item.unitPrice || 0) * (item.orderQuantity || 0)), 0);

    const newPO: PurchaseOrder = {
      id: poNumber,
      poNumber: poNumber,
      masterPoNumber: poData.masterPoNumber || poNumber,
      companyId: poData.companyId || companyInfo.registrationNumber || DEFAULT_COMPANY_INFO.registrationNumber,
      branchId: branchId,
      branchName: branchName,
      linkedRequestId: poData.linkedRequestId || '',
      linkedRequestNumber: poData.linkedRequestNumber || '',
      supplierId: poData.supplierId || '',
      supplierName: poData.supplierName || 'General Supplier',
      supplierCode: poData.supplierCode || '',
      supplierContactPerson: poData.supplierContactPerson || '',
      supplierTelephone: poData.supplierTelephone || '',
      supplierEmail: poData.supplierEmail || '',
      supplierAddress: poData.supplierAddress || '',
      deliveryAddress: deliveryAddress,
      deliveryInstructions: poData.deliveryInstructions || '',
      expectedDeliveryDate: poData.expectedDeliveryDate || new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0],
      items: items,
      totalProducts,
      totalQuantity,
      estimatedTotalValue,
      status: poData.status || 'Pending Approval',
      createdUser: createdUserName,
      createdByUserId: createdByUserId,
      userId: createdByUserId,
      createdAt: now,
      updatedUser: createdUserName,
      updatedAt: now,
      auditTrail: [
        {
          id: `aud-${Date.now()}`,
          action: 'Created',
          user: createdUserName,
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

  // Convenience helper: Convert a Stock Request directly to Purchase Orders grouped automatically by Supplier
  public async createPOGroupFromStockRequest(
    stockRequest: StockRequest,
    currentUser?: any
  ): Promise<PurchaseOrder[]> {
    const suppliers = productMasterService.getSuppliers();
    const products = productMasterService.getProducts();
    const requestItems = stockRequest.items || [];

    if (requestItems.length === 0) {
      const defaultPO = await this.createPOFromStockRequest(stockRequest, undefined, currentUser);
      return [defaultPO];
    }

    // Group items by supplier key (preferring canonical supplierId)
    const groupedMap = new Map<string, { supplier: typeof suppliers[0] | null; supplierName: string; items: StockRequestItem[] }>();

    requestItems.forEach((item) => {
      const matchedProduct = products.find(p => p.id === item.productId || p.internalProductCode === item.productId || p.productName.toLowerCase() === item.productName.toLowerCase());
      let matchedSupplier = suppliers.find(s => 
        (item.supplierId && s.id === item.supplierId) ||
        (item.supplier && s.supplierName.toLowerCase() === item.supplier.toLowerCase()) || 
        (matchedProduct && (s.id === matchedProduct.supplierId || s.supplierName.toLowerCase() === matchedProduct.supplier.toLowerCase()))
      );

      const suppKey = matchedSupplier ? matchedSupplier.id : (item.supplierId || item.supplier || matchedProduct?.supplierId || matchedProduct?.supplier || 'Unassigned Supplier');
      const suppName = matchedSupplier ? matchedSupplier.supplierName : (item.supplier || matchedProduct?.supplier || 'Unassigned Supplier');

      if (!groupedMap.has(suppKey)) {
        groupedMap.set(suppKey, { supplier: matchedSupplier || null, supplierName: suppName, items: [] });
      }
      groupedMap.get(suppKey)!.items.push(item);
    });

    const createdPOs: PurchaseOrder[] = [];
    const masterPoNumber = stockRequest.requestNumber 
      ? `MPO-${stockRequest.requestNumber}` 
      : `MPO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    for (const [_, group] of groupedMap.entries()) {
      const matchedSupplier = group.supplier;
      const poItems: PurchaseOrderItem[] = group.items.map((item, idx) => {
        const matchedProduct = products.find(p => p.id === item.productId || p.internalProductCode === item.productId || p.productName.toLowerCase() === item.productName.toLowerCase());
        const prodDesc = item.productDescription || item.productName || (matchedProduct as any)?.description || matchedProduct?.productName || 'Product';
        return {
          id: `poi-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
          productId: matchedProduct?.id || item.productId || `PRD-${idx}`,
          productName: prodDesc,
          productDescription: prodDesc,
          internalProductCode: matchedProduct?.internalProductCode || (item.productId && !item.productId.startsWith('KAN-') ? item.productId : (matchedProduct?.id || 'PRD-000')),
          kanbanId: item.kanbanId || (item.productId && item.productId.startsWith('KAN-') ? item.productId : undefined),
          supplierId: matchedSupplier?.id || matchedProduct?.supplierId || item.supplierId || '',
          supplierPartNumber: matchedProduct?.supplierPartNumber || item.supplierPartNumber || 'N/A',
          unit: matchedProduct?.unit || 'ea',
          orderQuantity: Number(item.quantity) || 1,
          receivedQuantity: item.receivedQuantity || 0,
          unitPrice: 0,
          totalPrice: 0,
          location: item.location || matchedProduct?.location || 'A-01-A-01',
          category: matchedProduct?.category || 'General',
          stockRequestItemId: item.id
        };
      });

      const po = await this.createPurchaseOrder({
        masterPoNumber: masterPoNumber,
        branchId: stockRequest.branchId,
        branchName: stockRequest.branchName,
        deliveryInstructions: stockRequest.notes ? `Requisition Notes: ${stockRequest.notes}` : undefined,
        linkedRequestId: stockRequest.id,
        linkedRequestNumber: stockRequest.requestNumber || stockRequest.id,
        supplierId: matchedSupplier?.id || '',
        supplierName: group.supplierName,
        supplierCode: matchedSupplier?.supplierCode || '',
        supplierContactPerson: matchedSupplier?.contactPerson || '',
        supplierTelephone: matchedSupplier?.telephone || '',
        supplierEmail: matchedSupplier?.email || '',
        supplierAddress: matchedSupplier?.physicalAddress || '',
        expectedDeliveryDate: matchedSupplier ? new Date(Date.now() + (matchedSupplier.leadTimeDays || 3) * 24 * 3600 * 1000).toISOString().split('T')[0] : undefined,
        items: poItems,
        status: 'Pending Approval'
      }, currentUser);

      createdPOs.push(po);
    }

    return createdPOs;
  }

  // Convenience helper: Convert a Stock Request directly to a Purchase Order
  public async createPOFromStockRequest(
    stockRequest: StockRequest,
    supplierId?: string,
    currentUser?: any
  ): Promise<PurchaseOrder> {
    const createdPOs = await this.createPOGroupFromStockRequest(stockRequest, currentUser);
    return createdPOs[0];
  }

  // Delete Purchase Order permanently
  public async deletePurchaseOrder(poId: string): Promise<boolean> {
    const idx = this.localPOs.findIndex(p => p.id === poId || p.poNumber === poId);
    if (idx === -1) return false;

    const removed = this.localPOs[idx];
    this.localPOs.splice(idx, 1);
    this.saveLocal();
    this.notify();

    try {
      if (this.isFirebaseConfigured) {
        await db.collection(APP_ID_PATH).doc('purchase_orders_data').collection('purchaseOrders').doc(removed.id).delete();
      }
    } catch (e) {
      console.warn('Failed to delete PO in Firebase:', e);
    }

    return true;
  }

  // Approve Purchase Order
  public async approvePO(poId: string, currentUser?: any, notes?: string): Promise<boolean> {
    const poIndex = this.localPOs.findIndex(p => p.id === poId || p.poNumber === poId);
    if (poIndex === -1) return false;

    const approverUserId = (typeof currentUser === 'object' && currentUser?.id)
      ? currentUser.id
      : (typeof currentUser === 'string' && currentUser ? currentUser : 'system');
    const approverName = (typeof currentUser === 'object' && (currentUser?.name || currentUser?.email))
      ? (currentUser.name || currentUser.email)
      : (typeof currentUser === 'string' && currentUser ? currentUser : 'Authorized Approver');

    const now = new Date().toISOString();
    const target = { ...this.localPOs[poIndex] };

    target.status = 'Approved';
    target.approvedBy = approverName;
    target.approvedByUserId = approverUserId;
    target.approvedAt = now;
    target.updatedUser = approverName;
    target.updatedAt = now;

    target.auditTrail.unshift({
      id: `aud-${Date.now()}`,
      action: 'Approved',
      user: approverName,
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
          approvedBy: approverName,
          approvedByUserId: approverUserId,
          approvedAt: now,
          updatedUser: approverName,
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
    currentUser?: any,
    notes?: string
  ): Promise<boolean> {
    const poIndex = this.localPOs.findIndex(p => p.id === poId || p.poNumber === poId);
    if (poIndex === -1) return false;

    const userName = (typeof currentUser === 'object' && (currentUser?.name || currentUser?.email))
      ? (currentUser.name || currentUser.email)
      : (typeof currentUser === 'string' && currentUser ? currentUser : 'User');

    const now = new Date().toISOString();
    const target = { ...this.localPOs[poIndex] };

    target.status = newStatus;
    target.updatedUser = userName;
    target.updatedAt = now;

    target.auditTrail.unshift({
      id: `aud-${Date.now()}`,
      action: `Status changed to ${newStatus}`,
      user: userName,
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
          updatedUser: userName,
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
