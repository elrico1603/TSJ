import firebase from 'firebase/compat/app';
import { db, APP_ID_PATH } from '../firebase';
import {
  ProductMaster,
  ProductCategory,
  Supplier,
  WarehouseLocation,
  MasterAuditLog
} from '../types';
import { inventoryService } from './inventoryService';

const STORAGE_PRODUCTS_KEY = 'tsj_products_master_v1';
const STORAGE_CATEGORIES_KEY = 'tsj_categories_master_v1';
const STORAGE_SUPPLIERS_KEY = 'tsj_suppliers_master_v1';
const STORAGE_LOCATIONS_KEY = 'tsj_locations_master_v1';
const STORAGE_AUDIT_KEY = 'tsj_master_audit_v1';

// Initial Sample Product Categories
const INITIAL_CATEGORIES: ProductCategory[] = [
  { id: 'CAT-101', name: 'Board', code: 'BOARD', description: 'Engineered wood & melamine boards', status: 'Active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'CAT-102', name: 'Hardware', code: 'HARDWARE', description: 'Hinges, runners, screws, handles', status: 'Active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'CAT-103', name: 'Paint', code: 'PAINT', description: 'Lacquers, stains, primers, sealers', status: 'Active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'CAT-104', name: 'Consumables', code: 'CONSUMABLE', description: 'Adhesives, sandpaper, drill bits', status: 'Active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'CAT-105', name: 'Machinery Parts', code: 'MACHINERY', description: 'CNC tooling, saw blades, belts', status: 'Active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'CAT-106', name: 'Packaging', code: 'PACKAGING', description: 'Bubble wrap, strapping, boxes', status: 'Active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];

// Initial Sample Suppliers
const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'SUP-001',
    supplierName: 'Sondor Wood & Boards',
    supplierCode: 'SONDOR',
    contactPerson: 'David Miller',
    telephone: '+27 21 555 0192',
    email: 'orders@sondorwood.co.za',
    physicalAddress: '12 Timber Way, Paarden Eiland, Cape Town',
    leadTimeDays: 3,
    preferredSupplier: true,
    status: 'Active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'SUP-002',
    supplierName: 'Fasteners SA',
    supplierCode: 'FASTENERS',
    contactPerson: 'Sarah Jenkins',
    telephone: '+27 21 555 8821',
    email: 'sales@fastenerssa.co.za',
    physicalAddress: '45 Industrial Crescent, Epping, Cape Town',
    leadTimeDays: 2,
    preferredSupplier: true,
    status: 'Active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'SUP-003',
    supplierName: 'Blum Hardware',
    supplierCode: 'BLUM',
    contactPerson: 'Johan van der Merwe',
    telephone: '+27 11 444 3300',
    email: 'support@blumhardware.co.za',
    physicalAddress: '88 Joinery Park, Midrand, Johannesburg',
    leadTimeDays: 5,
    preferredSupplier: true,
    status: 'Active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Initial Sample Warehouse Locations
const INITIAL_LOCATIONS: WarehouseLocation[] = [
  { id: 'LOC-101', aisle: 'A', rack: '01', shelf: 'A', bin: '01', locationCode: 'A-01-A-01', colour: 'RED', description: 'Aisle A Raw Boards', status: 'Active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'LOC-102', aisle: 'B', rack: '04', shelf: 'B', bin: '12', locationCode: 'B-04-B-12', colour: 'YELLOW', description: 'Aisle B Hardware Bins', status: 'Active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'LOC-103', aisle: 'C', rack: '08', shelf: 'C', bin: '05', locationCode: 'C-08-C-05', colour: 'GREEN', description: 'Aisle C Blum Fittings', status: 'Active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'LOC-104', aisle: 'D', rack: '02', shelf: 'A', bin: '03', locationCode: 'D-02-A-03', colour: 'BLUE', description: 'Aisle D Paints & Sealers', status: 'Active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];

// Initial Sample Products
const INITIAL_PRODUCTS: ProductMaster[] = [
  {
    id: 'PRD-0001',
    productName: 'Oak Board 20mm (1220x2440)',
    productImage: '',
    internalProductCode: 'PRD-0001',
    supplierId: 'SUP-001',
    supplier: 'Sondor Wood & Boards',
    supplierPartNumber: 'OAK-20-A',
    categoryId: 'CAT-101',
    category: 'Board',
    locationId: 'LOC-101',
    location: 'A-01-A-01',
    locationColour: 'RED',
    qrCode: 'PRD-0001',
    barcode: '6001234567891',
    unit: 'ea',
    minimumStock: 15,
    maximumStock: 100,
    orderQuantity: 20,
    deliveryTime: '3 Days',
    cardColour: '#10b981',
    status: 'Active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdUser: 'System',
    updatedUser: 'System'
  },
  {
    id: 'PRD-0002',
    productName: 'Wood Screws 4x30 Box 1000',
    productImage: '',
    internalProductCode: 'PRD-0002',
    supplierId: 'SUP-002',
    supplier: 'Fasteners SA',
    supplierPartNumber: 'SCR-430-B',
    categoryId: 'CAT-102',
    category: 'Hardware',
    locationId: 'LOC-102',
    location: 'B-04-B-12',
    locationColour: 'YELLOW',
    qrCode: 'PRD-0002',
    barcode: '6001234567892',
    unit: 'box',
    minimumStock: 12,
    maximumStock: 50,
    orderQuantity: 10,
    deliveryTime: '2 Days',
    cardColour: '#3b82f6',
    status: 'Active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdUser: 'System',
    updatedUser: 'System'
  },
  {
    id: 'PRD-0003',
    productName: 'Drawer Runner Soft-Close 500mm',
    productImage: '',
    internalProductCode: 'PRD-0003',
    supplierId: 'SUP-003',
    supplier: 'Blum Hardware',
    supplierPartNumber: 'BLUM-500-SC',
    categoryId: 'CAT-102',
    category: 'Hardware',
    locationId: 'LOC-103',
    location: 'C-08-C-05',
    locationColour: 'GREEN',
    qrCode: 'PRD-0003',
    barcode: '6001234567893',
    unit: 'pair',
    minimumStock: 25,
    maximumStock: 120,
    orderQuantity: 30,
    deliveryTime: '5 Days',
    cardColour: '#8b5cf6',
    status: 'Active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdUser: 'System',
    updatedUser: 'System'
  }
];

// Helper to get Firestore subcollections
function getMasterDocRef() {
  return db
    .collection('artifacts')
    .doc(APP_ID_PATH)
    .collection('public')
    .doc('data');
}

type ProductListener = (products: ProductMaster[]) => void;
type CategoryListener = (categories: ProductCategory[]) => void;
type SupplierListener = (suppliers: Supplier[]) => void;
type LocationListener = (locations: WarehouseLocation[]) => void;
type AuditListener = (audits: MasterAuditLog[]) => void;

const productListeners = new Set<ProductListener>();
const categoryListeners = new Set<CategoryListener>();
const supplierListeners = new Set<SupplierListener>();
const locationListeners = new Set<LocationListener>();
const auditListeners = new Set<AuditListener>();

export const productMasterService = {
  // Local storage helpers
  getLocalProducts(): ProductMaster[] {
    try {
      const stored = localStorage.getItem(STORAGE_PRODUCTS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse local products:', e);
    }
    this.saveLocalProducts(INITIAL_PRODUCTS);
    return INITIAL_PRODUCTS;
  },

  saveLocalProducts(items: ProductMaster[]): void {
    try {
      localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(items));
      productListeners.forEach(cb => cb(items));
    } catch (e) {
      console.error('Failed to save local products:', e);
    }
  },

  getLocalCategories(): ProductCategory[] {
    try {
      const stored = localStorage.getItem(STORAGE_CATEGORIES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse local categories:', e);
    }
    this.saveLocalCategories(INITIAL_CATEGORIES);
    return INITIAL_CATEGORIES;
  },

  saveLocalCategories(items: ProductCategory[]): void {
    try {
      localStorage.setItem(STORAGE_CATEGORIES_KEY, JSON.stringify(items));
      categoryListeners.forEach(cb => cb(items));
    } catch (e) {
      console.error('Failed to save local categories:', e);
    }
  },

  getLocalSuppliers(): Supplier[] {
    try {
      const stored = localStorage.getItem(STORAGE_SUPPLIERS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse local suppliers:', e);
    }
    this.saveLocalSuppliers(INITIAL_SUPPLIERS);
    return INITIAL_SUPPLIERS;
  },

  saveLocalSuppliers(items: Supplier[]): void {
    try {
      localStorage.setItem(STORAGE_SUPPLIERS_KEY, JSON.stringify(items));
      supplierListeners.forEach(cb => cb(items));
    } catch (e) {
      console.error('Failed to save local suppliers:', e);
    }
  },

  getLocalLocations(): WarehouseLocation[] {
    try {
      const stored = localStorage.getItem(STORAGE_LOCATIONS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse local locations:', e);
    }
    this.saveLocalLocations(INITIAL_LOCATIONS);
    return INITIAL_LOCATIONS;
  },

  saveLocalLocations(items: WarehouseLocation[]): void {
    try {
      localStorage.setItem(STORAGE_LOCATIONS_KEY, JSON.stringify(items));
      locationListeners.forEach(cb => cb(items));
    } catch (e) {
      console.error('Failed to save local locations:', e);
    }
  },

  getLocalAudits(): MasterAuditLog[] {
    try {
      const stored = localStorage.getItem(STORAGE_AUDIT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse local audit logs:', e);
    }
    return [];
  },

  saveLocalAudits(items: MasterAuditLog[]): void {
    try {
      localStorage.setItem(STORAGE_AUDIT_KEY, JSON.stringify(items));
      auditListeners.forEach(cb => cb(items));
    } catch (e) {
      console.error('Failed to save local audit logs:', e);
    }
  },

  // Audit Log recording helper
  async logMasterAction(log: Omit<MasterAuditLog, 'id' | 'timestamp'>): Promise<void> {
    const fullLog: MasterAuditLog = {
      ...log,
      id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString()
    };

    const localAudits = [fullLog, ...this.getLocalAudits()];
    this.saveLocalAudits(localAudits);

    try {
      await getMasterDocRef().collection('masterAuditLogs').doc(fullLog.id).set(fullLog);
    } catch (e) {
      console.warn('Firestore master audit write skipped:', e);
    }
  },

  // Product Master CRUD
  subscribeProducts(callback: ProductListener): () => void {
    productListeners.add(callback);
    callback(this.getLocalProducts());

    try {
      const unsub = getMasterDocRef()
        .collection('products')
        .onSnapshot(
          snapshot => {
            if (!snapshot.empty) {
              const firestoreItems: ProductMaster[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              } as ProductMaster));
              this.saveLocalProducts(firestoreItems);
            }
          },
          err => {
            console.warn('Firestore products subscription offline, using local storage:', err);
          }
        );
      return () => {
        productListeners.delete(callback);
        unsub();
      };
    } catch (e) {
      return () => productListeners.delete(callback);
    }
  },

  async createProduct(productData: Omit<ProductMaster, 'id' | 'createdAt' | 'updatedAt'>, user: string, reason: string = 'Initial product creation'): Promise<ProductMaster> {
    const newId = productData.internalProductCode || `PRD-${String(Date.now()).slice(-4)}`;
    const now = new Date().toISOString();

    const newProduct: ProductMaster = {
      ...productData,
      id: newId,
      internalProductCode: newId,
      qrCode: newId,
      status: productData.status || 'Active',
      createdAt: now,
      updatedAt: now,
      createdUser: user,
      updatedUser: user
    };

    const currentList = this.getLocalProducts();
    const updatedList = [newProduct, ...currentList.filter(p => p.id !== newId)];
    this.saveLocalProducts(updatedList);

    await this.logMasterAction({
      entityType: 'Product',
      entityId: newProduct.id,
      entityName: newProduct.productName,
      action: 'Created',
      user,
      reason
    });

    try {
      await getMasterDocRef().collection('products').doc(newId).set(newProduct);
    } catch (e) {
      console.warn('Firestore product create failed, saved locally:', e);
    }

    // Keep live inventory in sync
    this.syncProductToInventory(newProduct, user);

    return newProduct;
  },

  async updateProduct(id: string, updates: Partial<ProductMaster>, user: string, reason: string = 'Master product updated'): Promise<ProductMaster> {
    const currentList = this.getLocalProducts();
    const existingIndex = currentList.findIndex(p => p.id === id);
    if (existingIndex === -1) {
      throw new Error(`Product with ID ${id} not found in Product Master`);
    }

    const oldProduct = currentList[existingIndex];
    const updatedProduct: ProductMaster = {
      ...oldProduct,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedUser: user
    };

    currentList[existingIndex] = updatedProduct;
    this.saveLocalProducts([...currentList]);

    await this.logMasterAction({
      entityType: 'Product',
      entityId: updatedProduct.id,
      entityName: updatedProduct.productName,
      action: 'Updated',
      user,
      reason,
      changes: {
        before: oldProduct,
        after: updatedProduct
      }
    });

    try {
      await getMasterDocRef().collection('products').doc(id).update(updatedProduct);
    } catch (e) {
      console.warn('Firestore product update failed, saved locally:', e);
    }

    this.syncProductToInventory(updatedProduct, user);

    return updatedProduct;
  },

  async archiveProduct(id: string, user: string, reason: string): Promise<void> {
    await this.updateProduct(id, { status: 'Archived' }, user, reason || 'Product archived');
  },

  async restoreProduct(id: string, user: string, reason: string): Promise<void> {
    await this.updateProduct(id, { status: 'Active' }, user, reason || 'Product restored from archive');
  },

  async deleteProduct(id: string, user: string): Promise<boolean> {
    const current = this.getLocalProducts();
    const prod = current.find(p => p.id === id);
    const filtered = current.filter(p => p.id !== id);
    this.saveLocalProducts(filtered);

    if (prod) {
      await this.logMasterAction({
        entityType: 'Product',
        entityId: id,
        entityName: prod.productName,
        action: 'Deleted',
        user,
        reason: 'Permanently deleted product'
      });
    }

    try {
      await getMasterDocRef().collection('products').doc(id).delete();
    } catch (e) {
      console.warn('Firestore product delete failed:', e);
    }
    return true;
  },

  async deleteSupplier(id: string, user: string): Promise<boolean> {
    const current = this.getLocalSuppliers();
    const supp = current.find(s => s.id === id);
    const filtered = current.filter(s => s.id !== id);
    this.saveLocalSuppliers(filtered);

    if (supp) {
      await this.logMasterAction({
        entityType: 'Supplier',
        entityId: id,
        entityName: supp.supplierName,
        action: 'Deleted',
        user,
        reason: 'Permanently deleted supplier'
      });
    }

    try {
      await getMasterDocRef().collection('suppliers').doc(id).delete();
    } catch (e) {
      console.warn('Firestore supplier delete failed:', e);
    }
    return true;
  },

  async deleteCategory(id: string, user: string): Promise<boolean> {
    const current = this.getLocalCategories();
    const cat = current.find(c => c.id === id);
    const filtered = current.filter(c => c.id !== id);
    this.saveLocalCategories(filtered);

    if (cat) {
      await this.logMasterAction({
        entityType: 'Category',
        entityId: id,
        entityName: cat.name,
        action: 'Deleted',
        user,
        reason: 'Permanently deleted category'
      });
    }

    try {
      await getMasterDocRef().collection('categories').doc(id).delete();
    } catch (e) {
      console.warn('Firestore category delete failed:', e);
    }
    return true;
  },

  async deleteWarehouseLocation(id: string, user: string): Promise<boolean> {
    const current = this.getLocalLocations();
    const loc = current.find(l => l.id === id);
    const filtered = current.filter(l => l.id !== id);
    this.saveLocalLocations(filtered);

    if (loc) {
      await this.logMasterAction({
        entityType: 'WarehouseLocation',
        entityId: id,
        entityName: loc.locationCode,
        action: 'Deleted',
        user,
        reason: 'Permanently deleted location'
      });
    }

    try {
      await getMasterDocRef().collection('warehouseLocations').doc(id).delete();
    } catch (e) {
      console.warn('Firestore location delete failed:', e);
    }
    return true;
  },

  async duplicateProduct(id: string, user: string): Promise<ProductMaster> {
    const currentList = this.getLocalProducts();
    const target = currentList.find(p => p.id === id);
    if (!target) throw new Error(`Product ${id} not found`);

    const newCode = `PRD-${String(Date.now()).slice(-4)}`;
    const copyData: Omit<ProductMaster, 'id' | 'createdAt' | 'updatedAt'> = {
      ...target,
      productName: `${target.productName} (Copy)`,
      internalProductCode: newCode,
      barcode: `${target.barcode || '600'}-COPY`,
      status: 'Active'
    };

    return await this.createProduct(copyData, user, `Duplicated from product ${target.internalProductCode}`);
  },

  // Ensure inventory item matches Product Master
  syncProductToInventory(product: ProductMaster, user: string) {
    try {
      const invItems = inventoryService.getLocalInventory();
      const existingInv = invItems.find(i => i.productId === product.id || i.id === product.id);

      if (existingInv) {
        existingInv.productName = product.productName;
        existingInv.supplier = product.supplier;
        existingInv.supplierPartNumber = product.supplierPartNumber;
        existingInv.location = product.location;
        existingInv.imageUrl = product.productImage || existingInv.imageUrl;
        existingInv.minimumQuantity = product.minimumStock;
        existingInv.maximumQuantity = product.maximumStock;
        existingInv.lastUpdated = new Date().toISOString();
        existingInv.lastUpdatedBy = user;
        inventoryService.saveLocalInventory(invItems);
      } else {
        invItems.push({
          id: product.id,
          productId: product.id,
          productName: product.productName,
          supplier: product.supplier,
          supplierPartNumber: product.supplierPartNumber,
          location: product.location,
          imageUrl: product.productImage,
          currentQuantity: product.currentStock || product.minimumStock,
          minimumQuantity: product.minimumStock,
          maximumQuantity: product.maximumStock,
          lastUpdated: new Date().toISOString(),
          lastUpdatedBy: user
        });
        inventoryService.saveLocalInventory(invItems);
      }
    } catch (e) {
      console.error('Failed to sync Product Master to Inventory:', e);
    }
  },

  // Category CRUD
  subscribeCategories(callback: CategoryListener): () => void {
    categoryListeners.add(callback);
    callback(this.getLocalCategories());

    try {
      const unsub = getMasterDocRef()
        .collection('categories')
        .onSnapshot(
          snapshot => {
            if (!snapshot.empty) {
              const items: ProductCategory[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              } as ProductCategory));
              this.saveLocalCategories(items);
            }
          },
          err => console.warn('Categories subscription offline:', err)
        );
      return () => {
        categoryListeners.delete(callback);
        unsub();
      };
    } catch (e) {
      return () => categoryListeners.delete(callback);
    }
  },

  async createCategory(name: string, code: string, description: string, user: string): Promise<ProductCategory> {
    const newCat: ProductCategory = {
      id: `CAT-${Date.now()}`,
      name,
      code: code || name.toUpperCase().replace(/\s+/g, '_'),
      description,
      status: 'Active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const current = this.getLocalCategories();
    this.saveLocalCategories([newCat, ...current]);

    await this.logMasterAction({
      entityType: 'Category',
      entityId: newCat.id,
      entityName: newCat.name,
      action: 'Created',
      user,
      reason: 'Created new product category'
    });

    try {
      await getMasterDocRef().collection('categories').doc(newCat.id).set(newCat);
    } catch (e) {
      console.warn('Firestore category create failed:', e);
    }

    return newCat;
  },

  async updateCategory(id: string, updates: Partial<ProductCategory>, user: string): Promise<ProductCategory> {
    const current = this.getLocalCategories();
    const idx = current.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Category not found');

    const updated = {
      ...current[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    current[idx] = updated;
    this.saveLocalCategories([...current]);

    await this.logMasterAction({
      entityType: 'Category',
      entityId: updated.id,
      entityName: updated.name,
      action: updates.status === 'Archived' ? 'Archived' : 'Updated',
      user,
      reason: updates.status === 'Archived' ? 'Category archived' : 'Category updated'
    });

    try {
      await getMasterDocRef().collection('categories').doc(id).update(updated);
    } catch (e) {
      console.warn('Firestore category update failed:', e);
    }

    return updated;
  },

  // Supplier CRUD
  subscribeSuppliers(callback: SupplierListener): () => void {
    supplierListeners.add(callback);
    callback(this.getLocalSuppliers());

    try {
      const unsub = getMasterDocRef()
        .collection('suppliers')
        .onSnapshot(
          snapshot => {
            if (!snapshot.empty) {
              const items: Supplier[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              } as Supplier));
              this.saveLocalSuppliers(items);
            }
          },
          err => console.warn('Suppliers subscription offline:', err)
        );
      return () => {
        supplierListeners.delete(callback);
        unsub();
      };
    } catch (e) {
      return () => supplierListeners.delete(callback);
    }
  },

  async createSupplier(data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>, user: string): Promise<Supplier> {
    const newSupp: Supplier = {
      ...data,
      id: `SUP-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const current = this.getLocalSuppliers();
    this.saveLocalSuppliers([newSupp, ...current]);

    await this.logMasterAction({
      entityType: 'Supplier',
      entityId: newSupp.id,
      entityName: newSupp.supplierName,
      action: 'Created',
      user,
      reason: 'Created new supplier'
    });

    try {
      await getMasterDocRef().collection('suppliers').doc(newSupp.id).set(newSupp);
    } catch (e) {
      console.warn('Firestore supplier create failed:', e);
    }

    return newSupp;
  },

  async updateSupplier(id: string, updates: Partial<Supplier>, user: string): Promise<Supplier> {
    const current = this.getLocalSuppliers();
    const idx = current.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Supplier not found');

    const updated = {
      ...current[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    current[idx] = updated;
    this.saveLocalSuppliers([...current]);

    await this.logMasterAction({
      entityType: 'Supplier',
      entityId: updated.id,
      entityName: updated.supplierName,
      action: updates.status === 'Archived' ? 'Archived' : 'Updated',
      user,
      reason: updates.status === 'Archived' ? 'Supplier archived' : 'Supplier updated'
    });

    try {
      await getMasterDocRef().collection('suppliers').doc(id).update(updated);
    } catch (e) {
      console.warn('Firestore supplier update failed:', e);
    }

    return updated;
  },

  // Location CRUD
  subscribeLocations(callback: LocationListener): () => void {
    locationListeners.add(callback);
    callback(this.getLocalLocations());

    try {
      const unsub = getMasterDocRef()
        .collection('warehouseLocations')
        .onSnapshot(
          snapshot => {
            if (!snapshot.empty) {
              const items: WarehouseLocation[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              } as WarehouseLocation));
              this.saveLocalLocations(items);
            }
          },
          err => console.warn('Locations subscription offline:', err)
        );
      return () => {
        locationListeners.delete(callback);
        unsub();
      };
    } catch (e) {
      return () => locationListeners.delete(callback);
    }
  },

  async createWarehouseLocation(aisle: string, rack: string, shelf: string, bin: string, colour: string, description: string, user: string): Promise<WarehouseLocation> {
    const formattedCode = `${aisle.toUpperCase()}-${rack.padStart(2, '0')}-${shelf.toUpperCase()}-${bin.padStart(2, '0')}`;
    const newLoc: WarehouseLocation = {
      id: `LOC-${Date.now()}`,
      aisle: aisle.toUpperCase(),
      rack: rack.padStart(2, '0'),
      shelf: shelf.toUpperCase(),
      bin: bin.padStart(2, '0'),
      locationCode: formattedCode,
      colour: colour || 'GREEN',
      description,
      status: 'Active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const current = this.getLocalLocations();
    this.saveLocalLocations([newLoc, ...current]);

    await this.logMasterAction({
      entityType: 'WarehouseLocation',
      entityId: newLoc.id,
      entityName: newLoc.locationCode,
      action: 'Created',
      user,
      reason: 'Created warehouse location'
    });

    try {
      await getMasterDocRef().collection('warehouseLocations').doc(newLoc.id).set(newLoc);
    } catch (e) {
      console.warn('Firestore location create failed:', e);
    }

    return newLoc;
  },

  async updateWarehouseLocation(id: string, updates: Partial<WarehouseLocation>, user: string): Promise<WarehouseLocation> {
    const current = this.getLocalLocations();
    const idx = current.findIndex(l => l.id === id);
    if (idx === -1) throw new Error('Location not found');

    const oldLoc = current[idx];
    const aisle = (updates.aisle || oldLoc.aisle).toUpperCase();
    const rack = (updates.rack || oldLoc.rack).padStart(2, '0');
    const shelf = (updates.shelf || oldLoc.shelf).toUpperCase();
    const bin = (updates.bin || oldLoc.bin).padStart(2, '0');
    const locationCode = `${aisle}-${rack}-${shelf}-${bin}`;

    const updated = {
      ...oldLoc,
      ...updates,
      locationCode,
      updatedAt: new Date().toISOString()
    };

    current[idx] = updated;
    this.saveLocalLocations([...current]);

    await this.logMasterAction({
      entityType: 'WarehouseLocation',
      entityId: updated.id,
      entityName: updated.locationCode,
      action: updates.status === 'Archived' ? 'Archived' : 'Updated',
      user,
      reason: updates.status === 'Archived' ? 'Location archived' : 'Location updated'
    });

    try {
      await getMasterDocRef().collection('warehouseLocations').doc(id).update(updated);
    } catch (e) {
      console.warn('Firestore location update failed:', e);
    }

    return updated;
  },

  // Audit Logs subscription
  subscribeAuditLogs(callback: AuditListener): () => void {
    auditListeners.add(callback);
    callback(this.getLocalAudits());

    try {
      const unsub = getMasterDocRef()
        .collection('masterAuditLogs')
        .orderBy('timestamp', 'desc')
        .onSnapshot(
          snapshot => {
            if (!snapshot.empty) {
              const items: MasterAuditLog[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              } as MasterAuditLog));
              this.saveLocalAudits(items);
            }
          },
          err => console.warn('Audit logs subscription offline:', err)
        );
      return () => {
        auditListeners.delete(callback);
        unsub();
      };
    } catch (e) {
      return () => auditListeners.delete(callback);
    }
  },

  // Global search lookup across Product Master, Inventory, and Suppliers
  lookupProductByIdOrCode(query: string): ProductMaster | null {
    if (!query) return null;
    const q = query.trim().toLowerCase();
    const products = this.getLocalProducts();

    // Exact or partial ID, barcode, or internal code match
    return products.find(p => 
      p.id.toLowerCase() === q ||
      p.internalProductCode.toLowerCase() === q ||
      p.barcode?.toLowerCase() === q ||
      p.qrCode?.toLowerCase() === q ||
      p.productName.toLowerCase().includes(q) ||
      p.supplierPartNumber.toLowerCase() === q
    ) || null;
  },

  getProducts(): ProductMaster[] {
    return this.getLocalProducts();
  },

  getSuppliers(): Supplier[] {
    return this.getLocalSuppliers();
  }
};
