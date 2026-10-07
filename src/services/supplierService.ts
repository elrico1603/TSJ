import { db, APP_ID_PATH } from '../firebase';
import { Supplier, MasterAuditLog } from '../types';
import { canMutateSupplier } from './previewSafety';

export const AUTHORITATIVE_STORAGE_KEY = 'ts_hub_master_suppliers';
export const LEGACY_STORAGE_KEY = 'tsj_suppliers_master_v1';
const STORAGE_AUDIT_KEY = 'tsj_master_audit_v1';

export const DEFAULT_PO_MESSAGE = `Good day,

Please find attached our Purchase Order.

Kindly confirm receipt of the order and advise if there are any queries.

Kind regards,
TS Joinery Procurement`;

// Initial Authoritative Sample Suppliers
export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'SUP-001',
    supplierId: 'SUP-001',
    supplierName: 'Sondor Wood & Boards',
    supplierCode: 'SONDOR',
    contactPerson: 'David Miller',
    telephone: '+27 21 555 0192',
    mobile: '+27 82 555 0192',
    email: 'orders@sondorwood.co.za',
    poEmail: 'orders@sondorwood.co.za',
    poCcEmails: ['accounts@sondorwood.co.za'],
    defaultPOMessage: DEFAULT_PO_MESSAGE,
    physicalAddress: '12 Timber Way, Paarden Eiland, Cape Town',
    postalAddress: 'P.O. Box 112, Paarden Eiland, 7420',
    vatNumber: '4820194821',
    registrationNumber: '2015/019284/07',
    leadTimeDays: 3,
    preferredSupplier: true,
    status: 'Active',
    createdAt: '2026-01-15T08:00:00.000Z',
    updatedAt: '2026-01-15T08:00:00.000Z',
    createdByUserId: 'usr-admin-elrico'
  },
  {
    id: 'SUP-002',
    supplierId: 'SUP-002',
    supplierName: 'Fasteners SA',
    supplierCode: 'FASTENERS',
    contactPerson: 'Sarah Jenkins',
    telephone: '+27 21 555 8821',
    mobile: '+27 83 555 8821',
    email: 'sales@fastenerssa.co.za',
    poEmail: 'sales@fastenerssa.co.za',
    poCcEmails: ['dispatch@fastenerssa.co.za'],
    defaultPOMessage: DEFAULT_PO_MESSAGE,
    physicalAddress: '45 Industrial Crescent, Epping, Cape Town',
    postalAddress: 'P.O. Box 881, Epping, 7475',
    vatNumber: '4190283719',
    registrationNumber: '2016/482019/07',
    leadTimeDays: 2,
    preferredSupplier: true,
    status: 'Active',
    createdAt: '2026-01-15T08:00:00.000Z',
    updatedAt: '2026-01-15T08:00:00.000Z',
    createdByUserId: 'usr-admin-elrico'
  },
  {
    id: 'SUP-003',
    supplierId: 'SUP-003',
    supplierName: 'Blum Hardware',
    supplierCode: 'BLUM',
    contactPerson: 'Johan van der Merwe',
    telephone: '+27 11 444 3300',
    mobile: '+27 84 444 3300',
    email: 'support@blumhardware.co.za',
    poEmail: 'orders@blumhardware.co.za',
    poCcEmails: ['sales@blumhardware.co.za'],
    defaultPOMessage: DEFAULT_PO_MESSAGE,
    physicalAddress: '88 Joinery Park, Midrand, Johannesburg',
    postalAddress: 'P.O. Box 334, Midrand, 1685',
    vatNumber: '4390192840',
    registrationNumber: '2012/849201/07',
    leadTimeDays: 5,
    preferredSupplier: true,
    status: 'Active',
    createdAt: '2026-01-15T08:00:00.000Z',
    updatedAt: '2026-01-15T08:00:00.000Z',
    createdByUserId: 'usr-admin-elrico'
  }
];

