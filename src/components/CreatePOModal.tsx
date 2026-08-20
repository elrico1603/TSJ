import React, { useState, useEffect } from 'react';
import { PurchaseOrder, PurchaseOrderItem, Supplier, ProductMaster, StockRequest, StockRequestItem } from '../types';
import { productMasterService } from '../services/productMasterService';
import { stockRequestService } from '../services/stockRequestService';
import { purchaseOrderService } from '../services/purchaseOrderService';
import { Icon } from './Icon';

interface CreatePOModalProps {
  currentUser?: any;
  preselectedStockRequest?: StockRequestItem | null;
  onClose: () => void;
  onCreated: (newPO: PurchaseOrder) => void;
  announce?: (msg: string) => void;
}

export const CreatePOModal: React.FC<CreatePOModalProps> = ({
  currentUser,
  preselectedStockRequest,
  onClose,
  onCreated,
  announce
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [stockRequests, setStockRequests] = useState<StockRequest[]>([]);

  // Form Fields
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [linkedRequestId, setLinkedRequestId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('TS Joinery Factory, 14 Factory Rd, Montague Gardens, Cape Town');
  const [deliveryInstructions, setDeliveryInstructions] = useState('Deliver to Receiving Bay Gate B. Attn: Receiving Bay.');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0]
  );
  const [initialStatus, setInitialStatus] = useState<'Pending Approval' | 'Draft' | 'Approved'>('Pending Approval');

  // Line items state
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);

  // Item builder inputs
  const [selectedProductId, setSelectedProductId] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [orderQuantity, setOrderQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [unit, setUnit] = useState('ea');
  const [supplierPartNumber, setSupplierPartNumber] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setSuppliers(productMasterService.getSuppliers().filter(s => s.status === 'Active'));
    setProducts(productMasterService.getProducts().filter(p => p.status === 'Active'));
    setStockRequests(stockRequestService.getStockRequests());
  }, []);

  // Handle preselected stock request populate
  useEffect(() => {
    if (preselectedStockRequest) {
      setLinkedRequestId(preselectedStockRequest.id);
      
      // Auto match supplier
      const sups = productMasterService.getSuppliers();
      const prods = productMasterService.getProducts();

      let matchedSup = sups.find(s => s.supplierName.toLowerCase() === preselectedStockRequest.supplierName?.toLowerCase());
      let matchedProd = prods.find(p => p.id === preselectedStockRequest.productId || p.internalProductCode === preselectedStockRequest.productId);

      if (!matchedSup && matchedProd) {
        matchedSup = sups.find(s => s.id === matchedProd?.supplierId || s.supplierName === matchedProd?.supplier);
      }

      if (matchedSup) {
        setSelectedSupplierId(matchedSup.id);
      }

      const newItem: PurchaseOrderItem = {
        id: `poi-${Date.now()}`,
        productId: matchedProd?.id || preselectedStockRequest.productId || `PRD-${preselectedStockRequest.kanbanId || '000'}`,
        productName: preselectedStockRequest.productDescription || preselectedStockRequest.productName || 'Product',
        internalProductCode: matchedProd?.internalProductCode || preselectedStockRequest.kanbanId || 'PRD-000',
        supplierPartNumber: matchedProd?.supplierPartNumber || preselectedStockRequest.supplierPartNumber || '',
        unit: matchedProd?.unit || 'ea',
        orderQuantity: Number(preselectedStockRequest.orderQuantity || preselectedStockRequest.quantity) || 1,
        receivedQuantity: 0,
        unitPrice: 0,
        totalPrice: 0,
        location: preselectedStockRequest.location || matchedProd?.location || 'A-01-A-01',
        category: matchedProd?.category || 'General'
      };

      setItems([newItem]);
    }
  }, [preselectedStockRequest]);

  // Handle product selector change
  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    if (!prodId) return;

    const prod = products.find(p => p.id === prodId);
    if (prod) {
      setCustomItemName(prod.productName);
      setUnit(prod.unit || 'ea');
      setSupplierPartNumber(prod.supplierPartNumber || '');
      setOrderQuantity(prod.orderQuantity || 1);

      // Auto pick supplier if not set
      if (!selectedSupplierId && prod.supplierId) {
        setSelectedSupplierId(prod.supplierId);
      }
    }
  };

  const handleAddItem = () => {
    if (!customItemName.trim()) {
      alert('Please enter or select a product description.');
      return;
    }

    const matchedProd = products.find(p => p.id === selectedProductId);

    const newItem: PurchaseOrderItem = {
      id: `poi-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId: matchedProd?.id || `PRD-${Date.now()}`,
      productName: customItemName.trim(),
      internalProductCode: matchedProd?.internalProductCode || 'PRD-CUSTOM',
      supplierPartNumber: supplierPartNumber || matchedProd?.supplierPartNumber || 'N/A',
      unit: unit || 'ea',
      orderQuantity: Math.max(1, orderQuantity),
      receivedQuantity: 0,
      unitPrice: unitPrice || 0,
      totalPrice: (unitPrice || 0) * Math.max(1, orderQuantity),
      location: matchedProd?.location || 'A-01-A-01',
      category: matchedProd?.category || 'General'
    };

    setItems([...items, newItem]);

    // Reset item inputs
    setSelectedProductId('');
    setCustomItemName('');
    setOrderQuantity(1);
    setUnitPrice(0);
    setSupplierPartNumber('');
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(i => i.id !== itemId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('Please add at least one item to the Purchase Order.');
      return;
    }

    const selectedSup = suppliers.find(s => s.id === selectedSupplierId);
    const selectedReq = stockRequests.find(r => r.id === linkedRequestId);

    setIsSubmitting(true);
    try {
      const username = currentUser?.name || currentUser?.email || 'Janah (Procurement Manager)';

      const newPO = await purchaseOrderService.createPurchaseOrder({
        supplierId: selectedSup?.id || '',
        supplierName: selectedSup?.supplierName || 'General Supplier',
        supplierCode: selectedSup?.supplierCode || '',
        supplierContactPerson: selectedSup?.contactPerson || '',
        supplierTelephone: selectedSup?.telephone || '',
        supplierEmail: selectedSup?.email || '',
        supplierAddress: selectedSup?.physicalAddress || '',
        linkedRequestId: selectedReq?.id || '',
        linkedRequestNumber: selectedReq?.requestNumber || selectedReq?.id || '',
        deliveryAddress,
        deliveryInstructions,
        expectedDeliveryDate,
        items,
        status: initialStatus
      }, username);

      if (announce) announce(`Created Purchase Order ${newPO.poNumber}`);
      onCreated(newPO);
      onClose();
    } catch (e: any) {
      alert(`Failed to create Purchase Order: ${e?.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const grandTotal = items.reduce((sum, item) => sum + (item.totalPrice || (item.unitPrice || 0) * item.orderQuantity), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-[#151515] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-6 flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-5 bg-[#1f1f1f] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ff8c00]/10 border border-[#ff8c00]/30 flex items-center justify-center text-[#ff8c00]">
              <Icon name="plus-circle" size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider font-mono">
                CREATE NEW PURCHASE ORDER
              </h2>
              <p className="text-xs text-gray-400">
                Bridge Procurement with Suppliers & generate official PO document
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-all"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs font-sans">
          
          {/* Top Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-black/40 p-4 rounded-xl border border-white/5">
            {/* Supplier Selection */}
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                Select Supplier <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedSupplierId}
                onChange={e => setSelectedSupplierId(e.target.value)}
                className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff8c00] font-bold"
                required
              >
                <option value="">-- Choose Supplier --</option>
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>
                    {sup.supplierName} ({sup.supplierCode}) - {sup.contactPerson}
                  </option>
                ))}
              </select>
            </div>

            {/* Link Stock Request */}
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                Link Stock Request (Optional)
              </label>
              <select
                value={linkedRequestId}
                onChange={e => setLinkedRequestId(e.target.value)}
                className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff8c00] font-mono"
              >
                <option value="">-- None / Direct Order --</option>
                {stockRequests.map(req => (
                  <option key={req.id} value={req.id}>
                    {req.requestNumber} - {(req as any).productDescription || req.items?.[0]?.productName || 'Stock Request'} ({req.branchName})
                  </option>
                ))}
              </select>
            </div>

            {/* Expected Delivery Date */}
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                Expected Delivery Date
              </label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={e => setExpectedDeliveryDate(e.target.value)}
                className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00] font-mono"
              />
            </div>

            {/* Initial Status */}
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                Initial Document Status
              </label>
              <select
                value={initialStatus}
                onChange={e => setInitialStatus(e.target.value as any)}
                className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00] font-bold"
              >
                <option value="Pending Approval">Pending Approval (Janah Review)</option>
                <option value="Approved">Approved Immediately</option>
                <option value="Draft">Save as Draft</option>
              </select>
            </div>
          </div>

          {/* Delivery Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-black/40 p-4 rounded-xl border border-white/5">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                Delivery Address
              </label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                Delivery Instructions
              </label>
              <input
                type="text"
                value={deliveryInstructions}
                onChange={e => setDeliveryInstructions(e.target.value)}
                className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
              />
            </div>
          </div>

          {/* Line Items Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase text-[#ff8c00] tracking-wider flex items-center justify-between border-b border-white/10 pb-2">
              <span>ORDER PRODUCTS & QUANTITIES ({items.length})</span>
              <span className="text-gray-400 font-mono">Grand Total: R {grandTotal.toFixed(2)}</span>
            </h3>

            {/* Add Item Widget */}
            <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1">Pick from Product Master</label>
                  <select
                    value={selectedProductId}
                    onChange={e => handleSelectProduct(e.target.value)}
                    className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                  >
                    <option value="">-- Custom Product / Type Below --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.internalProductCode} - {p.productName} ({p.supplier})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1">Product Description</label>
                  <input
                    type="text"
                    value={customItemName}
                    onChange={e => setCustomItemName(e.target.value)}
                    placeholder="e.g. Oak Board 20mm (1220x2440)"
                    className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={orderQuantity}
                    onChange={e => setOrderQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00] font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1">Unit</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    placeholder="ea, box, m2"
                    className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1">Supplier Part #</label>
                  <input
                    type="text"
                    value={supplierPartNumber}
                    onChange={e => setSupplierPartNumber(e.target.value)}
                    placeholder="e.g. OAK-20-A"
                    className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1">Est. Unit Price (R)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={unitPrice}
                    onChange={e => setUnitPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00] font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 border border-white/10"
                >
                  <Icon name="plus" size={14} />
                  <span>Add Line Item</span>
                </button>
              </div>
            </div>

            {/* Item List Display */}
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.id} className="bg-black/50 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center font-mono font-bold text-gray-400 text-[10px]">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-white uppercase">{item.productName}</p>
                      <p className="text-[10px] text-gray-400 font-mono">
                        Code: {item.internalProductCode} | Part: {item.supplierPartNumber || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="font-black text-[#ff8c00] text-sm block font-mono">
                        {item.orderQuantity} {item.unit}
                      </span>
                      {item.unitPrice ? (
                        <span className="text-[10px] text-gray-400 font-mono">
                          R {(item.totalPrice || 0).toFixed(2)}
                        </span>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-all"
                    >
                      <Icon name="trash-2" size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Footer */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold uppercase transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || items.length === 0}
              className="px-6 py-2.5 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              <Icon name="check" size={16} />
              <span>{isSubmitting ? 'Generating PO...' : 'Generate Purchase Order'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
