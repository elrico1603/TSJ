import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import {
  MobileDispatchDoc,
  DispatchPhotoItem,
  generateDispatchNumber,
  uploadDispatchPhoto,
  createMobileDispatch,
  confirmReceiptAndInspect,
  flagDispatchDiscrepancy,
  subscribeMobileDispatches
} from '../services/mobileDispatchService';
import { permissionService } from '../services/permissionService';

interface DispatchesViewProps {
  currentUser?: any;
  announce?: (msg: string) => void;
  onBackToDashboard?: () => void;
}

const BRANCH_OPTIONS = [
  'Cape Town',
  'Main Factory',
  'Site',
  'Johannesburg',
  'Durban'
];

const COURIER_OPTIONS = [
  'Internal Driver / Bakkie',
  'The Courier Guy',
  'RAM Hand-to-Hand Couriers',
  'Mainline Freight Logistics',
  'DSV Global Transport',
  'Customer Collection'
];

export const DispatchesView: React.FC<DispatchesViewProps> = ({
  currentUser,
  announce,
  onBackToDashboard
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'incoming'>('incoming');
  const [dispatches, setDispatches] = useState<MobileDispatchDoc[]>([]);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'IN_TRANSIT' | 'DISCREPANCY' | 'DELIVERED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State for "Create Dispatch"
  const [dispatchNumber, setDispatchNumber] = useState(generateDispatchNumber());
  const [originBranch, setOriginBranch] = useState('Main Factory');
  const [destinationBranch, setDestinationBranch] = useState('Cape Town');
  const [project, setProject] = useState('');
  const [customer, setCustomer] = useState('');
  const [totalPiecesInput, setTotalPiecesInput] = useState<number>(1);
  const [courier, setCourier] = useState('Internal Driver / Bakkie');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [stagedOutgoingFiles, setStagedOutgoingFiles] = useState<File[]>([]);
  const [outgoingPreviews, setOutgoingPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');

  // Receiving / Inspection Modal State
  const [inspectingDispatch, setInspectingDispatch] = useState<MobileDispatchDoc | null>(null);
  const [receiverName, setReceiverName] = useState(
    currentUser?.name || currentUser?.firstName || 'Cape Town Depot Manager'
  );
  const [receivingNotes, setReceivingNotes] = useState('');
  const [stagedIncomingFiles, setStagedIncomingFiles] = useState<File[]>([]);
  const [incomingPreviews, setIncomingPreviews] = useState<string[]>([]);
  const [checkedPieces, setCheckedPieces] = useState<number[]>([]);
  const [checklist, setChecklist] = useState({
    packagingIntact: true,
    parcelCountMatches: true,
    qualityChecked: true
  });
  const [isInspectingSubmitting, setIsInspectingSubmitting] = useState(false);
  const [inspectProgressText, setInspectProgressText] = useState('');

  // Photo Full-Screen Lightbox Modal
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);

  // Printable Delivery Note / Waybill State
  const [printingDispatch, setPrintingDispatch] = useState<MobileDispatchDoc | null>(null);

  // File Input Refs
  const outgoingCameraRef = useRef<HTMLInputElement>(null);
  const incomingCameraRef = useRef<HTMLInputElement>(null);

  // Permission Enforcement for Dispatch & Receiving sub-modules
  const canViewDispatch = permissionService.hasPermission(currentUser, 'Dispatch Creation', 'View') ||
    permissionService.hasPermission(currentUser, 'Receiving Inspection', 'View');
  const canCreateDispatch = permissionService.hasPermission(currentUser, 'Dispatch Creation', 'Create');
  const canInspectReceiving = permissionService.hasPermission(currentUser, 'Receiving Inspection', 'Approve') ||
    permissionService.hasPermission(currentUser, 'Receiving Inspection', 'Create') ||
    permissionService.hasPermission(currentUser, 'Receiving Inspection', 'Edit');
  const canFlagDiscrepancy = permissionService.hasPermission(currentUser, 'Discrepancy Management', 'Create') ||
    permissionService.hasPermission(currentUser, 'Discrepancy Management', 'Edit') ||
    permissionService.hasPermission(currentUser, 'Discrepancy Management', 'Approve');
  const canPrintWaybill = permissionService.hasPermission(currentUser, 'Waybills & Delivery Notes', 'Print') ||
    permissionService.hasPermission(currentUser, 'Dispatch Creation', 'Print');

  // Subscribe to real-time dispatches
  useEffect(() => {
    const unsubscribe = subscribeMobileDispatches((items) => {
      setDispatches(items);
    });
    return () => unsubscribe();
  }, []);

  // Update receiver name when user changes
  useEffect(() => {
    if (currentUser) {
      setReceiverName(
        currentUser.name ||
        `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() ||
        currentUser.email ||
        'Receiving Manager'
      );
    }
  }, [currentUser]);

  // Handle Outgoing Camera/File Selection (Unlimited dynamic N photos)
  const handleOutgoingFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newFiles = Array.from(e.target.files);
    setStagedOutgoingFiles((prev) => {
      const updated = [...prev, ...newFiles];
      // Automatically keep total piece count in sync with outgoing photos count (N = photos.length)
      setTotalPiecesInput(updated.length);
      return updated;
    });

    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setOutgoingPreviews((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (e.target) e.target.value = '';
  };

  const removeOutgoingPhoto = (index: number) => {
    setStagedOutgoingFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      setTotalPiecesInput(Math.max(1, updated.length));
      return updated;
    });
    setOutgoingPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle Incoming Camera/File Selection
  const handleIncomingFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newFiles = Array.from(e.target.files);
    setStagedIncomingFiles((prev) => [...prev, ...newFiles]);

    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setIncomingPreviews((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (e.target) e.target.value = '';
  };

  const removeIncomingPhoto = (index: number) => {
    setStagedIncomingFiles((prev) => prev.filter((_, i) => i !== index));
    setIncomingPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Create Dispatch
  const handleCreateDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project.trim()) {
      alert('Please specify the Project or Job Name.');
      return;
    }

    setIsSubmitting(true);
    setUploadProgressText('Preparing dispatch document...');

    try {
      const tempDispatchId = `dsp_${Date.now()}`;
      const uploadedPhotos: DispatchPhotoItem[] = [];

      if (stagedOutgoingFiles.length > 0) {
        for (let i = 0; i < stagedOutgoingFiles.length; i++) {
          const file = stagedOutgoingFiles[i];
          setUploadProgressText(`Uploading outgoing photo ${i + 1} of ${stagedOutgoingFiles.length}...`);
          const photoItem = await uploadDispatchPhoto(file, tempDispatchId, 'outgoing');
          uploadedPhotos.push(photoItem);
        }
      }

      setUploadProgressText('Recording shipment to Firestore...');
      const creator = currentUser?.name || currentUser?.email || 'Factory Dispatch Officer';
      const pieces = totalPiecesInput && totalPiecesInput > 0 ? totalPiecesInput : Math.max(uploadedPhotos.length, 1);

      const newDispatch = await createMobileDispatch({
        dispatchNumber,
        project,
        customer: customer || project,
        originBranch,
        destinationBranch,
        courier,
        trackingNumber,
        notes,
        totalPieces: pieces,
        photos: uploadedPhotos,
        createdBy: creator
      });

      if (announce) {
        announce(`Dispatch ${newDispatch.dispatchNumber} set In Transit (${pieces} piece(s))`);
      }

      // Reset form
      setDispatchNumber(generateDispatchNumber());
      setProject('');
      setCustomer('');
      setNotes('');
      setTrackingNumber('');
      setTotalPiecesInput(1);
      setStagedOutgoingFiles([]);
      setOutgoingPreviews([]);
      setActiveTab('incoming');
      setFilterStatus('IN_TRANSIT');
    } catch (err: any) {
      console.error('Failed to create dispatch:', err);
      alert(`Error creating dispatch: ${err.message || 'Check network connection'}`);
    } finally {
      setIsSubmitting(false);
      setUploadProgressText('');
    }
  };

  // Submit Receiving / Inspection Full Approval
  const handleConfirmInspection = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inspectingDispatch) return;

    const totalCount = inspectingDispatch.totalPieces || (inspectingDispatch.photos && inspectingDispatch.photos.length > 0 ? inspectingDispatch.photos.length : 1);
    
    // Strict Validation: Must have at least 1 label photo and all pieces verified
    if (stagedIncomingFiles.length === 0) {
      alert('Mandatory Label Photo Required: Please snap at least 1 photo of the waybill/package label to approve full delivery.');
      return;
    }

    if (checkedPieces.length < totalCount) {
      alert(`Cannot Approve Full Delivery: Only ${checkedPieces.length} of ${totalCount} pieces are checked. If pieces are missing or damaged, please use "Flag Discrepancy / Partial Receipt".`);
      return;
    }

    setIsInspectingSubmitting(true);
    setInspectProgressText('Uploading label & condition photos...');

    try {
      const uploadedIncomingPhotos: DispatchPhotoItem[] = [];

      if (stagedIncomingFiles.length > 0) {
        for (let i = 0; i < stagedIncomingFiles.length; i++) {
          const file = stagedIncomingFiles[i];
          setInspectProgressText(`Uploading receiving label photo ${i + 1} of ${stagedIncomingFiles.length}...`);
          const photoItem = await uploadDispatchPhoto(file, inspectingDispatch.id, 'incoming');
          uploadedIncomingPhotos.push(photoItem);
        }
      }

      setInspectProgressText('Finalizing approval in Firestore...');
      await confirmReceiptAndInspect(inspectingDispatch.id, {
        receiverName: receiverName.trim() || 'Receiving Depot Manager',
        receivingNotes: receivingNotes.trim() || 'All pieces verified and accepted in good order.',
        receivingPhotos: uploadedIncomingPhotos,
        verifiedPieces: checkedPieces,
        totalPieces: totalCount,
        checklist
      });

      if (announce) {
        announce(`Dispatch ${inspectingDispatch.dispatchNumber} Approved & Completed (${checkedPieces.length}/${totalCount} pieces)`);
      }

      // Reset modal state
      setInspectingDispatch(null);
      setReceivingNotes('');
      setStagedIncomingFiles([]);
      setIncomingPreviews([]);
      setCheckedPieces([]);
    } catch (err: any) {
      console.error('Failed to confirm receipt:', err);
      alert(`Error confirming receipt: ${err.message || 'Check network connection'}`);
    } finally {
      setIsInspectingSubmitting(false);
      setInspectProgressText('');
    }
  };

  // Submit Discrepancy / Partial Receipt Flagging
  const handleFlagDiscrepancy = async () => {
    if (!inspectingDispatch) return;

    const totalCount = inspectingDispatch.totalPieces || (inspectingDispatch.photos && inspectingDispatch.photos.length > 0 ? inspectingDispatch.photos.length : 1);
    const allPiecesList = Array.from({ length: totalCount }, (_, i) => i + 1);
    const missing = allPiecesList.filter(p => !checkedPieces.includes(p));

    const finalNotes = receivingNotes.trim() || (missing.length > 0 ? `Missing pieces: ${missing.map(p => `Piece ${p} of ${totalCount}`).join(', ')}` : 'Damage or discrepancy noted upon receiving inspection.');

    setIsInspectingSubmitting(true);
    setInspectProgressText('Uploading discrepancy evidence photos...');

    try {
      const uploadedIncomingPhotos: DispatchPhotoItem[] = [];

      if (stagedIncomingFiles.length > 0) {
        for (let i = 0; i < stagedIncomingFiles.length; i++) {
          const file = stagedIncomingFiles[i];
          setInspectProgressText(`Uploading photo ${i + 1} of ${stagedIncomingFiles.length}...`);
          const photoItem = await uploadDispatchPhoto(file, inspectingDispatch.id, 'incoming');
          uploadedIncomingPhotos.push(photoItem);
        }
      }

      setInspectProgressText('Logging discrepancy to Firestore...');
      await flagDispatchDiscrepancy(inspectingDispatch.id, {
        receiverName: receiverName.trim() || 'Receiving Officer',
        receivingNotes: finalNotes,
        receivingPhotos: uploadedIncomingPhotos,
        missingPieces: missing,
        verifiedPieces: checkedPieces,
        totalPieces: totalCount
      });

      if (announce) {
        announce(`DISCREPANCY FLAGGED for Dispatch ${inspectingDispatch.dispatchNumber}`);
      }

      // Reset modal state & switch to discrepancy filter
      setInspectingDispatch(null);
      setReceivingNotes('');
      setStagedIncomingFiles([]);
      setIncomingPreviews([]);
      setCheckedPieces([]);
      setFilterStatus('DISCREPANCY');
    } catch (err: any) {
      console.error('Failed to flag discrepancy:', err);
      alert(`Error flagging discrepancy: ${err.message || 'Check network connection'}`);
    } finally {
      setIsInspectingSubmitting(false);
      setInspectProgressText('');
    }
  };

  // Filtered Dispatches List
  const inTransitCount = dispatches.filter(d => d.status === 'In Transit' || d.status === 'Dispatched').length;
  const discrepancyCount = dispatches.filter(d => d.status === 'Discrepancy Flagged' || d.status === 'Issue Logged').length;
  const deliveredCount = dispatches.filter(d => d.status === 'Delivered / Completed' || d.status === 'Delivered / Received' || d.status === 'Received').length;

  const filteredDispatches = dispatches.filter((d) => {
    // Status filter
    if (filterStatus === 'IN_TRANSIT') {
      if (d.status !== 'In Transit' && d.status !== 'Dispatched') return false;
    } else if (filterStatus === 'DISCREPANCY') {
      if (d.status !== 'Discrepancy Flagged' && d.status !== 'Issue Logged') return false;
    } else if (filterStatus === 'DELIVERED') {
      if (d.status !== 'Delivered / Completed' && d.status !== 'Delivered / Received' && d.status !== 'Received') return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = d.dispatchNumber.toLowerCase().includes(q);
      const matchProject = d.project.toLowerCase().includes(q);
      const matchDest = d.destinationBranch.toLowerCase().includes(q);
      const matchOrigin = d.originBranch.toLowerCase().includes(q);
      const matchCourier = (d.courier || '').toLowerCase().includes(q);
      const matchNotes = (d.notes || '').toLowerCase().includes(q) || (d.receivingNotes || '').toLowerCase().includes(q);
      if (!matchNumber && !matchProject && !matchDest && !matchOrigin && !matchCourier && !matchNotes) {
        return false;
      }
    }

    return true;
  });

  if (!canViewDispatch) {
    return (
      <div className="w-full max-w-2xl mx-auto my-12 p-8 text-center bg-red-500/10 border border-red-500/20 rounded-3xl font-sans">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
          <Icon name="lock" size={32} />
        </div>
        <h2 className="text-xl font-black uppercase tracking-wider text-red-400 mb-2 font-sans">Access Restricted</h2>
        <p className="text-xs text-gray-300 font-sans">
          You do not have permission to view or manage Dispatch & Receiving operations. Please contact your system administrator to assign the appropriate Dispatch & Receiving permissions in Roles & Permissions.
        </p>
        {onBackToDashboard && (
          <button
            onClick={onBackToDashboard}
            className="mt-6 px-6 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all inline-flex items-center gap-2"
          >
            <Icon name="arrow-left" size={16} />
            <span>Return to Dashboard</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 space-y-6 font-sans pb-28">
      {/* Top Header & Back Button */}
      <div className="bg-[#151518]/90 border border-white/10 rounded-[2rem] p-5 sm:p-7 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff8c00]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 transition-colors"
                title="Back"
              >
                <Icon name="arrow-left" size={18} />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#ff8c00]/20 text-[#ff8c00]">
                  <Icon name="truck" size={18} />
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#ff8c00]">
                  Mobile Logistics Hub
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight text-white mt-0.5">
                Dispatches & Receiving
              </h1>
            </div>
          </div>

          {/* Real-Time Pulse Tag */}
          <div className="inline-flex items-center gap-2 self-start sm:self-auto px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Cloud Sync Active</span>
          </div>
        </div>

        {/* Primary Toggle Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-black/50 border border-white/10 rounded-2xl mt-6">
          <button
            type="button"
            onClick={() => setActiveTab('incoming')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-200 ${
              activeTab === 'incoming'
                ? 'bg-[#ff8c00] text-white shadow-lg shadow-[#ff8c00]/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon name="package" size={18} />
            <span>Active / Incoming</span>
            {inTransitCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-black/40 text-white text-[10px] font-mono font-black border border-white/20">
                {inTransitCount}
              </span>
            )}
          </button>

          <button
            type="button"
            disabled={!canCreateDispatch}
            onClick={() => {
              if (canCreateDispatch) setActiveTab('create');
            }}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-200 ${
              !canCreateDispatch
                ? 'opacity-40 cursor-not-allowed text-gray-500'
                : activeTab === 'create'
                ? 'bg-[#ff8c00] text-white shadow-lg shadow-[#ff8c00]/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title={canCreateDispatch ? 'Create Dispatch' : 'Permission Required: Dispatch Creation (Create)'}
          >
            <Icon name={canCreateDispatch ? 'plus' : 'lock'} size={18} />
            <span>Create Dispatch</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CREATE DISPATCH (Origin/Sender View) */}
      {/* ========================================================================= */}
      {activeTab === 'create' && (
        <form
          onSubmit={handleCreateDispatch}
          className="bg-[#151518]/90 border border-white/10 rounded-[2rem] p-5 sm:p-8 backdrop-blur-2xl shadow-2xl space-y-6"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                <Icon name="truck" size={20} className="text-[#ff8c00]" />
                Outgoing Dispatch Manifest
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Record shipment details and capture photo evidence before departure.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Dispatch Number */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                  Dispatch Number
                </label>
                <button
                  type="button"
                  onClick={() => setDispatchNumber(generateDispatchNumber())}
                  className="text-[10px] font-mono text-[#ff8c00] hover:underline flex items-center gap-1"
                >
                  <Icon name="refresh-cw" size={12} /> Regenerate
                </button>
              </div>
              <input
                type="text"
                value={dispatchNumber}
                onChange={(e) => setDispatchNumber(e.target.value)}
                required
                className="w-full bg-[#101012] border border-white/10 focus:border-[#ff8c00] rounded-xl px-4 py-3 text-sm font-mono font-bold text-white focus:outline-none transition-colors"
                placeholder="DSP-2026-XXXX"
              />
            </div>

            {/* Project / Job Name */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                Project / Job Name *
              </label>
              <input
                type="text"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                required
                className="w-full bg-[#101012] border border-white/10 focus:border-[#ff8c00] rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none transition-colors"
                placeholder="e.g. Waterfront Penthouse Suite Joinery"
              />
            </div>

            {/* Origin Branch */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                Origin Branch
              </label>
              <select
                value={originBranch}
                onChange={(e) => setOriginBranch(e.target.value)}
                className="w-full bg-[#101012] border border-white/10 focus:border-[#ff8c00] rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none transition-colors"
              >
                {BRANCH_OPTIONS.map((b) => (
                  <option key={b} value={b} className="bg-[#151518] text-white">
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Destination Branch */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                Destination Branch *
              </label>
              <select
                value={destinationBranch}
                onChange={(e) => setDestinationBranch(e.target.value)}
                className="w-full bg-[#101012] border border-white/10 focus:border-[#ff8c00] rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none transition-colors"
              >
                {BRANCH_OPTIONS.map((b) => (
                  <option key={b} value={b} className="bg-[#151518] text-white">
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Courier / Driver */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                Courier / Transport Method
              </label>
              <select
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                className="w-full bg-[#101012] border border-white/10 focus:border-[#ff8c00] rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none transition-colors"
              >
                {COURIER_OPTIONS.map((c) => (
                  <option key={c} value={c} className="bg-[#151518] text-white">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Tracking / Waybill Number */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                Tracking / Waybill # (Optional)
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full bg-[#101012] border border-white/10 focus:border-[#ff8c00] rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none transition-colors"
                placeholder="e.g. RAM-99214-CPT"
              />
            </div>

            {/* Total Pieces / Crate Count */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                Total Pieces / Package Count *
              </label>
              <input
                type="number"
                min="1"
                max="999"
                value={totalPiecesInput}
                onChange={(e) => setTotalPiecesInput(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full bg-[#101012] border border-white/10 focus:border-[#ff8c00] rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none transition-colors"
                placeholder="e.g. 4"
              />
            </div>
          </div>

          {/* Notes & Special Instructions */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
              Handling Instructions & Outgoing Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-[#101012] border border-white/10 focus:border-[#ff8c00] rounded-xl p-4 text-sm text-white focus:outline-none transition-colors resize-none"
              placeholder="e.g. 4 crates with high-gloss walnut panels. Handle with corner protectors and keep upright."
            />
          </div>

          {/* ========================================================================= */}
          {/* NATIVE CAMERA PHOTO EVIDENCE CAPTURE */}
          {/* ========================================================================= */}
          <div className="photo-upload-section border border-white/10 bg-black/40 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <Icon name="camera" size={18} className="text-[#ff8c00]" />
                  Outgoing Photo Evidence Capture
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Take photos of packed items, crate condition, and waybills before departure.
                </p>
              </div>

              {/* Hidden Native Camera & Gallery Input */}
              <input
                ref={outgoingCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handleOutgoingFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => outgoingCameraRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#ff8c00] hover:bg-[#e07b00] text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-[#ff8c00]/20 active:scale-95 transition-all"
              >
                <Icon name="camera" size={16} />
                <span>Snap / Add Photos</span>
              </button>
            </div>

            {/* Photo Previews Grid */}
            {outgoingPreviews.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
                {outgoingPreviews.map((src, index) => (
                  <div
                    key={index}
                    className="relative group rounded-xl overflow-hidden border border-white/10 aspect-square bg-black/60 shadow-md"
                  >
                    <img
                      src={src}
                      alt={`Outgoing item ${index + 1}`}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setActiveLightboxImage(src)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                    
                    <span className="absolute bottom-2 left-2 text-[10px] font-mono font-bold text-white bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-sm">
                      #{index + 1}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeOutgoingPhoto(index);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white transition-colors"
                      title="Remove Photo"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div
                onClick={() => outgoingCameraRef.current?.click()}
                className="border-2 border-dashed border-white/10 hover:border-[#ff8c00]/50 rounded-xl p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center space-y-2 bg-white/[0.02]"
              >
                <div className="p-3 rounded-full bg-white/5 text-gray-400">
                  <Icon name="camera" size={28} />
                </div>
                <p className="text-xs font-bold text-gray-300">
                  Tap here to open native camera or select photos
                </p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">
                  Supports multiple photos (JPG, PNG, WebP)
                </p>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-4 bg-[#ff8c00] hover:bg-[#e07b00] disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-[#ff8c00]/25 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Icon name="refresh-cw" size={16} className="animate-spin" />
                  <span>{uploadProgressText || 'Uploading Dispatch...'}</span>
                </>
              ) : (
                <>
                  <Icon name="send" size={16} />
                  <span>Dispatch Shipment (Set In Progress)</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ACTIVE & INCOMING DISPATCHES (Receiver View) */}
      {/* ========================================================================= */}
      {activeTab === 'incoming' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="bg-[#151518]/90 border border-white/10 rounded-2xl p-4 backdrop-blur-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
            {/* Filter Chips */}
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors whitespace-nowrap ${
                  filterStatus === 'ALL'
                    ? 'bg-white/20 text-white'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                All ({dispatches.length})
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus('IN_TRANSIT')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  filterStatus === 'IN_TRANSIT'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                In Transit ({inTransitCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus('DISCREPANCY')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  filterStatus === 'DISCREPANCY'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/50'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                {discrepancyCount > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />}
                Discrepancies ({discrepancyCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus('DELIVERED')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors whitespace-nowrap ${
                  filterStatus === 'DELIVERED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                Delivered ({deliveredCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Icon
                name="search"
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dispatches..."
                className="w-full bg-[#101012] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:outline-none focus:border-[#ff8c00]"
              />
            </div>
          </div>

          {/* Dispatches Cards List */}
          <div className="space-y-4">
            {filteredDispatches.map((dispatch) => {
              const isInTransit = dispatch.status === 'In Transit' || dispatch.status === 'Dispatched';
              const isDiscrepancy = dispatch.status === 'Discrepancy Flagged' || dispatch.status === 'Issue Logged';
              const isDelivered = dispatch.status === 'Delivered / Completed' || dispatch.status === 'Delivered / Received' || dispatch.status === 'Received';
              const totalPieces = dispatch.totalPieces || (dispatch.photos?.length ? dispatch.photos.length : 1);

              return (
                <div
                  key={dispatch.id}
                  className={`bg-[#151518]/90 border rounded-[2rem] p-5 sm:p-6 backdrop-blur-2xl shadow-xl transition-all space-y-4 ${
                    isDiscrepancy
                      ? 'border-red-500/40 bg-red-950/10 hover:border-red-500/60'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm sm:text-base font-mono font-black text-white bg-white/5 px-3 py-1 rounded-xl border border-white/10">
                        {dispatch.dispatchNumber}
                      </span>

                      {/* Route Pill */}
                      <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                        <span className="text-gray-400">{dispatch.originBranch}</span>
                        <Icon name="arrow-right" size={14} className="text-[#ff8c00]" />
                        <span className="text-white font-black">{dispatch.destinationBranch}</span>
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isInTransit ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-wider">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                          In Transit
                        </span>
                      ) : isDiscrepancy ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/50 text-red-300 text-xs font-black uppercase tracking-wider animate-pulse">
                          <Icon name="alert-triangle" size={14} className="text-red-400" />
                          Discrepancy Flagged
                        </span>
                      ) : isDelivered ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider">
                          <Icon name="check-circle" size={14} />
                          Delivered / Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-500/10 border border-gray-500/30 text-gray-300 text-xs font-bold uppercase">
                          {dispatch.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* RED ALERT BANNER FOR DISCREPANCIES */}
                  {isDiscrepancy && (
                    <div className="bg-red-950/40 border-2 border-red-500/50 rounded-2xl p-4 text-xs space-y-2.5">
                      <div className="flex items-center gap-2 text-red-300 font-black uppercase tracking-wider">
                        <Icon name="alert-triangle" size={18} className="text-red-400" />
                        <span>Exception / Discrepancy Reported at Destination</span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-200">
                        {dispatch.missingPieces && dispatch.missingPieces.length > 0 && (
                          <div className="bg-black/40 rounded-xl p-2.5 border border-red-500/30">
                            <span className="text-[10px] uppercase font-bold text-red-400 block mb-1">
                              Missing Piece(s):
                            </span>
                            <span className="font-mono font-bold text-white">
                              {dispatch.missingPieces.map(p => `Piece ${p} of ${totalPieces}`).join(', ')}
                            </span>
                            <span className="text-[11px] text-gray-400 block mt-0.5">
                              ({(dispatch.verifiedPieces?.length || 0)} of {totalPieces} pieces verified)
                            </span>
                          </div>
                        )}

                        <div className="bg-black/40 rounded-xl p-2.5 border border-red-500/30">
                          <span className="text-[10px] uppercase font-bold text-red-400 block mb-1">
                            Receiver Remarks:
                          </span>
                          <p className="italic text-white">
                            "{dispatch.receivingNotes || 'Discrepancy noted upon delivery inspection.'}"
                          </p>
                          {dispatch.receivedBy && (
                            <span className="text-[10px] text-gray-400 block mt-0.5">
                              Logged by {dispatch.receivedBy} {dispatch.receivedAt ? `on ${new Date(dispatch.receivedAt).toLocaleDateString()}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Project Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                        Project / Job
                      </p>
                      <p className="text-sm font-black text-white">{dispatch.project}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                        Shipment Quantity
                      </p>
                      <p className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Icon name="package" size={14} className="text-[#ff8c00]" />
                        <span>{totalPieces} Piece{totalPieces > 1 ? 's' : ''} / Package{totalPieces > 1 ? 's' : ''}</span>
                      </p>
                    </div>

                    {dispatch.courier && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                          Transport / Courier
                        </p>
                        <p className="text-xs font-bold text-gray-300">
                          {dispatch.courier}
                          {dispatch.trackingNumber ? ` (${dispatch.trackingNumber})` : ''}
                        </p>
                      </div>
                    )}
                  </div>

                  {dispatch.notes && (
                    <div className="bg-black/30 rounded-xl p-3 border border-white/5 text-xs text-gray-300">
                      <span className="font-bold text-gray-400 uppercase text-[10px] block mb-0.5">
                        Sender Handling Notes:
                      </span>
                      {dispatch.notes}
                    </div>
                  )}

                  {/* Outgoing Photos Carousel */}
                  {dispatch.photos && dispatch.photos.length > 0 && (
                    <div className="photo-gallery">
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                        <Icon name="camera" size={14} className="text-[#ff8c00]" />
                        Sender Outgoing Evidence ({dispatch.photos.length} photos)
                      </p>
                      <div className="flex gap-2.5 overflow-x-auto pb-1">
                        {dispatch.photos.map((photo, i) => (
                          <div
                            key={photo.id || i}
                            onClick={() => setActiveLightboxImage(photo.url)}
                            className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-white/10 bg-black cursor-pointer group"
                          >
                            <img
                              src={photo.url}
                              alt={photo.name || `Photo ${i + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Receiver Photos (if delivered or discrepancy) */}
                  {(isDelivered || isDiscrepancy) && dispatch.receivingPhotos && dispatch.receivingPhotos.length > 0 && (
                    <div className="photo-gallery pt-2 border-t border-white/5">
                      <p className={`text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-1.5 ${isDiscrepancy ? 'text-red-400' : 'text-emerald-400'}`}>
                        <Icon name="camera" size={14} />
                        Receiver Delivery Evidence & Label Snaps ({dispatch.receivingPhotos.length} photos)
                      </p>
                      <div className="flex gap-2.5 overflow-x-auto pb-1">
                        {dispatch.receivingPhotos.map((photo, i) => (
                          <div
                            key={photo.id || i}
                            onClick={() => setActiveLightboxImage(photo.url)}
                            className={`relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border bg-black cursor-pointer group ${
                              isDiscrepancy ? 'border-red-500/30' : 'border-emerald-500/30'
                            }`}
                          >
                            <img
                              src={photo.url}
                              alt={photo.name || `Receiving photo ${i + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Receiving Sign-Off Info (if delivered) */}
                  {isDelivered && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <span className="font-bold">Received by:</span> {dispatch.receivedBy || 'Destination Officer'}
                        {dispatch.receivedAt && (
                          <span className="text-gray-400 ml-2 font-mono text-[11px]">
                            ({new Date(dispatch.receivedAt).toLocaleString()})
                          </span>
                        )}
                      </div>
                      {dispatch.receivingNotes && (
                        <p className="italic text-gray-300 text-[11px]">"{dispatch.receivingNotes}"</p>
                      )}
                    </div>
                  )}

                  {/* Card Actions (Print Delivery Note & Receiver Confirmation) */}
                  <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-end gap-2.5 no-print">
                    <button
                      type="button"
                      onClick={() => setPrintingDispatch(dispatch)}
                      disabled={!canPrintWaybill}
                      className="w-full sm:w-auto px-4 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border border-white/10 active:scale-95 transition-all shadow-sm"
                      title={canPrintWaybill ? "Print Official Delivery Note / Waybill" : "Permission Required: Waybills & Delivery Notes (Print)"}
                    >
                      <Icon name={canPrintWaybill ? "printer" : "lock"} size={15} className="text-[#ff8c00]" />
                      <span>Print Delivery Note</span>
                    </button>

                    {(isInTransit || isDiscrepancy) && (
                      <button
                        type="button"
                        disabled={!canInspectReceiving}
                        onClick={() => {
                          if (!canInspectReceiving) return;
                          setInspectingDispatch(dispatch);
                          setStagedIncomingFiles([]);
                          setIncomingPreviews([]);
                          setReceivingNotes(dispatch.receivingNotes || '');
                          if (dispatch.verifiedPieces && dispatch.verifiedPieces.length > 0) {
                            setCheckedPieces(dispatch.verifiedPieces);
                          } else {
                            setCheckedPieces([]);
                          }
                        }}
                        className={`w-full sm:w-auto px-6 py-2.5 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          isDiscrepancy
                            ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                            : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                        }`}
                        title={canInspectReceiving ? undefined : 'Permission Required: Receiving Inspection (Check / Approve)'}
                      >
                        <Icon name={canInspectReceiving ? "check-square" : "lock"} size={15} />
                        <span>{isDiscrepancy ? 'Re-inspect & Resolve' : 'Inspect & Receive Shipment'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredDispatches.length === 0 && (
              <div className="text-center py-16 bg-[#151518]/60 border border-white/5 rounded-3xl space-y-3">
                <div className="p-4 rounded-full bg-white/5 text-gray-500 inline-block">
                  <Icon name="truck" size={32} />
                </div>
                <p className="text-sm font-bold text-gray-400">
                  No dispatches found matching your filter.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="px-5 py-2.5 bg-[#ff8c00] text-white rounded-xl text-xs font-black uppercase tracking-wider"
                >
                  Create New Dispatch
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PIECE-BY-PIECE VERIFICATION & HANDSHAKE (Receiver Side) */}
      {/* ========================================================================= */}
      {inspectingDispatch && (() => {
        const totalCount = inspectingDispatch.totalPieces || (inspectingDispatch.photos?.length ? inspectingDispatch.photos.length : 1);
        const piecesArray = Array.from({ length: totalCount }, (_, i) => i + 1);
        const allPiecesChecked = piecesArray.length > 0 && piecesArray.every(p => checkedPieces.includes(p));
        const hasLabelPhoto = stagedIncomingFiles.length > 0;
        const canApproveFully = allPiecesChecked && hasLabelPhoto;

        const togglePiece = (pieceNum: number) => {
          setCheckedPieces(prev =>
            prev.includes(pieceNum)
              ? prev.filter(p => p !== pieceNum)
              : [...prev, pieceNum]
          );
        };

        const selectAllPieces = () => {
          setCheckedPieces(piecesArray);
        };

        const clearAllPieces = () => {
          setCheckedPieces([]);
        };

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className="bg-[#18181c] border border-white/15 rounded-[2.5rem] w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] font-mono text-[#ff8c00] font-black uppercase tracking-widest">
                    Destination Two-Stage Verification Handshake
                  </span>
                  <h2 className="text-xl font-black uppercase tracking-tight text-white mt-0.5">
                    Receiving Inspection: {inspectingDispatch.dispatchNumber}
                  </h2>
                  <p className="text-xs text-gray-400">
                    {inspectingDispatch.project} ({inspectingDispatch.originBranch} ➔ {inspectingDispatch.destinationBranch})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingDispatch(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  <Icon name="x" size={20} />
                </button>
              </div>

              {/* Sender Reference Outgoing Photos */}
              {inspectingDispatch.photos && inspectingDispatch.photos.length > 0 && (
                <div className="bg-black/40 border border-white/10 rounded-2xl p-3.5 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Icon name="camera" size={14} className="text-[#ff8c00]" />
                    Sender Outgoing Photos for Reference ({inspectingDispatch.photos.length}):
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {inspectingDispatch.photos.map((p, idx) => (
                      <img
                        key={idx}
                        src={p.url}
                        alt={`Sender item ${idx + 1}`}
                        onClick={() => setActiveLightboxImage(p.url)}
                        className="w-16 h-16 rounded-xl object-cover cursor-pointer hover:opacity-80 border border-white/10 flex-shrink-0"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 1. PIECE-BY-PIECE VERIFICATION CHECKLIST */}
              <div className="space-y-3 bg-black/40 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                      <Icon name="package" size={16} className="text-[#ff8c00]" />
                      Piece-by-Piece Verification ({checkedPieces.length} of {totalCount} Verified)
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Verify and check off each individual physical crate or package received.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllPieces}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-bold text-white transition-colors"
                    >
                      Check All
                    </button>
                    <button
                      type="button"
                      onClick={clearAllPieces}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-gray-400 hover:text-white transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      allPiecesChecked ? 'bg-emerald-500' : 'bg-[#ff8c00]'
                    }`}
                    style={{ width: `${(checkedPieces.length / totalCount) * 100}%` }}
                  />
                </div>

                {/* Piece Checkboxes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {piecesArray.map((pieceNum) => {
                    const isChecked = checkedPieces.includes(pieceNum);
                    return (
                      <div
                        key={pieceNum}
                        onClick={() => togglePiece(pieceNum)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-all ${
                          isChecked
                            ? 'bg-emerald-950/20 border-emerald-500/40 text-white'
                            : 'bg-black/60 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-colors ${
                              isChecked
                                ? 'bg-emerald-500 border-emerald-400 text-black'
                                : 'border-white/20 bg-black/40'
                            }`}
                          >
                            {isChecked && <Icon name="check" size={14} className="stroke-[3]" />}
                          </div>
                          <div>
                            <span className="text-xs font-bold">
                              Piece {pieceNum} of {totalCount}
                            </span>
                            {inspectingDispatch.photos?.[pieceNum - 1]?.name && (
                              <p className="text-[10px] text-gray-400 truncate max-w-[150px]">
                                {inspectingDispatch.photos[pieceNum - 1].name}
                              </p>
                            )}
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            isChecked
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-white/5 text-gray-500'
                          }`}
                        >
                          {isChecked ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. MANDATORY LABEL PHOTO CAPTURE */}
              <div className="photo-upload-section border border-white/10 bg-black/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                      <Icon name="camera" size={16} className="text-[#ff8c00]" />
                      Mandatory Label & Package Evidence *
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Snap photo evidence of the waybill stickers pasted on the packages.
                    </p>
                  </div>

                  <input
                    ref={incomingCameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handleIncomingFileChange}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => incomingCameraRef.current?.click()}
                    className="px-4 py-2.5 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-md shadow-[#ff8c00]/20 active:scale-95"
                  >
                    <Icon name="camera" size={14} />
                    <span>Snap Label Photo</span>
                  </button>
                </div>

                {/* Validation Indicator */}
                <div className="text-[11px] font-bold">
                  {hasLabelPhoto ? (
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <Icon name="check-circle" size={14} />
                      Label photo captured ({stagedIncomingFiles.length} photo{stagedIncomingFiles.length > 1 ? 's' : ''})
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1.5">
                      <Icon name="alert-circle" size={14} />
                      Required: Please snap at least 1 photo of the package sticker/waybill before approving.
                    </span>
                  )}
                </div>

                {incomingPreviews.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2">
                    {incomingPreviews.map((src, i) => (
                      <div
                        key={i}
                        className="relative rounded-xl overflow-hidden border border-white/10 aspect-square bg-black group"
                      >
                        <img
                          src={src}
                          alt={`Receiving label ${i + 1}`}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setActiveLightboxImage(src)}
                        />
                        <button
                          type="button"
                          onClick={() => removeIncomingPhoto(i)}
                          className="absolute top-1.5 right-1.5 p-1 bg-red-500/90 rounded-lg text-white"
                          title="Remove Photo"
                        >
                          <Icon name="x" size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. RECEIVER NAME & CONDITION NOTES */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                    Receiver Name / Officer ID *
                  </label>
                  <input
                    type="text"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    required
                    className="w-full bg-[#101012] border border-white/10 focus:border-[#ff8c00] rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none transition-colors"
                    placeholder="e.g. Johan Van Der Merwe (Cape Town Receiving Depot)"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                    Receiver Notes / Damage Report / Discrepancy Comments
                  </label>
                  <textarea
                    value={receivingNotes}
                    onChange={(e) => setReceivingNotes(e.target.value)}
                    rows={2}
                    className="w-full bg-[#101012] border border-white/10 focus:border-[#ff8c00] rounded-xl p-3 text-sm text-white focus:outline-none transition-colors resize-none"
                    placeholder={
                      allPiecesChecked
                        ? 'e.g. All crates inspected in 100% mint condition.'
                        : 'e.g. Piece 2 not found on truck; corner damage noted on Piece 1 packaging.'
                    }
                  />
                </div>
              </div>

              {/* 4. STRICT EXCEPTION HANDLING ACTIONS */}
              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setInspectingDispatch(null)}
                    className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-black uppercase tracking-wider transition-colors order-last sm:order-first"
                  >
                    Cancel
                  </button>

                  {/* Red Action: Flag Discrepancy / Partial Receipt */}
                  <button
                    type="button"
                    onClick={handleFlagDiscrepancy}
                    disabled={isInspectingSubmitting || !canFlagDiscrepancy}
                    className="px-6 py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 active:scale-95 transition-all"
                    title={canFlagDiscrepancy ? undefined : 'Permission Required: Discrepancy Management (Create / Edit / Approve)'}
                  >
                    {isInspectingSubmitting ? (
                      <>
                        <Icon name="refresh-cw" size={16} className="animate-spin" />
                        <span>{inspectProgressText || 'Logging...'}</span>
                      </>
                    ) : (
                      <>
                        <Icon name={canFlagDiscrepancy ? "alert-triangle" : "lock"} size={16} />
                        <span>Flag Discrepancy / Partial Receipt</span>
                      </>
                    )}
                  </button>

                  {/* Green Action: Approve & Complete Receipt */}
                  <button
                    type="button"
                    onClick={() => handleConfirmInspection()}
                    disabled={!canApproveFully || isInspectingSubmitting || !canInspectReceiving}
                    className="px-7 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 active:scale-95 transition-all"
                    title={canInspectReceiving ? undefined : 'Permission Required: Receiving Inspection (Approve)'}
                  >
                    {isInspectingSubmitting ? (
                      <>
                        <Icon name="refresh-cw" size={16} className="animate-spin" />
                        <span>{inspectProgressText || 'Approving...'}</span>
                      </>
                    ) : (
                      <>
                        <Icon name={canInspectReceiving ? "check" : "lock"} size={16} />
                        <span>Approve & Complete Receipt</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Helper notice */}
                <p className="text-[11px] text-gray-400 text-center sm:text-right">
                  {!allPiecesChecked
                    ? `⚠️ Cannot Approve Full Receipt: ${totalCount - checkedPieces.length} piece(s) unverified. Use "Flag Discrepancy" to record partial delivery.`
                    : !hasLabelPhoto
                    ? '⚠️ Please take at least 1 photo of the package label to enable "Approve & Complete Receipt".'
                    : '✓ All pieces verified & label photo captured. Ready to approve full receipt.'}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* FULL SCREEN PHOTO LIGHTBOX */}
      {/* ========================================================================= */}
      {activeLightboxImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md no-print"
          onClick={() => setActiveLightboxImage(null)}
        >
          <button
            type="button"
            onClick={() => setActiveLightboxImage(null)}
            className="absolute top-6 right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <Icon name="x" size={24} />
          </button>
          <img
            src={activeLightboxImage}
            alt="Enlarged photo evidence"
            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINTABLE DELIVERY NOTE / WAYBILL (SCREEN PREVIEW MODAL & PRINT VIEW) */}
      {/* ========================================================================= */}
      {printingDispatch && (
        <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-3 sm:p-6 overflow-y-auto backdrop-blur-md no-print-bg">
          {/* Interactive Screen Preview Container */}
          <div className="bg-white text-gray-900 rounded-3xl max-w-3xl w-full p-6 sm:p-10 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto font-sans relative">
            
            {/* Modal Screen-Only Action Bar */}
            <div className="flex items-center justify-between border-b pb-4 no-print">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-500">
                <Icon name="printer" size={16} className="text-[#ff8c00]" />
                <span>Delivery Note & Waybill Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-[#ff8c00]/30 flex items-center gap-2 transition-all active:scale-95"
                >
                  <Icon name="printer" size={16} />
                  <span>Print Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintingDispatch(null)}
                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                  title="Close Preview"
                >
                  <Icon name="x" size={18} />
                </button>
              </div>
            </div>

            {/* Document Content */}
            <div id="printable-delivery-note" className="space-y-6 bg-white text-black p-2 sm:p-4">
              
              {/* Document Header Branding */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-black pb-4 gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-black uppercase">
                    TIMBERSMITH JOINERY
                  </h1>
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-widest mt-0.5">
                    Architectural Joinery & Custom Manufacturing
                  </p>
                  <p className="text-[11px] text-gray-600 mt-1">
                    Tel: +27 (0)21 850 0123 | Email: logistics@tsjoinery.co.za
                  </p>
                </div>

                <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto">
                  <span className="inline-block px-3 py-1 bg-black text-white text-xs font-mono font-black uppercase tracking-widest rounded">
                    DELIVERY NOTE & WAYBILL
                  </span>
                  <div className="mt-2 space-y-0.5 text-xs font-mono">
                    <p className="font-black text-base text-black">
                      #{printingDispatch.dispatchNumber}
                    </p>
                    <p className="text-gray-600">
                      Date: {new Date(printingDispatch.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-gray-600">
                      Time: {new Date(printingDispatch.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Routing & Shipment Route Summary */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 border border-gray-300 p-4 rounded-xl">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 block">
                    Origin Dispatch Depot:
                  </span>
                  <p className="text-sm font-black text-black uppercase">
                    {printingDispatch.originBranch}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 block">
                    Destination Branch / Site:
                  </span>
                  <p className="text-sm font-black text-black uppercase">
                    {printingDispatch.destinationBranch}
                  </p>
                </div>
              </div>

              {/* Shipment & Project Details Grid */}
              <div className="border border-gray-300 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <tbody>
                    <tr className="border-b border-gray-300 bg-gray-100">
                      <th className="py-2 px-3 font-black text-gray-700 w-1/3 uppercase text-[10px]">Project / Job</th>
                      <td className="py-2 px-3 font-bold text-black">{printingDispatch.project}</td>
                    </tr>
                    {printingDispatch.customer && (
                      <tr className="border-b border-gray-300">
                        <th className="py-2 px-3 font-black text-gray-700 uppercase text-[10px]">Customer / Client</th>
                        <td className="py-2 px-3 text-black font-semibold">{printingDispatch.customer}</td>
                      </tr>
                    )}
                    <tr className="border-b border-gray-300">
                      <th className="py-2 px-3 font-black text-gray-700 uppercase text-[10px]">Total Quantity / Pieces</th>
                      <td className="py-2 px-3 font-bold text-black">
                        {printingDispatch.totalPieces || (printingDispatch.photos?.length ? printingDispatch.photos.length : 1)} Piece(s) / Package(s)
                      </td>
                    </tr>
                    <tr className="border-b border-gray-300">
                      <th className="py-2 px-3 font-black text-gray-700 uppercase text-[10px]">Transport Carrier</th>
                      <td className="py-2 px-3 text-black font-semibold">{printingDispatch.courier || 'Internal Driver / Bakkie'}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                      <th className="py-2 px-3 font-black text-gray-700 uppercase text-[10px]">Waybill / Tracking #</th>
                      <td className="py-2 px-3 font-mono font-bold text-black">{printingDispatch.trackingNumber || 'N/A'}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                      <th className="py-2 px-3 font-black text-gray-700 uppercase text-[10px]">Dispatch Officer</th>
                      <td className="py-2 px-3 text-black font-semibold">{printingDispatch.createdBy || 'Factory Dispatch'}</td>
                    </tr>
                    <tr>
                      <th className="py-2 px-3 font-black text-gray-700 uppercase text-[10px]">Current Status</th>
                      <td className="py-2 px-3 font-bold text-black uppercase">{printingDispatch.status}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Handling Notes / Packaging Instructions */}
              <div className="border border-gray-300 p-4 rounded-xl space-y-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-600">
                  Handling Instructions & Cargo Notes:
                </p>
                <p className="text-xs text-gray-800 leading-relaxed font-medium">
                  {printingDispatch.notes || 'Handle with care. Keep dry, strapped, and fully protected against transit vibration.'}
                </p>
              </div>

              {/* Sign-off Blocks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Dispatched By */}
                <div className="border border-black p-4 rounded-xl space-y-3">
                  <p className="text-[11px] font-black uppercase tracking-wider text-black border-b border-gray-300 pb-1">
                    1. Dispatched By (Origin Depot)
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Name:</span>
                      <span className="font-mono font-bold text-black">{printingDispatch.createdBy || '__________________'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date:</span>
                      <span className="font-mono text-black">{new Date(printingDispatch.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="pt-4 border-t border-dashed border-gray-300">
                      <span className="text-[10px] text-gray-500 uppercase block mb-1">Signature:</span>
                      <div className="h-8 border-b border-black" />
                    </div>
                  </div>
                </div>

                {/* Received By */}
                <div className="border border-black p-4 rounded-xl space-y-3">
                  <p className="text-[11px] font-black uppercase tracking-wider text-black border-b border-gray-300 pb-1">
                    2. Received By (Destination)
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Name:</span>
                      <span className="font-mono font-bold text-black">{printingDispatch.receivedBy || '__________________'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date & Time:</span>
                      <span className="font-mono text-black">
                        {printingDispatch.receivedAt ? new Date(printingDispatch.receivedAt).toLocaleString() : '__________________'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-gray-700 py-1">
                      <span>[ {printingDispatch.status === 'Delivered / Received' ? '✓' : ' '} ] In Good Order</span>
                      <span>[ ] Discrepancy Noted</span>
                    </div>
                    <div className="pt-2 border-t border-dashed border-gray-300">
                      <span className="text-[10px] text-gray-500 uppercase block mb-1">Signature:</span>
                      <div className="h-8 border-b border-black" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Document Disclaimer Footer */}
              <div className="border-t border-gray-300 pt-3 text-[10px] text-gray-500 text-center leading-relaxed">
                <p>
                  Official Timbersmith Joinery Logistics & Waybill Document. Excludes digital photo evidence.
                  All items must be physically verified upon arrival prior to carrier release.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Global & Print CSS Overrides */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-delivery-note,
          #printable-delivery-note * {
            visibility: visible !important;
          }
          #printable-delivery-note {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            border: none !important;
          }
          .photo-gallery,
          .photo-upload-section,
          .no-print,
          .no-print-bg {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>
    </div>
  );
};
