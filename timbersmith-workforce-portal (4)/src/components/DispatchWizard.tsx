import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { DispatchPhotoUploader } from './DispatchPhotoUploader';
import { DispatchRecord, DispatchItem } from './DispatchDetails';
import { productMasterService } from '../services/productMasterService';
import { ProductMaster } from '../types';
import {
  DispatchPackage,
  formatPackageCode,
  generateStickerCode,
  createDefaultPackages,
  validatePackages
} from '../types/dispatchPackage';
import { EvidencePhoto } from '../types/storage';

interface DispatchWizardProps {
  initialDispatch?: DispatchRecord | null;
  onSave: (dispatchData: Partial<DispatchRecord>, finalStatus: 'Draft' | 'Ready for Dispatch' | 'Dispatched') => Promise<void>;
  onCancel: () => void;
  currentUser?: any;
  announce?: (msg: string) => void;
}

const COURIER_OPTIONS = [
  'The Courier Guy',
  'DHL Express',
  'PostNet',
  'RAM Hand-to-Hand',
  'FedEx',
  'Other'
];

export function getCourierTrackingUrl(courierCompany?: string, trackingNumber?: string, customTrackingUrl?: string): string | null {
  if (customTrackingUrl && customTrackingUrl.trim()) {
    return customTrackingUrl.trim();
  }
  if (!trackingNumber || !trackingNumber.trim()) return null;
  const cleanTracking = trackingNumber.trim();
  const cleanCourier = (courierCompany || '').toLowerCase().trim();

  if (cleanCourier.includes('courier guy')) {
    return `https://portal.thecourierguy.co.za/track?tracking_number=${encodeURIComponent(cleanTracking)}`;
  }
  if (cleanCourier.includes('dhl')) {
    return `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${encodeURIComponent(cleanTracking)}`;
  }
  if (cleanCourier.includes('postnet')) {
    return `https://www.postnet.co.za/tracker?track=${encodeURIComponent(cleanTracking)}`;
  }
  if (cleanCourier.includes('ram')) {
    return `https://www.ram.co.za/tracking/${encodeURIComponent(cleanTracking)}`;
  }
  if (cleanCourier.includes('fedex')) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(cleanTracking)}`;
  }
  return null;
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
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Step 1: Manifest & Delivery Info
  const [dispatchNumber] = useState(
    initialDispatch?.dispatchNumber || `DSP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [customer, setCustomer] = useState(initialDispatch?.customer || '');
  const [project, setProject] = useState(initialDispatch?.project || '');
  const [destinationBranch, setDestinationBranch] = useState(initialDispatch?.destinationBranch || 'Cape Town');
  const [installer, setInstaller] = useState(initialDispatch?.installer || '');
  const [courierCompany, setCourierCompany] = useState(initialDispatch?.courierCompany || initialDispatch?.courier || 'The Courier Guy');
  const [trackingNumber, setTrackingNumber] = useState(initialDispatch?.trackingNumber || '');
  const [customTrackingUrl, setCustomTrackingUrl] = useState(initialDispatch?.trackingUrl || '');
  const [notes, setNotes] = useState(initialDispatch?.notes || '');

  // Step 1: Items List (Kanban / Product Master autocomplete)
  const [items, setItems] = useState<DispatchItem[]>(initialDispatch?.items || []);
  const [allProducts, setAllProducts] = useState<ProductMaster[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [matchingProducts, setMatchingProducts] = useState<ProductMaster[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [isCustomProduct, setIsCustomProduct] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemCode, setCustomItemCode] = useState('');

  // Step 2 & 3: Packages Management
  const initialPackageCount = initialDispatch?.packages?.length || 1;
  const [packageCount, setPackageCount] = useState<number>(initialPackageCount);
  const [packages, setPackages] = useState<DispatchPackage[]>(() => {
    if (initialDispatch?.packages && initialDispatch.packages.length > 0) {
      return initialDispatch.packages;
    }
    return createDefaultPackages(dispatchNumber, initialPackageCount, initialDispatch?.project || initialDispatch?.customer || 'Factory Joinery');
  });

  const [selectedPackageIndex, setSelectedPackageIndex] = useState<number>(0);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  // Autocomplete data fetching
  useEffect(() => {
    const prods = productMasterService.getLocalProducts();
    setAllProducts(prods);
  }, []);

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

  // Adjust packages when packageCount changes
  const handleUpdatePackageCount = (newCount: number) => {
    const targetCount = Math.max(1, Math.min(100, newCount || 1));
    setPackageCount(targetCount);

    setPackages(prev => {
      const currentList = [...prev];
      const now = new Date().toISOString();

      if (targetCount > currentList.length) {
        // Add new packages
        for (let i = currentList.length + 1; i <= targetCount; i++) {
          const pkgCode = formatPackageCode(dispatchNumber, i, targetCount);
          const stkCode = generateStickerCode(dispatchNumber, i, targetCount);
          currentList.push({
            id: `pkg-${dispatchNumber.toLowerCase()}-${i}-${Date.now().toString(36)}`,
            dispatchNumber,
            packageNumber: i,
            totalPackages: targetCount,
            packageCode: pkgCode,
            stickerCode: stkCode,
            description: `Package ${i} of ${targetCount}`,
            status: 'UNVERIFIED',
            dispatchStatus: 'pending',
            receivingStatus: 'unverified',
            dispatchPhotos: [],
            receivingPhotos: [],
            createdAt: now,
            updatedAt: now
          });
        }
      } else if (targetCount < currentList.length) {
        // Trim excess packages
        currentList.splice(targetCount);
      }

      // Re-index and update totalPackages on all packages
      return currentList.map((pkg, idx) => {
        const pNum = idx + 1;
        return {
          ...pkg,
          packageNumber: pNum,
          totalPackages: targetCount,
          packageCode: formatPackageCode(dispatchNumber, pNum, targetCount),
          stickerCode: generateStickerCode(dispatchNumber, pNum, targetCount),
          updatedAt: now
        };
      });
    });

    if (selectedPackageIndex >= targetCount) {
      setSelectedPackageIndex(targetCount - 1);
    }
  };

  const handleUpdatePackageField = (index: number, field: keyof DispatchPackage, value: any) => {
    setPackages(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = {
          ...updated[index],
          [field]: value,
          updatedAt: new Date().toISOString()
        };
      }
      return updated;
    });
  };

  // Add Item to Manifest
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

  // Photo handlers for Step 3
  const handleAddPhotoToPackage = (packageId: string, photo: EvidencePhoto, previewUrl?: string) => {
    if (previewUrl) {
      setPreviewUrls(prev => ({ ...prev, [photo.id]: previewUrl }));
    }

    setPackages(prev =>
      prev.map(pkg => {
        if (pkg.id === packageId) {
          const currentPhotos = pkg.dispatchPhotos || [];
          return {
            ...pkg,
            dispatchPhotos: [...currentPhotos, photo],
            updatedAt: new Date().toISOString()
          };
        }
        return pkg;
      })
    );
  };

  const handleRemovePhotoFromPackage = (packageId: string, photoId: string) => {
    setPackages(prev =>
      prev.map(pkg => {
        if (pkg.id === packageId) {
          const currentPhotos = pkg.dispatchPhotos || [];
          return {
            ...pkg,
            dispatchPhotos: currentPhotos.filter(p => p.id !== photoId),
            updatedAt: new Date().toISOString()
          };
        }
        return pkg;
      })
    );
  };

  // Step 1 Validation
  const validateStep1 = (): boolean => {
    const errs: string[] = [];
    if (!customer.trim()) errs.push('Customer / Client is required.');
    if (!project.trim()) errs.push('Project Name is required.');
    if (!destinationBranch.trim()) errs.push('Destination Branch is required.');
    setValidationErrors(errs);
    return errs.length === 0;
  };

  // Step 2 Validation
  const validateStep2 = (): boolean => {
    const errs: string[] = [];
    if (packages.length === 0) {
      errs.push('At least one package must be defined.');
    }
    const pkgVal = validatePackages(packages);
    if (!pkgVal.valid) {
      errs.push(...pkgVal.errors);
    }
    setValidationErrors(errs);
    return errs.length === 0;
  };

  // Step Navigation
  const handleNext = () => {
    if (currentStep === 1) {
      if (!validateStep1()) return;
      setCurrentStep(2);
      setValidationErrors([]);
    } else if (currentStep === 2) {
      if (!validateStep2()) return;
      setCurrentStep(3);
      setValidationErrors([]);
    }
  };

  const handleBack = () => {
    setValidationErrors([]);
    if (currentStep === 3) setCurrentStep(2);
    else if (currentStep === 2) setCurrentStep(1);
  };

  // Printable Package Labels
  const handlePrintLabels = (singlePackageIndex?: number) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const packagesToPrint = typeof singlePackageIndex === 'number'
      ? [packages[singlePackageIndex]]
      : packages;

    const labelCards = packagesToPrint.map(pkg => `
      <div class="label-card">
        <div class="label-header">
          <div class="logo">TIMBERSMITH JOINERY</div>
          <div class="pkg-num">PACKAGE ${pkg.packageNumber} OF ${pkg.totalPackages}</div>
        </div>
        <div class="main-code">${pkg.packageCode}</div>
        <div class="sticker-code">${pkg.stickerCode || generateStickerCode(dispatchNumber, pkg.packageNumber, pkg.totalPackages)}</div>
        <div class="meta-grid">
          <div>
            <div class="meta-label">Customer</div>
            <div class="meta-val">${customer || 'N/A'}</div>
          </div>
          <div>
            <div class="meta-label">Project</div>
            <div class="meta-val">${project || 'N/A'}</div>
          </div>
          <div>
            <div class="meta-label">Destination</div>
            <div class="meta-val">${destinationBranch}</div>
          </div>
          <div>
            <div class="meta-label">Courier & Tracking</div>
            <div class="meta-val">${courierCompany} - ${trackingNumber || 'N/A'}</div>
          </div>
        </div>
        <div class="desc-box">
          <div class="meta-label">Contents / Description</div>
          <div class="desc-text">${pkg.description || 'General Joinery Components'}</div>
          ${pkg.quantity ? `<div style="margin-top: 4px; font-size: 11px;">Qty: <strong>${pkg.quantity}</strong></div>` : ''}
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Package Labels - ${dispatchNumber}</title>
          <style>
            @page { size: auto; margin: 10mm; }
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; color: #111; }
            .label-card {
              border: 2px solid #000;
              border-radius: 8px;
              padding: 16px;
              margin-bottom: 20px;
              page-break-inside: avoid;
              max-width: 480px;
            }
            .label-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #000;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .logo { font-size: 14px; font-weight: 900; letter-spacing: 1px; }
            .pkg-num { font-size: 14px; font-weight: 900; background: #000; color: #fff; padding: 4px 8px; border-radius: 4px; }
            .main-code { font-size: 24px; font-weight: 900; font-family: monospace; letter-spacing: 1px; margin-bottom: 4px; }
            .sticker-code { font-size: 14px; font-family: monospace; color: #444; margin-bottom: 12px; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; border-top: 1px dashed #999; border-bottom: 1px dashed #999; padding: 8px 0; }
            .meta-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #666; }
            .meta-val { font-size: 12px; font-weight: 700; }
            .desc-box { background: #f4f4f4; padding: 8px; border-radius: 4px; }
            .desc-text { font-size: 12px; font-weight: 600; margin-top: 2px; }
          </style>
        </head>
        <body>
          <h2 style="font-size: 16px; text-transform: uppercase; margin-bottom: 16px;">TimberSmith Dispatch Package Labels (${dispatchNumber})</h2>
          ${labelCards}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Submit Handler
  const handleFinalSubmit = async (status: 'Draft' | 'Ready for Dispatch' | 'Dispatched') => {
    if (!validateStep1() || !validateStep2()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const computedTrackingUrl = getCourierTrackingUrl(courierCompany, trackingNumber, customTrackingUrl);
      const currentUserName = currentUser?.name || currentUser?.displayName || currentUser?.email || 'Factory Dispatch Officer';
      const now = new Date().toISOString();

      // Synchronize package statuses
      const finalizedPackages: DispatchPackage[] = packages.map(pkg => {
        let pkgStatus = pkg.status;
        let pkgDispatchStatus = pkg.dispatchStatus;

        if (status === 'Dispatched') {
          pkgStatus = 'DISPATCHED';
          pkgDispatchStatus = 'dispatched';
        } else if (status === 'Ready for Dispatch') {
          pkgStatus = 'UNVERIFIED';
          pkgDispatchStatus = 'verified';
        } else {
          pkgStatus = 'UNVERIFIED';
          pkgDispatchStatus = 'pending';
        }

        return {
          ...pkg,
          status: pkgStatus,
          dispatchStatus: pkgDispatchStatus,
          updatedAt: now
        };
      });

      // Build audit history event
      const historyItem = {
        action: status === 'Dispatched' ? 'DISPATCHED' : status === 'Ready for Dispatch' ? 'READY_FOR_DISPATCH' : 'DISPATCH_CREATED',
        user: currentUserName,
        timestamp: now,
        notes: status === 'Dispatched'
          ? `Dispatched ${packages.length} packages via ${courierCompany} (Tracking: ${trackingNumber || 'N/A'})`
          : `Saved dispatch with ${packages.length} packages`
      };

      const existingHistory = initialDispatch?.history || [];

      const dispatchPayload: Partial<DispatchRecord> = {
        dispatchNumber,
        customer: customer.trim(),
        project: project.trim(),
        destinationBranch: destinationBranch.trim(),
        installer: installer.trim() || undefined,
        courier: courierCompany,
        courierCompany,
        trackingNumber: trackingNumber.trim() || undefined,
        trackingUrl: computedTrackingUrl || undefined,
        parcelCount: `${packages.length} Package${packages.length > 1 ? 's' : ''}`,
        notes: notes.trim() || undefined,
        status,
        items,
        packages: finalizedPackages,
        // Preserve legacy fields if editing an existing record
        googleDriveFolderId: initialDispatch?.googleDriveFolderId,
        googleDriveFolderName: initialDispatch?.googleDriveFolderName,
        googleDriveFolderUrl: initialDispatch?.googleDriveFolderUrl,
        photos: initialDispatch?.photos,
        history: [...existingHistory, historyItem]
      };

      await onSave(dispatchPayload, status);
      if (announce) {
        announce(`Dispatch ${dispatchNumber} successfully saved as ${status}`);
      }
    } catch (err: any) {
      console.error('Failed to save dispatch:', err);
      setValidationErrors([err?.message || 'Failed to save dispatch. Please try again.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPackage = packages[selectedPackageIndex] || packages[0];
  const computedTrackingUrl = getCourierTrackingUrl(courierCompany, trackingNumber, customTrackingUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#121214] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between bg-black/40 sticky top-0 z-20">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-[#ff8c00]/10 text-[#ff8c00] rounded-2xl border border-[#ff8c00]/20">
              <Icon name="truck" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-wider text-white">
                {initialDispatch ? `Edit Dispatch — ${dispatchNumber}` : 'New Factory Dispatch Manifest'}
              </h2>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                Step {currentStep} of 3: {
                  currentStep === 1 ? 'Manifest & Delivery Information' :
                  currentStep === 2 ? 'Package Creation & Labelling' :
                  'Factory Photo Evidence'
                }
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-colors"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="bg-black/60 border-b border-white/5 px-6 py-3">
          <div className="flex items-center justify-between max-w-xl mx-auto">
            {/* Step 1 */}
            <div className={`flex items-center space-x-2 ${currentStep >= 1 ? 'text-[#ff8c00]' : 'text-gray-500'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono border ${
                currentStep >= 1 ? 'bg-[#ff8c00]/20 border-[#ff8c00] text-[#ff8c00]' : 'border-gray-600 text-gray-500'
              }`}>
                1
              </div>
              <span className="text-xs font-black uppercase tracking-wider hidden sm:inline">Manifest</span>
            </div>

            <div className={`flex-1 h-0.5 mx-3 ${currentStep >= 2 ? 'bg-[#ff8c00]' : 'bg-white/10'}`} />

            {/* Step 2 */}
            <div className={`flex items-center space-x-2 ${currentStep >= 2 ? 'text-[#ff8c00]' : 'text-gray-500'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono border ${
                currentStep >= 2 ? 'bg-[#ff8c00]/20 border-[#ff8c00] text-[#ff8c00]' : 'border-gray-600 text-gray-500'
              }`}>
                2
              </div>
              <span className="text-xs font-black uppercase tracking-wider hidden sm:inline">Packages</span>
            </div>

            <div className={`flex-1 h-0.5 mx-3 ${currentStep >= 3 ? 'bg-[#ff8c00]' : 'bg-white/10'}`} />

            {/* Step 3 */}
            <div className={`flex items-center space-x-2 ${currentStep >= 3 ? 'text-[#ff8c00]' : 'text-gray-500'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono border ${
                currentStep >= 3 ? 'bg-[#ff8c00]/20 border-[#ff8c00] text-[#ff8c00]' : 'border-gray-600 text-gray-500'
              }`}>
                3
              </div>
              <span className="text-xs font-black uppercase tracking-wider hidden sm:inline">Factory Photos</span>
            </div>
          </div>
        </div>

        {/* Validation Errors Notice */}
        {validationErrors.length > 0 && (
          <div className="m-5 p-4 bg-red-950/40 border border-red-500/30 rounded-2xl space-y-1">
            <div className="flex items-center space-x-2 text-red-400 font-bold text-xs">
              <Icon name="alert-triangle" size={16} />
              <span>Please resolve the following before proceeding:</span>
            </div>
            <ul className="list-disc list-inside text-xs text-red-300 space-y-0.5 pl-2">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: MANIFEST & DELIVERY INFORMATION */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Customer */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                    Customer / Client <span className="text-[#ff8c00]">*</span>
                  </label>
                  <input
                    type="text"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    placeholder="e.g. IBC, Private Client"
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#ff8c00]"
                  />
                </div>

                {/* Project */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                    Project Name <span className="text-[#ff8c00]">*</span>
                  </label>
                  <input
                    type="text"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    placeholder="e.g. Bedroom 1 - Built-in Wardrobes"
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#ff8c00]"
                  />
                </div>

                {/* Destination Branch */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                    Destination Branch <span className="text-[#ff8c00]">*</span>
                  </label>
                  <input
                    type="text"
                    value={destinationBranch}
                    onChange={(e) => setDestinationBranch(e.target.value)}
                    placeholder="e.g. Cape Town, Johannesburg Site"
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#ff8c00]"
                  />
                </div>

                {/* Installer / Recipient */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                    Installer / Recipient
                  </label>
                  <input
                    type="text"
                    value={installer}
                    onChange={(e) => setInstaller(e.target.value)}
                    placeholder="e.g. Lead Installer Name"
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#ff8c00]"
                  />
                </div>

                {/* Courier Company Dropdown */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                    Courier Company
                  </label>
                  <select
                    value={courierCompany}
                    onChange={(e) => setCourierCompany(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#ff8c00]"
                  >
                    {COURIER_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tracking Number */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                    Tracking Number
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="e.g. TCG-12345678"
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-cyan-400 outline-none focus:border-[#ff8c00]"
                  />
                </div>
              </div>

              {/* Courier Tracking Destination Preview */}
              {trackingNumber && (
                <div className="p-3 bg-black/40 border border-white/10 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center space-x-2">
                    <Icon name="external-link" size={14} className="text-cyan-400" />
                    <span className="text-gray-400">Tracking Destination:</span>
                    {computedTrackingUrl ? (
                      <a
                        href={computedTrackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 underline hover:text-cyan-300 font-bold break-all"
                      >
                        {computedTrackingUrl}
                      </a>
                    ) : (
                      <span className="text-gray-300">Plain text tracking (No automatic portal link)</span>
                    )}
                  </div>

                  {courierCompany === 'Other' && (
                    <div className="w-full mt-2">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                        Custom Tracking URL (Optional)
                      </label>
                      <input
                        type="url"
                        value={customTrackingUrl}
                        onChange={(e) => setCustomTrackingUrl(e.target.value)}
                        placeholder="https://mycarrier.com/track/..."
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-cyan-400 outline-none focus:border-[#ff8c00]"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Shipment Notes */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                  Dispatch Notes & Handling Instructions
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Fragile veneer panels, keep upright, delivery before 14:00."
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-[#ff8c00]"
                />
              </div>

              {/* Items List / Product Association */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-200">
                      Manufactured Products / Items ({items.length})
                    </h3>
                    <p className="text-[10px] text-gray-400">
                      Add components from Product Master or custom items to include on the manifest.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCustomProduct(!isCustomProduct)}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    {isCustomProduct ? 'Search Master Products' : '+ Custom Item'}
                  </button>
                </div>

                {!isCustomProduct ? (
                  <div className="relative">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={productQuery}
                          onChange={(e) => setProductQuery(e.target.value)}
                          placeholder="Search product master by code, name, or category..."
                          className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-[#ff8c00]"
                        />
                        <Icon name="search" size={16} className="absolute left-3 top-2.5 text-gray-400" />
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 bg-black/60 border border-white/10 rounded-xl px-2 py-2 text-xs text-center text-white outline-none focus:border-[#ff8c00]"
                      />
                    </div>

                    {showProductDropdown && matchingProducts.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-[#1a1a1e] border border-white/10 rounded-2xl shadow-xl max-h-48 overflow-y-auto divide-y divide-white/5">
                        {matchingProducts.map((prod) => (
                          <div
                            key={prod.id}
                            onClick={() => handleSelectMasterProduct(prod)}
                            className="p-2.5 hover:bg-white/10 cursor-pointer flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-mono font-bold text-[#ff8c00] mr-2">
                                {prod.internalProductCode}
                              </span>
                              <span className="text-white font-medium">{prod.productName}</span>
                            </div>
                            <span className="text-[10px] text-gray-400 font-mono">{prod.category || 'Standard'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-black/30 p-3 rounded-2xl border border-white/10">
                    <input
                      type="text"
                      placeholder="Item Code (e.g. CUP-01)"
                      value={customItemCode}
                      onChange={(e) => setCustomItemCode(e.target.value)}
                      className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#ff8c00]"
                    />
                    <input
                      type="text"
                      placeholder="Product Description / Name"
                      value={customItemName}
                      onChange={(e) => setCustomItemName(e.target.value)}
                      className="sm:col-span-2 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#ff8c00]"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 bg-black/60 border border-white/10 rounded-xl px-2 py-2 text-xs text-center text-white outline-none focus:border-[#ff8c00]"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomProduct}
                        className="flex-1 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}

                {/* Selected Items Table */}
                {items.length > 0 && (
                  <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden">
                    <div className="divide-y divide-white/5 max-h-48 overflow-y-auto">
                      {items.map((it) => (
                        <div key={it.id} className="p-3 flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-3">
                            <span className="font-mono text-cyan-400 font-bold">{it.internalProductCode}</span>
                            <span className="text-white">{it.productName}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="px-2 py-0.5 bg-white/10 rounded text-xs font-mono font-bold text-gray-200">
                              Qty: {it.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(it.id)}
                              className="p-1 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded transition-colors"
                            >
                              <Icon name="trash-2" size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: PACKAGE BREAKDOWN & LABELLING */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Package Count Controller */}
              <div className="p-5 bg-black/40 border border-white/10 rounded-3xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black uppercase text-white">Transport Package Breakdown</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Specify how many individual packages or boxes make up this shipment (e.g. 7 packages).
                    </p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <label className="text-xs font-bold uppercase text-gray-300">Total Packages:</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={packageCount}
                      onChange={(e) => handleUpdatePackageCount(parseInt(e.target.value) || 1)}
                      className="w-20 bg-black border border-[#ff8c00] rounded-xl px-3 py-2 text-sm font-mono font-bold text-center text-[#ff8c00] outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
                  <span className="text-xs font-mono text-gray-400">
                    Generated: <strong className="text-cyan-400">{packages.length} Package{packages.length > 1 ? 's' : ''}</strong> (1 of {packages.length} to {packages.length} of {packages.length})
                  </span>

                  <button
                    type="button"
                    onClick={() => handlePrintLabels()}
                    className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all shadow"
                  >
                    <Icon name="printer" size={16} />
                    <span>Print All Package Labels</span>
                  </button>
                </div>
              </div>

              {/* Package Cards List */}
              <div className="space-y-3">
                {packages.map((pkg, idx) => (
                  <div
                    key={pkg.id || idx}
                    className="p-4 bg-black/50 border border-white/10 rounded-2xl space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 font-mono font-bold flex items-center justify-center text-xs border border-cyan-500/30">
                          {pkg.packageNumber}/{pkg.totalPackages}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-white">{pkg.packageCode}</span>
                            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 px-2 py-0.5 rounded">
                              {pkg.stickerCode}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold border ${
                          (pkg.dispatchPhotos?.length || 0) > 0
                            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}>
                          {pkg.dispatchPhotos?.length || 0} Photos Attached
                        </span>

                        <button
                          type="button"
                          onClick={() => handlePrintLabels(idx)}
                          className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs transition-colors"
                          title="Print this package label"
                        >
                          <Icon name="printer" size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[9px] font-black uppercase tracking-wider text-gray-400 mb-1">
                          Package Description / Contents
                        </label>
                        <input
                          type="text"
                          value={pkg.description || ''}
                          onChange={(e) => handleUpdatePackageField(idx, 'description', e.target.value)}
                          placeholder={`e.g. Bedroom 1 Cupboard Top Section (Package ${pkg.packageNumber} of ${pkg.totalPackages})`}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-[#ff8c00]"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-wider text-gray-400 mb-1">
                          Estimated Weight (kg)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={pkg.weightKg || ''}
                          onChange={(e) => handleUpdatePackageField(idx, 'weightKg', parseFloat(e.target.value) || undefined)}
                          placeholder="e.g. 15.5"
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white outline-none focus:border-[#ff8c00]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: FACTORY PHOTOGRAPHS & EVIDENCE */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {/* Package Selector Pills */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Select Package to Photograph / Review
                </label>
                <div className="flex flex-wrap gap-2">
                  {packages.map((pkg, idx) => {
                    const isSelected = idx === selectedPackageIndex;
                    const photoCount = pkg.dispatchPhotos?.length || 0;

                    return (
                      <button
                        key={pkg.id || idx}
                        type="button"
                        onClick={() => setSelectedPackageIndex(idx)}
                        className={`px-3 py-2 rounded-2xl text-xs font-mono transition-all flex items-center space-x-2 border ${
                          isSelected
                            ? 'bg-[#ff8c00] border-[#ff8c00] text-black font-bold shadow-lg'
                            : 'bg-black/40 hover:bg-black/60 border-white/10 text-gray-300'
                        }`}
                      >
                        <span>Package {pkg.packageNumber} of {pkg.totalPackages}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isSelected
                            ? 'bg-black text-[#ff8c00]'
                            : photoCount > 0
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {photoCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Package Photo Uploader */}
              {selectedPackage && (
                <DispatchPhotoUploader
                  dispatchNumber={dispatchNumber}
                  customer={customer}
                  project={project}
                  selectedPackage={selectedPackage}
                  onAddPhotoToPackage={handleAddPhotoToPackage}
                  onRemovePhotoFromPackage={handleRemovePhotoFromPackage}
                  currentUser={currentUser}
                  previewUrls={previewUrls}
                />
              )}

              {/* Overall Evidence Summary Breakdown */}
              <div className="p-5 bg-black/40 border border-white/10 rounded-3xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">
                    Shipment Evidence Audit Overview
                  </h4>
                  <span className="text-xs font-mono text-gray-400">
                    Total Photos Across All Packages: <strong className="text-cyan-400">
                      {packages.reduce((acc, p) => acc + (p.dispatchPhotos?.length || 0), 0)}
                    </strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {packages.map((pkg) => {
                    const count = pkg.dispatchPhotos?.length || 0;
                    return (
                      <div
                        key={pkg.id}
                        onClick={() => setSelectedPackageIndex(pkg.packageNumber - 1)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                          count > 0
                            ? 'bg-cyan-950/20 border-cyan-500/30 text-cyan-300'
                            : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                        }`}
                      >
                        <div className="font-mono font-bold flex justify-between">
                          <span>{pkg.packageCode}</span>
                          <span>{count} {count === 1 ? 'photo' : 'photos'}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">
                          {pkg.description || `Package ${pkg.packageNumber} of ${pkg.totalPackages}`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Navigation Actions */}
        <div className="p-5 sm:p-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 bg-black/40 sticky bottom-0 z-20">
          <div className="flex items-center space-x-2">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1 transition-colors"
              >
                <Icon name="chevron-left" size={16} />
                <span>Back</span>
              </button>
            )}
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
          </div>

          <div className="flex items-center space-x-3">
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2.5 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1 transition-all shadow-lg"
              >
                <span>Continue</span>
                <Icon name="chevron-right" size={16} />
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFinalSubmit('Draft')}
                  className="px-4 py-2.5 bg-gray-700/60 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                >
                  Save as Draft
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFinalSubmit('Ready for Dispatch')}
                  className="px-4 py-2.5 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                >
                  Ready for Dispatch
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFinalSubmit('Dispatched')}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all shadow-lg"
                >
                  <Icon name="check-circle" size={16} />
                  <span>Confirm & Dispatch</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
