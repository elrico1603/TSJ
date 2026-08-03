import React, { useState, useEffect } from 'react';
import {
  ProductMaster,
  ProductCategory,
  Supplier,
  WarehouseLocation,
  MasterAuditLog,
  InventoryItem
} from '../types';
import { Icon } from './Icon';
import { productMasterService } from '../services/productMasterService';
import { inventoryService } from '../services/inventoryService';
import { ProductFormModal } from './ProductFormModal';
import { CategoryFormModal } from './CategoryFormModal';
import { SupplierFormModal } from './SupplierFormModal';
import { LocationFormModal } from './LocationFormModal';
import { QRCodeWidget } from './QRCodeWidget';

interface ProductMasterHubProps {
  currentUser?: any;
  isCloudLive?: boolean;
  announce?: (msg: string) => void;
}

export const ProductMasterHub: React.FC<ProductMasterHubProps> = ({
  currentUser,
  isCloudLive = false,
  announce
}) => {
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'suppliers' | 'locations' | 'audit'>('products');

  // Master Data State
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [auditLogs, setAuditLogs] = useState<MasterAuditLog[]>([]);
  const [inventoryMap, setInventoryMap] = useState<Record<string, number>>({});

  // Global Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'Active' | 'Archived' | 'All'>('Active');

  // Modal State
  const [productModal, setProductModal] = useState<{
    open: boolean;
    mode: 'create' | 'edit' | 'view' | 'duplicate';
    product: ProductMaster | null;
  }>({ open: false, mode: 'create', product: null });

  const [categoryModal, setCategoryModal] = useState<{ open: boolean; category: ProductCategory | null }>({ open: false, category: null });
  const [supplierModal, setSupplierModal] = useState<{ open: boolean; supplier: Supplier | null }>({ open: false, supplier: null });
  const [locationModal, setLocationModal] = useState<{ open: boolean; location: WarehouseLocation | null }>({ open: false, location: null });

  const [archiveConfirm, setArchiveConfirm] = useState<{ type: 'product' | 'category' | 'supplier' | 'location'; id: string; name: string } | null>(null);
  const [archiveReason, setArchiveReason] = useState('');

  // Subscriptions
  useEffect(() => {
    const unsubP = productMasterService.subscribeProducts(items => setProducts(items));
    const unsubC = productMasterService.subscribeCategories(items => setCategories(items));
    const unsubS = productMasterService.subscribeSuppliers(items => setSuppliers(items));
    const unsubL = productMasterService.subscribeLocations(items => setLocations(items));
    const unsubA = productMasterService.subscribeAuditLogs(items => setAuditLogs(items));

    // Inventory listener for live stock mapping
    const updateInvMap = () => {
      const invItems = inventoryService.getLocalInventory();
      const map: Record<string, number> = {};
      invItems.forEach(item => {
        map[item.productId] = item.currentQuantity;
        map[item.id] = item.currentQuantity;
      });
      setInventoryMap(map);
    };

    updateInvMap();
    const unsubInv = inventoryService.subscribeInventory(() => updateInvMap());

    return () => {
      unsubP();
      unsubC();
      unsubS();
      unsubL();
      unsubA();
      unsubInv();
    };
  }, []);

  // Filtered Products based on Global Search (Requirement 8)
  const filteredProducts = products.filter(p => {
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    const matchesCat = selectedCategory === 'All' || p.categoryId === selectedCategory || p.category === selectedCategory;
    const matchesSupp = selectedSupplier === 'All' || p.supplierId === selectedSupplier || p.supplier === selectedSupplier;

    if (!matchesStatus || !matchesCat || !matchesSupp) return false;

    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase().trim();
    return (
      p.productName.toLowerCase().includes(q) ||
      p.internalProductCode.toLowerCase().includes(q) ||
      p.supplier.toLowerCase().includes(q) ||
      p.supplierPartNumber.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.qrCode && p.qrCode.toLowerCase().includes(q)) ||
      p.location.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  const handleArchiveSubmit = async () => {
    if (!archiveConfirm) return;
    const username = currentUser?.name || currentUser?.email || 'Admin User';

    try {
      if (archiveConfirm.type === 'product') {
        await productMasterService.archiveProduct(archiveConfirm.id, username, archiveReason || 'Archived by user');
      } else if (archiveConfirm.type === 'category') {
        await productMasterService.updateCategory(archiveConfirm.id, { status: 'Archived' }, username);
      } else if (archiveConfirm.type === 'supplier') {
        await productMasterService.updateSupplier(archiveConfirm.id, { status: 'Archived' }, username);
      } else if (archiveConfirm.type === 'location') {
        await productMasterService.updateWarehouseLocation(archiveConfirm.id, { status: 'Archived' }, username);
      }
      if (announce) announce(`Archived ${archiveConfirm.name}`);
      setArchiveConfirm(null);
      setArchiveReason('');
    } catch (e: any) {
      alert(`Archive failed: ${e?.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER & TITLE BAR */}
      <div className="bg-[#151515] border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#ff8c00]/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-[#ff8c00]/20 text-[#ff8c00] border border-[#ff8c00]/30">
                Single Source of Truth
              </span>
              {isCloudLive && (
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Cloud Live
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight uppercase flex items-center gap-3">
              <Icon name="database" size={28} className="text-[#ff8c00]" />
              <span>Product Master & Central Data</span>
            </h1>
            <p className="text-xs text-gray-400 font-medium mt-1 max-w-xl">
              Centralized catalog powering Kanban, Inventory, Orders, Procurement & Warehouse operations.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setProductModal({ open: true, mode: 'create', product: null })}
              className="px-5 py-3 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 active:scale-95"
            >
              <Icon name="plus" size={18} />
              <span>New Product Master</span>
            </button>
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div className="mt-6 flex items-center gap-2 border-b border-white/10 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveTab('products')}
            className={`pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-2 ${
              activeTab === 'products'
                ? 'border-[#ff8c00] text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon name="package" size={16} />
            <span>Product Master ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-2 ${
              activeTab === 'categories'
                ? 'border-[#ff8c00] text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon name="tag" size={16} />
            <span>Categories ({categories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('suppliers')}
            className={`pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-2 ${
              activeTab === 'suppliers'
                ? 'border-[#ff8c00] text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon name="truck" size={16} />
            <span>Suppliers ({suppliers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('locations')}
            className={`pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-2 ${
              activeTab === 'locations'
                ? 'border-[#ff8c00] text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon name="map-pin" size={16} />
            <span>Locations ({locations.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'border-[#ff8c00] text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon name="shield" size={16} />
            <span>Audit Trail ({auditLogs.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PRODUCT MASTER */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          
          {/* SEARCH & FILTER BAR */}
          <div className="bg-[#151515] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Global Search Input */}
            <div className="relative w-full md:w-96">
              <Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search Name, Code, Supplier, Part #, QR, Barcode, Location..."
                className="w-full bg-[#111111] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
              >
                <option value="All">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                value={selectedSupplier}
                onChange={e => setSelectedSupplier(e.target.value)}
                className="bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
              >
                <option value="All">All Suppliers</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.supplierName}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
              >
                <option value="Active">Active Products</option>
                <option value="Archived">Archived Products</option>
                <option value="All">All Statuses</option>
              </select>
            </div>
          </div>

          {/* PRODUCTS LIST / CARDS */}
          {filteredProducts.length === 0 ? (
            <div className="bg-[#151515] border border-white/10 rounded-2xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gray-800 text-gray-500 flex items-center justify-center mx-auto">
                <Icon name="package" size={24} />
              </div>
              <h3 className="text-sm font-bold text-white uppercase">No Master Products Found</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                No product records match your current search criteria. Try clearing filters or create a new product master record.
              </p>
              <button
                onClick={() => setProductModal({ open: true, mode: 'create', product: null })}
                className="mt-2 px-4 py-2 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-bold uppercase"
              >
                Create Product Master
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map(p => {
                const liveStock = inventoryMap[p.id] ?? inventoryMap[p.internalProductCode] ?? (p.currentStock || 0);
                const isLow = liveStock <= p.minimumStock;

                return (
                  <div
                    key={p.id}
                    className="bg-[#151515] border border-white/10 rounded-2xl p-5 hover:border-[#ff8c00]/50 transition-all flex flex-col justify-between group relative overflow-hidden"
                  >
                    {/* Top Status & ID Bar */}
                    <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-3">
                      <span className="font-mono text-xs font-black text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded uppercase">
                        {p.internalProductCode}
                      </span>

                      <div className="flex items-center gap-2">
                        {isLow ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1">
                            <Icon name="alert-triangle" size={12} />
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            In Stock
                          </span>
                        )}

                        {p.status === 'Archived' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-gray-500/20 text-gray-400 border border-gray-500/30">
                            Archived
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Main Info Body */}
                    <div className="py-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 shrink-0 flex items-center justify-center overflow-hidden">
                          {p.productImage ? (
                            <img src={p.productImage} alt={p.productName} className="w-full h-full object-cover" />
                          ) : (
                            <QRCodeWidget text={p.id} className="w-10 h-10" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-extrabold text-white uppercase leading-snug line-clamp-2">
                            {p.productName}
                          </h3>
                          <p className="text-[11px] text-gray-400 font-medium mt-0.5 truncate">
                            {p.category || 'General'} • {p.unit}
                          </p>
                        </div>
                      </div>

                      {/* Specification Metadata Grid */}
                      <div className="bg-[#111111] border border-white/5 rounded-xl p-3 grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="block text-gray-500 font-bold uppercase text-[9px]">Supplier</span>
                          <span className="font-bold text-gray-200 truncate block">{p.supplier || 'N/A'}</span>
                          <span className="text-[10px] font-mono text-gray-400 truncate block">Part: {p.supplierPartNumber || 'N/A'}</span>
                        </div>

                        <div>
                          <span className="block text-gray-500 font-bold uppercase text-[9px]">Location</span>
                          <span className="font-bold text-amber-400 font-mono block">{p.location || 'N/A'}</span>
                          <span className="text-[10px] text-gray-400 block">Lead: {p.deliveryTime || 'N/A'}</span>
                        </div>
                      </div>

                      {/* Stock Readout Counter */}
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                        <div>
                          <span className="block text-[10px] font-extrabold text-gray-400 uppercase">Current Inventory</span>
                          <span className={`text-xl font-black font-mono leading-none ${isLow ? 'text-red-400' : 'text-emerald-400'}`}>
                            {liveStock} <span className="text-xs text-gray-400 font-sans uppercase">{p.unit}</span>
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="block text-[9px] font-bold text-gray-500 uppercase">Min / Max</span>
                          <span className="text-xs font-mono font-bold text-gray-300">
                            {p.minimumStock} / {p.maximumStock}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Action Buttons */}
                    <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setProductModal({ open: true, mode: 'view', product: p })}
                          className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1"
                          title="View Details"
                        >
                          <Icon name="eye" size={14} />
                          <span>View</span>
                        </button>

                        <button
                          onClick={() => setProductModal({ open: true, mode: 'edit', product: p })}
                          className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-[#ff8c00] rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1"
                          title="Edit Master"
                        >
                          <Icon name="edit-3" size={14} />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => setProductModal({ open: true, mode: 'duplicate', product: p })}
                          className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-purple-400 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1"
                          title="Duplicate Product"
                        >
                          <Icon name="copy" size={14} />
                          <span>Copy</span>
                        </button>
                      </div>

                      {p.status === 'Active' ? (
                        <button
                          onClick={() => setArchiveConfirm({ type: 'product', id: p.id, name: p.productName })}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Archive Product"
                        >
                          <Icon name="archive" size={16} />
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            const username = currentUser?.name || currentUser?.email || 'Admin User';
                            await productMasterService.restoreProduct(p.id, username, 'Restored by user');
                          }}
                          className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-bold uppercase"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PRODUCT CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#151515] border border-white/10 rounded-2xl p-4">
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Product Categories</h2>
              <p className="text-xs text-gray-400">Classify product master records for purchasing & reporting.</p>
            </div>
            <button
              onClick={() => setCategoryModal({ open: true, category: null })}
              className="px-4 py-2 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2"
            >
              <Icon name="plus" size={16} />
              <span>Add Category</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(c => {
              const productCount = products.filter(p => p.categoryId === c.id || p.category === c.name).length;
              return (
                <div key={c.id} className="bg-[#151515] border border-white/10 rounded-2xl p-5 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-mono font-bold text-[#ff8c00] bg-[#ff8c00]/10 px-2 py-0.5 rounded border border-[#ff8c00]/30">
                        {c.code}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">
                        {productCount} Products
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-white uppercase">{c.name}</h3>
                    <p className="text-xs text-gray-400 mt-1">{c.description || 'No description provided.'}</p>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setCategoryModal({ open: true, category: c })}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-bold uppercase flex items-center gap-1"
                    >
                      <Icon name="edit-3" size={14} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setArchiveConfirm({ type: 'category', id: c.id, name: c.name })}
                      className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg"
                      title="Archive Category"
                    >
                      <Icon name="archive" size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: SUPPLIERS */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#151515] border border-white/10 rounded-2xl p-4">
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Supplier Management</h2>
              <p className="text-xs text-gray-400">Manage vendor contact info, lead times, and preferred status.</p>
            </div>
            <button
              onClick={() => setSupplierModal({ open: true, supplier: null })}
              className="px-4 py-2 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2"
            >
              <Icon name="plus" size={16} />
              <span>Add Supplier</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map(s => {
              const suppliedProducts = products.filter(p => p.supplierId === s.id || p.supplier === s.supplierName).length;
              return (
                <div key={s.id} className="bg-[#151515] border border-white/10 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/30">
                        {s.supplierCode}
                      </span>
                      {s.preferredSupplier && (
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                          Preferred
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-extrabold text-white uppercase">{s.supplierName}</h3>
                    <p className="text-xs text-gray-400 font-medium">Contact: {s.contactPerson || 'N/A'}</p>

                    <div className="mt-3 bg-[#111111] p-3 rounded-xl border border-white/5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-gray-300">
                        <span className="text-gray-500 font-bold uppercase text-[10px]">Phone:</span>
                        <span>{s.telephone || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between text-gray-300">
                        <span className="text-gray-500 font-bold uppercase text-[10px]">Email:</span>
                        <span className="truncate max-w-[180px]">{s.email || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between text-gray-300">
                        <span className="text-gray-500 font-bold uppercase text-[10px]">Lead Time:</span>
                        <span className="text-emerald-400 font-bold">{s.leadTimeDays} Days</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                    <span className="text-gray-400 font-bold">{suppliedProducts} Linked Items</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSupplierModal({ open: true, supplier: s })}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-bold uppercase flex items-center gap-1"
                      >
                        <Icon name="edit-3" size={14} />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => setArchiveConfirm({ type: 'supplier', id: s.id, name: s.supplierName })}
                        className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg"
                      >
                        <Icon name="archive" size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: WAREHOUSE LOCATIONS */}
      {activeTab === 'locations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#151515] border border-white/10 rounded-2xl p-4">
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Warehouse Location Matrix</h2>
              <p className="text-xs text-gray-400">Structured Aisle-Rack-Shelf-Bin layout references.</p>
            </div>
            <button
              onClick={() => setLocationModal({ open: true, location: null })}
              className="px-4 py-2 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2"
            >
              <Icon name="plus" size={16} />
              <span>Add Location</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {locations.map(l => (
              <div key={l.id} className="bg-[#151515] border border-white/10 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-black font-mono text-[#ff8c00] bg-[#ff8c00]/10 px-2.5 py-1 rounded-lg border border-[#ff8c00]/30">
                      {l.locationCode}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-white/10 text-white">
                      {l.colour || 'GREEN'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{l.description || 'Warehouse Bin Location'}</p>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setLocationModal({ open: true, location: l })}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-bold uppercase flex items-center gap-1"
                  >
                    <Icon name="edit-3" size={14} />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => setArchiveConfirm({ type: 'location', id: l.id, name: l.locationCode })}
                    className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg"
                  >
                    <Icon name="archive" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-[#151515] border border-white/10 rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Icon name="shield" size={18} className="text-[#ff8c00]" />
              <span>Master Data Change Audit Log</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Complete chronological audit trail recording creates, updates, archives, and soft deletes with user & reason signatures.
            </p>
          </div>

          <div className="divide-y divide-white/5 border border-white/10 rounded-2xl overflow-hidden bg-[#111111]">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">No audit logs recorded yet.</div>
            ) : (
              auditLogs.map(a => (
                <div key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02]">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        a.action === 'Created' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        a.action === 'Updated' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {a.action}
                      </span>
                      <span className="text-xs font-bold text-white uppercase">{a.entityType}: {a.entityName}</span>
                    </div>
                    <p className="text-xs text-gray-400 italic">"{a.reason || 'No reason specified'}"</p>
                  </div>

                  <div className="text-right text-[11px] text-gray-400 shrink-0">
                    <span className="font-bold text-gray-200 block">{a.user}</span>
                    <span className="font-mono text-gray-500">{new Date(a.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      {productModal.open && (
        <ProductFormModal
          mode={productModal.mode}
          product={productModal.product}
          categories={categories}
          suppliers={suppliers}
          locations={locations}
          currentUser={currentUser}
          onClose={() => setProductModal({ open: false, mode: 'create', product: null })}
          onSave={() => {
            setProductModal({ open: false, mode: 'create', product: null });
            if (announce) announce('Product Master saved successfully');
          }}
        />
      )}

      {categoryModal.open && (
        <CategoryFormModal
          category={categoryModal.category}
          currentUser={currentUser}
          onClose={() => setCategoryModal({ open: false, category: null })}
          onSave={() => {
            setCategoryModal({ open: false, category: null });
            if (announce) announce('Category saved successfully');
          }}
        />
      )}

      {supplierModal.open && (
        <SupplierFormModal
          supplier={supplierModal.supplier}
          currentUser={currentUser}
          onClose={() => setSupplierModal({ open: false, supplier: null })}
          onSave={() => {
            setSupplierModal({ open: false, supplier: null });
            if (announce) announce('Supplier saved successfully');
          }}
        />
      )}

      {locationModal.open && (
        <LocationFormModal
          location={locationModal.location}
          currentUser={currentUser}
          onClose={() => setLocationModal({ open: false, location: null })}
          onSave={() => {
            setLocationModal({ open: false, location: null });
            if (announce) announce('Location saved successfully');
          }}
        />
      )}

      {/* ARCHIVE CONFIRMATION MODAL */}
      {archiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#151515] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Icon name="archive" size={18} className="text-red-400" />
              <span>Archive {archiveConfirm.name}?</span>
            </h3>
            <p className="text-xs text-gray-400">
              Archiving this record soft-deletes it from active selections. Please state a reason for audit tracking.
            </p>

            <input
              type="text"
              value={archiveReason}
              onChange={e => setArchiveReason(e.target.value)}
              placeholder="State reason for archiving..."
              className="w-full bg-[#111111] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-red-400"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setArchiveConfirm(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveSubmit}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider"
              >
                Confirm Archive
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
