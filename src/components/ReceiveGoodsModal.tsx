import React, { useState } from 'react';
import { StockRequest } from '../types';
import { Icon } from './Icon';
import { stockRequestService } from '../services/stockRequestService';

interface ReceiveGoodsModalProps {
  request: StockRequest;
  currentUser: any;
  isPurchasingOrAdmin: boolean;
  announce: (txt: string) => void;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReceiveGoodsModal: React.FC<ReceiveGoodsModalProps> = ({
  request,
  currentUser,
  isPurchasingOrAdmin,
  announce,
  onClose,
  onSuccess
}) => {
  // Optional delivery date
  const [deliveryDate, setDeliveryDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [generalNotes, setGeneralNotes] = useState<string>('');

  // Per-item receive state: { [productId]: { qtyNow: number, notes: string } }
  const [receiveState, setReceiveState] = useState<{
    [productId: string]: { qtyNow: number; notes: string };
  }>(() => {
    const initialState: { [productId: string]: { qtyNow: number; notes: string } } = {};
    request.items.forEach(item => {
      const already = item.receivedQuantity || 0;
      const remaining = Math.max(0, item.quantity - already);
      initialState[item.productId || item.supplierPartNumber] = {
        qtyNow: remaining, // Pre-fill with remaining needed quantity for quick receipt
        notes: item.notes || ''
      };
    });
    return initialState;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmation state modal after successful processing
  const [confirmationData, setConfirmationData] = useState<{
    requestNumber: string;
    totalUnitsReceived: number;
    updatedProductsCount: number;
    newStatus: string;
  } | null>(null);

  const handleQtyChange = (productId: string, val: number) => {
    setReceiveState(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        qtyNow: Math.max(0, val)
      }
    }));
  };

  const handleNotesChange = (productId: string, txt: string) => {
    setReceiveState(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        notes: txt
      }
    }));
  };

  const handleSetFullQuantity = (productId: string, remaining: number) => {
    handleQtyChange(productId, remaining);
  };

  const calculateTotalQtyNow = (): number => {
    const list = Object.values(receiveState) as Array<{ qtyNow: number; notes: string }>;
    return list.reduce((sum, item) => sum + (item.qtyNow || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPurchasingOrAdmin) {
      announce("Access Restricted: Only Purchasing or Admin can receive goods.");
      return;
    }

    const totalQtyNow = calculateTotalQtyNow();
    if (totalQtyNow <= 0) {
      announce("Please enter a valid received quantity greater than 0 for at least one item.");
      return;
    }

    setIsSubmitting(true);

    try {
      const itemsReceivedPayload = request.items.map(item => {
        const key = item.productId || item.supplierPartNumber;
        const entry = receiveState[key];
        return {
          productId: item.productId,
          receivedQtyNow: entry ? entry.qtyNow : 0,
          notes: entry ? entry.notes : ''
        };
      });

      const userContext = {
        userId: currentUser?.id || currentUser?.uid || 'purchasing_user',
        userName: currentUser?.name || currentUser?.email || 'Purchasing Manager',
        role: currentUser?.role || 'Purchasing'
      };

      const result = await stockRequestService.receiveGoodsForRequest({
        requestId: request.id,
        itemsReceived: itemsReceivedPayload,
        userContext,
        notes: generalNotes
      });

      announce(`Goods receipt confirmed for request ${request.requestNumber}`);

      setConfirmationData({
        requestNumber: request.requestNumber,
        totalUnitsReceived: result.totalUnitsReceived,
        updatedProductsCount: result.updatedProductsCount,
        newStatus: result.newStatus
      });
    } catch (err: any) {
      console.error("Failed to receive goods:", err);
      announce(err.message || "Failed to process goods receipt.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Derive primary supplier or supplier list
  const suppliers = Array.from(new Set(request.items.map(i => i.supplier || 'Unspecified')));
  const primarySupplier = suppliers.join(', ');

  const formattedOrderedDate = new Date(request.orderedAt || request.createdAt).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  if (confirmationData) {
    return (
      <div className="fixed inset-0 z-[2200] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 font-sans">
        <div className="bg-[#151515] border border-white/10 w-full max-w-md rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl text-center">
          <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400">
            <Icon name="check-circle" size={32} />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black uppercase text-white tracking-tight">
              Stock Successfully Received
            </h3>
            <p className="text-xs text-gray-400">
              Inventory updated immediately and audit history recorded.
            </p>
          </div>

          <div className="bg-black/50 p-5 rounded-2xl border border-white/10 text-left space-y-3 font-sans text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Request Number</span>
              <span className="font-mono font-black text-[#ff8c00] text-sm">{confirmationData.requestNumber}</span>
            </div>

            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Items Received</span>
              <span className="font-black text-white text-sm">{confirmationData.totalUnitsReceived} Units</span>
            </div>

            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Inventory Updated</span>
              <span className="font-bold text-emerald-400">{confirmationData.updatedProductsCount} Products</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400 font-bold uppercase text-[10px]">New Status</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                confirmationData.newStatus === 'Received'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {confirmationData.newStatus}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              onSuccess();
              onClose();
            }}
            className="w-full py-3.5 bg-[#ff8c00] hover:bg-[#e07b00] text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-xl"
          >
            Done & Return to Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200 font-sans">
      <div className="bg-[#151515] border border-white/10 w-full max-w-4xl rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-6 bg-black/60 border-b border-white/10 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-lg sm:text-xl font-black font-mono text-[#ff8c00]">
                {request.requestNumber}
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Receive Goods
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Verify delivered stock quantities & trigger automatic inventory update.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 sm:p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all shrink-0"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
            
            {/* Header Display Info Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-4 bg-black/40 rounded-2xl border border-white/5 text-xs font-sans">
              <div>
                <span className="block text-[10px] font-black text-gray-500 uppercase">Request Number</span>
                <span className="text-white font-mono font-bold block mt-0.5">{request.requestNumber}</span>
              </div>

              <div>
                <span className="block text-[10px] font-black text-gray-500 uppercase">Supplier</span>
                <span className="text-gray-200 font-bold block mt-0.5 truncate">{primarySupplier}</span>
              </div>

              <div>
                <span className="block text-[10px] font-black text-gray-500 uppercase">Requested By</span>
                <span className="text-white font-bold block mt-0.5">{request.requestedByName}</span>
              </div>

              <div>
                <span className="block text-[10px] font-black text-gray-500 uppercase">Ordered Date</span>
                <span className="text-gray-300 font-mono block mt-0.5">{formattedOrderedDate}</span>
              </div>
            </div>

            {/* Optional Delivery Date & General Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                  Delivery Date (Optional)
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff8c00] font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                  General Delivery Notes / Waybill Ref
                </label>
                <input
                  type="text"
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  placeholder="E.g., Delivery Note #82914 received via Courier"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                />
              </div>
            </div>

            {/* Item Rows Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-300 flex items-center gap-2">
                  <Icon name="package" size={16} className="text-[#ff8c00]" />
                  <span>Items To Receive ({request.items.length})</span>
                </h4>
                <span className="text-[10px] text-gray-400 font-mono">
                  Touch-friendly controls & instant difference calculation
                </span>
              </div>

              <div className="space-y-4">
                {request.items.map((item, idx) => {
                  const key = item.productId || item.supplierPartNumber;
                  const alreadyReceived = item.receivedQuantity || 0;
                  const needed = Math.max(0, item.quantity - alreadyReceived);
                  const entry = receiveState[key] || { qtyNow: 0, notes: '' };
                  const totalAccumulatedAfterThis = alreadyReceived + entry.qtyNow;
                  const diff = totalAccumulatedAfterThis - item.quantity;

                  return (
                    <div
                      key={idx}
                      className="bg-black/30 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4 transition-all hover:border-white/20"
                    >
                      {/* Item Top Details */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-black/50 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                            ) : (
                              <Icon name="package" size={20} className="text-gray-600" />
                            )}
                          </div>
                          <div>
                            <h5 className="text-sm font-black text-white">{item.productName}</h5>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Supplier: <span className="text-gray-200 font-bold">{item.supplier}</span> &bull; Part #: <span className="font-mono text-gray-300">{item.supplierPartNumber}</span>
                            </p>
                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                              Bin Location: <strong className="text-gray-300">{item.location}</strong>
                            </p>
                          </div>
                        </div>

                        {/* Status Badges for Item Qty */}
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono shrink-0">
                          <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-xl text-gray-300 text-center">
                            <span className="block text-[9px] font-bold uppercase text-gray-500">Requested</span>
                            <span className="font-black text-white">{item.quantity}</span>
                          </div>

                          {alreadyReceived > 0 && (
                            <div className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-300 text-center">
                              <span className="block text-[9px] font-bold uppercase text-purple-400">Prev. Recv</span>
                              <span className="font-black">{alreadyReceived}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quantity Input & Touch Controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-white/5 items-center">
                        
                        {/* Touch Controls for Received Quantity */}
                        <div className="sm:col-span-2 space-y-1">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black uppercase text-gray-400">
                              Received Quantity Now
                            </label>
                            <button
                              type="button"
                              onClick={() => handleSetFullQuantity(key, needed)}
                              className="text-[10px] font-bold text-[#ff8c00] hover:underline uppercase"
                            >
                              Fill Remaining ({needed})
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleQtyChange(key, entry.qtyNow - 1)}
                              className="w-12 h-12 bg-white/5 hover:bg-white/10 active:bg-white/20 text-white rounded-xl font-black text-lg border border-white/10 flex items-center justify-center transition-all shrink-0 touch-manipulation"
                            >
                              -
                            </button>

                            <input
                              type="number"
                              min={0}
                              value={entry.qtyNow}
                              onChange={(e) => handleQtyChange(key, parseInt(e.target.value) || 0)}
                              className="flex-1 bg-black/60 border border-white/10 rounded-xl h-12 text-center text-base font-mono font-black text-white focus:outline-none focus:border-[#ff8c00]"
                            />

                            <button
                              type="button"
                              onClick={() => handleQtyChange(key, entry.qtyNow + 1)}
                              className="w-12 h-12 bg-white/5 hover:bg-white/10 active:bg-white/20 text-white rounded-xl font-black text-lg border border-white/10 flex items-center justify-center transition-all shrink-0 touch-manipulation"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Calculated Difference Badge */}
                        <div className="flex flex-col justify-center items-start sm:items-end">
                          <span className="text-[10px] font-black uppercase text-gray-500 mb-1">
                            Difference (Recv vs Req)
                          </span>
                          <span className={`px-3.5 py-1.5 rounded-xl font-mono font-black text-xs border ${
                            diff === 0
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : diff < 0
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          }`}>
                            {diff === 0 ? '0 (Fully Received)' : `${diff} (${diff < 0 ? 'Partial Delivery' : 'Over Delivered'})`}
                          </span>
                        </div>
                      </div>

                      {/* Item Notes */}
                      <div>
                        <input
                          type="text"
                          value={entry.notes}
                          onChange={(e) => handleNotesChange(key, e.target.value)}
                          placeholder="Item notes (e.g., 2 units damaged in box, partial shipment arriving Monday)"
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#ff8c00]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Modal Footer Controls */}
          <div className="p-4 sm:p-6 bg-black/60 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-gray-400 font-mono text-center sm:text-left">
              Total Units To Receive Now: <strong className="text-[#ff8c00] font-black text-sm">{calculateTotalQtyNow()}</strong>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-5 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-white/10"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting || calculateTotalQtyNow() <= 0}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-xl transition-all flex items-center justify-center gap-2 ${
                  isSubmitting || calculateTotalQtyNow() <= 0
                    ? 'bg-gray-700 cursor-not-allowed opacity-50'
                    : 'bg-[#ff8c00] hover:bg-[#e07b00]'
                }`}
              >
                {isSubmitting ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <Icon name="check-circle" size={16} />
                    <span>Confirm & Update Inventory</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