export type SupplierListener = (suppliers: Supplier[]) => void;
const supplierListeners = new Set<SupplierListener>();

// Helper to get Firestore root reference
function getMasterDocRef() {
  return db
    .collection('artifacts')
    .doc(APP_ID_PATH)
    .collection('public')
    .doc('data');
}

// Dedicated audit log helper
async function logSupplierAudit(log: Omit<MasterAuditLog, 'id' | 'timestamp'>): Promise<void> {
  const fullLog: MasterAuditLog = {
    ...log,
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString()
  };

  try {
    const stored = localStorage.getItem(STORAGE_AUDIT_KEY);
    const audits: MasterAuditLog[] = stored ? JSON.parse(stored) : [];
    localStorage.setItem(STORAGE_AUDIT_KEY, JSON.stringify([fullLog, ...audits]));
  } catch (e) {
    console.error('Failed to log supplier audit locally:', e);
  }

  try {
    await getMasterDocRef().collection('masterAuditLogs').doc(fullLog.id).set(fullLog);
  } catch (e) {
    console.warn('Firestore master audit write skipped:', e);
  }
}

/**
 * Authoritative Supplier Service & Facade
 * 
 * Provides single source of truth for all Supplier Master operations.
 * Synchronizes with `ts_hub_master_suppliers` and backward-compatible legacy storage.
 */
