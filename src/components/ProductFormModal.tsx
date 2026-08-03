import React, { useState, useEffect } from 'react';
import { ProductMaster, ProductCategory, Supplier, WarehouseLocation } from '../types';
import { Icon } from './Icon';
import { productMasterService } from '../services/productMasterService';

interface ProductFormModalProps {
  mode: 'create' | 'edit' | 'view' | 'duplicate';
  product?: ProductMaster | null;
  categories: ProductCategory[];
  suppliers: Supplier[];
  locations: WarehouseLocation[];
  currentUser?: any;
  onClose: () => void;
  onSave: () => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  mode,
  product,
  categories,
  suppliers,
  locations,
  currentUser,
  onClose,
  onSave
}) => {
  const isView = mode === 'view';
  const isEdit = mode === 'edit';
  const isDuplicate = mode === 'duplicate';

  const [formData, setFormData] = useState({
    productName: '',
    internalProductCode: '',
    productImage: '',
    categoryId: '',
    category: '',
    supplierId: '',
    supplier: '',
    supplierPartNumber: '',
    locationId: '',
    location: '',
    locationColour: 'GREEN',
    barcode: '',
    unit: 'ea',
    minimumStock: 10,
    maximumStock: 100,
    orderQuantity: 20,
    deliveryTime: '3 Days',
    cardColour: '#10b981',
    status: 'Active' as 'Active' | 'Archived'
  });

  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        productName: isDuplicate ? `${product.productName} (Copy)` : product.productName,
        internalProductCode: isDuplicate ? `PRD-${String(Date.now()).slice(-4)}` : product.internalProductCode,
        productImage: product.productImage || '',
        categoryId: product.categoryId || '',
        category: product.category || '',
        supplierId: product.supplierId || '',
        supplier: product.supplier || '',
        supplierPartNumber: product.supplierPartNumber || '',
        locationId: product.locationId || '',
        location: product.location || '',
        locationColour: product.locationColour || 'GREEN',
        barcode: isDuplicate ? `${product.barcode || ''}-COPY` : (product.barcode || ''),
        unit: product.unit || 'ea',
        minimumStock: product.minimumStock || 10,
        maximumStock: product.maximumStock || 100,
        orderQuantity: product.orderQuantity || 20,
        deliveryTime: product.deliveryTime || '3 Days',
        cardColour: product.cardColour || '#10b981',
        status: isDuplicate ? 'Active' : (product.status || 'Active')
      });
    } else {
      // Auto-generate a clean internal code for new creation
      const nextCode = `PRD-${String(Date.now()).slice(-4)}`;
      setFormData(prev => ({
        ...prev,
        internalProductCode: nextCode,
        barcode: `600${Math.floor(1000000000 + Math.random() * 9000000000)}`
      }));
    }
  }, [product, mode]);

  const handleCategoryChange = (catId: string) => {
    const selected = categories.find(c => c.id === catId);
    setFormData(prev => ({
      ...prev,
      categoryId: catId,
      category: selected ? selected.name : ''
    }));
  };

  const handleSupplierChange = (supId: string) => {
    const selected = suppliers.find(s => s.id === supId);
    setFormData(prev => ({
      ...prev,
      supplierId: supId,
      supplier: selected ? selected.supplierName : '',
      deliveryTime: selected ? `${selected.leadTimeDays} Days` : prev.deliveryTime
    }));
  };

  const handleLocationChange = (locId: string) => {
    const selected = locations.find(l => l.id === locId);
    setFormData(prev => ({
      ...prev,
      locationId: locId,
      location: selected ? selected.locationCode : prev.location,
      locationColour: selected?.colour || prev.locationColour
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isView) return;

    if (!formData.productName.trim()) {
      setError('Product Name is required.');
      return;
    }

    if (!formData.internalProductCode.trim()) {
      setError('Internal Product Code is required.');
      return;
    }

    if (isEdit && !reason.trim()) {
      setError('An audit reason is required when editing master records.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const username = currentUser?.name || currentUser?.email || 'Admin User';

    try {
      if (isEdit && product) {
        await productMasterService.updateProduct(
          product.id,
          {
            ...formData,
            currentStock: product.currentStock
          },
          username,
          reason
        );
      } else {
        await productMasterService.createProduct(
          formData,
          username,
          isDuplicate ? `Duplicated from ${product?.internalProductCode}` : 'New product created'
        );
      }
      onSave();
    } catch (err: any) {
      setError(err?.message || 'Failed to save product master record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-[#151515] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
        
        {/* Header */}
        <div className="p-6 bg-[#1f1f1f] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ff8c00]/10 border border-[#ff8c00]/30 flex items-center justify-center text-[#ff8c00]">
              <Icon name="package" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider">
                {isView && 'Product Master Details'}
                {isEdit && 'Edit Product Master Record'}
                {mode === 'create' && 'Create New Product Master'}
                {isDuplicate && 'Duplicate Product Master Record'}
              </h2>
              <p className="text-xs text-gray-400 font-medium">
                Single Source of Truth for TS Joinery Inventory & Operations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold flex items-center gap-2">
              <Icon name="alert-triangle" size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Core Identifiers */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#ff8c00] border-b border-white/10 pb-2">
              1. Core Identification
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  disabled={isView}
                  value={formData.productName}
                  onChange={e => setFormData({ ...formData, productName: e.target.value })}
                  placeholder="e.g. Oak Board 20mm (1220x2440)"
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff8c00] disabled:opacity-60"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                  Internal Product Code *
                </label>
                <input
                  type="text"
                  disabled={isView}
                  value={formData.internalProductCode}
                  onChange={e => setFormData({ ...formData, internalProductCode: e.target.value })}
                  placeholder="e.g. PRD-0001"
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono text-purple-400 font-bold focus:outline-none focus:border-[#ff8c00] disabled:opacity-60"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                  Product Image URL
                </label>
                <input
                  type="text"
                  disabled={isView}
                  value={formData.productImage}
                  onChange={e => setFormData({ ...formData, productImage: e.target.value })}
                  placeholder="https://... or image data URL"
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff8c00] disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                  Barcode / EAN
                </label>
                <input
                  type="text"
                  disabled={isView}
                  value={formData.barcode}
                  onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder="e.g. 6001234567890"
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#ff8c00] disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Supplier & Category */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#ff8c00] border-b border-white/10 pb-2">
              2. Supplier & Categorization
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                  Category
                </label>
                <select
                  disabled={isView}
                  value={formData.categoryId}
                  onChange={e => handleCategoryChange(e.target.value)}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff8c00] disabled:opacity-60"
                >
                  <option value="">Select Category...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                  Supplier
                </label>
                <select
                  disabled={isView}
                  value={formData.supplierId}
                  onChange={e => handleSupplierChange(e.target.value)}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff8c00] disabled:opacity-60"
                >
                  <option value="">Select Supplier...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.supplierName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                  Supplier Part Number
                </label>
                <input
                  type="text"
                  disabled={isView}
                  value={formData.supplierPartNumber}
                  onChange={e => setFormData({ ...formData, supplierPartNumber: e.target.value })}
                  placeholder="e.g. OAK-20-A"
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff8c00] disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Warehouse & Stock Parameters */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#ff8c00] border-b border-white/10 pb-2">
              3. Location & Stock Control Parameters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                  Warehouse Location
                </label>
                <select
                  disabled={isView}
                  value={formData.locationId}
                  onChange={e => handleLocationChange(e.target.value)}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff8c00] disabled:opacity-60"
                >
                  <option value="">Select Location...</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.locationCode} ({l.colour})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                  Unit of Measure
                </label>
                <select
                  disabled={isView}
                  value={formData.unit}
                  onChange={e => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff8c00] disabled:opacity-60"
                >
                  <option value="ea">Each (ea)</option>
                  <option value="box">Box (box)</option>
                  <option value="pack">Pack (pack)</option>
                  <option value="pair">Pair (pair)</option>
                  <option value="m2">Square Meter (m2)</option>
                  <option value="m">Meter (m)</option>
                  <option value="kg">Kilogram (kg)</option>
                  <option value="litres">Litres (L)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                  Order Quantity (Batch)
                </label>
                <input
                  type="number"
                  disabled={isView}
                  min={1}
                  value={formData.orderQuantity}
                  onChange={e => setFormData({ ...formData, orderQuantity: Number(e.target.value) || 1 })}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff8c00] disabled:opacity-60"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                  Minimum Stock Level
                </label>
                <input
                  type="number"
                  disabled={isView}
                  min={0}
                  value={formData.minimumStock}
                  onChange={e => setFormData({ ...formData, minimumStock: Number(e.target.value) || 0 })}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-amber-400 font-bold focus:outline-none focus:border-[#ff8c00] disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                  Maximum Stock Level
                </label>
                <input
                  type="number"
                  disabled={isView}
                  min={1}
                  value={formData.maximumStock}
                  onChange={e => setFormData({ ...formData, maximumStock: Number(e.target.value) || 1 })}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-emerald-400 font-bold focus:outline-none focus:border-[#ff8c00] disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                  Lead Delivery Time
                </label>
                <input
                  type="text"
                  disabled={isView}
                  value={formData.deliveryTime}
                  onChange={e => setFormData({ ...formData, deliveryTime: e.target.value })}
                  placeholder="e.g. 3 Days"
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff8c00] disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          {/* Audit Reason if Editing */}
          {isEdit && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
              <label className="block text-xs font-black uppercase text-amber-400 flex items-center gap-2">
                <Icon name="shield" size={14} />
                <span>Audit Change Reason *</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="State reason for updating product master record (e.g., Supplier lead time change, relocated bin)..."
                className="w-full bg-[#111111] border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                required
              />
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold uppercase transition-all"
            >
              {isView ? 'Close' : 'Cancel'}
            </button>

            {!isView && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
              >
                <Icon name="check" size={16} />
                <span>{isSubmitting ? 'Saving...' : isEdit ? 'Update Master' : 'Save Product Master'}</span>
              </button>
            )}
          </div>
        </form>

      </div>
    </div>
  );
};
