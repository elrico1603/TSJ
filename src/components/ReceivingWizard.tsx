import React, { useState } from 'react';
import { Icon } from './Icon';
import { DispatchRecord, DispatchItem, ReceivingPhoto } from './DispatchDetails';
import { DispatchPackage, PackageReceivingStatus, calculatePackageSummary, PackageSummary } from '../types/dispatchPackage';
import { EvidencePhoto, EvidenceType } from '../types/storage';
import { generateEvidenceStoragePath, generateStorageObjectName } from '../types/storagePath';

interface ReceivingWizardProps {
  dispatch: DispatchRecord;
  onSaveReceiving: (
    updatedDispatch: DispatchRecord,
    newStatus: 'Received' | 'Partially Received' | 'Issue Logged'
  ) => Promise<void>;
  onCancel: () => void;
  currentUser?: any;
  announce?: (msg: string) => void;
}

export const ReceivingWizard: React.FC<ReceivingWizardProps> = ({
  dispatch,
  onSaveReceiving,
  onCancel,
  currentUser,
  announce
}) => {
  const isModern = !!(dispatch.packages && dispatch.packages.length > 0);
  const totalPkgsCount = isModern ? dispatch.packages!.length : 0;

  // Modern packages state
  const [packages, setPackages] = useState<DispatchPackage[]>(() => {
    if (!dispatch.packages || dispatch.packages.length === 0) return [];
    return dispatch.packages.map(p => ({
      ...p,
      receivingStatus: p.receivingStatus || (
        p.status === 'RECEIVED' ? 'received' :
        p.status === 'MISSING' ? 'missing' :
        p.status === 'DAMAGED' ? 'damaged' :
        p.status === 'INCORRECT' ? 'incorrect' : 'unverified'
      ),
      receivingPhotos: p.receivingPhotos ? [...p.receivingPhotos] : []
    }));
  });

  // Active package selected for detailed inspection / photo upload
  const [selectedPackageIndex, setSelectedPackageIndex] = useState<number>(0);

  // Filter for large shipments (e.g. 50 packages)
  const [statusFilter, setStatusFilter] = useState<'all' | 'unverified' | 'received' | 'missing' | 'damaged' | 'incorrect'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected photo category for package evidence
  const [selectedEvidenceType, setSelectedEvidenceType] = useState<EvidenceType>('package_condition');

  // Local object URLs for previewing photos in the current browser session
  const [localPhotoPreviews, setLocalPhotoPreviews] = useState<Record<string, string>>({});

  // Legacy checklist state
  const [legacyChecklist, setLegacyChecklist] = useState(
    dispatch.receivingChecklist || {
      packagingIntact: true,
      parcelCountMatches: true,
      correctProducts: true,
      qualityChecked: true
    }
  );

  // Overall delivery note & general receiving photos
  const [receivingPhotos, setReceivingPhotos] = useState<ReceivingPhoto[]>(
    dispatch.receivingPhotos || []
  );

  // Notes & Discrepancies
  const [receivingNotes, setReceivingNotes] = useState(dispatch.receivingNotes || '');

  // Wizard active step
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const summary: PackageSummary = calculatePackageSummary(packages);

  // Set package receiving status
  const handleSetPackageStatus = (index: number, newStatus: PackageReceivingStatus) => {
    const now = new Date().toISOString();
    const receiverName = currentUser?.fullName || currentUser?.name || currentUser?.email || 'Store Receiver';

    setPackages(prev => {
      const updated = [...prev];
      if (updated[index]) {
        const uppercaseStatus =
          newStatus === 'received' ? 'RECEIVED' :
          newStatus === 'missing' ? 'MISSING' :
          newStatus === 'damaged' ? 'DAMAGED' :
          newStatus === 'incorrect' ? 'INCORRECT' : 'UNVERIFIED';

        updated[index] = {
          ...updated[index],
          receivingStatus: newStatus,
          status: uppercaseStatus,
          receivedBy: receiverName,
          receivedAt: now,
          updatedAt: now
        };
      }
      return updated;
    });
    setValidationError(null);
  };

  // Bulk mark all unverified packages as received
  const handleMarkAllUnverifiedAsReceived = () => {
    const now = new Date().toISOString();
    const receiverName = currentUser?.fullName || currentUser?.name || currentUser?.email || 'Store Receiver';

    setPackages(prev =>
      prev.map(pkg => {
        if (!pkg.receivingStatus || pkg.receivingStatus === 'unverified') {
          return {
            ...pkg,
            receivingStatus: 'received',
            status: 'RECEIVED',
            receivedBy: receiverName,
            receivedAt: now,
            updatedAt: now
          };
        }
        return pkg;
      })
    );
    setValidationError(null);
  };

  // Update package-specific notes
  const handleUpdatePackageNotes = (index: number, notes: string) => {
    setPackages(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = {
          ...updated[index],
          receivingNotes: notes
        };
      }
      return updated;
    });
  };

  // Handle capturing/attaching photo to a specific package
  const handleAddPackagePhoto = (e: React.ChangeEvent<HTMLInputElement>, packageIndex: number) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const pkg = packages[packageIndex];
    if (!pkg) return;

    const currentUserName = currentUser?.fullName || currentUser?.name || currentUser?.email || 'Store Receiver';

    Array.from(files).forEach((file: File) => {
      const photoId = `photo_recv_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const objectUrl = URL.createObjectURL(file);

      // Store local preview URL for ephemeral in-browser viewing
      setLocalPhotoPreviews(prev => ({
        ...prev,
        [photoId]: objectUrl
      }));

      // Generate deterministic Cloud Storage path metadata (NO Base64!)
      const storagePath = generateEvidenceStoragePath({
        customer: dispatch.customer,
        project: dispatch.project,
        item: pkg.description || pkg.productName || 'Package',
        dispatchNumber: dispatch.dispatchNumber,
        stage: 'receiving',
        packageNumber: pkg.packageNumber,
        totalPackages: pkg.totalPackages,
        year: new Date().getFullYear()
      });

      const storageObjectName = generateStorageObjectName(selectedEvidenceType, file.name);

      const newEvidencePhoto: EvidencePhoto = {
        id: photoId,
        dispatchNumber: dispatch.dispatchNumber,
        packageId: pkg.id,
        packageNumber: pkg.packageNumber,
        totalPackages: pkg.totalPackages,
        evidenceStage: 'receiving',
        evidenceType: selectedEvidenceType,
        originalFileName: file.name,
        storagePath,
        storageObjectName,
        mimeType: file.type || 'image/jpeg',
        size: file.size,
        uploadedBy: currentUserName,
        uploadedAt: new Date().toISOString()
      };

      setPackages(prev => {
        const updated = [...prev];
        if (updated[packageIndex]) {
          const currentPhotos = updated[packageIndex].receivingPhotos || [];
          updated[packageIndex] = {
            ...updated[packageIndex],
            receivingPhotos: [...currentPhotos, newEvidencePhoto]
          };
        }
        return updated;
      });
    });

    // Reset input value so same photo can be re-selected if desired
    e.target.value = '';
  };

  // Remove photo from a package
  const handleRemovePackagePhoto = (packageIndex: number, photoId: string) => {
    setPackages(prev => {
      const updated = [...prev];
      if (updated[packageIndex]) {
        const currentPhotos = updated[packageIndex].receivingPhotos || [];
        updated[packageIndex] = {
          ...updated[packageIndex],
          receivingPhotos: currentPhotos.filter(p => p.id !== photoId)
        };
      }
      return updated;
    });

    setLocalPhotoPreviews(prev => {
      const next = { ...prev };
      delete next[photoId];
      return next;
    });
  };

  // Handle general delivery note / legacy photo upload
  const handleGeneralPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, category: 'delivery_note' | 'parcel_condition' | 'unpacked_items') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const photoId = `recv_gen_photo_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const objectUrl = URL.createObjectURL(file);

      setLocalPhotoPreviews(prev => ({
        ...prev,
        [photoId]: objectUrl
      }));

      const photo: ReceivingPhoto = {
        id: photoId,
        category,
        name: file.name,
        url: objectUrl,
        uploadedAt: new Date().toISOString(),
        size: file.size
      };
      setReceivingPhotos(prev => [...prev, photo]);
    });

    e.target.value = '';
  };

  const handleRemoveGeneralPhoto = (photoId: string) => {
    setReceivingPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  // Filtered list of packages for the verification list
  const filteredPackages = packages.filter((pkg) => {
    if (statusFilter !== 'all' && pkg.receivingStatus !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const codeMatch = pkg.packageCode?.toLowerCase().includes(q);
      const stickerMatch = pkg.stickerCode?.toLowerCase().includes(q);
      const descMatch = pkg.description?.toLowerCase().includes(q);
      const numMatch = String(pkg.packageNumber).includes(q);
      return codeMatch || stickerMatch || descMatch || numMatch;
    }
    return true;
  });

  // Final validation and submission
  const handleFinishReceiving = async (targetStatus: 'Received' | 'Partially Received' | 'Issue Logged') => {
    setValidationError(null);

    // BLOCKING CHECK 1: In modern mode, ALL packages must be verified
    if (isModern) {
      if (summary.unverified > 0) {
        setValidationError(
          `Cannot complete receiving: ${summary.unverified} of ${summary.total} package(s) remain unverified. Every package must be inspected and marked.`
        );
        setCurrentStep(2);
        return;
      }

      // BLOCKING CHECK 2: Cannot mark as 'Received' if any package is missing, damaged, or incorrect
      if (targetStatus === 'Received' && (summary.missing > 0 || summary.damaged > 0 || summary.incorrect > 0)) {
        setValidationError(
          `Cannot approve full receipt: ${summary.missing} missing, ${summary.damaged} damaged, and ${summary.incorrect} incorrect packages were logged. Please select "Approve Partial Receipt" or "Log Delivery Issue".`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const receivingUser = currentUser?.fullName || currentUser?.name || currentUser?.email || 'Store Receiver';

      // Build meaningful audit history entry
      const historyEntry = {
        action:
          targetStatus === 'Received'
            ? 'RECEIVING_COMPLETED'
            : targetStatus === 'Partially Received'
            ? 'RECEIVING_PARTIAL'
            : 'RECEIVING_ISSUE_LOGGED',
        user: receivingUser,
        timestamp: nowIso,
        notes: isModern
          ? `Receiving finalized as ${targetStatus}. Packages summary: ${summary.received}/${summary.total} Received, ${summary.missing} Missing, ${summary.damaged} Damaged, ${summary.incorrect} Incorrect.${receivingNotes ? ` Receiver Notes: ${receivingNotes}` : ''}`
          : receivingNotes || `Goods received with status ${targetStatus}`
      };

      const updatedRecord: DispatchRecord = {
        ...dispatch,
        status: targetStatus,
        packages: isModern ? packages : dispatch.packages,
        receivingChecklist: legacyChecklist,
        receivingPhotos: receivingPhotos,
        receivingNotes: receivingNotes,
        receivedBy: receivingUser,
        receivedAt: nowIso,
        updatedAt: nowIso,
        history: [...(dispatch.history || []), historyEntry]
      };

      await onSaveReceiving(updatedRecord, targetStatus);
      if (announce) {
        announce(`Dispatch ${dispatch.dispatchNumber} receiving finalized as ${targetStatus}`);
      }
    } catch (err) {
      console.error('Error completing receiving wizard:', err);
      setValidationError('Failed to save receiving record. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPkg = packages[selectedPackageIndex];

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
      <div className="bg-[#121214] border border-white/10 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Wizard Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#121214]/95 backdrop-blur-md z-20">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <Icon name="check-circle" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black uppercase text-white tracking-wider">
                  RECEIVING VERIFICATION: {dispatch.dispatchNumber}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                  {isModern ? `${totalPkgsCount} Expected Packages` : 'Legacy Shipment'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {dispatch.customer} — {dispatch.project} ({dispatch.destinationBranch})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Dynamic Package Summary Bar (Visible on all steps in modern mode) */}
        {isModern && (
          <div className="bg-black/50 border-b border-white/10 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Expected Packages:</span>
              <strong className="text-white text-sm">{summary.total}</strong>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                {summary.received} Received
              </span>

              <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                {summary.missing} Missing
              </span>

              <span className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                {summary.damaged} Damaged
              </span>

              <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                {summary.incorrect} Incorrect
              </span>

              <span className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 border ${
                summary.unverified > 0
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 animate-pulse'
                  : 'bg-white/5 text-gray-400 border-white/10'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                {summary.unverified} Unverified
              </span>
            </div>
          </div>
        )}

        {/* Wizard Step Navigation */}
        <div className="px-6 pt-4 pb-2">
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { step: 1, label: '1. Dispatch Details' },
              { step: 2, label: isModern ? '2. Package Inspection' : '2. Checklist' },
              { step: 3, label: '3. Evidence & Notes' },
              { step: 4, label: '4. Sign-Off & Approval' }
            ].map(s => (
              <button
                key={s.step}
                type="button"
                onClick={() => setCurrentStep(s.step as any)}
                className={`p-2.5 rounded-2xl border transition-all flex items-center justify-center space-x-1.5 text-[11px] font-black uppercase tracking-wider ${
                  currentStep === s.step
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow'
                    : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[9px] font-mono">
                  {s.step}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Global Validation Banner */}
        {validationError && (
          <div className="mx-6 mt-2 p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center space-x-3 text-red-300 text-xs">
            <Icon name="alert-triangle" size={18} className="shrink-0 text-red-400" />
            <span className="font-semibold">{validationError}</span>
          </div>
        )}

        {/* Step Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* STEP 1: Read-Only Dispatch Information */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center gap-3">
                <Icon name="shield" size={20} className="text-amber-400 shrink-0" />
                <p className="text-xs text-amber-200">
                  <strong>Read-Only Protection:</strong> Sender dispatch specifications and waybill declarations are immutable during receiving verification.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Customer / Client</span>
                  <p className="text-sm font-bold text-white">{dispatch.customer}</p>
                </div>

                <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Project Name</span>
                  <p className="text-sm font-bold text-white">{dispatch.project}</p>
                </div>

                <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Destination Branch</span>
                  <p className="text-sm font-bold text-emerald-400">{dispatch.destinationBranch}</p>
                </div>

                <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Courier Service</span>
                  <p className="text-sm font-bold text-white">{dispatch.courierCompany || dispatch.courier || 'N/A'}</p>
                </div>

                <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Tracking Number</span>
                  {dispatch.trackingNumber ? (
                    <p className="text-sm font-mono font-bold text-cyan-400">{dispatch.trackingNumber}</p>
                  ) : (
                    <p className="text-sm font-mono text-gray-500">N/A</p>
                  )}
                </div>

                <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Total Packages</span>
                  <p className="text-sm font-bold text-purple-400">
                    {isModern ? `${packages.length} Transport Packages` : dispatch.parcelCount || '1'}
                  </p>
                </div>
              </div>

              {/* Items List */}
              {dispatch.items && dispatch.items.length > 0 && (
                <div className="bg-black/40 border border-white/10 p-4 rounded-2xl space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-300">
                    Manifest Items ({dispatch.items.length})
                  </h4>
                  <div className="divide-y divide-white/5 font-mono text-xs">
                    {dispatch.items.map((item, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between text-gray-300">
                        <div>
                          <span className="font-bold text-white">{item.productName}</span>
                          <span className="text-gray-500 block text-[10px]">{item.internalProductCode}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-emerald-400 font-bold">{item.quantity} units</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dispatch Notes */}
              {dispatch.notes && (
                <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Sender Dispatch Notes</span>
                  <p className="text-xs text-gray-300 italic">"{dispatch.notes}"</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Modern Package-by-Package Inspection */}
          {currentStep === 2 && isModern && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    Step 2: Package-by-Package Physical Verification
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Inspect each package code/sticker and record receiving status ({packages.length} Packages)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleMarkAllUnverifiedAsReceived}
                    className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5"
                  >
                    <Icon name="check-circle" size={14} />
                    <span>Mark All Unverified as Received</span>
                  </button>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-black/40 p-3 rounded-2xl border border-white/5">
                <div className="flex flex-wrap gap-1.5">
                  {(['all', 'unverified', 'received', 'missing', 'damaged', 'incorrect'] as const).map(f => {
                    const count =
                      f === 'all' ? packages.length :
                      f === 'unverified' ? summary.unverified :
                      f === 'received' ? summary.received :
                      f === 'missing' ? summary.missing :
                      f === 'damaged' ? summary.damaged : summary.incorrect;

                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setStatusFilter(f)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono capitalize transition-all border ${
                          statusFilter === f
                            ? 'bg-[#ff8c00] text-black font-bold border-[#ff8c00]'
                            : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {f} ({count})
                      </button>
                    );
                  })}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search package / code..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 font-mono w-48"
                  />
                </div>
              </div>

              {/* Package Verification Cards */}
              <div className="space-y-3">
                {filteredPackages.length === 0 ? (
                  <div className="p-8 text-center bg-black/30 border border-white/5 rounded-2xl text-xs text-gray-500">
                    No packages match the current filter "{statusFilter}".
                  </div>
                ) : (
                  filteredPackages.map(pkg => {
                    const actualIdx = packages.findIndex(p => p.id === pkg.id);
                    const isSelected = actualIdx === selectedPackageIndex;
                    const recStatus = pkg.receivingStatus || 'unverified';
                    const photoCount = pkg.receivingPhotos?.length || 0;

                    return (
                      <div
                        key={pkg.id || actualIdx}
                        className={`p-4 rounded-2xl border transition-all space-y-3 ${
                          recStatus === 'received'
                            ? 'bg-emerald-950/10 border-emerald-500/20'
                            : recStatus === 'missing'
                            ? 'bg-amber-950/15 border-amber-500/30'
                            : recStatus === 'damaged'
                            ? 'bg-red-950/15 border-red-500/30'
                            : recStatus === 'incorrect'
                            ? 'bg-purple-950/15 border-purple-500/30'
                            : 'bg-black/40 border-white/10'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-xl font-mono font-bold flex items-center justify-center text-xs border ${
                              recStatus === 'received'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : recStatus === 'missing'
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : recStatus === 'damaged'
                                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                : recStatus === 'incorrect'
                                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                                : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                            }`}>
                              {pkg.packageNumber}/{pkg.totalPackages}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-mono font-bold text-white">
                                  {pkg.packageCode}
                                </span>
                                {pkg.stickerCode && (
                                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 px-2 py-0.5 rounded">
                                    {pkg.stickerCode}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-300 mt-0.5">
                                {pkg.description || 'Joinery package'}
                              </p>
                            </div>
                          </div>

                          {/* Quick Status Selector Buttons */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSetPackageStatus(actualIdx, 'received')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                                recStatus === 'received'
                                  ? 'bg-emerald-500 text-black border-emerald-500 shadow'
                                  : 'bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-400 border-emerald-500/20'
                              }`}
                            >
                              ✓ Received
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSetPackageStatus(actualIdx, 'missing')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                                recStatus === 'missing'
                                  ? 'bg-amber-500 text-black border-amber-500 shadow'
                                  : 'bg-amber-950/30 hover:bg-amber-900/40 text-amber-400 border-amber-500/20'
                              }`}
                            >
                              ⚠ Missing
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSetPackageStatus(actualIdx, 'damaged')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                                recStatus === 'damaged'
                                  ? 'bg-red-500 text-black border-red-500 shadow'
                                  : 'bg-red-950/30 hover:bg-red-900/40 text-red-400 border-red-500/20'
                              }`}
                            >
                              ✕ Damaged
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSetPackageStatus(actualIdx, 'incorrect')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                                recStatus === 'incorrect'
                                  ? 'bg-purple-500 text-black border-purple-500 shadow'
                                  : 'bg-purple-950/30 hover:bg-purple-900/40 text-purple-400 border-purple-500/20'
                              }`}
                            >
                              ? Incorrect
                            </button>

                            {recStatus !== 'unverified' && (
                              <button
                                type="button"
                                onClick={() => handleSetPackageStatus(actualIdx, 'unverified')}
                                title="Reset to Unverified"
                                className="p-1.5 text-gray-500 hover:text-gray-300 rounded-lg"
                              >
                                <Icon name="rotate-ccw" size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Package Discrepancy Note input when missing, damaged, or incorrect */}
                        {(recStatus === 'damaged' || recStatus === 'missing' || recStatus === 'incorrect') && (
                          <div className="pt-2 border-t border-white/5 space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-amber-400 block tracking-wider">
                              {recStatus.toUpperCase()} Discrepancy Notes:
                            </label>
                            <input
                              type="text"
                              value={pkg.receivingNotes || ''}
                              onChange={e => handleUpdatePackageNotes(actualIdx, e.target.value)}
                              placeholder={`e.g. Describe ${recStatus} details for Package ${pkg.packageNumber}...`}
                              className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-sans"
                            />
                          </div>
                        )}

                        {/* Package Photo Count Pill & Quick Button */}
                        <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 pt-2 border-t border-white/5">
                          <div className="flex items-center gap-2">
                            <span>Receiving Evidence:</span>
                            <span className={`px-2 py-0.5 rounded font-bold ${
                              photoCount > 0
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'bg-white/5 text-gray-500'
                            }`}>
                              {photoCount} Photos
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPackageIndex(actualIdx);
                              setCurrentStep(3);
                            }}
                            className="text-xs font-mono font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 underline"
                          >
                            <Icon name="camera" size={12} />
                            <span>Add / View Photos</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Legacy Checklist Fallback */}
          {currentStep === 2 && !isModern && (
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Step 2: Legacy Receiving Checklist</h3>
                <p className="text-xs text-gray-400 mt-0.5">Physical inspection checklist for legacy dispatches</p>
              </div>

              <div className="space-y-4">
                <label className="flex items-start gap-4 p-4 bg-black/40 border border-white/10 rounded-2xl cursor-pointer hover:border-emerald-500/50 transition-all">
                  <input
                    type="checkbox"
                    checked={legacyChecklist.packagingIntact}
                    onChange={e => setLegacyChecklist(prev => ({ ...prev, packagingIntact: e.target.checked }))}
                    className="w-5 h-5 rounded border-white/20 bg-black text-emerald-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-extrabold text-white uppercase block">1. Outer Packaging Intact & Undamaged</span>
                    <span className="text-xs text-gray-400 block mt-0.5">Boxes or crates show no severe tears or crush damage.</span>
                  </div>
                </label>

                <label className="flex items-start gap-4 p-4 bg-black/40 border border-white/10 rounded-2xl cursor-pointer hover:border-emerald-500/50 transition-all">
                  <input
                    type="checkbox"
                    checked={legacyChecklist.parcelCountMatches}
                    onChange={e => setLegacyChecklist(prev => ({ ...prev, parcelCountMatches: e.target.checked }))}
                    className="w-5 h-5 rounded border-white/20 bg-black text-emerald-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-extrabold text-white uppercase block">
                      2. Parcel Count Matches Manifest ({dispatch.parcelCount || 'Verified'})
                    </span>
                    <span className="text-xs text-gray-400 block mt-0.5">The total physical items received matches declared waybill count.</span>
                  </div>
                </label>

                <label className="flex items-start gap-4 p-4 bg-black/40 border border-white/10 rounded-2xl cursor-pointer hover:border-emerald-500/50 transition-all">
                  <input
                    type="checkbox"
                    checked={legacyChecklist.correctProducts}
                    onChange={e => setLegacyChecklist(prev => ({ ...prev, correctProducts: e.target.checked }))}
                    className="w-5 h-5 rounded border-white/20 bg-black text-emerald-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-extrabold text-white uppercase block">3. Correct Products & Quantities</span>
                    <span className="text-xs text-gray-400 block mt-0.5">Contents cross-checked against the line items.</span>
                  </div>
                </label>

                <label className="flex items-start gap-4 p-4 bg-black/40 border border-white/10 rounded-2xl cursor-pointer hover:border-emerald-500/50 transition-all">
                  <input
                    type="checkbox"
                    checked={legacyChecklist.qualityChecked}
                    onChange={e => setLegacyChecklist(prev => ({ ...prev, qualityChecked: e.target.checked }))}
                    className="w-5 h-5 rounded border-white/20 bg-black text-emerald-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-extrabold text-white uppercase block">4. Joinery Quality Inspection Passed</span>
                    <span className="text-xs text-gray-400 block mt-0.5">Veneers, finishes, and hardware arrive free from defects.</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* STEP 3: Evidence & Notes */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  Step 3: Photographic Evidence & Receiving Notes
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Record package evidence photos and document courier delivery notes
                </p>
              </div>

              {/* MODERN MODE: Package-Specific Photo Attachment */}
              {isModern && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-black uppercase text-gray-300 tracking-wider">
                      Select Package for Photo Evidence:
                    </span>
                    <span className="text-xs font-mono text-cyan-400">
                      Active: Pkg {selectedPkg?.packageNumber || 1} of {packages.length} ({selectedPkg?.packageCode})
                    </span>
                  </div>

                  {/* Horizontal Package Selector Pills */}
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-black/30 rounded-2xl border border-white/5">
                    {packages.map((pkg, idx) => {
                      const isSelected = idx === selectedPackageIndex;
                      const count = pkg.receivingPhotos?.length || 0;

                      return (
                        <button
                          key={pkg.id || idx}
                          type="button"
                          onClick={() => setSelectedPackageIndex(idx)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center space-x-1.5 border ${
                            isSelected
                              ? 'bg-emerald-500 text-black font-bold border-emerald-500 shadow'
                              : 'bg-black/40 hover:bg-black/60 text-gray-300 border-white/10'
                          }`}
                        >
                          <span>Pkg {pkg.packageNumber}/{pkg.totalPackages}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            isSelected
                              ? 'bg-black text-emerald-400'
                              : count > 0
                              ? 'bg-cyan-500/20 text-cyan-400'
                              : 'bg-white/10 text-gray-500'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Package Evidence Card */}
                  {selectedPkg && (
                    <div className="bg-black/50 border border-white/10 rounded-3xl p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="text-sm font-mono font-bold text-white block">
                            {selectedPkg.packageCode} — Package {selectedPkg.packageNumber} of {selectedPkg.totalPackages}
                          </span>
                          <span className="text-xs text-gray-400 block mt-0.5">
                            {selectedPkg.description || 'Joinery component'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-mono uppercase text-gray-400">Category:</label>
                          <select
                            value={selectedEvidenceType}
                            onChange={e => setSelectedEvidenceType(e.target.value as EvidenceType)}
                            className="bg-black border border-white/15 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                          >
                            <option value="package_condition">Package Condition</option>
                            <option value="package_label">Package Label</option>
                            <option value="package_contents">Package Contents</option>
                            <option value="damage_report">Damage Report</option>
                            <option value="delivery_note">Delivery Note</option>
                            <option value="general_evidence">General Evidence</option>
                          </select>
                        </div>
                      </div>

                      {/* Snap / Upload Control */}
                      <label className="block border-2 border-dashed border-white/15 hover:border-emerald-400/50 rounded-2xl p-6 text-center cursor-pointer transition-all bg-white/[0.02]">
                        <Icon name="camera" size={28} className="mx-auto text-emerald-400 mb-2" />
                        <span className="text-xs font-bold text-gray-200 block">
                          Snap with Camera or Upload Photos for Package {selectedPkg.packageNumber}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono block mt-1">
                          Category: {selectedEvidenceType.replace('_', ' ').toUpperCase()} • Lightweight Metadata
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          multiple
                          onChange={e => handleAddPackagePhoto(e, selectedPackageIndex)}
                          className="hidden"
                        />
                      </label>

                      {/* Package Photos Grid */}
                      {(!selectedPkg.receivingPhotos || selectedPkg.receivingPhotos.length === 0) ? (
                        <div className="p-4 text-center bg-black/30 border border-white/5 rounded-2xl text-xs text-gray-500">
                          No receiving photos attached to Package {selectedPkg.packageNumber} yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {selectedPkg.receivingPhotos.map(photo => {
                            const previewUrl = localPhotoPreviews[photo.id];

                            return (
                              <div
                                key={photo.id}
                                className="bg-black/60 border border-white/10 p-3 rounded-2xl space-y-2 text-xs relative group"
                              >
                                {previewUrl ? (
                                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-black/40 border border-white/10 relative">
                                    <img
                                      src={previewUrl}
                                      alt={photo.originalFileName}
                                      className="w-full h-full object-cover"
                                    />
                                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 rounded text-[9px] font-mono text-cyan-300">
                                      Local Preview
                                    </span>
                                  </div>
                                ) : (
                                  <div className="aspect-video w-full rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex flex-col items-center justify-center text-cyan-400 p-2">
                                    <Icon name="image" size={24} />
                                    <span className="text-[9px] font-mono text-gray-400 mt-1 truncate max-w-full">
                                      {photo.originalFileName}
                                    </span>
                                  </div>
                                )}

                                <div className="space-y-1 text-[10px]">
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Category:</span>
                                    <span className="font-mono text-emerald-300 uppercase">{photo.evidenceType.replace('_', ' ')}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Time:</span>
                                    <span className="text-gray-300 font-mono">{new Date(photo.uploadedAt).toLocaleTimeString()}</span>
                                  </div>
                                  <div className="p-1.5 bg-white/5 rounded border border-white/5 text-[9px] text-gray-400 font-mono break-all">
                                    {photo.storagePath}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemovePackagePhoto(selectedPackageIndex, photo.id)}
                                  className="absolute top-2 right-2 p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-xs transition-all shadow"
                                >
                                  <Icon name="trash-2" size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* General Courier Delivery Note & Waybill Section */}
              <div className="bg-black/40 border border-white/10 rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black uppercase text-amber-400 block tracking-wider">
                      Courier Delivery Note / Signed Waybill
                    </span>
                    <span className="text-[11px] text-gray-400 block mt-0.5">
                      Capture photograph of physical signed waybill for chain of custody record
                    </span>
                  </div>
                </div>

                <label className="block border-2 border-dashed border-white/15 hover:border-amber-400/50 rounded-2xl p-4 text-center cursor-pointer transition-all bg-white/[0.02]">
                  <Icon name="file-text" size={24} className="mx-auto text-amber-400 mb-1" />
                  <span className="text-xs font-bold text-gray-200 block">
                    Snap / Upload Signed Delivery Note
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={e => handleGeneralPhotoUpload(e, 'delivery_note')}
                    className="hidden"
                  />
                </label>

                {receivingPhotos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                    {receivingPhotos.map(p => (
                      <div key={p.id} className="relative rounded-xl overflow-hidden aspect-square border border-white/10 bg-black/40">
                        {p.url && (
                          <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-black/80 p-1 text-[9px] text-white truncate font-mono">
                          {p.name}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveGeneralPhoto(p.id)}
                          className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md text-[10px]"
                        >
                          <Icon name="x" size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Overall Receiver Notes & Discrepancies Textarea */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-gray-300 block">
                  Overall Receiver Notes & Comments:
                </label>
                <textarea
                  rows={4}
                  value={receivingNotes}
                  onChange={e => setReceivingNotes(e.target.value)}
                  placeholder="Record overall delivery condition, courier driver remarks, or special installation notes..."
                  className="w-full bg-black border border-white/10 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>
            </div>
          )}

          {/* STEP 4: Sign-Off & Approval */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  Step 4: Final Receiving Sign-Off & Chain of Custody Approval
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Confirm physical receipt to update inventory, update package statuses, and record audit log
                </p>
              </div>

              {/* Summary Audit Card */}
              <div className="bg-black/40 border border-white/10 p-5 rounded-2xl space-y-3 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Receiving Officer:</span>
                  <span className="text-white font-bold">{currentUser?.fullName || currentUser?.name || currentUser?.email || 'Store Receiver'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Destination Branch:</span>
                  <span className="text-emerald-400 font-bold">{dispatch.destinationBranch}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Courier Service:</span>
                  <span className="text-cyan-400 font-bold">{dispatch.courierCompany || dispatch.courier || 'Direct'}</span>
                </div>

                {isModern ? (
                  <>
                    <div className="border-t border-white/5 pt-2 flex justify-between">
                      <span className="text-gray-400">Total Expected Packages:</span>
                      <span className="text-white font-bold">{summary.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Packages Received:</span>
                      <span className="text-emerald-400 font-bold">{summary.received} / {summary.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Missing / Damaged / Incorrect:</span>
                      <span className={`font-bold ${summary.missing + summary.damaged + summary.incorrect > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                        {summary.missing} Missing, {summary.damaged} Damaged, {summary.incorrect} Incorrect
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Unverified Packages:</span>
                      <span className={`font-bold ${summary.unverified > 0 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                        {summary.unverified}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="border-t border-white/5 pt-2 flex justify-between">
                    <span className="text-gray-400">Checklist Passed:</span>
                    <span className="text-amber-400 font-bold">
                      {Object.values(legacyChecklist).filter(Boolean).length} / 4 Items
                    </span>
                  </div>
                )}
              </div>

              {/* Status Blocking Guidance Alert */}
              {isModern && summary.unverified > 0 && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center space-x-3 text-red-300 text-xs font-mono">
                  <Icon name="alert-circle" size={20} className="shrink-0 text-red-400" />
                  <div>
                    <strong className="block text-red-400 uppercase font-black">Completion Blocked:</strong>
                    <span>{summary.unverified} package(s) remain unverified. Go back to Step 2 to mark all packages before sign-off.</span>
                  </div>
                </div>
              )}

              {isModern && summary.unverified === 0 && (summary.missing > 0 || summary.damaged > 0 || summary.incorrect > 0) && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center space-x-3 text-amber-200 text-xs font-mono">
                  <Icon name="alert-triangle" size={20} className="shrink-0 text-amber-400" />
                  <div>
                    <strong className="block text-amber-400 uppercase font-black">Discrepancy Detected:</strong>
                    <span>Shipment cannot be marked as fully Received because discrepancies exist ({summary.missing} missing, {summary.damaged} damaged, {summary.incorrect} incorrect). Choose Partial Receipt or Log Issue.</span>
                  </div>
                </div>
              )}

              {/* Final Action Sign-Off Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                {/* 1. Full Receipt Button */}
                <button
                  type="button"
                  disabled={isSubmitting || (isModern && (summary.unverified > 0 || summary.missing > 0 || summary.damaged > 0 || summary.incorrect > 0))}
                  onClick={() => handleFinishReceiving('Received')}
                  className={`p-4 rounded-2xl text-xs font-black uppercase tracking-wider flex flex-col items-center justify-center gap-1.5 transition-all shadow-lg border ${
                    !isSubmitting && (!isModern || (summary.unverified === 0 && summary.missing === 0 && summary.damaged === 0 && summary.incorrect === 0))
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 cursor-pointer'
                      : 'bg-white/5 text-gray-500 border-white/5 cursor-not-allowed opacity-40'
                  }`}
                >
                  <Icon name="check-circle" size={20} />
                  <span>Approve Full Receipt</span>
                  <span className="text-[9px] font-mono lowercase opacity-80">(all {isModern ? summary.total : ''} packages intact)</span>
                </button>

                {/* 2. Partial Receipt Button */}
                <button
                  type="button"
                  disabled={isSubmitting || (isModern && summary.unverified > 0)}
                  onClick={() => handleFinishReceiving('Partially Received')}
                  className={`p-4 rounded-2xl text-xs font-black uppercase tracking-wider flex flex-col items-center justify-center gap-1.5 transition-all shadow-lg border ${
                    !isSubmitting && (!isModern || summary.unverified === 0)
                      ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500 cursor-pointer'
                      : 'bg-white/5 text-gray-500 border-white/5 cursor-not-allowed opacity-40'
                  }`}
                >
                  <Icon name="package" size={20} />
                  <span>Approve Partial Receipt</span>
                  <span className="text-[9px] font-mono lowercase opacity-80">(some packages missing/delayed)</span>
                </button>

                {/* 3. Issue Logged Button */}
                <button
                  type="button"
                  disabled={isSubmitting || (isModern && summary.unverified > 0)}
                  onClick={() => handleFinishReceiving('Issue Logged')}
                  className={`p-4 rounded-2xl text-xs font-black uppercase tracking-wider flex flex-col items-center justify-center gap-1.5 transition-all shadow-lg border ${
                    !isSubmitting && (!isModern || summary.unverified === 0)
                      ? 'bg-red-600 hover:bg-red-500 text-white border-red-500 cursor-pointer'
                      : 'bg-white/5 text-gray-500 border-white/5 cursor-not-allowed opacity-40'
                  }`}
                >
                  <Icon name="alert-triangle" size={20} />
                  <span>Log Delivery Issue</span>
                  <span className="text-[9px] font-mono lowercase opacity-80">(damage / incorrect items)</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Wizard Footer Navigation Controls */}
        <div className="p-5 sm:p-6 border-t border-white/10 flex items-center justify-between sticky bottom-0 bg-[#121214] z-20">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => {
              setValidationError(null);
              setCurrentStep(prev => (prev - 1) as any);
            }}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-30 transition-all"
          >
            Back
          </button>

          {currentStep < 4 && (
            <button
              type="button"
              onClick={() => {
                setValidationError(null);
                setCurrentStep(prev => (prev + 1) as any);
              }}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg"
            >
              <span>Next Step</span>
              <Icon name="arrow-right" size={16} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
