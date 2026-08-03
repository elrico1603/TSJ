import React, { useState, useEffect } from 'react';
import { InventoryItem, InventoryHistoryItem } from '../types';
import { inventoryService } from '../services/inventoryService';
import { Icon } from './Icon';

interface InventoryManagementProps {
  isCloudLive: boolean;
  currentUser: any;
  isPurchasingOrAdmin: boolean;
  announce: (txt: string) => void;
}

export const InventoryManagement: React.FC<InventoryManagementProps> = ({
  isCloudLive,
  currentUser,
  isPurchasingOrAdmin,
  announce
}) => {
  const [activeTab, setActiveTab] = useState<'live' | 'history'>('live');
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [historyList, setHistoryList] = useState<InventoryHistoryItem[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stockLevelFilter, setStockLevelFilter] = useState<'All' | 'Green' | 'Amber' | 'Red'>('All');

  // Adjustment Modal State
  const [adjustModalItem, setAdjustModalItem] = useState<InventoryItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);

  // Subscribe to Inventory & History
  useEffect(() => {
    const unsubInv = inventoryService.subscribeInventory(items => {
      setInventoryList(items);
    });
    const unsubHist = inventoryService.subscribeInventoryHistory(items => {
      setHistoryList(items);
    });

    return () => {
      unsubInv();
      unsubHist();
    };
  }, []);

  const getStockStatus = (item: InventoryItem): 'Green' | 'Amber' | 'Red' => {
    if (item.currentQuantity <= item.minimumQuantity) return 'Red';
    // If approaching minimum (within 25% above minimum)
    if (item.currentQuantity <= Math.ceil(item.minimumQuantity * 1.25)) return 'Amber';
    return 'Green';
  };

  const getStockBadge = (item: InventoryItem) => {
    const status = getStockStatus(item);
    switch (status) {
      case 'Green':
        return (
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Healthy Stock</span>
          </span>
        );
      case 'Amber':
        return (
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>Approaching Min</span>
          </span>
        );
      case 'Red':
        return (
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping"></span>
            <span>Low Stock Alert</span>
          </span>
        );
    }
  };

  const handleOpenAdjustModal = (item: InventoryItem) => {
    if (!isPurchasingOrAdmin) {
      announce("Stock Managers can view inventory but cannot modify stock quantities.");
      return;
    }
    setAdjustModalItem(item);
    setAdjustQty(item.currentQuantity);
    setAdjustNotes('');
  };

  const handleConfirmAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalItem) return;

    if (!isPurchasingOrAdmin) {
      announce("Access Restricted: Only Purchasing or Admin can update inventory.");
      return;
    }

    if (!adjustNotes.trim()) {
      announce("Please provide a note/reason for this inventory adjustment.");
      return;
    }

    setIsAdjusting(true);
    try {
      const performedBy = currentUser?.name || currentUser?.email || 'Purchasing Manager';
      await inventoryService.adjustStock({
        productId: adjustModalItem.productId,
        newQuantity: adjustQty,
        performedBy,
        notes: adjustNotes
      });

      announce(`Stock quantity for ${adjustModalItem.productName} adjusted to ${adjustQty}`);
      setAdjustModalItem(null);
    } catch (err: any) {
      console.error("Adjustment failed:", err);
      announce(err.message || "Failed to adjust stock.");
    } finally {
      setIsAdjusting(false);
    }
  };

  // Filtered inventory items
  const filteredInventory = inventoryList.filter(item => {
    if (stockLevelFilter !== 'All') {
      const status = getStockStatus(item);
      if (status !== stockLevelFilter) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = item.productName.toLowerCase().includes(q);
      const matchPart = item.supplierPartNumber.toLowerCase().includes(q);
      const matchSupplier = item.supplier.toLowerCase().includes(q);
      const matchLoc = item.location.toLowerCase().includes(q);
      if (!matchName && !matchPart && !matchSupplier && !matchLoc) return false;
    }

    return true;
  });

  // Summary counts
  const totalProductsCount = inventoryList.length;
  const redAlertsCount = inventoryList.filter(i => getStockStatus(i) === 'Red').length;
  const amberAlertsCount = inventoryList.filter(i => getStockStatus(i) === 'Amber').length;
  const greenHealthyCount = inventoryList.filter(i => getStockStatus(i) === 'Green').length;

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header & Sub-Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h3 className="text-2xl font-black uppercase tracking-tighter text-white">
            Inventory & Stock Control
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Real-time stock quantities, min/max threshold indicators, and complete movement history.
          </p>
        </div>

        {/* View Switching Tabs */}
        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-2xl border border-white/10 shrink-0">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'live'
                ? 'bg-[#ff8c00] text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Icon name="package" size={14} />
            <span>Live Stock ({totalProductsCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-[#ff8c00] text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Icon name="clock" size={14} />
            <span>Movement History</span>
          </button>
        </div>
      </div>

      {activeTab === 'live' && (
        <div className="space-y-6">
          
          {/* Summary Indicator Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-[#151515] p-4 rounded-2xl border border-white/5 space-y-1">
              <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                Total Products Tracked
              </span>
              <div className="text-2xl font-black font-mono text-white">{totalProductsCount}</div>
              <span className="text-[10px] text-gray-400">In Warehouse Database</span>
            </div>

            <button
              onClick={() => setStockLevelFilter(stockLevelFilter === 'Red' ? 'All' : 'Red')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                stockLevelFilter === 'Red'
                  ? 'bg-red-500/20 border-red-500/50'
                  : 'bg-[#151515] border-white/5 hover:border-red-500/30'
              }`}
            >
              <span className="text-[10px] font-black uppercase text-red-400 tracking-wider">
                Low Stock (Red)
              </span>
              <div className="text-2xl font-black font-mono text-white">{redAlertsCount}</div>
              <span className="text-[10px] text-gray-400">At or Below Minimum</span>
            </button>

            <button
              onClick={() => setStockLevelFilter(stockLevelFilter === 'Amber' ? 'All' : 'Amber')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                stockLevelFilter === 'Amber'
                  ? 'bg-amber-500/20 border-amber-500/50'
                  : 'bg-[#151515] border-white/5 hover:border-amber-500/30'
              }`}
            >
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                Approaching Min (Amber)
              </span>
              <div className="text-2xl font-black font-mono text-white">{amberAlertsCount}</div>
              <span className="text-[10px] text-gray-400">Reorder Recommended</span>
            </button>

            <button
              onClick={() => setStockLevelFilter(stockLevelFilter === 'Green' ? 'All' : 'Green')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                stockLevelFilter === 'Green'
                  ? 'bg-emerald-500/20 border-emerald-500/50'
                  : 'bg-[#151515] border-white/5 hover:border-emerald-500/30'
              }`}
            >
              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                Healthy Stock (Green)
              </span>
              <div className="text-2xl font-black font-mono text-white">{greenHealthyCount}</div>
              <span className="text-[10px] text-gray-400">Above Thresholds</span>
            </button>
          </div>

          {/* Search & Stock Filter Bar */}
          <div className="bg-[#151515] p-4 rounded-2xl border border-white/10 flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by product, part number, supplier, bin location..."
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#ff8c00]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
                >
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <span className="text-[10px] font-black uppercase text-gray-500 shrink-0">Filter Level:</span>
              {(['All', 'Red', 'Amber', 'Green'] as const).map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setStockLevelFilter(lvl)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 ${
                    stockLevelFilter === lvl
                      ? 'bg-[#ff8c00] text-white shadow-md'
                      : 'bg-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid / Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInventory.map(item => {
              const status = getStockStatus(item);
              const percent = Math.min(100, Math.round((item.currentQuantity / (item.maximumQuantity || 100)) * 100));

              return (
                <div
                  key={item.id}
                  className={`bg-[#151515] border rounded-2xl p-5 space-y-4 transition-all hover:border-white/20 flex flex-col justify-between ${
                    status === 'Red'
                      ? 'border-red-500/30'
                      : status === 'Amber'
                      ? 'border-amber-500/30'
                      : 'border-white/10'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-black/50 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                          ) : (
                            <Icon name="package" size={20} className="text-gray-600" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white">{item.productName}</h4>
                          <span className="font-mono text-xs text-gray-400 block">{item.supplierPartNumber}</span>
                        </div>
                      </div>

                      {getStockBadge(item)}
                    </div>

                    {/* Info Metadata */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-sans text-gray-400 bg-black/30 p-3 rounded-xl border border-white/5">
                      <div>
                        <span className="block text-[9px] font-bold text-gray-500 uppercase">Supplier</span>
                        <span className="text-gray-200 font-bold truncate block">{item.supplier}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-bold text-gray-500 uppercase">Bin Location</span>
                        <span className="text-gray-200 font-mono font-bold block">{item.location}</span>
                      </div>
                    </div>

                    {/* Stock Levels Breakdown */}
                    <div className="p-3 bg-black/50 rounded-xl border border-white/5 space-y-2 font-mono text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-[10px] uppercase font-bold">Current Stock</span>
                        <span className={`text-base font-black ${
                          status === 'Red' ? 'text-red-400' : status === 'Amber' ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {item.currentQuantity}
                        </span>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            status === 'Red' ? 'bg-red-500' : status === 'Amber' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-gray-400 pt-1">
                        <span>Min Threshold: <strong className="text-white">{item.minimumQuantity}</strong></span>
                        <span>Max Target: <strong className="text-white">{item.maximumQuantity}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action Button */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs font-sans">
                    <span className="text-[10px] text-gray-500">
                      Last updated: {item.lastUpdatedBy || 'System'}
                    </span>

                    {isPurchasingOrAdmin ? (
                      <button
                        onClick={() => handleOpenAdjustModal(item)}
                        className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-white/10 flex items-center gap-1.5"
                      >
                        <Icon name="sliders" size={14} />
                        <span>Adjust Stock</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-500 italic">Read-only (Stock Manager)</span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredInventory.length === 0 && (
              <div className="col-span-full text-center py-16 bg-[#151515] rounded-3xl border border-white/5 space-y-3">
                <Icon name="package" size={48} className="text-gray-700 mx-auto" />
                <p className="text-xs text-gray-400 font-bold uppercase">
                  No inventory products found matching search or filter criteria.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB: MOVEMENT HISTORY AUDIT LOG */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-400 font-mono px-2">
            <span>Showing {historyList.length} movement history records</span>
            <span>Immutable Firestore Collection (inventoryHistory)</span>
          </div>

          <div className="bg-[#151515] border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-black/60 border-b border-white/10 text-gray-400 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">Product</th>
                    <th className="p-3.5">Movement Type</th>
                    <th className="p-3.5">Req #</th>
                    <th className="p-3.5 text-right">Qty Shift</th>
                    <th className="p-3.5 text-right">Before</th>
                    <th className="p-3.5 text-right">After</th>
                    <th className="p-3.5">Performed By</th>
                    <th className="p-3.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {historyList.map(h => (
                    <tr key={h.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3.5 font-mono text-gray-400 whitespace-nowrap">
                        {new Date(h.timestamp).toLocaleString('en-ZA')}
                      </td>
                      <td className="p-3.5 font-bold text-white whitespace-nowrap">
                        {h.productName || h.productId}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          h.movementType === 'Received' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                          h.movementType === 'Issued' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>
                          {h.movementType}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-[#ff8c00] font-bold whitespace-nowrap">
                        {h.requestNumber || '-'}
                      </td>
                      <td className="p-3.5 text-right font-black font-mono text-white whitespace-nowrap">
                        {h.quantity > 0 ? `+${h.quantity}` : h.quantity}
                      </td>
                      <td className="p-3.5 text-right font-mono text-gray-400 whitespace-nowrap">
                        {h.beforeQuantity}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {h.afterQuantity}
                      </td>
                      <td className="p-3.5 text-gray-300 font-bold whitespace-nowrap">
                        {h.performedBy}
                      </td>
                      <td className="p-3.5 text-gray-400 italic text-[11px] max-w-xs truncate">
                        {h.notes || '-'}
                      </td>
                    </tr>
                  ))}
                  {historyList.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-gray-500 italic">
                        No movement history recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ADJUSTMENT MODAL */}
      {adjustModalItem && (
        <div className="fixed inset-0 z-[2100] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in font-sans">
          <div className="bg-[#151515] border border-white/10 w-full max-w-md rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-lg font-black uppercase text-white">
                Adjust Stock Quantity
              </h3>
              <button onClick={() => setAdjustModalItem(null)} className="text-gray-400 hover:text-white">
                <Icon name="x" size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmAdjustment} className="space-y-4">
              <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1 text-xs">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Product Name</span>
                <span className="font-bold text-white block">{adjustModalItem.productName}</span>
                <span className="text-[10px] text-gray-400 block font-mono">Part #: {adjustModalItem.supplierPartNumber}</span>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                  New Stock Quantity
                </label>
                <input
                  type="number"
                  min={0}
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseInt(e.target.value) || 0)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-base font-mono font-black text-white focus:outline-none focus:border-[#ff8c00]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                  Reason for Adjustment <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="E.g., Physical stock count correction, damaged item written off"
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalItem(null)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdjusting || !adjustNotes.trim()}
                  className="px-5 py-2.5 bg-[#ff8c00] hover:bg-[#e07b00] rounded-xl text-xs font-black uppercase text-white shadow-lg transition-all"
                >
                  {isAdjusting ? 'Saving...' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
