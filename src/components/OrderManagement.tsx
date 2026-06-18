import React, { useState, useEffect } from 'react';
import { db, APP_ID_PATH } from '../firebase';
import { OrderItem } from '../types';
import { Icon } from './Icon';

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
  const [activeCategory, setActiveCategory] = useState<string>('red');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderForm, setOrderForm] = useState({ title: '', notes: '', photo: '' });

  // Load orders
  useEffect(() => {
    if (isCloudLive && activeCategory) {
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
  }, [activeCategory, isCloudLive]);

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

  return (
    <div className="animate-in fade-in duration-500 font-sans">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black uppercase tracking-tighter text-white font-sans">Order Management</h2>
        {canManageOrders && (
          <button 
            onClick={() => setShowOrderModal(true)} 
            className="px-6 py-3 bg-[#ff8c00] hover:bg-[#e07b00] rounded-xl text-xs font-black uppercase tracking-widest text-white transition-colors"
          >
            Log New Order
          </button>
        )}
      </div>

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
            <p className="text-xs text-gray-600 font-bold uppercase mt-4 font-sans">No orders listed in this category.</p>
          </div>
        )}
      </div>

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