export const supplierService = {
  /**
   * Get all cached suppliers from single authoritative local storage
   */
  getLocalSuppliers(): Supplier[] {
    try {
      const authoritative = localStorage.getItem(AUTHORITATIVE_STORAGE_KEY);
      if (authoritative) {
        const parsed = JSON.parse(authoritative);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localStorage.setItem(AUTHORITATIVE_STORAGE_KEY, legacy);
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse local suppliers:', e);
    }
    this.saveLocalSuppliers(INITIAL_SUPPLIERS);
    return INITIAL_SUPPLIERS;
  },

  /**
   * Save suppliers to authoritative storage and notify all active listeners
   */
  saveLocalSuppliers(items: Supplier[]): void {
    try {
      const serialized = JSON.stringify(items);
      localStorage.setItem(AUTHORITATIVE_STORAGE_KEY, serialized);
      localStorage.setItem(LEGACY_STORAGE_KEY, serialized);
      supplierListeners.forEach(cb => cb(items));
    } catch (e) {
      console.error('Failed to save local suppliers:', e);
    }
  },

  /**
   * Synchronous query for all suppliers
   */
  getSuppliers(): Supplier[] {
    return this.getLocalSuppliers();
  },

  /**
   * Find a supplier by its canonical immutable ID
   */
  getSupplierById(id: string): Supplier | undefined {
    return this.getLocalSuppliers().find(s => s.id === id || s.supplierId === id);
  },

  /**
   * Subscribe to reactive supplier updates
   */
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

  /**
   * Create a new supplier with duplicate protection and canonical ID assignment
   */
  async createSupplier(
    data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>,
    user: string
  ): Promise<Supplier> {
    const current = this.getLocalSuppliers();
    const cleanName = data.supplierName?.trim() || '';
    const cleanCode = data.supplierCode?.trim().toUpperCase() || '';

    // Duplicate check: Supplier Code
    if (cleanCode) {
      const dupCode = current.find(s => s.supplierCode?.trim().toUpperCase() === cleanCode);
      if (dupCode) {
        throw new Error(`Supplier Code "${cleanCode}" is already in use by "${dupCode.supplierName}" (${dupCode.id}).`);
      }
    }

    // Duplicate check: Supplier Name
    if (cleanName) {
      const dupName = current.find(s => s.supplierName?.trim().toLowerCase() === cleanName.toLowerCase());
      if (dupName) {
        throw new Error(`A supplier with the name "${cleanName}" already exists (${dupName.id}).`);
      }
    }

    const canonicalId = (data as any).id || (data as any).supplierId || `SUP-${String(Date.now()).slice(-6)}`;
    
    // Clean and validate CC emails array
    const cleanCcEmails = Array.isArray(data.poCcEmails) 
      ? data.poCcEmails.map(e => e.trim()).filter(Boolean)
      : [];

    const newSupp: Supplier = {
      ...data,
      id: canonicalId,
      supplierId: canonicalId, // Canonical relational alias
      supplierName: cleanName,
      supplierCode: cleanCode,
      contactPerson: data.contactPerson?.trim() || '',
      telephone: data.telephone?.trim() || '',
      mobile: data.mobile?.trim() || '',
      email: data.email?.trim() || '',
      // Dedicated PO Email: if blank, it stays blank. Do NOT auto-copy general email.
      poEmail: data.poEmail !== undefined ? data.poEmail.trim() : '',
      poCcEmails: cleanCcEmails,
      defaultPOMessage: data.defaultPOMessage !== undefined ? data.defaultPOMessage : DEFAULT_PO_MESSAGE,
      physicalAddress: data.physicalAddress?.trim() || '',
      postalAddress: data.postalAddress?.trim() || '',
      vatNumber: data.vatNumber?.trim() || '',
      registrationNumber: data.registrationNumber?.trim() || '',
      leadTimeDays: typeof data.leadTimeDays === 'number' && data.leadTimeDays > 0 ? data.leadTimeDays : 3,
      preferredSupplier: Boolean(data.preferredSupplier),
      status: data.status || 'Active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByUserId: user,
      updatedByUserId: user
    };

    this.saveLocalSuppliers([newSupp, ...current]);

    await logSupplierAudit({
      entityType: 'Supplier',
      entityId: newSupp.id,
      entityName: newSupp.supplierName,
      action: 'Created',
      user,
      reason: 'Created new supplier'
    });

    if (canMutateSupplier('createSupplier', newSupp.id)) {
      try {
        await getMasterDocRef().collection('suppliers').doc(newSupp.id).set(newSupp);
      } catch (e) {
        console.warn('Firestore supplier create failed:', e);
      }
    }

    return newSupp;
  },

  /**
   * Update an existing supplier.
   * CRITICAL: Canonical ID (Supplier.id) is immutable and NEVER changed.
   */
  async updateSupplier(
    id: string,
    updates: Partial<Supplier>,
    user: string
  ): Promise<Supplier> {
    const current = this.getLocalSuppliers();
    const idx = current.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Supplier not found');

    const existing = current[idx];
    const cleanName = updates.supplierName !== undefined ? updates.supplierName.trim() : existing.supplierName;
    const cleanCode = updates.supplierCode !== undefined ? updates.supplierCode.trim().toUpperCase() : existing.supplierCode;

    // Duplicate check: Supplier Code against OTHER suppliers
    if (cleanCode && updates.supplierCode !== undefined) {
      const dupCode = current.find(s => s.id !== id && s.supplierCode?.trim().toUpperCase() === cleanCode);
      if (dupCode) {
        throw new Error(`Supplier Code "${cleanCode}" is already in use by "${dupCode.supplierName}" (${dupCode.id}).`);
      }
    }

    // Duplicate check: Supplier Name against OTHER suppliers
    if (cleanName && updates.supplierName !== undefined) {
      const dupName = current.find(s => s.id !== id && s.supplierName?.trim().toLowerCase() === cleanName.toLowerCase());
      if (dupName) {
        throw new Error(`A supplier with the name "${cleanName}" already exists (${dupName.id}).`);
      }
    }

    // Clean CC emails if provided
    const cleanCcEmails = Array.isArray(updates.poCcEmails)
      ? updates.poCcEmails.map(e => e.trim()).filter(Boolean)
      : (existing.poCcEmails || []);

    const updated: Supplier = {
      ...existing,
      ...updates,
      // Immutable canonical ID preserved
      id: existing.id,
      supplierId: existing.id,
      supplierName: cleanName,
      supplierCode: cleanCode,
      contactPerson: updates.contactPerson !== undefined ? updates.contactPerson.trim() : existing.contactPerson,
      telephone: updates.telephone !== undefined ? updates.telephone.trim() : existing.telephone,
      mobile: updates.mobile !== undefined ? updates.mobile.trim() : (existing.mobile || ''),
      email: updates.email !== undefined ? updates.email.trim() : existing.email,
      // Dedicated PO Email: preserve or update (allowed to be empty)
      poEmail: updates.poEmail !== undefined ? updates.poEmail.trim() : (existing.poEmail || ''),
      poCcEmails: cleanCcEmails,
      defaultPOMessage: updates.defaultPOMessage !== undefined ? updates.defaultPOMessage : (existing.defaultPOMessage || DEFAULT_PO_MESSAGE),
      physicalAddress: updates.physicalAddress !== undefined ? updates.physicalAddress.trim() : existing.physicalAddress,
      postalAddress: updates.postalAddress !== undefined ? updates.postalAddress.trim() : (existing.postalAddress || ''),
      vatNumber: updates.vatNumber !== undefined ? updates.vatNumber.trim() : (existing.vatNumber || ''),
      registrationNumber: updates.registrationNumber !== undefined ? updates.registrationNumber.trim() : (existing.registrationNumber || ''),
      leadTimeDays: typeof updates.leadTimeDays === 'number' && updates.leadTimeDays > 0 ? updates.leadTimeDays : existing.leadTimeDays,
      preferredSupplier: updates.preferredSupplier !== undefined ? Boolean(updates.preferredSupplier) : existing.preferredSupplier,
      status: updates.status || existing.status || 'Active',
      updatedAt: new Date().toISOString(),
      updatedByUserId: user
    };

    current[idx] = updated;
    this.saveLocalSuppliers([...current]);

    const isArchived = updates.status === 'Archived';
    const isInactive = updates.status === 'Inactive';
    const actionLabel: MasterAuditLog['action'] = isArchived ? 'Archived' : 'Updated';
    const reasonLabel = isArchived ? 'Supplier archived' : (isInactive ? 'Supplier deactivated' : 'Supplier updated');

    await logSupplierAudit({
      entityType: 'Supplier',
      entityId: updated.id,
      entityName: updated.supplierName,
      action: actionLabel,
      user,
      reason: reasonLabel
    });

    if (canMutateSupplier('updateSupplier', id)) {
      try {
        await getMasterDocRef().collection('suppliers').doc(id).update(updated);
      } catch (e) {
        console.warn('Firestore supplier update failed:', e);
      }
    }

    return updated;
  },

  /**
   * Delete a supplier
   */
  async deleteSupplier(id: string, user: string): Promise<boolean> {
    const current = this.getLocalSuppliers();
    const supp = current.find(s => s.id === id);
    const filtered = current.filter(s => s.id !== id);
    this.saveLocalSuppliers(filtered);

    if (supp) {
      await logSupplierAudit({
        entityType: 'Supplier',
        entityId: id,
        entityName: supp.supplierName,
        action: 'Soft Deleted',
        user,
        reason: 'Permanently deleted supplier'
      });
    }

    if (canMutateSupplier('deleteSupplier', id)) {
      try {
        await getMasterDocRef().collection('suppliers').doc(id).delete();
      } catch (e) {
        console.warn('Firestore supplier delete failed:', e);
      }
    }
    return true;
  },

  /**
   * Search suppliers across name, code, contact person, emails, and phone
   */
  searchSuppliers(query: string): Supplier[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.getLocalSuppliers();

    return this.getLocalSuppliers().filter(s => {
      return (
        s.supplierName?.toLowerCase().includes(q) ||
        s.supplierCode?.toLowerCase().includes(q) ||
        s.contactPerson?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.poEmail?.toLowerCase().includes(q) ||
        s.telephone?.toLowerCase().includes(q) ||
        s.vatNumber?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q)
      );
    });
  }
};
