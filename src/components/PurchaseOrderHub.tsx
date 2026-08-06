import React, { useState, useEffect } from 'react';
import { PurchaseOrder, PurchaseOrderStatus } from '../types';
import { purchaseOrderService } from '../services/purchaseOrderService';
import { PurchaseOrderDocumentModal } from './PurchaseOrderDocumentModal';
import { CreatePOModal } from './CreatePOModal';
import { Icon } from './Icon';

interface PurchaseOrderHubProps {
  currentUser?: any;
  announce?: (msg: string) => void;
}

export const PurchaseOrderHub: React.FC<PurchaseOrderHubProps> = ({
  currentUser,
  announce
}) => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modals state
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const unsubscribe = purchaseOrderService.subscribe(pos => {
      setPurchaseOrders(pos);
    });
    return () => unsubscribe();
  }, []);

  const handleApprovePO = async (e: React.MouseEvent, poId: string) => {
    e.stopPropagation();
    const username = currentUser?.name || currentUser?.email || 'Janah (Procurement Manager)';
    const success = await purchaseOrderService.approvePO(poId, username, 'Approved from Purchase Order Hub');
    if (success && announce) {
      announce(`Purchase Order ${poId} approved.`);
    }
  };

  const handleArchivePO = async (e: React.MouseEvent, poId: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to archive Purchase Order ${poId}?`)) {
      const username = currentUser?.name || currentUser?.email || 'Admin';
      await purchaseOrderService.updatePOStatus(poId, 'Archived', username, 'Archived by user');
      if (announce) announce(`Purchase Order ${poId} archived.`);
    }
  };

  // Filter purchase orders
  const filteredPOs = purchaseOrders.filter(po => {
    // Status filter
    if (statusFilter !== 'All' && po.status !== statusFilter) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = po.poNumber.toLowerCase().includes(q);
      const matchSupplier = po.supplierName.toLowerCase().includes(q);
      const matchReq = po.linkedRequestNumber?.toLowerCase().includes(q);
      const matchItem = po.items.some(i => i.productName.toLowerCase().includes(q) || i.internalProductCode.toLowerCase().includes(q));
      if (!matchNumber && !matchSupplier && !matchReq && !matchItem) {
        return false;
      }
    }

    // Date range filter
    if (dateFrom) {
      const poDate = new Date(po.createdAt).toISOString().split('T')[0];
      if (poDate < dateFrom) return false;
    }
    if (dateTo) {
      const poDate = new Date(po.createdAt).toISOString().split('T')[0];
      if (poDate > dateTo) return false;
    }

    return true;
  });

  const getStatusBadge = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'Approved':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Approved</span>;
      case 'Pending Approval':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">Pending Approval</span>;
      case 'Draft':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-500/20 text-gray-400 border border-gray-500/30">Draft</span>;
      case 'Sent':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">Sent</span>;
      case 'Partially Received':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Partially Received</span>;
      case 'Completed':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30">Completed</span>;
      case 'Cancelled':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30">Cancelled</span>;
      case 'Archived':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-600/20 text-gray-500 border border-gray-600/30">Archived</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-500/20 text-gray-400">{status}</span>;
    }
  };

  const pendingCount = purchaseOrders.filter(p => p.status === 'Pending Approval').length;
  const approvedCount = purchaseOrders.filter(p => p.status === 'Approved').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Header Banner */}
      <div className="bg-[#151515] border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
                <Icon name="box" size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                    PURCHASE ORDERS
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    PHASE 6
                  </span>
                </div>
                <p className="text-xs text-gray-400 font-medium">
                  Procurement to Supplier Bridge & Requisition Approvals
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-cyan-600/20 flex items-center gap-2"
            >
              <Icon name="plus" size={16} />
              <span>Create Purchase Order</span>
            </button>
          </div>
        </div>

        {/* Quick Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/5">
          <div className="bg-black/30 border border-white/5 p-3 rounded-xl">
            <span className="text-[10px] font-black text-gray-500 uppercase block">Total Orders</span>
            <span className="text-lg font-black text-white font-mono">{purchaseOrders.length}</span>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-xl">
            <span className="text-[10px] font-black text-amber-400 uppercase block">Pending Approval</span>
            <span className="text-lg font-black text-amber-400 font-mono">{pendingCount}</span>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl">
            <span className="text-[10px] font-black text-emerald-400 uppercase block">Approved Orders</span>
            <span className="text-lg font-black text-emerald-400 font-mono">{approvedCount}</span>
          </div>
          <div className="bg-black/30 border border-white/5 p-3 rounded-xl">
            <span className="text-[10px] font-black text-gray-500 uppercase block">Company Scope</span>
            <span className="text-xs font-black text-gray-300 font-mono">TS-JOINERY-CPT</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#151515] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
        
        {/* Search & Filters Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search Bar */}
          <div className="md:col-span-2 relative">
            <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by PO #, Supplier, Stock Request #, Product name..."
              className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors font-medium"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Partially Received">Partially Received</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          {/* Date Range Picker */}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-2 py-2 text-[11px] text-white focus:outline-none focus:border-cyan-500 font-mono"
            />
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-2 py-2 text-[11px] text-white focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        {(statusFilter !== 'All' || searchQuery || dateFrom || dateTo) && (
          <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
            <span className="text-gray-400 font-mono text-[10px]">
              Showing {filteredPOs.length} of {purchaseOrders.length} orders
            </span>
            <button
              onClick={() => {
                setStatusFilter('All');
                setSearchQuery('');
                setDateFrom('');
                setDateTo('');
              }}
              className="text-[10px] text-cyan-400 hover:underline font-bold uppercase"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Purchase Orders List Table / Cards */}
      <div className="space-y-3">
        {filteredPOs.length === 0 ? (
          <div className="bg-[#151515] border border-white/10 rounded-2xl p-12 text-center text-gray-500 space-y-3">
            <Icon name="box" size={32} className="mx-auto text-gray-600" />
            <p className="text-sm font-bold text-gray-400">No Purchase Orders found.</p>
            <p className="text-xs text-gray-600">Create a new Purchase Order or adjust your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredPOs.map(po => {
              const formattedDate = new Date(po.createdAt).toLocaleDateString('en-ZA', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              });

              return (
                <div
                  key={po.id}
                  onClick={() => setSelectedPO(po)}
                  className="bg-[#151515] border border-white/10 rounded-2xl p-5 hover:border-cyan-500/50 transition-all cursor-pointer group space-y-4"
                >
                  {/* Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-base font-black font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3.5 py-1 rounded-xl group-hover:bg-cyan-500/20 transition-colors">
                        {po.poNumber}
                      </span>
                      {getStatusBadge(po.status)}
                      {po.linkedRequestNumber && (
                        <span className="text-xs text-gray-400 font-mono bg-white/5 px-2.5 py-0.5 rounded-lg border border-white/5">
                          Req: <span className="text-[#ff8c00] font-bold">{po.linkedRequestNumber}</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-400 font-mono">
                      Created: <span className="text-gray-200 font-bold">{formattedDate}</span> by {po.createdUser}
                    </div>
                  </div>

                  {/* Main Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="block text-[10px] font-black text-gray-500 uppercase">Supplier</span>
                      <span className="text-white font-black block mt-0.5 text-sm">{po.supplierName}</span>
                      {po.supplierContactPerson && (
                        <span className="text-[10px] text-gray-400 block">{po.supplierContactPerson}</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[10px] font-black text-gray-500 uppercase">Line Products</span>
                      <span className="text-white font-bold block mt-0.5">{po.totalProducts} Products</span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-black text-gray-500 uppercase">Total Quantity</span>
                      <span className="text-cyan-400 font-black font-mono block mt-0.5">{po.totalQuantity} Units</span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-black text-gray-500 uppercase">Est. Total Value</span>
                      <span className="text-emerald-400 font-black font-mono block mt-0.5 text-sm">
                        R {(po.estimatedTotalValue || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedPO(po);
                        }}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase transition-all border border-white/10 flex items-center gap-1.5"
                      >
                        <Icon name="eye" size={14} />
                        <span>View Document</span>
                      </button>

                      {po.status === 'Pending Approval' && (
                        <button
                          onClick={e => handleApprovePO(e, po.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase transition-all shadow-lg flex items-center gap-1.5"
                        >
                          <Icon name="check-circle" size={14} />
                          <span>Approve</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedPO(po);
                          setTimeout(() => window.print(), 200);
                        }}
                        className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-all"
                        title="Print / PDF"
                      >
                        <Icon name="printer" size={16} />
                      </button>

                      {po.status !== 'Archived' && (
                        <button
                          onClick={e => handleArchivePO(e, po.id)}
                          className="p-2 text-gray-500 hover:text-amber-400 rounded-xl hover:bg-white/5 transition-all"
                          title="Archive PO"
                        >
                          <Icon name="archive" size={16} />
                        </button>
                      )}

                      <button
                        onClick={async e => {
                          e.stopPropagation();
                          if (window.confirm(`PERMANENT DELETE: Delete Purchase Order ${po.poNumber} permanently?`)) {
                            await purchaseOrderService.deletePurchaseOrder(po.id);
                            if (announce) announce(`Purchase Order ${po.poNumber} deleted permanently.`);
                          }
                        }}
                        className="p-2 text-gray-500 hover:text-red-500 rounded-xl hover:bg-red-500/10 transition-all"
                        title="Permanently Delete PO"
                      >
                        <Icon name="trash-2" size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DOCUMENT VIEW MODAL */}
      {selectedPO && (
        <PurchaseOrderDocumentModal
          po={selectedPO}
          currentUser={currentUser}
          onClose={() => setSelectedPO(null)}
          onStatusChanged={() => {
            const updated = purchaseOrderService.getPOById(selectedPO.id);
            if (updated) setSelectedPO(updated);
          }}
          announce={announce}
        />
      )}

      {/* CREATE PO FORM MODAL */}
      {showCreateModal && (
        <CreatePOModal
          currentUser={currentUser}
          onClose={() => setShowCreateModal(false)}
          onCreated={newPO => {
            setSelectedPO(newPO);
          }}
          announce={announce}
        />
      )}

    </div>
  );
};
