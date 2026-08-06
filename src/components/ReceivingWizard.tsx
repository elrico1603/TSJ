import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { googleDriveService, DriveFileInfo, DriveFolderInfo } from '../services/googleDriveService';
import { DispatchRecord, DispatchItem, ReceivingPhoto } from './DispatchDetails';

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
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Checklist state
  const [checklist, setChecklist] = useState({
    packagingIntact: true,
    parcelCountMatches: true,
    correctProducts: true,
    qualityChecked: true
  });

  // Photos state (3 required categories)
  const [receivingPhotos, setReceivingPhotos] = useState<ReceivingPhoto[]>(
    dispatch.receivingPhotos || []
  );

  // Notes & Discrepancy
  const [receivingNotes, setReceivingNotes] = useState(dispatch.receivingNotes || '');

  // Google Drive Receiving Folder
  const [receivingFolder, setReceivingFolder] = useState<DriveFolderInfo | null>(
    dispatch.googleDriveReceivingFolderId ? {
      folderId: dispatch.googleDriveReceivingFolderId,
      folderName: `RECEIVING_${dispatch.dispatchNumber}`,
      folderUrl: dispatch.googleDriveReceivingFolderUrl || `https://drive.google.com/drive/folders/${dispatch.googleDriveReceivingFolderId}`
    } : null
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto create independent Google Drive Receiving Folder when wizard opens
  useEffect(() => {
    if (!receivingFolder) {
      googleDriveService.createReceivingFolder({
        dispatchNumber: dispatch.dispatchNumber,
        customer: dispatch.customer,
        project: dispatch.project,
        branch: dispatch.destinationBranch
      }).then(folder => {
        setReceivingFolder(folder);
      }).catch(err => {
        console.warn('Failed to create receiving drive folder:', err);
      });
    }
  }, [dispatch, receivingFolder]);

  const deliveryNotePhotos = receivingPhotos.filter(p => p.category === 'delivery_note');
  const parcelConditionPhotos = receivingPhotos.filter(p => p.category === 'parcel_condition');
  const unpackedItemsPhotos = receivingPhotos.filter(p => p.category === 'unpacked_items');

  const validateStep3 = (): boolean => {
    const errs: Record<string, string> = {};
    if (deliveryNotePhotos.length === 0) {
      errs.deliveryNote = 'Delivery note photograph is mandatory.';
    }
    if (parcelConditionPhotos.length === 0) {
      errs.parcelCondition = 'Parcel condition photograph is mandatory.';
    }
    if (unpackedItemsPhotos.length === 0) {
      errs.unpackedItems = 'Unpacked items photograph is mandatory.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, category: 'delivery_note' | 'parcel_condition' | 'unpacked_items') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const photo: ReceivingPhoto = {
          id: `recv_photo_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          category,
          name: file.name,
          url: reader.result as string,
          uploadedAt: new Date().toISOString(),
          size: file.size
        };
        setReceivingPhotos(prev => [...prev, photo]);
      };
      reader.readAsDataURL(file);
    });

    // Clear input
    e.target.value = '';
  };

  const handleRemovePhoto = (photoId: string) => {
    setReceivingPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const handleFinishReceiving = async (targetStatus: 'Received' | 'Partially Received' | 'Issue Logged') => {
    if (!validateStep3()) {
      setCurrentStep(3);
      return;
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const receivingUser = currentUser?.fullName || currentUser?.name || currentUser?.email || 'Store Receiver';

      let folderInfo = receivingFolder;
      if (!folderInfo) {
        folderInfo = await googleDriveService.createReceivingFolder({
          dispatchNumber: dispatch.dispatchNumber,
          customer: dispatch.customer,
          project: dispatch.project,
          branch: dispatch.destinationBranch
        });
      }

      const historyEntry = {
        action: `Received (${targetStatus})`,
        user: receivingUser,
        timestamp: nowIso,
        notes: receivingNotes || `Goods received with status ${targetStatus}`
      };

      const updatedRecord: DispatchRecord = {
        ...dispatch,
        status: targetStatus,
        receivingChecklist: checklist,
        receivingPhotos,
        receivingNotes,
        receivedBy: receivingUser,
        receivedAt: nowIso,
        googleDriveReceivingFolderId: folderInfo.folderId,
        googleDriveReceivingFolderUrl: folderInfo.folderUrl,
        updatedAt: nowIso,
        history: [...(dispatch.history || []), historyEntry]
      };

      await onSaveReceiving(updatedRecord, targetStatus);
      if (announce) announce(`Dispatch ${dispatch.dispatchNumber} marked as ${targetStatus}`);
    } catch (err) {
      console.error('Error completing receiving wizard:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto font-sans">
      <div className="bg-[#121214] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col my-auto">
        
        {/* Wizard Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#121214]/95 backdrop-blur-md z-20">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <Icon name="check-circle" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black uppercase text-white tracking-wider">
                  RECEIVING WIZARD: {dispatch.dispatchNumber}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Read-Only Dispatch Safeguard
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Verify Goods • Upload Mandatory Photos • Approve Receipt
              </p>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Wizard Step Navigation */}
        <div className="px-6 pt-6">
          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { step: 1, label: '1. Dispatch Info' },
              { step: 2, label: '2. Checklist' },
              { step: 3, label: '3. Mandatory Photos' },
              { step: 4, label: '4. Discrepancies' },
              { step: 5, label: '5. Sign-Off' }
            ].map(s => (
              <button
                key={s.step}
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
                <span className="hidden md:inline">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step Body */}
        <div className="p-6 space-y-6 flex-1">
          
          {/* STEP 1: Read-Only Dispatch Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center gap-3">
                <Icon name="shield" size={20} className="text-amber-400 shrink-0" />
                <p className="text-xs text-amber-200">
                  <strong>Read-Only Protection:</strong> Dispatch details entered by sender are strictly read-only and cannot be altered during the receiving process.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <p className="text-sm font-bold text-amber-400">{dispatch.destinationBranch}</p>
                </div>

                <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Courier & Company</span>
                  <p className="text-sm font-bold text-white">{dispatch.courierCompany || dispatch.courier || 'N/A'}</p>
                </div>

                <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Tracking Number</span>
                  {dispatch.trackingNumber ? (
                    <a
                      href={dispatch.trackingUrl || `https://www.google.com/search?q=${encodeURIComponent(dispatch.trackingNumber)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono font-bold text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <span>{dispatch.trackingNumber}</span>
                      <Icon name="external-link" size={14} />
                    </a>
                  ) : (
                    <p className="text-sm font-mono text-gray-500">N/A</p>
                  )}
                </div>

                <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Total Parcels</span>
                  <p className="text-sm font-bold text-purple-400">{dispatch.parcelCount || 'N/A'}</p>
                </div>
              </div>

              {/* Items List */}
              {dispatch.items && dispatch.items.length > 0 && (
                <div className="bg-black/40 border border-white/10 p-4 rounded-2xl space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-300">
                    Dispatched Items ({dispatch.items.length})
                  </h4>
                  <div className="divide-y divide-white/5 font-mono text-xs">
                    {dispatch.items.map((item, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between text-gray-300">
                        <div>
                          <span className="font-bold text-white">{item.productName}</span>
                          <span className="text-gray-500 block text-[10px]">{item.internalProductCode} • {item.supplier || 'N/A'}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-emerald-400 font-bold">{item.quantity} units</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sender Notes */}
              {dispatch.notes && (
                <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Dispatch Notes & Packaging Instructions</span>
                  <p className="text-xs text-gray-300 italic">"{dispatch.notes}"</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Receiving Checklist */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Step 2: Receiving Physical Verification Checklist</h3>
                <p className="text-xs text-gray-400 mt-0.5">Check all items carefully before completing sign-off</p>
              </div>

              <div className="space-y-4">
                <label className="flex items-start gap-4 p-4 bg-black/40 border border-white/10 rounded-2xl cursor-pointer hover:border-emerald-500/50 transition-all">
                  <input
                    type="checkbox"
                    checked={checklist.packagingIntact}
                    onChange={e => setChecklist(prev => ({ ...prev, packagingIntact: e.target.checked }))}
                    className="w-5 h-5 rounded border-white/20 bg-black text-emerald-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-extrabold text-white uppercase block">1. Outer Packaging Intact & Undamaged</span>
                    <span className="text-xs text-gray-400 block mt-0.5">Boxes, crates, or protective bubble wrap show no severe tears, water marks, or crush damage.</span>
                  </div>
                </label>

                <label className="flex items-start gap-4 p-4 bg-black/40 border border-white/10 rounded-2xl cursor-pointer hover:border-emerald-500/50 transition-all">
                  <input
                    type="checkbox"
                    checked={checklist.parcelCountMatches}
                    onChange={e => setChecklist(prev => ({ ...prev, parcelCountMatches: e.target.checked }))}
                    className="w-5 h-5 rounded border-white/20 bg-black text-emerald-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-extrabold text-white uppercase block">
                      2. Parcel Count Matches Manifest ({dispatch.parcelCount || 'Verified'})
                    </span>
                    <span className="text-xs text-gray-400 block mt-0.5">The total physical boxes/pallets received matches the declared waybill parcel count.</span>
                  </div>
                </label>

                <label className="flex items-start gap-4 p-4 bg-black/40 border border-white/10 rounded-2xl cursor-pointer hover:border-emerald-500/50 transition-all">
                  <input
                    type="checkbox"
                    checked={checklist.correctProducts}
                    onChange={e => setChecklist(prev => ({ ...prev, correctProducts: e.target.checked }))}
                    className="w-5 h-5 rounded border-white/20 bg-black text-emerald-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-extrabold text-white uppercase block">3. Correct Products & Quantities</span>
                    <span className="text-xs text-gray-400 block mt-0.5">Contents unpacked and cross-checked against the dispatch manifest line items.</span>
                  </div>
                </label>

                <label className="flex items-start gap-4 p-4 bg-black/40 border border-white/10 rounded-2xl cursor-pointer hover:border-emerald-500/50 transition-all">
                  <input
                    type="checkbox"
                    checked={checklist.qualityChecked}
                    onChange={e => setChecklist(prev => ({ ...prev, qualityChecked: e.target.checked }))}
                    className="w-5 h-5 rounded border-white/20 bg-black text-emerald-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-extrabold text-white uppercase block">4. Joinery Quality Inspection Passed</span>
                    <span className="text-xs text-gray-400 block mt-0.5">Veneers, finishes, and hardware arrive free from scratches, chips, or manufacturing defects.</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* STEP 3: Mandatory Photographs */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  Step 3: Mandatory Photographs
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Receivers MUST upload photographs across all 3 required categories before sign-off
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Photo 1: Delivery Note */}
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
                      <Icon name="file-text" size={16} />
                      1. Delivery Note
                    </span>
                    <span className="text-[10px] font-mono text-red-400 uppercase font-bold">Mandatory</span>
                  </div>

                  <p className="text-[11px] text-gray-400">Clear photo of signed physical delivery note or waybill.</p>

                  <label className="block border-2 border-dashed border-white/15 hover:border-amber-400/50 rounded-xl p-4 text-center cursor-pointer transition-all bg-white/[0.02]">
                    <Icon name="camera" size={24} className="mx-auto text-amber-400 mb-1" />
                    <span className="text-[11px] font-bold text-gray-200 block">Snap / Upload Delivery Note</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={e => handleFileUpload(e, 'delivery_note')}
                      className="hidden"
                    />
                  </label>

                  {deliveryNotePhotos.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {deliveryNotePhotos.map(p => (
                        <div key={p.id} className="relative group rounded-xl overflow-hidden aspect-square border border-white/10">
                          <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                          <button
                            onClick={() => handleRemovePhoto(p.id)}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md text-[10px]"
                          >
                            <Icon name="x" size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {errors.deliveryNote && <p className="text-[10px] text-red-400 font-mono">{errors.deliveryNote}</p>}
                </div>

                {/* Photo 2: Parcel Condition */}
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-cyan-400 flex items-center gap-1.5">
                      <Icon name="box" size={16} />
                      2. Parcel Condition
                    </span>
                    <span className="text-[10px] font-mono text-red-400 uppercase font-bold">Mandatory</span>
                  </div>

                  <p className="text-[11px] text-gray-400">Photo of unopened boxes/crates on arrival showing labels.</p>

                  <label className="block border-2 border-dashed border-white/15 hover:border-cyan-400/50 rounded-xl p-4 text-center cursor-pointer transition-all bg-white/[0.02]">
                    <Icon name="camera" size={24} className="mx-auto text-cyan-400 mb-1" />
                    <span className="text-[11px] font-bold text-gray-200 block">Snap / Upload Parcel Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={e => handleFileUpload(e, 'parcel_condition')}
                      className="hidden"
                    />
                  </label>

                  {parcelConditionPhotos.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {parcelConditionPhotos.map(p => (
                        <div key={p.id} className="relative group rounded-xl overflow-hidden aspect-square border border-white/10">
                          <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                          <button
                            onClick={() => handleRemovePhoto(p.id)}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md text-[10px]"
                          >
                            <Icon name="x" size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {errors.parcelCondition && <p className="text-[10px] text-red-400 font-mono">{errors.parcelCondition}</p>}
                </div>

                {/* Photo 3: Unpacked Items */}
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-emerald-400 flex items-center gap-1.5">
                      <Icon name="package" size={16} />
                      3. Unpacked Items
                    </span>
                    <span className="text-[10px] font-mono text-red-400 uppercase font-bold">Mandatory</span>
                  </div>

                  <p className="text-[11px] text-gray-400">Photo of unpacked joinery items laid out for inspection.</p>

                  <label className="block border-2 border-dashed border-white/15 hover:border-emerald-400/50 rounded-xl p-4 text-center cursor-pointer transition-all bg-white/[0.02]">
                    <Icon name="camera" size={24} className="mx-auto text-emerald-400 mb-1" />
                    <span className="text-[11px] font-bold text-gray-200 block">Snap / Upload Unpacked Items</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={e => handleFileUpload(e, 'unpacked_items')}
                      className="hidden"
                    />
                  </label>

                  {unpackedItemsPhotos.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {unpackedItemsPhotos.map(p => (
                        <div key={p.id} className="relative group rounded-xl overflow-hidden aspect-square border border-white/10">
                          <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                          <button
                            onClick={() => handleRemovePhoto(p.id)}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md text-[10px]"
                          >
                            <Icon name="x" size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {errors.unpackedItems && <p className="text-[10px] text-red-400 font-mono">{errors.unpackedItems}</p>}
                </div>

              </div>

              {receivingFolder && (
                <div className="bg-purple-950/20 border border-purple-500/30 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-white uppercase block">Independent Google Drive Receiving Vault</span>
                    <span className="text-[10px] text-purple-300 font-mono block">{receivingFolder.folderName}</span>
                  </div>
                  <a
                    href={receivingFolder.folderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold uppercase flex items-center gap-1"
                  >
                    <Icon name="external-link" size={14} />
                    <span>Open Drive</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Comments & Discrepancies */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Step 4: Receiver Comments & Discrepancies Log</h3>
                <p className="text-xs text-gray-400 mt-0.5">Record any missing items, damaged panels, or general delivery notes</p>
              </div>

              <textarea
                rows={5}
                value={receivingNotes}
                onChange={e => setReceivingNotes(e.target.value)}
                placeholder="e.g. Received 3 out of 4 parcels in good condition. Parcel #4 had minor edge dent on bottom packaging; photo attached."
                className="w-full bg-black border border-white/10 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-emerald-500 font-sans"
              />
            </div>
          )}

          {/* STEP 5: Sign-Off & Approval */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Step 5: Final Receiving Sign-Off</h3>
                <p className="text-xs text-gray-400 mt-0.5">Confirm receipt approval to update inventory and notify management</p>
              </div>

              <div className="bg-black/40 border border-white/10 p-5 rounded-2xl space-y-3 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Receiving User Signature:</span>
                  <span className="text-white font-bold">{currentUser?.fullName || currentUser?.name || currentUser?.email || 'Store Receiver'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Mandatory Photos Uploaded:</span>
                  <span className="text-emerald-400 font-bold">{receivingPhotos.length} Photos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Checklist Completion:</span>
                  <span className="text-amber-400 font-bold">
                    {Object.values(checklist).filter(Boolean).length} / 4 Passed
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFinishReceiving('Received')}
                  className="p-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all shadow-lg"
                >
                  <Icon name="check-circle" size={20} />
                  <span>Approve Full Receipt</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFinishReceiving('Partially Received')}
                  className="p-4 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all shadow-lg"
                >
                  <Icon name="package" size={20} />
                  <span>Approve Partial Receipt</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFinishReceiving('Issue Logged')}
                  className="p-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all shadow-lg"
                >
                  <Icon name="alert-triangle" size={20} />
                  <span>Log Delivery Issue</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Wizard Footer Controls */}
        <div className="p-6 border-t border-white/10 flex items-center justify-between sticky bottom-0 bg-[#121214] z-20">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep(prev => (prev - 1) as any)}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-30"
          >
            Back
          </button>

          {currentStep < 5 && (
            <button
              type="button"
              onClick={() => {
                if (currentStep === 3 && !validateStep3()) return;
                setCurrentStep(prev => (prev + 1) as any);
              }}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2"
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
