import React, { useState, useEffect } from 'react';
import { Supplier } from '../types';
import { Icon } from './Icon';
import { supplierService, DEFAULT_PO_MESSAGE } from '../services/supplierService';

interface SupplierFormModalProps {
  supplier?: Supplier | null;
  currentUser?: any;
  onClose: () => void;
  onSave: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  supplier,
  currentUser,
  onClose,
  onSave
}) => {
  const isEdit = Boolean(supplier);

  const [formData, setFormData] = useState({
    supplierName: '',
    supplierCode: '',
    contactPerson: '',
    telephone: '',
    mobile: '',
    email: '',
    poEmail: '',
    poCcEmails: [] as string[],
    defaultPOMessage: DEFAULT_PO_MESSAGE,
    vatNumber: '',
    registrationNumber: '',
    physicalAddress: '',
    postalAddress: '',
    leadTimeDays: 3,
    preferredSupplier: true,
    status: 'Active' as 'Active' | 'Inactive' | 'Archived'
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (supplier) {
      setFormData({
        supplierName: supplier.supplierName || '',
        supplierCode: supplier.supplierCode || '',
        contactPerson: supplier.contactPerson || '',
        telephone: supplier.telephone || '',
        mobile: supplier.mobile || '',
        email: supplier.email || '',
        poEmail: supplier.poEmail || '',
        poCcEmails: Array.isArray(supplier.poCcEmails) ? [...supplier.poCcEmails] : [],
        defaultPOMessage: supplier.defaultPOMessage !== undefined ? supplier.defaultPOMessage : DEFAULT_PO_MESSAGE,
        vatNumber: supplier.vatNumber || '',
        registrationNumber: supplier.registrationNumber || '',
        physicalAddress: supplier.physicalAddress || '',
        postalAddress: supplier.postalAddress || '',
        leadTimeDays: supplier.leadTimeDays || 3,
        preferredSupplier: Boolean(supplier.preferredSupplier),
        status: supplier.status || 'Active'
      });
    } else {
      setFormData(prev => ({
        ...prev,
        supplierCode: `SUP-${String(Date.now()).slice(-3)}`,
        defaultPOMessage: DEFAULT_PO_MESSAGE,
        poCcEmails: []
      }));
    }
  }, [supplier]);

  // CC Email management
  const handleAddCcEmail = () => {
    setFormData(prev => ({
      ...prev,
      poCcEmails: [...prev.poCcEmails, '']
    }));
  };

  const handleUpdateCcEmail = (index: number, value: string) => {
    setFormData(prev => {
      const updated = [...prev.poCcEmails];
      updated[index] = value;
      return { ...prev, poCcEmails: updated };
    });
  };

  const handleRemoveCcEmail = (index: number) => {
    setFormData(prev => ({
      ...prev,
      poCcEmails: prev.poCcEmails.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate Supplier Name
    if (!formData.supplierName.trim()) {
      setError('Supplier Name is required.');
      return;
    }

    // Validate General Email format if provided
    if (formData.email.trim() && !EMAIL_REGEX.test(formData.email.trim())) {
      setError(`Invalid General Email address format: "${formData.email.trim()}"`);
      return;
    }

    // Validate PO Email format if provided
    if (formData.poEmail.trim() && !EMAIL_REGEX.test(formData.poEmail.trim())) {
      setError(`Invalid Purchase Order Email address format: "${formData.poEmail.trim()}"`);
      return;
    }

    // Validate each CC Email in array
    for (let i = 0; i < formData.poCcEmails.length; i++) {
      const cc = formData.poCcEmails[i].trim();
      if (cc && !EMAIL_REGEX.test(cc)) {
        setError(`Invalid CC Email address format on row ${i + 1}: "${cc}"`);
        return;
      }
    }

    // Filter out blank CC lines
    const cleanCcList = formData.poCcEmails.map(c => c.trim()).filter(Boolean);

    setIsSubmitting(true);
    const username = currentUser?.name || currentUser?.email || 'Admin User';

    const payload = {
      ...formData,
      supplierName: formData.supplierName.trim(),
      supplierCode: formData.supplierCode.trim().toUpperCase(),
      contactPerson: formData.contactPerson.trim(),
      telephone: formData.telephone.trim(),
      mobile: formData.mobile.trim(),
      email: formData.email.trim(),
      poEmail: formData.poEmail.trim(), // Dedicated field, allowed to remain blank
      poCcEmails: cleanCcList,
      defaultPOMessage: formData.defaultPOMessage,
      vatNumber: formData.vatNumber.trim(),
      registrationNumber: formData.registrationNumber.trim(),
      physicalAddress: formData.physicalAddress.trim(),
      postalAddress: formData.postalAddress.trim(),
      leadTimeDays: Math.max(1, Number(formData.leadTimeDays) || 1),
      preferredSupplier: Boolean(formData.preferredSupplier),
      status: formData.status
    };

    try {
      if (isEdit && supplier) {
        // supplier.id is canonical and immutable
        await supplierService.updateSupplier(supplier.id, payload, username);
      } else {
        await supplierService.createSupplier(payload, username);
      }
      onSave();
    } catch (err: any) {
      setError(err?.message || 'Failed to save supplier.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-[#151515] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="p-5 bg-[#1f1f1f] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#ff8c00]/10 border border-[#ff8c00]/30 flex items-center justify-center text-[#ff8c00]">
              <Icon name="truck" size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">
                {isEdit ? 'Edit Supplier Record' : 'Add New Supplier'}
              </h2>
              {isEdit && supplier && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                    ID: {supplier.id}
                  </span>
                  <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">
                    (Canonical Immutable)
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold flex items-center gap-2">
              <Icon name="alert-triangle" size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* SECTION 1: IDENTITY & CONTACT */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#ff8c00] border-b border-white/10 pb-1.5 flex items-center gap-2">
              <Icon name="user" size={14} />
              <span>Identity & Contact Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                  Supplier Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.supplierName}
                  onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
                  placeholder="e.g. Sondor Wood & Boards"
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff8c00]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Supplier Code</label>
                <input
                  type="text"
                  value={formData.supplierCode}
                  onChange={e => setFormData({ ...formData, supplierCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. SONDOR"
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#ff8c00]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Contact Person</label>
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                  placeholder="e.g. David Miller"
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Telephone</label>
                <input
                  type="text"
                  value={formData.telephone}
                  onChange={e => setFormData({ ...formData, telephone: e.target.value })}
                  placeholder="+27 21 555 0192"
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Mobile / Cellphone</label>
                <input
                  type="text"
                  value={formData.mobile}
                  onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                  placeholder="+27 82 555 0192"
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">General Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="info@supplier.co.za"
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Lead Time (Days)</label>
                <input
                  type="number"
                  min={1}
                  value={formData.leadTimeDays}
                  onChange={e => setFormData({ ...formData, leadTimeDays: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-emerald-400 font-bold focus:outline-none focus:border-[#ff8c00]"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: PURCHASE ORDER COMMUNICATION */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-purple-400 border-b border-white/10 pb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="mail" size={14} />
                <span>Purchase Order Email & Communication</span>
              </div>
              <span className="text-[10px] text-gray-500 font-normal lowercase">po dedicated routing</span>
            </h3>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                Dedicated PO Email
              </label>
              <input
                type="email"
                value={formData.poEmail}
                onChange={e => setFormData({ ...formData, poEmail: e.target.value })}
                placeholder="orders@supplier.co.za (Leave blank if not assigned)"
                className="w-full bg-[#111111] border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-purple-200 focus:outline-none focus:border-purple-400"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Primary recipient for Purchase Orders. If blank, no dedicated PO dispatch email is configured.
              </p>
            </div>

            {/* Dynamic CC Emails Array */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-gray-400 uppercase">
                  CC Email Recipients ({formData.poCcEmails.length})
                </label>
                <button
                  type="button"
                  onClick={handleAddCcEmail}
                  className="px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-purple-500/30 transition-all"
                >
                  <Icon name="plus" size={12} />
                  <span>Add CC Email</span>
                </button>
              </div>

              {formData.poCcEmails.length === 0 ? (
                <div className="p-3 bg-[#111111] border border-dashed border-white/10 rounded-xl text-center text-xs text-gray-500">
                  No CC email addresses configured. Click "Add CC Email" to add secondary recipients.
                </div>
              ) : (
                <div className="space-y-2">
                  {formData.poCcEmails.map((cc, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-gray-500 w-5 text-right">{idx + 1}.</span>
                      <input
                        type="email"
                        value={cc}
                        onChange={e => handleUpdateCcEmail(idx, e.target.value)}
                        placeholder="e.g. accounts@supplier.co.za or buyer@example.com"
                        className="flex-1 bg-[#111111] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCcEmail(idx)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Remove CC email"
                      >
                        <Icon name="trash-2" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Default PO Message */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-gray-400 uppercase">
                  Default Purchase Order Message
                </label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, defaultPOMessage: DEFAULT_PO_MESSAGE })}
                  className="text-[10px] text-gray-400 hover:text-[#ff8c00] transition-colors"
                >
                  Reset to Template
                </button>
              </div>
              <textarea
                value={formData.defaultPOMessage}
                onChange={e => setFormData({ ...formData, defaultPOMessage: e.target.value })}
                rows={4}
                placeholder="Enter standard greeting and PO instructions for this supplier..."
                className="w-full bg-[#111111] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#ff8c00] font-mono leading-relaxed"
              />
              <p className="text-[10px] text-gray-500 mt-0.5">
                Saved per-supplier message template (data only, not hardcoded).
              </p>
            </div>
          </div>

          {/* SECTION 3: BUSINESS INFORMATION */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 border-b border-white/10 pb-1.5 flex items-center gap-2">
              <Icon name="briefcase" size={14} />
              <span>Business Registration & Tax Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">VAT Number</label>
                <input
                  type="text"
                  value={formData.vatNumber}
                  onChange={e => setFormData({ ...formData, vatNumber: e.target.value })}
                  placeholder="e.g. 4820194821"
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Company Registration Number</label>
                <input
                  type="text"
                  value={formData.registrationNumber}
                  onChange={e => setFormData({ ...formData, registrationNumber: e.target.value })}
                  placeholder="e.g. 2015/019284/07"
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: ADDRESS DETAILS */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 border-b border-white/10 pb-1.5 flex items-center gap-2">
              <Icon name="map-pin" size={14} />
              <span>Address Details</span>
            </h3>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Physical Address</label>
              <textarea
                value={formData.physicalAddress}
                onChange={e => setFormData({ ...formData, physicalAddress: e.target.value })}
                placeholder="e.g. 12 Timber Way, Paarden Eiland, Cape Town"
                rows={2}
                className="w-full bg-[#111111] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Postal Address</label>
              <textarea
                value={formData.postalAddress}
                onChange={e => setFormData({ ...formData, postalAddress: e.target.value })}
                placeholder="e.g. P.O. Box 112, Paarden Eiland, 7420"
                rows={2}
                className="w-full bg-[#111111] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
              />
            </div>
          </div>

          {/* SECTION 5: PREFERRED STATUS */}
          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="prefSupp"
              checked={formData.preferredSupplier}
              onChange={e => setFormData({ ...formData, preferredSupplier: e.target.checked })}
              className="w-4 h-4 rounded accent-[#ff8c00]"
            />
            <label htmlFor="prefSupp" className="text-xs font-bold text-white cursor-pointer select-none">
              Mark as Preferred Supplier (Prioritized in automated stock replenishment)
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-white/10 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold uppercase transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Icon name="loader" size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEdit ? 'Save Changes' : 'Create Supplier'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
