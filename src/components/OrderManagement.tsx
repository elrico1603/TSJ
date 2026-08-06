import React, { useState, useEffect } from 'react';
import { db, APP_ID_PATH } from '../firebase';
import { OrderItem, StockRequest } from '../types';
import { Icon } from './Icon';
import { notificationService } from '../services/notificationService';
import { stockRequestService, isValidStatusTransition } from '../services/stockRequestService';
import { purchaseOrderService } from '../services/purchaseOrderService';
import { ReceiveGoodsModal } from './ReceiveGoodsModal';
import { InventoryManagement } from './InventoryManagement';

interface OrderManagementProps {
  isCloudLive: boolean;
  canManageOrders: boolean;
  currentUser?: any;
  announce: (txt: string) => void;
}

export const OrderManagement: React.FC<OrderManagementProps> = ({
  isCloudLive,
  canManageOrders,
  currentUser,
  announce
}) => {
  const [activeTab, setActiveTab] = useState<'procurement' | 'inventory' | 'tickets' | 'history'>('procurement');
  const [activeCategory, setActiveCategory] = useState<string>('red');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [stockRequests, setStockRequests] = useState<StockRequest[]>([]);
  
  // Search & Filter state for Procurement Dashboard
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [branchFilter, setBranchFilter] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [selectedStockRequest, setSelectedStockRequest] = useState<StockRequest | null>(null);
  const [receiveGoodsRequest, setReceiveGoodsRequest] = useState<StockRequest | null>(null);
  const [transitionNotesModal, setTransitionNotesModal] = useState<{
    request: StockRequest;
    nextStatus: StockRequest['status'];
  } | null>(null);
  const [actionNotes, setActionNotes] = useState<string>('');

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderForm, setOrderForm] = useState({ title: '', notes: '', photo: '' });

  // Permissions & Roles
  const userRole = currentUser?.role || '';
  const isStockManager = userRole === 'Stock Manager';
  const isPurchasingOrAdmin = !isStockManager && (canManageOrders || ['Admin', 'Purchasing', 'Janah', 'Supervisor', 'HR'].includes(userRole) || currentUser?.email?.includes('janah'));

  // Real-time Subscription to Stock Requests
  useEffect(() => {
    const unsub = stockRequestService.subscribeRequests(requests => {
      if (requests.length === 0 && !isCloudLive) {
        // Sample stock request for offline demonstration
        const sample: StockRequest = {
          id: 'sr_sample_01',
          requestNumber: 'TSJ-2026-000001',
          requestedByUid: 'sm_001',
          requestedByName: 'Stock Manager',
          requestedByRole: 'Stock Manager',
          branchId: 'BR-01',
          branchName: 'TS Joinery Main Workshop',
          status: 'Pending',
          createdAt: new Date().toISOString(),
          totalProducts: 2,
          totalQuantity: 24,
          notes: 'Urgent stock batch for cabinet assembly',
          items: [
            {
              productId: 'K-101',
              productName: 'Oak Board 20mm (1220x2440)',
              quantity: 4,
              supplier: 'Sondor Wood',
              supplierPartNumber: 'OAK-20-A',
              location: 'A12 (Red)',
              imageUrl: ''
            },
            {
              productId: 'K-102',
              productName: 'Wood Screws 4x30 Box 1000',
              quantity: 20,
              supplier: 'Fasteners SA',
              supplierPartNumber: 'SCR-430-B',
              location: 'B04 (Yellow)',
              imageUrl: ''
            }
          ],
          history: [
            {
              id: 'h_1',
              action: 'Submitted',
              userId: 'sm_001',
              userName: 'Stock Manager',
              role: 'Stock Manager',
              timestamp: new Date().toISOString(),
              notes: 'Created & submitted via Kanban Scanner'
            }
          ]
        };
        setStockRequests([sample]);
      } else {
        setStockRequests(requests);
      }
    });
    return () => unsub();
  }, [isCloudLive]);

  // Sync selected stock request when requests change
  useEffect(() => {
    if (selectedStockRequest) {
      const match = stockRequests.find(r => r.id === selectedStockRequest.id);
      if (match) setSelectedStockRequest(match);
    }
  }, [stockRequests]);

  // Load production support tickets
  useEffect(() => {
    if (isCloudLive && activeCategory && activeTab === 'tickets') {
      const unsub = db.collection('artifacts')
        .doc(APP_ID_PATH)
        .collection('public')
        .doc('data')
        .collection('orders')
        .where('category', '==', activeCategory)
        .onSnapshot(
          snap => {
            if (!snap.empty) {
              setOrderItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as OrderItem)));
            } else {
              setOrderItems([]);
            }
          },
          err => console.error("Firestore Orders failed:", err)
        );
      return () => unsub();
    }
  }, [activeCategory, isCloudLive, activeTab]);

  // Load scanned order history
  useEffect(() => {
    if (isCloudLive && activeTab === 'history') {
      const unsub = db.collection('artifacts')
        .doc(APP_ID_PATH)
        .collection('public')
        .doc('data')
        .collection('order_history')
        .onSnapshot(
          snap => {
            if (!snap.empty) {
              const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
              list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
              setOrderHistory(list);
            } else {
              setOrderHistory([]);
            }
          },
          err => console.error("Firestore Order History failed:", err)
        );
      return () => unsub();
    }
  }, [activeTab, isCloudLive]);

  // Offline mock fallback for scanned history
  useEffect(() => {
    if (!isCloudLive && activeTab === 'history' && orderHistory.length === 0) {
      setOrderHistory([
        {
          id: 'SO-827415',
          orderNumber: 'SO-827415',
          date: '2026-07-22',
          time: '14:32:10',
          requestedBy: 'Workshop Manager',
          products: ['Oak Board 20mm', 'Screws 4x30'],
          requestedQuantities: [2, 5],
          orderStatus: 'Pending',
          createdAt: '2026-07-22T14:32:10.000Z',
          items: [
            {
              kanbanId: 'K-101',
              productName: 'Oak Board 20mm',
              supplierName: 'Sondor Wood',
              supplierPartNumber: 'OAK-20',
              baseOrderQuantity: '10 Sheets',
              binQuantity: '1 Bin',
              warehouseLocation: 'A12 (Red)',
              deliveryTime: '3 Days',
              basketQty: 2
            }
          ]
        }
      ]);
    }
  }, [activeTab, isCloudLive, orderHistory.length]);

  // Status transition handler
  const handlePerformTransition = async (
    req: StockRequest,
    nextStatus: StockRequest['status'],
    notesText?: string
  ) => {
    if (!isPurchasingOrAdmin) {
      announce("Access Restricted: Only Purchasing or Admin can update request status.");
      return;
    }

    try {
      const userContext = {
        userId: currentUser?.id || currentUser?.uid || 'p_user',
        userName: currentUser?.name || currentUser?.email || 'Janah (Purchasing)',
        role: userRole || 'Purchasing'
      };

      await stockRequestService.updateRequestStatus(req.id, nextStatus, userContext, notesText);
      announce(`Stock Request ${req.requestNumber} changed to ${nextStatus}`);
      setTransitionNotesModal(null);
      setActionNotes('');
    } catch (err: any) {
      console.error("Failed to update request status:", err);
      announce(err.message || "Failed to update request status.");
    }
  };

  const handleUpdateScannedHistoryStatus = async (orderId: string, newStatus: string) => {
    if (isCloudLive) {
      try {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('data')
          .collection('order_history')
          .doc(orderId)
          .update({ orderStatus: newStatus });
        announce(`Order status updated to ${newStatus}`);
      } catch (err) {
        console.error("Failed to update history status:", err);
      }
    } else {
      setOrderHistory(prev => prev.map(o => o.id === orderId ? { ...o, orderStatus: newStatus } : o));
      announce(`Order status updated to ${newStatus}`);
    }
  };

  const handleDeleteHistoryOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this order history record?')) return;
    if (isCloudLive) {
      try {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('data')
          .collection('order_history')
          .doc(orderId)
          .delete();
        announce('Order history record deleted');
      } catch (err) {
        console.error("Failed to delete order history record:", err);
      }
    } else {
      setOrderHistory(prev => prev.filter(o => o.id !== orderId));
      announce('Order history record deleted');
    }
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.title.trim()) return;

    const newOrder: Omit<OrderItem, 'id'> = {
      title: orderForm.title,
      notes: orderForm.notes,
      photo: orderForm.photo,
      category: activeCategory,
      createdAt: new Date().toISOString()
    };

    if (isCloudLive) {
      await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('orders').add(newOrder);
    } else {
      setOrderItems(prev => [...prev, { id: Date.now().toString(), ...newOrder }]);
    }

    try {
      await notificationService.addNotification({
        category: 'stock_order',
        categoryLabel: 'Stock Orders',
        title: `New Support Ticket: ${newOrder.title}`,
        description: `Priority category: ${activeCategory.toUpperCase()}.${newOrder.notes ? ' Notes: ' + newOrder.notes : ''}`,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        priority: activeCategory === 'red' ? 'high' : 'medium',
        relatedPage: 'orders',
        targetEmails: ['frans@tsjoinery.co.za', 'janah@tsjoinery.co.za'],
        targetRoles: ['Admin', 'Supervisor', 'HR']
      });
    } catch (err) {
      console.warn('Failed to add order notification:', err);
    }

    setShowOrderModal(false);
    setOrderForm({ title: '', notes: '', photo: '' });
    announce('Support ticket created');
  };

  const handleOrderPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setOrderForm(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to remove this order item?')) return;
    if (isCloudLive) {
      await db.collection('artifacts')
        .doc(APP_ID_PATH)
        .collection('public')
        .doc('data')
        .collection('orders')
        .doc(orderId)
        .delete();
    } else {
      setOrderItems(prev => prev.filter(o => o.id !== orderId));
    }
    announce('Order deleted');
  };

  // Dashboard Counter Counts
  const pendingCount = stockRequests.filter(r => r.status === 'Pending').length;
  const orderedCount = stockRequests.filter(r => r.status === 'Ordered').length;
  const partiallyReceivedCount = stockRequests.filter(r => r.status === 'Partially Received').length;
  const receivedCount = stockRequests.filter(r => r.status === 'Received').length;
  const completedCount = stockRequests.filter(r => r.status === 'Completed').length;
  const cancelledCount = stockRequests.filter(r => r.status === 'Cancelled').length;

  // Extract unique branches for filter dropdown
  const availableBranches = Array.from(new Set(stockRequests.map(r => r.branchName || 'TS Joinery Main Workshop')));

  // Filtered stock requests logic
  const filteredRequests = stockRequests.filter(req => {
    // 1. Status Filter
    if (statusFilter !== 'All' && req.status !== statusFilter) return false;

    // 2. Branch Filter
    if (branchFilter !== 'All' && req.branchName !== branchFilter) return false;

    // 3. Search Query Filter (Request Number, Product Name, Supplier, Requested By)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesReqNum = req.requestNumber.toLowerCase().includes(q);
      const matchesReqUser = req.requestedByName.toLowerCase().includes(q);
      const matchesProduct = req.items.some(i => i.productName.toLowerCase().includes(q));
      const matchesSupplier = req.items.some(i => i.supplier.toLowerCase().includes(q));

      if (!matchesReqNum && !matchesReqUser && !matchesProduct && !matchesSupplier) {
        return false;
      }
    }

    // 4. Date From
    if (dateFrom) {
      const reqDate = req.createdAt.split('T')[0];
      if (reqDate < dateFrom) return false;
    }

    // 5. Date To
    if (dateTo) {
      const reqDate = req.createdAt.split('T')[0];
      if (reqDate > dateTo) return false;
    }

    return true;
  });

  const getStatusBadge = (status: StockRequest['status']) => {
    switch (status) {
      case 'Pending':
        return <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">Pending</span>;
      case 'Ordered':
        return <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">Ordered</span>;
      case 'Partially Received':
        return <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/30">Partially Received</span>;
      case 'Received':
        return <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/30">Received</span>;
      case 'Completed':
        return <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Completed</span>;
      case 'Cancelled':
        return <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/30">Cancelled</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-gray-500/10 text-gray-400 border border-gray-500/30">{status}</span>;
    }
  };

  const categories = [
    { key: 'red', label: 'Urgent Priority', color: 'bg-red-500 text-white' },
    { key: 'yellow', label: 'Medium Priority', color: 'bg-yellow-500 text-black' },
    { key: 'green', label: 'Standard Schedule', color: 'bg-green-500 text-white' }
  ];

  return (
    <div className="animate-in fade-in duration-500 font-sans pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter text-white font-sans">
            Procurement Dashboard
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-sans">
            Centralized stock request lifecycle management for Purchasing & Inventory control.
          </p>
        </div>

        {canManageOrders && activeTab === 'tickets' && (
          <button 
            onClick={() => setShowOrderModal(true)} 
            className="px-6 py-3 bg-[#ff8c00] hover:bg-[#e07b00] rounded-xl text-xs font-black uppercase tracking-widest text-white transition-colors shrink-0"
          >
            Log Support Ticket
          </button>
        )}
      </div>

      {/* Primary Sub-Navigation Tabs */}
      <div className="flex border-b border-white/10 mb-8 space-x-8 overflow-x-auto">
        <button
          onClick={() => setActiveTab('procurement')}
          className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'procurement'
              ? 'border-[#ff8c00] text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <Icon name="package" size={16} />
          <span>Procurement & Stock Requests</span>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#ff8c00] text-black font-black">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'inventory'
              ? 'border-[#ff8c00] text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <Icon name="sliders" size={16} />
          <span>Inventory & Stock Control</span>
        </button>

        <button
          onClick={() => setActiveTab('tickets')}
          className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'tickets'
              ? 'border-[#ff8c00] text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <Icon name="alert-circle" size={16} />
          <span>Production Tickets</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-[#ff8c00] text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <Icon name="clock" size={16} />
          <span>Scanned Order History</span>
        </button>
      </div>

      {/* TAB 1: PROCUREMENT DASHBOARD & LIFECYCLE */}
      {activeTab === 'procurement' && (
        <div className="space-y-8">
          
          {/* SECTION 1: DASHBOARD SUMMARY CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* Card 1: Pending */}
            <button
              onClick={() => setStatusFilter(statusFilter === 'Pending' ? 'All' : 'Pending')}
              className={`p-4 sm:p-5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                statusFilter === 'Pending'
                  ? 'bg-amber-500/20 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)] scale-[1.02]'
                  : 'bg-[#151515] border-white/5 hover:border-amber-500/30 hover:bg-amber-500/5'
              }`}
            >
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block mb-1">
                  Pending
                </span>
                <span className="text-3xl font-black text-white font-mono leading-none">
                  {pendingCount}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase">
                <span>Awaiting</span>
                <Icon name="clock" size={14} className="text-amber-400" />
              </div>
            </button>

            {/* Card 2: Ordered */}
            <button
              onClick={() => setStatusFilter(statusFilter === 'Ordered' ? 'All' : 'Ordered')}
              className={`p-4 sm:p-5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                statusFilter === 'Ordered'
                  ? 'bg-blue-500/20 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.2)] scale-[1.02]'
                  : 'bg-[#151515] border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5'
              }`}
            >
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 block mb-1">
                  Ordered
                </span>
                <span className="text-3xl font-black text-white font-mono leading-none">
                  {orderedCount}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase">
                <span>Supplier</span>
                <Icon name="shopping-cart" size={14} className="text-blue-400" />
              </div>
            </button>

            {/* Card 3: Partially Received */}
            <button
              onClick={() => setStatusFilter(statusFilter === 'Partially Received' ? 'All' : 'Partially Received')}
              className={`p-4 sm:p-5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                statusFilter === 'Partially Received'
                  ? 'bg-orange-500/20 border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.2)] scale-[1.02]'
                  : 'bg-[#151515] border-white/5 hover:border-orange-500/30 hover:bg-orange-500/5'
              }`}
            >
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 block mb-1 truncate">
                  Partial Recv
                </span>
                <span className="text-3xl font-black text-white font-mono leading-none">
                  {partiallyReceivedCount}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase">
                <span>Incomplete</span>
                <Icon name="package" size={14} className="text-orange-400" />
              </div>
            </button>

            {/* Card 4: Received */}
            <button
              onClick={() => setStatusFilter(statusFilter === 'Received' ? 'All' : 'Received')}
              className={`p-4 sm:p-5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                statusFilter === 'Received'
                  ? 'bg-purple-500/20 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.2)] scale-[1.02]'
                  : 'bg-[#151515] border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5'
              }`}
            >
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 block mb-1">
                  Received
                </span>
                <span className="text-3xl font-black text-white font-mono leading-none">
                  {receivedCount}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase">
                <span>Warehouse</span>
                <Icon name="package" size={14} className="text-purple-400" />
              </div>
            </button>

            {/* Card 5: Completed */}
            <button
              onClick={() => setStatusFilter(statusFilter === 'Completed' ? 'All' : 'Completed')}
              className={`p-4 sm:p-5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                statusFilter === 'Completed'
                  ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)] scale-[1.02]'
                  : 'bg-[#151515] border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5'
              }`}
            >
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
                  Completed
                </span>
                <span className="text-3xl font-black text-white font-mono leading-none">
                  {completedCount}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase">
                <span>Fulfilled</span>
                <Icon name="check-circle" size={14} className="text-emerald-400" />
              </div>
            </button>

            {/* Card 6: Cancelled */}
            <button
              onClick={() => setStatusFilter(statusFilter === 'Cancelled' ? 'All' : 'Cancelled')}
              className={`p-4 sm:p-5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                statusFilter === 'Cancelled'
                  ? 'bg-red-500/20 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)] scale-[1.02]'
                  : 'bg-[#151515] border-white/5 hover:border-red-500/30 hover:bg-red-500/5'
              }`}
            >
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-red-400 block mb-1">
                  Cancelled
                </span>
                <span className="text-3xl font-black text-white font-mono leading-none">
                  {cancelledCount}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase">
                <span>Archived</span>
                <Icon name="x-circle" size={14} className="text-red-400" />
              </div>
            </button>
          </div>

          {/* SECTION 2: INSTANT SEARCH & FILTER BAR */}
          <div className="bg-[#151515] p-5 rounded-2xl border border-white/10 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search Field */}
              <div className="lg:col-span-2 relative">
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Search Requests</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Req #, product name, supplier, requested by..."
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#ff8c00] transition-colors"
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
              </div>

              {/* Status Filter Dropdown */}
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff8c00] transition-colors font-bold cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Ordered">Ordered</option>
                  <option value="Received">Received</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* Branch Filter Dropdown */}
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Branch</label>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff8c00] transition-colors font-bold cursor-pointer"
                >
                  <option value="All">All Branches</option>
                  {availableBranches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Date Filters Container */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Date From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00] transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Date To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00] transition-colors font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Active Filters Summary Bar */}
            {(statusFilter !== 'All' || branchFilter !== 'All' || searchQuery || dateFrom || dateTo) && (
              <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-gray-500">Active Filters:</span>
                  {statusFilter !== 'All' && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#ff8c00]/10 text-[#ff8c00] border border-[#ff8c00]/20 text-[10px] font-bold">
                      Status: {statusFilter}
                    </span>
                  )}
                  {branchFilter !== 'All' && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#ff8c00]/10 text-[#ff8c00] border border-[#ff8c00]/20 text-[10px] font-bold">
                      Branch: {branchFilter}
                    </span>
                  )}
                  {searchQuery && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#ff8c00]/10 text-[#ff8c00] border border-[#ff8c00]/20 text-[10px] font-bold">
                      Search: "{searchQuery}"
                    </span>
                  )}
                  {(dateFrom || dateTo) && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#ff8c00]/10 text-[#ff8c00] border border-[#ff8c00]/20 text-[10px] font-bold">
                      Dates: {dateFrom || 'Start'} to {dateTo || 'End'}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => {
                    setStatusFilter('All');
                    setBranchFilter('All');
                    setSearchQuery('');
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="text-[10px] text-gray-400 hover:text-white underline font-bold uppercase"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>

          {/* SECTION 3: REQUEST LIST & ACTION BUTTONS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-gray-400 font-mono px-2">
              <span>Showing {filteredRequests.length} of {stockRequests.length} stock requests</span>
              <span>Updated live from Firebase</span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredRequests.map(req => {
                const formattedDate = new Date(req.createdAt).toLocaleDateString('en-ZA', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });
                const formattedTime = new Date(req.createdAt).toLocaleTimeString('en-ZA', {
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={req.id}
                    className="bg-[#151515] border border-white/10 rounded-2xl p-5 sm:p-6 hover:border-white/20 transition-all space-y-4"
                  >
                    {/* Card Top Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-base font-black font-mono text-[#ff8c00] bg-[#ff8c00]/10 border border-[#ff8c00]/20 px-3.5 py-1 rounded-xl">
                          {req.requestNumber}
                        </span>
                        {getStatusBadge(req.status)}
                      </div>

                      <div className="text-xs text-gray-400 font-sans flex items-center gap-2">
                        <Icon name="map-pin" size={14} className="text-[#ff8c00]" />
                        <span className="font-bold text-gray-200">{req.branchName}</span>
                      </div>
                    </div>

                    {/* Card Key Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-sans text-gray-400">
                      <div>
                        <span className="block text-[10px] font-black text-gray-500 uppercase">Requested By</span>
                        <span className="text-white font-bold block mt-0.5">{req.requestedByName}</span>
                        <span className="text-[10px] text-gray-500 font-mono">({req.requestedByRole})</span>
                      </div>

                      <div>
                        <span className="block text-[10px] font-black text-gray-500 uppercase">Created Date & Time</span>
                        <span className="text-gray-300 font-mono block mt-0.5">{formattedDate}</span>
                        <span className="text-[10px] text-gray-500 font-mono">{formattedTime}</span>
                      </div>

                      <div>
                        <span className="block text-[10px] font-black text-gray-500 uppercase">Product Count</span>
                        <span className="text-white font-black block mt-0.5">{req.totalProducts} Products</span>
                      </div>

                      <div>
                        <span className="block text-[10px] font-black text-gray-500 uppercase">Total Quantity</span>
                        <span className="text-[#ff8c00] font-black block mt-0.5">{req.totalQuantity} Units</span>
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
                      {/* View details button */}
                      <button
                        onClick={() => setSelectedStockRequest(req)}
                        className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-white/10 flex items-center gap-2 shrink-0"
                      >
                        <Icon name="eye" size={14} />
                        <span>View Details & History</span>
                      </button>

                      {/* Status Transition Action Buttons (Allowed only if authorized) */}
                      {isPurchasingOrAdmin && (
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Pending -> Ordered */}
                          {req.status === 'Pending' && (
                            <button
                              onClick={() => handlePerformTransition(req, 'Ordered')}
                              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-2"
                            >
                              <Icon name="shopping-cart" size={14} />
                              <span>Mark Ordered</span>
                            </button>
                          )}

                          {/* Generate Purchase Order */}
                          {(req.status === 'Pending' || req.status === 'Ordered') && (
                            <button
                              onClick={async () => {
                                const username = currentUser?.name || currentUser?.email || 'Janah (Procurement Manager)';
                                const createdPOs = await purchaseOrderService.createPOGroupFromStockRequest(req, username);
                                if (req.status === 'Pending') {
                                  await handlePerformTransition(req, 'Ordered');
                                }
                                announce(`Generated ${createdPOs.length} Purchase Order(s) for Request ${req.requestNumber}`);
                                alert(`Generated ${createdPOs.length} Purchase Order(s) automatically grouped by supplier:\n\n` + createdPOs.map(p => `• ${p.poNumber} (${p.supplierName}): ${p.totalProducts} item(s)`).join('\n') + `\n\nAccess them under the "Purchase Orders" module.`);
                              }}
                              className="px-3.5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-1.5"
                            >
                              <Icon name="box" size={14} />
                              <span>Generate POs</span>
                            </button>
                          )}

                          {/* Ordered or Partially Received -> Receive Goods Modal */}
                          {(req.status === 'Ordered' || req.status === 'Partially Received') && (
                            <button
                              onClick={() => setReceiveGoodsRequest(req)}
                              className="px-4 py-2.5 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-2"
                            >
                              <Icon name="package" size={14} />
                              <span>Receive Goods</span>
                            </button>
                          )}

                          {/* Quick Mark Received Option */}
                          {req.status === 'Ordered' && (
                            <button
                              onClick={() => handlePerformTransition(req, 'Received')}
                              className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
                            >
                              <Icon name="check" size={14} />
                              <span>Quick Recv</span>
                            </button>
                          )}

                          {/* Received -> Completed */}
                          {req.status === 'Received' && (
                            <button
                              onClick={() => handlePerformTransition(req, 'Completed')}
                              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-2"
                            >
                              <Icon name="check-circle" size={14} />
                              <span>Complete</span>
                            </button>
                          )}

                          {/* Cancel Option (allowed for Pending, Ordered, Received) */}
                          {['Pending', 'Ordered', 'Received'].includes(req.status) && (
                            <button
                              onClick={() => setTransitionNotesModal({ request: req, nextStatus: 'Cancelled' })}
                              className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                            >
                              <Icon name="x-circle" size={14} />
                              <span>Cancel</span>
                            </button>
                          )}

                          {/* Permanent Delete Button */}
                          <button
                            onClick={async () => {
                              if (confirm(`PERMANENT DELETE: Are you sure you want to permanently delete Stock Request ${req.requestNumber}?`)) {
                                await stockRequestService.deleteStockRequest(req.id);
                                if (announce) announce(`Stock Request ${req.requestNumber} deleted permanently.`);
                              }
                            }}
                            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                            title="Permanently Delete Stock Request"
                          >
                            <Icon name="trash-2" size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredRequests.length === 0 && (
                <div className="text-center py-16 bg-[#151515] rounded-3xl border border-white/5 font-sans space-y-3">
                  <Icon name="package" size={48} className="text-gray-700 mx-auto" />
                  <p className="text-xs text-gray-400 font-bold uppercase">
                    No stock requests found matching search criteria.
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Try adjusting search filters or selecting "All Statuses".
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1.5: INVENTORY & STOCK CONTROL */}
      {activeTab === 'inventory' && (
        <InventoryManagement
          isCloudLive={isCloudLive}
          currentUser={currentUser}
          isPurchasingOrAdmin={isPurchasingOrAdmin}
          announce={announce}
        />
      )}

      {/* TAB 2: PRODUCTION SUPPORT TICKETS */}
      {activeTab === 'tickets' && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-8 bg-black/20 p-1 rounded-2xl">
            {categories.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`py-3 rounded-xl transition-all font-sans text-xs font-black uppercase tracking-wider ${
                  activeCategory === cat.key ? `${cat.color} shadow-lg scale-98` : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orderItems.map(item => (
              <div key={item.id} className="bg-[#151515]/90 border border-white/5 rounded-[2.5rem] p-6 hover:border-white/10 transition-all flex flex-col justify-between">
                <div>
                  {item.photo && (
                    <div className="w-full h-48 rounded-2xl overflow-hidden bg-black/40 mb-4 border border-white/5">
                      <img src={item.photo} className="w-full h-full object-cover" alt="Order Attachment" />
                    </div>
                  )}
                  <h3 className="font-bold text-white text-lg font-sans">{item.title}</h3>
                  {item.notes && <p className="text-sm text-gray-400 mt-2 font-sans italic">{item.notes}</p>}
                  <p className="text-[10px] text-gray-500 font-mono mt-4">
                    Logged: {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                {canManageOrders && (
                  <div className="mt-6 pt-4 border-t border-white/5 flex justify-end">
                    <button 
                      onClick={() => handleDeleteOrder(item.id)} 
                      className="px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors"
                    >
                      <Icon name="trash-2" size={14} />
                      <span>Remove Ticket</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
            {orderItems.length === 0 && (
              <div className="col-span-full text-center py-20 bg-black/20 rounded-[3rem] border border-white/5 font-sans mb-8">
                <Icon name="banknote" size={48} className="text-gray-700 mx-auto" />
                <p className="text-xs text-gray-600 font-bold uppercase mt-4 font-sans">No tickets listed in this category.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB 3: SCANNED ORDER HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {orderHistory.map(order => (
            <div key={order.id} className="bg-[#151515]/90 border border-white/5 rounded-[2.5rem] p-8 hover:border-white/10 transition-all">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-6 mb-6">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl text-xs font-black tracking-widest uppercase">
                    Order Ref: {order.orderNumber}
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider`}>
                    {order.orderStatus || 'Pending'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-gray-400">
                  <div className="flex items-center gap-2">
                    <Icon name="calendar" size={14} className="text-[#ff8c00]" />
                    <span>{order.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="clock" size={14} className="text-[#ff8c00]" />
                    <span>{order.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="user" size={14} className="text-[#ff8c00]" />
                    <span className="text-gray-300 font-bold">{order.requestedBy}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Consolidated Products Included</p>
                <div className="grid grid-cols-1 gap-3">
                  {(order.items || []).map((prod: any, idx: number) => (
                    <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5 text-sm">
                      <div className="space-y-1">
                        <p className="font-bold text-white">{prod.productName}</p>
                        <p className="text-xs text-gray-500">
                          Supplier: <span className="text-gray-300">{prod.supplierName}</span> | Part No: <span className="text-gray-300">{prod.supplierPartNumber}</span>
                        </p>
                      </div>
                      <div className="mt-4 md:mt-0 flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-[10px] uppercase text-gray-500 font-bold">Storage Location</p>
                          <p className="font-mono text-xs text-gray-300">{prod.warehouseLocation || 'N/A'}</p>
                        </div>
                        <div className="px-4 py-2 bg-[#ff8c00]/10 border border-[#ff8c00]/20 rounded-lg text-[#ff8c00] font-black text-xs uppercase tracking-widest">
                          Qty: x{prod.basketQty}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {canManageOrders ? (
                    <>
                      <label className="text-xs text-gray-400 font-bold uppercase">Change Status:</label>
                      <select
                        value={order.orderStatus || 'Pending'}
                        onChange={(e) => handleUpdateScannedHistoryStatus(order.id, e.target.value)}
                        className="bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none cursor-pointer hover:border-white/20 transition-all font-bold"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Sent">Sent</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500 italic">Only supervisors can change order status.</p>
                  )}
                </div>

                {canManageOrders && (
                  <button
                    onClick={() => handleDeleteHistoryOrder(order.id)}
                    className="px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors"
                  >
                    <Icon name="trash-2" size={14} />
                    <span>Delete Record</span>
                  </button>
                )}
              </div>
            </div>
          ))}

          {orderHistory.length === 0 && (
            <div className="col-span-full text-center py-20 bg-black/20 rounded-[3rem] border border-white/5 font-sans">
              <Icon name="shopping-bag" size={48} className="text-gray-700 mx-auto" />
              <p className="text-xs text-gray-600 font-bold uppercase mt-4 font-sans">No scanned order history recorded yet.</p>
            </div>
          )}
        </div>
      )}

      {/* SECTION 4 & 5: REQUEST DETAILS & AUDIT HISTORY MODAL */}
      {selectedStockRequest && (
        <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 font-sans">
          <div className="bg-[#151515] border border-white/10 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="p-6 bg-black/50 border-b border-white/10 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black font-mono text-[#ff8c00]">
                    {selectedStockRequest.requestNumber}
                  </span>
                  {getStatusBadge(selectedStockRequest.status)}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Requested by <strong className="text-white">{selectedStockRequest.requestedByName}</strong> ({selectedStockRequest.requestedByRole}) &bull; {selectedStockRequest.branchName}
                </p>
              </div>

              <button
                onClick={() => setSelectedStockRequest(null)}
                className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">
              
              {/* Header Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-black/30 rounded-2xl border border-white/5 text-xs font-sans">
                <div>
                  <span className="block text-[10px] font-bold text-gray-500 uppercase">Created Timestamp</span>
                  <span className="text-gray-300 font-mono">
                    {new Date(selectedStockRequest.createdAt).toLocaleString('en-ZA')}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-gray-500 uppercase">User ID</span>
                  <span className="text-white font-mono">{selectedStockRequest.requestedByUid}</span>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-gray-500 uppercase">Branch</span>
                  <span className="text-white font-bold">{selectedStockRequest.branchName}</span>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-gray-500 uppercase">Product Totals</span>
                  <span className="text-white font-bold">{selectedStockRequest.totalProducts} Products</span>
                  <span className="block text-[#ff8c00] font-black">{selectedStockRequest.totalQuantity} Units</span>
                </div>
              </div>

              {selectedStockRequest.notes && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-300 italic font-sans">
                  <strong>Request Notes:</strong> {selectedStockRequest.notes}
                </div>
              )}

              {/* Status Transition Action Bar inside modal */}
              {isPurchasingOrAdmin && ['Pending', 'Ordered', 'Partially Received', 'Received'].includes(selectedStockRequest.status) && (
                <div className="p-4 bg-[#1f1f1f] rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs">
                    <span className="block font-bold text-white uppercase text-[10px]">Workflow Action</span>
                    <span className="text-gray-400">Current state: <strong className="text-[#ff8c00]">{selectedStockRequest.status}</strong></span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedStockRequest.status === 'Pending' && (
                      <button
                        onClick={() => handlePerformTransition(selectedStockRequest, 'Ordered')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-2"
                      >
                        <Icon name="shopping-cart" size={14} />
                        <span>Mark Ordered</span>
                      </button>
                    )}

                    {(selectedStockRequest.status === 'Ordered' || selectedStockRequest.status === 'Partially Received') && (
                      <button
                        onClick={() => setReceiveGoodsRequest(selectedStockRequest)}
                        className="px-4 py-2 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-2"
                      >
                        <Icon name="package" size={14} />
                        <span>Receive Goods</span>
                      </button>
                    )}

                    {selectedStockRequest.status === 'Received' && (
                      <button
                        onClick={() => handlePerformTransition(selectedStockRequest, 'Completed')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-2"
                      >
                        <Icon name="check-circle" size={14} />
                        <span>Complete Request</span>
                      </button>
                    )}

                    <button
                      onClick={() => setTransitionNotesModal({ request: selectedStockRequest, nextStatus: 'Cancelled' })}
                      className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                    >
                      <Icon name="x-circle" size={14} />
                      <span>Cancel Request</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <Icon name="package" size={14} className="text-[#ff8c00]" />
                  <span>Request Items ({selectedStockRequest.items.length})</span>
                </h4>

                <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/30">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-sans">
                      <thead className="bg-white/5 border-b border-white/10 text-gray-400 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Image</th>
                          <th className="p-3">Product Name</th>
                          <th className="p-3">Supplier</th>
                          <th className="p-3">Part Number</th>
                          <th className="p-3">Storage Location</th>
                          <th className="p-3 text-right">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-gray-300">
                        {selectedStockRequest.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-white/5 transition-colors">
                            <td className="p-3">
                              <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                                ) : (
                                  <Icon name="package" size={16} className="text-gray-600" />
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <div>
                                <span className="text-[9px] font-black uppercase text-gray-400 block font-mono">Product:</span>
                                <span className="font-bold text-white text-xs block">{item.productName}</span>
                              </div>
                              <div className="mt-1">
                                <span className="text-[9px] font-black uppercase text-gray-400 block font-mono">Code:</span>
                                <span className="font-mono text-purple-400 text-xs font-bold block">{item.productId}</span>
                              </div>
                            </td>
                            <td className="p-3 text-gray-400">{item.supplier}</td>
                            <td className="p-3 font-mono text-gray-400">{item.supplierPartNumber}</td>
                            <td className="p-3 font-mono text-gray-300">{item.location}</td>
                            <td className="p-3 text-right font-black text-[#ff8c00]">x{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* AUDIT HISTORY VERTICAL TIMELINE */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <Icon name="clock" size={14} className="text-[#ff8c00]" />
                  <span>Audit History Timeline</span>
                </h4>

                <div className="relative border-l-2 border-white/10 ml-3 pl-6 space-y-6">
                  {(selectedStockRequest.history || []).map((h, idx) => (
                    <div key={h.id || idx} className="relative">
                      {/* Timeline Node Dot */}
                      <div className={`absolute -left-[31px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                        h.action === 'Submitted' ? 'bg-amber-500 text-black' :
                        h.action === 'Ordered' ? 'bg-blue-500 text-white' :
                        h.action === 'Received' ? 'bg-purple-500 text-white' :
                        h.action === 'Completed' ? 'bg-emerald-500 text-black' :
                        'bg-red-500 text-white'
                      }`}>
                        <Icon name={
                          h.action === 'Submitted' ? 'clock' :
                          h.action === 'Ordered' ? 'shopping-cart' :
                          h.action === 'Received' ? 'package' :
                          h.action === 'Completed' ? 'check' : 'x'
                        } size={12} />
                      </div>

                      <div className="bg-black/30 p-4 rounded-xl border border-white/5 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-white">
                            {h.action === 'Submitted' ? 'Stock Request Created & Submitted' : `Request Marked ${h.action}`}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400">
                            {new Date(h.timestamp).toLocaleString('en-ZA')}
                          </span>
                        </div>

                        <p className="text-xs text-gray-400">
                          Action by <strong className="text-gray-200">{h.userName}</strong> ({h.role})
                        </p>

                        {h.notes && (
                          <p className="text-xs text-gray-300 italic pt-1 border-t border-white/5 mt-1">
                            "{h.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {(!selectedStockRequest.history || selectedStockRequest.history.length === 0) && (
                    <p className="text-xs text-gray-500 italic">No audit history recorded.</p>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-black/50 border-t border-white/10 flex items-center justify-between gap-4">
              <button
                onClick={() => setSelectedStockRequest(null)}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-white/10"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: OPTIONAL NOTES FOR STATUS TRANSITION / CANCELLATION */}
      {transitionNotesModal && (
        <div className="fixed inset-0 z-[2100] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in font-sans">
          <div className="bg-[#151515] border border-white/10 w-full max-w-md rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-lg font-black uppercase text-white">
                {transitionNotesModal.nextStatus === 'Cancelled' ? 'Cancel Stock Request' : `Mark as ${transitionNotesModal.nextStatus}`}
              </h3>
              <button onClick={() => setTransitionNotesModal(null)} className="text-gray-400 hover:text-white">
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-gray-300">
                You are updating request <strong className="text-[#ff8c00]">{transitionNotesModal.request.requestNumber}</strong> to status <strong className="text-white">{transitionNotesModal.nextStatus}</strong>.
              </p>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                  Notes / Reason (Optional)
                </label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Enter supplier notes, delivery delay info, or cancellation reason..."
                  rows={3}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setTransitionNotesModal(null)}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold uppercase"
              >
                Back
              </button>
              <button
                onClick={() => handlePerformTransition(transitionNotesModal.request, transitionNotesModal.nextStatus, actionNotes)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase text-white shadow-lg ${
                  transitionNotesModal.nextStatus === 'Cancelled' ? 'bg-red-600 hover:bg-red-500' : 'bg-[#ff8c00] hover:bg-[#e07b00]'
                }`}
              >
                Confirm {transitionNotesModal.nextStatus}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUPPORT TICKET MODAL */}
      {showOrderModal && (
        <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-8 animate-in fade-in">
          <div className="bg-[#151515] w-full max-w-lg rounded-[4rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col font-sans">
            <div className="p-8 border-b border-white/5 bg-black/20 flex justify-between items-center text-white font-sans">
              <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Log new Support Ticket</h2>
              <button onClick={() => setShowOrderModal(false)} className="p-3 text-gray-500 hover:text-white"><Icon name="x" size={24}/></button>
            </div>
            <div className="p-12 space-y-6">
              <form onSubmit={handleSaveOrder} className="space-y-6 text-left">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-500 ml-3">Product description / Job name</label>
                  <input required value={orderForm.title} onChange={e => setOrderForm({ ...orderForm, title: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 mt-1.5 text-white" placeholder="E.g., Oak Cabinet frame" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-500 ml-3">Special Instructions / notes</label>
                  <textarea value={orderForm.notes} onChange={e => setOrderForm({ ...orderForm, notes: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 mt-1.5 text-white text-sm" placeholder="E.g., Polish edge profile twice" rows={3} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-500 ml-3">Attach illustration / photo</label>
                  <div className="flex items-center gap-4 mt-1.5">
                    {orderForm.photo && (
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-black border border-white/5">
                        <img src={orderForm.photo} className="w-full h-full object-cover" alt="illustration preview" />
                      </div>
                    )}
                    <label className="flex-1 cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 text-center text-xs font-bold uppercase tracking-widest text-white">
                      Upload File
                      <input type="file" accept="image/*" onChange={handleOrderPhotoUpload} className="hidden" />
                    </label>
                  </div>
                </div>
                <button type="submit" className="w-full py-4 bg-[#ff8c00] hover:bg-[#e07b00] rounded-xl font-black uppercase text-xs tracking-widest text-white shadow-xl transition-colors mt-8">Save ticket</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* RECEIVE GOODS MODAL */}
      {receiveGoodsRequest && (
        <ReceiveGoodsModal
          request={receiveGoodsRequest}
          currentUser={currentUser}
          isPurchasingOrAdmin={isPurchasingOrAdmin}
          announce={announce}
          onClose={() => setReceiveGoodsRequest(null)}
          onSuccess={() => {
            setReceiveGoodsRequest(null);
            setSelectedStockRequest(null);
          }}
        />
      )}
    </div>
  );
};
