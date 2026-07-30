import React, { useState, useEffect } from 'react';
import { db, APP_ID_PATH } from '../firebase';
import { OrderItem } from '../types';
import { Icon } from './Icon';
import { notificationService } from '../services/notificationService';

interface OrderManagementProps {
  isCloudLive: boolean;
  canManageOrders: boolean;
  announce: (txt: string) => void;
}

export const OrderManagement: React.FC<OrderManagementProps> = ({
  isCloudLive,
  canManageOrders,
  announce
}) => {
  const [activeTab, setActiveTab] = useState<'tickets' | 'history'>('tickets');
  const [activeCategory, setActiveCategory] = useState<string>('red');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderForm, setOrderForm] = useState({ title: '', notes: '', photo: '' });

  // Load priority tickets
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
              // Sort by date/time or createdAt descending
              list.sort((a, b) => {
                const dateA = a.createdAt || '';
                const dateB = b.createdAt || '';
                return dateB.localeCompare(dateA);
              });
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

  // Local fallback mock data when not cloud live
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
            },
            {
              kanbanId: 'K-102',
              productName: 'Screws 4x30',
              supplierName: 'Fasteners SA',
              supplierPartNumber: 'SCR-430',
              baseOrderQuantity: '1000 Pcs',
              binQuantity: '2 Bins',
              warehouseLocation: 'B04 (Yellow)',
              deliveryTime: '1 Day',
              basketQty: 5
            }
          ]
        },
        {
          id: 'SO-418293',
          orderNumber: 'SO-418293',
          date: '2026-07-21',
          time: '09:15:44',
          requestedBy: 'Assembly Artisan',
          products: ['PVA Adhesive 5L'],
          requestedQuantities: [1],
          orderStatus: 'Sent',
          createdAt: '2026-07-21T09:15:44.000Z',
          items: [
            {
              kanbanId: 'K-105',
              productName: 'PVA Adhesive 5L',
              supplierName: 'Glue SA',
              supplierPartNumber: 'PVA-5',
              baseOrderQuantity: '4 Buckets',
              binQuantity: '1 Bin',
              warehouseLocation: 'C02 (Green)',
              deliveryTime: '2 Days',
              basketQty: 1
            }
          ]
        }
      ]);
    }
  }, [activeTab, isCloudLive, orderHistory.length]);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
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
        console.error("Failed to update status:", err);
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

    // Trigger Global Notification for new stock order
    try {
      await notificationService.addNotification({
        category: 'stock_order',
        categoryLabel: 'Stock Orders',
        title: `New Stock Order: ${newOrder.title}`,
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
    announce('Order status registered');
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

  const categories = [
    { key: 'red', label: 'Urgent Priority', color: 'bg-red-500 text-white' },
    { key: 'yellow', label: 'Medium Priority', color: 'bg-yellow-500 text-black' },
    { key: 'green', label: 'Standard Schedule', color: 'bg-green-500 text-white' }
  ];

  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase().trim();
    if (s === 'pending') return 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20';
    if (s === 'sent') return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    if (s === 'completed') return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    if (s === 'cancelled') return 'bg-red-500/10 text-red-400 border border-red-500/20';
    return 'bg-gray-500/10 text-gray-400 border border-gray-500/20';
  };

  return (
    <div className="animate-in fade-in duration-500 font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter text-white font-sans">Order Management</h2>
          <p className="text-xs text-gray-400 mt-1 font-sans">
            Track urgent workspace support tickets and review system-generated scanned Kanban replenishment orders.
          </p>
        </div>
        {canManageOrders && activeTab === 'tickets' && (
          <button 
            onClick={() => setShowOrderModal(true)} 
            className="px-6 py-3 bg-[#ff8c00] hover:bg-[#e07b00] rounded-xl text-xs font-black uppercase tracking-widest text-white transition-colors"
          >
            Log New Ticket
          </button>
        )}
      </div>

      {/* Primary Sub-Navigation Tabs */}
      <div className="flex border-b border-white/10 mb-8 space-x-8">
        <button
          onClick={() => setActiveTab('tickets')}
          className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${
            activeTab === 'tickets'
              ? 'border-[#ff8c00] text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          Production Support Tickets
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${
            activeTab === 'history'
              ? 'border-[#ff8c00] text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          Scanned Order History
        </button>
      </div>

      {activeTab === 'tickets' ? (
        <>
          {/* Priority Filters for Tickets */}
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
      ) : (
        /* Scanned Order History Tab View */
        <div className="space-y-6">
          {orderHistory.map(order => (
            <div key={order.id} className="bg-[#151515]/90 border border-white/5 rounded-[2.5rem] p-8 hover:border-white/10 transition-all">
              {/* Order Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-6 mb-6">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl text-xs font-black tracking-widest uppercase">
                    Order Ref: {order.orderNumber}
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(order.orderStatus)}`}>
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

              {/* Order Items List */}
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
                        <p className="text-xs text-gray-500">
                          Base Qty: <span className="text-gray-300">{prod.baseOrderQuantity}</span> | Bin configuration: <span className="text-gray-300">{prod.binQuantity}</span> | Lead time: <span className="text-gray-300">{prod.deliveryTime}</span>
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

              {/* Action Controls */}
              <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {canManageOrders ? (
                    <>
                      <label className="text-xs text-gray-400 font-bold uppercase">Change Status:</label>
                      <select
                        value={order.orderStatus || 'Pending'}
                        onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
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

      {showOrderModal && (
        <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-8 animate-in fade-in">
          <div className="bg-[#151515] w-full max-w-lg rounded-[4rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-8 border-b border-white/5 bg-black/20 flex justify-between items-center text-white italic font-sans">
              <h2 className="text-2xl font-black uppercase tracking-tighter text-white font-sans">log new Ticket / order</h2>
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
                <button type="submit" className="w-full py-4 bg-[#ff8c00] hover:bg-[#e07b00] rounded-xl font-black uppercase text-xs tracking-widest text-white shadow-xl transition-colors mt-8 font-sans">Save ticket</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
