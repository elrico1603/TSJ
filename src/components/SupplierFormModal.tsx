import React, { useState, useEffect } from 'react';
import { Supplier } from '../types';
import { Icon } from './Icon';
import { productMasterService } from '../services/productMasterService';

interface SupplierFormModalProps {
  supplier?: Supplier | null;
  currentUser?: any;
  onClose: () => void;
  onSave: () => void;
}

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
    email: '',
    physicalAddress: '',
    leadTimeDays: 3,
    preferredSupplier: true,
    status: 'Active' as 'Active' | 'Archived'
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (supplier) {
      setFormData({
        supplierName: supplier.supplierName,
        supplierCode: supplier.supplierCode,
        contactPerson: supplier.contactPerson,
        telephone: supplier.telephone,
        email: supplier.email,
        physicalAddress: supplier.physicalAddress,
        leadTimeDays: supplier.leadTimeDays,
        preferredSupplier: supplier.preferredSupplier,
        status: supplier.status || 'Active'
      });
    } else {
      setFormData(prev => ({
        ...prev,
        supplierCode: `SUP-${String(Date.now()).slice(-3)}`
      }));
    }
  }, [supplier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplierName.trim()) {
      setError('Supplier Name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const username = currentUser?.name || currentUser?.email || 'Admin User';

    try {
      if (isEdit && supplier) {
        await productMasterService.updateSupplier(supplier.id, formData, username);
      } else {
        await productMasterService.createSupplier(formData, username);
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
      <div className="bg-[#151515] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-8">
        <div className="p-5 bg-[#1f1f1f] border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Icon name="truck" size={18} className="text-[#ff8c00]" />
            <span>{isEdit ? 'Edit Supplier Record' : 'Add New Supplier'}</span>
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <Icon name="x" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Supplier Name *</label>
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
              <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="orders@supplier.co.za"
                className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Lead Time (Days)</label>
              <input
                type="number"
                min={1}
                value={formData.leadTimeDays}
                onChange={e => setFormData({ ...formData, leadTimeDays: Number(e.target.value) || 1 })}
                className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-emerald-400 font-bold focus:outline-none focus:border-[#ff8c00]"
              />
            </div>
          </div>

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

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="prefSupp"
              checked={formData.preferredSupplier}
              onChange={e => setFormData({ ...formData, preferredSupplier: e.target.checked })}
              className="w-4 h-4 rounded accent-[#ff8c00]"
            />
            <label htmlFor="prefSupp" className="text-xs font-bold text-white">
              Mark as Preferred Supplier
            </label>
          </div>

          <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
            >
              {isSubmitting ? 'Saving...' : 'Save Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
