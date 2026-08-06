import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { googleDriveService, DriveFileInfo, DriveFolderInfo } from '../services/googleDriveService';
import { DispatchPhotoUploader } from './DispatchPhotoUploader';
import { DispatchRecord, DispatchItem } from './DispatchDetails';
import { productMasterService } from '../services/productMasterService';
import { ProductMaster } from '../types';

interface DispatchWizardProps {
  initialDispatch?: DispatchRecord | null;
  onSave: (dispatchData: Partial<DispatchRecord>, finalStatus: 'Draft' | 'Ready for Dispatch' | 'Dispatched') => Promise<void>;
  onCancel: () => void;
  currentUser?: any;
  announce?: (msg: string) => void;
}

export const DispatchWizard: React.FC<DispatchWizardProps> = ({
  initialDispatch,
  onSave,
  onCancel,
  currentUser,
  announce
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [dispatchNumber, setDispatchNumber] = useState(
    initialDispatch?.dispatchNumber || `DSP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [customer, setCustomer] = useState(initialDispatch?.customer || '');
  const [project, setProject] = useState(initialDispatch?.project || '');
  const [destinationBranch, setDestinationBranch] = useState(initialDispatch?.destinationBranch || 'Cape Town');
  const [installer, setInstaller] = useState(initialDispatch?.installer || '');
  const [courier, setCourier] = useState(initialDispatch?.courier || '');
  const [courierCompany, setCourierCompany] = useState(initialDispatch?.courierCompany || 'The Courier Guy');
  const [trackingNumber, setTrackingNumber] = useState(initialDispatch?.trackingNumber || '');
  const [parcelCount, setParcelCount] = useState(initialDispatch?.parcelCount || '1 Parcel');
  const [notes, setNotes] = useState(initialDispatch?.notes || '');

  // Dispatch Items & Product Autocomplete
  const [items, setItems] = useState<DispatchItem[]>(initialDispatch?.items || []);
  const [allProducts, setAllProducts] = useState<ProductMaster[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [matchingProducts, setMatchingProducts] = useState<ProductMaster[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [isCustomProduct, setIsCustomProduct] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemCode, setCustomItemCode] = useState('');

  // Fetch products for autocomplete
  useEffect(() => {
    const prods = productMasterService.getLocalProducts();
    setAllProducts(prods);
  }, []);

  // Filter products when typing query
  useEffect(() => {
    if (!productQuery.trim()) {
      setMatchingProducts([]);
      setShowProductDropdown(false);
      return;
    }
    const q = productQuery.toLowerCase();
    const filtered = allProducts.filter(p =>
      p.productName.toLowerCase().includes(q) ||
      p.internalProductCode.toLowerCase().includes(q) ||
      (p.category && p.category.toLowerCase().includes(q))
    ).slice(0, 8);
    setMatchingProducts(filtered);
    setShowProductDropdown(true);
  }, [productQuery, allProducts]);

  const handleSelectMasterProduct = (prod: ProductMaster) => {
    const newItem: DispatchItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      productId: prod.id,
      internalProductCode: prod.internalProductCode,
      productName: prod.productName,
      supplier: prod.supplier,
      supplierPartNumber: prod.supplierPartNumber,
      baseOrderQuantity: prod.orderQuantity ? String(prod.orderQuantity) : '1',
      location: prod.location,
      deliveryTime: prod.deliveryTime,
      category: prod.category,
      quantity: itemQuantity,
      isCustom: false
    };

    setItems(prev => [...prev, newItem]);
    setProductQuery('');
    setShowProductDropdown(false);
    setItemQuantity(1);
  };

  const handleAddCustomProduct = () => {
    if (!customItemName.trim()) return;
    const newItem: DispatchItem = {
      id: `item_custom_${Date.now()}`,
      internalProductCode: customItemCode || `CUST-${Math.floor(100 + Math.random() * 900)}`,
      productName: customItemName,
      quantity: itemQuantity,
      isCustom: true
    };
    setItems(prev => [...prev, newItem]);
    setCustomItemName('');
    setCustomItemCode('');
    setIsCustomProduct(false);
    setItemQuantity(1);
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  // Google Drive State
  const [driveFolder, setDriveFolder] = useState<DriveFolderInfo | null>(
    initialDispatch?.googleDriveFolderId ? {
      folderId: initialDispatch.googleDriveFolderId,
      folderName: initialDispatch.googleDriveFolderName || `Folder_${dispatchNumber}`,
      folderUrl: initialDispatch.googleDriveFolderUrl || `https://drive.google.com/drive/folders/${initialDispatch.googleDriveFolderId}`
    } : null
  );
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Photos
  const [photos, setPhotos] = useState<DriveFileInfo[]>(initialDispatch?.photos || []);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!customer.trim()) errs.customer = 'Customer / Client name is required';
    if (!project.trim()) errs.project = 'Project name is required';
    if (!destinationBranch.trim()) errs.destinationBranch = 'Destination branch is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNextToStep2 = async () => {
    if (!validateStep1()) return;

    setCurrentStep(2);

    // Auto create Google Drive Folder if not already created
    if (!driveFolder) {
      setIsCreatingFolder(true);
      try {
        const folder = await googleDriveService.createDispatchFolder({
          dispatchNumber,
          customer,
          project,
          branch: destinationBranch
        });
        setDriveFolder(folder);
        announce?.(`Google Drive folder created: ${folder.folderName}`);
      } catch (e) {
        console.error('Failed to create Google Drive folder:', e);
      } finally {
        setIsCreatingFolder(false);
      }
    }
  };

  const handleFinish = async (targetStatus: 'Draft' | 'Ready for Dispatch' | 'Dispatched') => {
    if (!validateStep1()) {
      setCurrentStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      let finalFolder = driveFolder;
      if (!finalFolder) {
        finalFolder = await googleDriveService.createDispatchFolder({
          dispatchNumber,
          customer,
          project,
          branch: destinationBranch
        });
      }

      let trackingUrl = '';
      if (trackingNumber.trim()) {
        const trk = trackingNumber.trim();
        if (courierCompany === 'The Courier Guy') {
          trackingUrl = `https://portal.thecourierguy.co.za/track?tracking_number=${encodeURIComponent(trk)}`;
        } else if (courierCompany === 'RAM Hand-to-Hand') {
          trackingUrl = `https://www.ram.co.za/Tracking?trackingNumber=${encodeURIComponent(trk)}`;
        } else if (courierCompany === 'DHL Express') {
          trackingUrl = `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(trk)}`;
        } else if (courierCompany === 'FedEx') {
          trackingUrl = `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trk)}`;
        } else {
          trackingUrl = trk.startsWith('http') ? trk : `https://www.google.com/search?q=${encodeURIComponent(courierCompany + ' ' + trk)}`;
        }
      }

      const payload: Partial<DispatchRecord> = {
        dispatchNumber,
        customer,
        project,
        destinationBranch,
        installer,
        courier: courier || courierCompany,
        courierCompany,
        trackingNumber,
        trackingUrl,
        parcelCount,
        items,
        notes,
        status: targetStatus,
        googleDriveFolderId: finalFolder.folderId,
        googleDriveFolderName: finalFolder.folderName,
        googleDriveFolderUrl: finalFolder.folderUrl,
        photoCount: photos.length,
        photos,
        createdBy: initialDispatch?.createdBy || currentUser?.fullName || currentUser?.name || 'Dispatch Supervisor'
      };

      await onSave(payload, targetStatus);
      announce?.(`Dispatch ${dispatchNumber} saved as ${targetStatus}`);
    } catch (err) {
      console.error('Error saving dispatch:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto font-sans">
      <div className="bg-[#121214] border border-white/10 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col my-auto">
        {/* Wizard Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#121214]/90 backdrop-blur-md z-20">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-[#ff8c00]/10 text-[#ff8c00] rounded-2xl border border-[#ff8c00]/30">
              <Icon name="package" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase text-white tracking-wider">
                {initialDispatch ? `Edit Dispatch: ${dispatchNumber}` : 'New Dispatch Shipment'}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Multi-Step Dispatch Wizard & Google Drive Archival</p>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Wizard Progress Bar */}
        <div className="px-6 pt-6 font-sans">
          <div className="grid grid-cols-3 gap-3 text-center">
            <button
              onClick={() => setCurrentStep(1)}
              className={`p-3 rounded-2xl border transition-all flex items-center justify-center space-x-2 text-xs font-black uppercase tracking-wider ${
                currentStep === 1
                  ? 'bg-[#ff8c00]/20 text-[#ff8c00] border-[#ff8c00]/40 shadow'
                  : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-[#ff8c00]/20 text-[#ff8c00] border border-[#ff8c00]/30 flex items-center justify-center text-[10px] font-mono">1</span>
              <span className="hidden sm:inline">1. General Info</span>
            </button>

            <button
              onClick={() => validateStep1() && handleNextToStep2()}
              className={`p-3 rounded-2xl border transition-all flex items-center justify-center space-x-2 text-xs font-black uppercase tracking-wider ${
                currentStep === 2
                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/40 shadow'
                  : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-[10px] font-mono">2</span>
              <span className="hidden sm:inline">2. Google Drive</span>
            </button>

            <button
              onClick={() => validateStep1() && setCurrentStep(3)}
              className={`p-3 rounded-2xl border transition-all flex items-center justify-center space-x-2 text-xs font-black uppercase tracking-wider ${
                currentStep === 3
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow'
                  : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-[10px] font-mono">3</span>
              <span className="hidden sm:inline">3. Photos</span>
            </button>
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6 space-y-6 flex-1">
          {/* STEP 1: General Information */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="border-b border-white/10 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Step 1: General Information</h3>
                <p className="text-xs text-gray-400 mt-0.5">Enter client, destination, courier, and shipment tracking details</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1.5">
                    Automatic Dispatch Number
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={dispatchNumber}
                    className="bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-amber-400 font-mono font-bold w-full outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1.5">
                    Customer / Client <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    placeholder="e.g. Waterfront Hotel & Suites"
                    className={`bg-black border rounded-xl px-4 py-2.5 text-xs text-white w-full outline-none focus:border-[#ff8c00] ${
                      errors.customer ? 'border-red-500' : 'border-white/10'
                    }`}
                  />
                  {errors.customer && <p className="text-[10px] text-red-400 mt-1 font-mono">{errors.customer}</p>}
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1.5">
                    Project <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    placeholder="e.g. Master Bedroom Joinery Phase 2"
                    className={`bg-black border rounded-xl px-4 py-2.5 text-xs text-white w-full outline-none focus:border-[#ff8c00] ${
                      errors.project ? 'border-red-500' : 'border-white/10'
                    }`}
                  />
                  {errors.project && <p className="text-[10px] text-red-400 mt-1 font-mono">{errors.project}</p>}
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1.5">
                    Destination Branch <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={destinationBranch}
                    onChange={(e) => setDestinationBranch(e.target.value)}
                    className="bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white w-full outline-none focus:border-[#ff8c00]"
                  >
                    <option value="Cape Town">Cape Town (Main Vault)</option>
                    <option value="Johannesburg">Johannesburg Branch</option>
                    <option value="Durban Workshop">Durban Workshop</option>
                    <option value="Jobsite Installation">Jobsite Direct Installation</option>
                    <option value="Export Logistics Hub">Export Logistics Hub</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1.5">
                    Installer / Site Supervisor
                  </label>
                  <input
                    type="text"
                    value={installer}
                    onChange={(e) => setInstaller(e.target.value)}
                    placeholder="e.g. Johan Van Der Merwe"
                    className="bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white w-full outline-none focus:border-[#ff8c00]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1.5">
                    Courier Company
                  </label>
                  <select
                    value={courierCompany}
                    onChange={(e) => {
                      setCourierCompany(e.target.value);
                      if (e.target.value !== 'Other') setCourier(e.target.value);
                    }}
                    className="bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white w-full outline-none focus:border-[#ff8c00]"
                  >
                    <option value="The Courier Guy">The Courier Guy</option>
                    <option value="RAM Hand-to-Hand">RAM Hand-to-Hand Couriers</option>
                    <option value="DHL Express">DHL Express</option>
                    <option value="FedEx">FedEx Express</option>
                    <option value="Other">Custom Courier Service</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1.5">
                    Courier Service Name
                  </label>
                  <input
                    type="text"
                    value={courier}
                    onChange={(e) => setCourier(e.target.value)}
                    placeholder="e.g. RAM Hand-to-Hand / Overnight"
                    className="bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white w-full outline-none focus:border-[#ff8c00]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1.5">
                    Courier Tracking Number
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="e.g. TRK-9908123-ZA"
                    className="bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono w-full outline-none focus:border-[#ff8c00]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1.5">
                    Total Parcels / Box Count
                  </label>
                  <input
                    type="text"
                    value={parcelCount}
                    onChange={(e) => setParcelCount(e.target.value)}
                    placeholder="e.g. 4 Parcels, 2 Boxes, 1 Pallet"
                    className="bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-purple-300 font-mono font-bold w-full outline-none focus:border-[#ff8c00]"
                  />
                </div>

                {/* Product Autocomplete Search Section */}
                <div className="md:col-span-2 bg-white/5 border border-white/10 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Icon name="search" size={14} />
                      Dispatched Products & Kanban Items Autocomplete
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCustomProduct(!isCustomProduct)}
                      className="text-[10px] font-mono text-cyan-400 hover:underline font-bold"
                    >
                      {isCustomProduct ? '← Search Master Products' : '+ Add Custom Product'}
                    </button>
                  </div>

                  {!isCustomProduct ? (
                    <div className="relative">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={productQuery}
                            onChange={(e) => setProductQuery(e.target.value)}
                            placeholder="Type Product Name or Internal Code to search Kanban products..."
                            className="bg-black border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white w-full outline-none focus:border-amber-400 font-sans"
                          />
                          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        </div>

                        <input
                          type="number"
                          min={1}
                          value={itemQuantity}
                          onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-20 bg-black border border-white/10 rounded-xl px-2 text-center text-xs text-white font-mono"
                          title="Quantity"
                        />
                      </div>

                      {/* Autocomplete Dropdown */}
                      {showProductDropdown && matchingProducts.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-[#18181c] border border-amber-500/40 rounded-xl shadow-2xl z-30 max-h-48 overflow-y-auto divide-y divide-white/5">
                          {matchingProducts.map(prod => (
                            <button
                              key={prod.id}
                              type="button"
                              onClick={() => handleSelectMasterProduct(prod)}
                              className="w-full text-left p-2.5 hover:bg-amber-500/10 transition-all flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-white block">{prod.productName}</span>
                                <span className="text-[10px] text-gray-400 font-mono">
                                  {prod.internalProductCode} • Supplier: {prod.supplier || 'N/A'} • Loc: {prod.location || 'N/A'}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                Select
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-black/40 p-3 rounded-xl border border-white/5">
                      <input
                        type="text"
                        value={customItemName}
                        onChange={(e) => setCustomItemName(e.target.value)}
                        placeholder="Custom Product Name"
                        className="bg-black border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                      />
                      <input
                        type="text"
                        value={customItemCode}
                        onChange={(e) => setCustomItemCode(e.target.value)}
                        placeholder="Internal Code (Optional)"
                        className="bg-black border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-cyan-400"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={1}
                          value={itemQuantity}
                          onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 bg-black border border-white/10 rounded-lg px-2 text-center text-xs text-white font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomProduct}
                          className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-black uppercase"
                        >
                          Add Custom
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Items List Table */}
                  {items.length > 0 && (
                    <div className="border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5 bg-black/50 text-xs font-mono">
                      {items.map(item => (
                        <div key={item.id} className="p-2.5 flex items-center justify-between text-gray-300 hover:bg-white/[0.02]">
                          <div>
                            <span className="font-bold text-white block">{item.productName}</span>
                            <span className="text-[10px] text-gray-500">
                              {item.internalProductCode} • {item.supplier ? `Supplier: ${item.supplier}` : 'Custom Item'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-emerald-400 font-bold">{item.quantity} Qty</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-gray-500 hover:text-red-400 p-1"
                            >
                              <Icon name="trash-2" size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1.5">
                    Dispatch Notes & Packaging Instructions
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Fragile veneer panels wrapped in bubble wrap. Require double-checked sign-off on arrival."
                    className="bg-black border border-white/10 rounded-xl p-3 text-xs text-white w-full outline-none focus:border-[#ff8c00] resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Google Drive Folder */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Step 2: Google Drive Architecture Integration</h3>
                <p className="text-xs text-gray-400 mt-0.5">Automatic folder allocation in TimberSmith Google Workspace Storage</p>
              </div>

              {isCreatingFolder ? (
                <div className="p-12 text-center bg-purple-950/20 border border-purple-500/30 rounded-3xl space-y-3">
                  <div className="w-12 h-12 rounded-full border-4 border-purple-500 border-t-transparent animate-spin mx-auto"></div>
                  <p className="text-sm font-black text-purple-300 uppercase">Allocating Google Drive Folder...</p>
                  <p className="text-xs text-gray-400">Communicating with Google Workspace Storage Architecture</p>
                </div>
              ) : driveFolder ? (
                <div className="bg-purple-950/20 border border-purple-500/30 p-6 rounded-3xl space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl border border-purple-500/30">
                      <Icon name="folder" size={24} />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-white">{driveFolder.folderName}</h4>
                      <p className="text-xs text-purple-300 font-mono">Folder ID: {driveFolder.folderId}</p>
                    </div>
                  </div>

                  <div className="bg-black/50 p-4 rounded-2xl border border-white/5 space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Target Root Vault:</span>
                      <span className="text-gray-200">TimberSmith Dispatch Vault</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Folder Storage URL:</span>
                      <span className="text-purple-400 truncate max-w-xs">{driveFolder.folderUrl}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Credentials & Access:</span>
                      <span className="text-emerald-400 font-bold">No passwords required (Modular OAuth ready)</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <a
                      href={driveFolder.folderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all shadow-lg"
                    >
                      <Icon name="external-link" size={16} />
                      <span>Open Google Drive Folder</span>
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* STEP 3: Photos */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Step 3: Quality & Packaging Photos</h3>
                <p className="text-xs text-gray-400 mt-0.5">Upload photos of packaged joinery items directly to the Google Drive folder</p>
              </div>

              <DispatchPhotoUploader
                folderId={driveFolder?.folderId || ''}
                folderUrl={driveFolder?.folderUrl}
                photos={photos}
                onPhotosChange={(updated) => setPhotos(updated)}
              />
            </div>
          )}
        </div>

        {/* Wizard Footer Actions */}
        <div className="p-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 sticky bottom-0 bg-[#121214] z-20">
          <div className="flex items-center space-x-2">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all"
              >
                <Icon name="arrow-left" size={16} />
                <span>Back</span>
              </button>
            )}

            {currentStep < 3 && (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 1) handleNextToStep2();
                  else setCurrentStep(3);
                }}
                className="px-5 py-2.5 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all shadow-lg"
              >
                <span>Next Step</span>
                <Icon name="arrow-right" size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleFinish('Draft')}
              className="px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
            >
              Save as Draft
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleFinish('Ready for Dispatch')}
              className="px-4 py-2.5 bg-cyan-600/30 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
            >
              Ready for Dispatch
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleFinish('Dispatched')}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all shadow-lg disabled:opacity-50"
            >
              <Icon name="send" size={16} />
              <span>Dispatch Shipment</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
