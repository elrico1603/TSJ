import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import {
  MobileDispatchDoc,
  DispatchPhotoItem,
  generateDispatchNumber,
  uploadDispatchPhoto,
  createMobileDispatch,
  confirmReceiptAndInspect,
  subscribeMobileDispatches
} from '../services/mobileDispatchService';

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
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'IN_TRANSIT' | 'DELIVERED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State for "Create Dispatch"
  const [dispatchNumber, setDispatchNumber] = useState(generateDispatchNumber());
  const [originBranch, setOriginBranch] = useState('Main Factory');
  const [destinationBranch, setDestinationBranch] = useState('Cape Town');
  const [project, setProject] = useState('');
  const [customer, setCustomer] = useState('');
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
  const [checklist, setChecklist] = useState({
    packagingIntact: true,
    parcelCountMatches: true,
    qualityChecked: true
  });
  const [isInspectingSubmitting, setIsInspectingSubmitting] = useState(false);
  const [inspectProgressText, setInspectProgressText] = useState('');

  // Photo Full-Screen Lightbox Modal
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);

  // File Input Refs
  const outgoingCameraRef = useRef<HTMLInputElement>(null);
  const incomingCameraRef = useRef<HTMLInputElement>(null);

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

  // Handle Outgoing Camera/File Selection
  const handleOutgoingFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newFiles = Array.from(e.target.files);
    setStagedOutgoingFiles((prev) => [...prev, ...newFiles]);

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
    setStagedOutgoingFiles((prev) => prev.filter((_, i) => i !== index));
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

      const newDispatch = await createMobileDispatch({
        dispatchNumber,
        project,
        customer: customer || project,
        originBranch,
        destinationBranch,
        courier,
        trackingNumber,
        notes,
        photos: uploadedPhotos,
        createdBy: creator
      });

      if (announce) {
        announce(`Dispatch ${newDispatch.dispatchNumber} sent (In Transit)`);
      }

      // Reset form
      setDispatchNumber(generateDispatchNumber());
      setProject('');
      setCustomer('');
      setNotes('');
      setTrackingNumber('');
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

  // Submit Receiving / Inspection Confirmation
  const handleConfirmInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingDispatch) return;

    setIsInspectingSubmitting(true);
    setInspectProgressText('Processing inspection verification...');

    try {
      const uploadedIncomingPhotos: DispatchPhotoItem[] = [];

      if (stagedIncomingFiles.length > 0) {
        for (let i = 0; i < stagedIncomingFiles.length; i++) {
          const file = stagedIncomingFiles[i];
          setInspectProgressText(`Uploading receiving photo ${i + 1} of ${stagedIncomingFiles.length}...`);
          const photoItem = await uploadDispatchPhoto(file, inspectingDispatch.id, 'incoming');
          uploadedIncomingPhotos.push(photoItem);
        }
      }

      setInspectProgressText('Finalizing delivery confirmation in Firestore...');
      await confirmReceiptAndInspect(inspectingDispatch.id, {
        receiverName: receiverName || 'Cape Town Receiving Officer',
        receivingNotes: receivingNotes || 'Delivered and inspected in good order.',
        receivingPhotos: uploadedIncomingPhotos,
        checklist
      });

      if (announce) {
        announce(`Dispatch ${inspectingDispatch.dispatchNumber} marked Delivered / Received`);
      }

      // Reset modal state
      setInspectingDispatch(null);
      setReceivingNotes('');
      setStagedIncomingFiles([]);
      setIncomingPreviews([]);
    } catch (err: any) {
      console.error('Failed to confirm receipt:', err);
      alert(`Error confirming receipt: ${err.message || 'Check network connection'}`);
    } finally {
      setIsInspectingSubmitting(false);
      setInspectProgressText('');
    }
  };

  // Filtered Dispatches List
  const inTransitCount = dispatches.filter(d => d.status === 'In Transit' || d.status === 'Dispatched').length;

  const filteredDispatches = dispatches.filter((d) => {
    // Status filter
    if (filterStatus === 'IN_TRANSIT') {
      if (d.status !== 'In Transit' && d.status !== 'Dispatched') return false;
    } else if (filterStatus === 'DELIVERED') {
      if (d.status !== 'Delivered / Received' && d.status !== 'Received') return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = d.dispatchNumber.toLowerCase().includes(q);
      const matchProject = d.project.toLowerCase().includes(q);
      const matchDest = d.destinationBranch.toLowerCase().includes(q);
      const matchOrigin = d.originBranch.toLowerCase().includes(q);
      const matchCourier = (d.courier || '').toLowerCase().includes(q);
      if (!matchNumber && !matchProject && !matchDest && !matchOrigin && !matchCourier) {
        return false;
      }
    }

    return true;
  });

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
            onClick={() => setActiveTab('create')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-200 ${
              activeTab === 'create'
                ? 'bg-[#ff8c00] text-white shadow-lg shadow-[#ff8c00]/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon name="plus" size={18} />
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
          <div className="border border-white/10 bg-black/40 rounded-2xl p-5 space-y-4">
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
                  <span>Dispatch Shipment (Set In Transit)</span>
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
                onClick={() => setFilterStatus('DELIVERED')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors whitespace-nowrap ${
                  filterStatus === 'DELIVERED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                Delivered / Received ({dispatches.filter(d => d.status === 'Delivered / Received' || d.status === 'Received').length})
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
              const isDelivered = dispatch.status === 'Delivered / Received' || dispatch.status === 'Received';

              return (
                <div
                  key={dispatch.id}
                  className="bg-[#151518]/90 border border-white/10 hover:border-white/20 rounded-[2rem] p-5 sm:p-6 backdrop-blur-2xl shadow-xl transition-all space-y-4"
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
                      ) : isDelivered ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider">
                          <Icon name="check-circle" size={14} />
                          Delivered / Received
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-500/10 border border-gray-500/30 text-gray-300 text-xs font-bold uppercase">
                          {dispatch.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Project Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                        Project / Job
                      </p>
                      <p className="text-sm font-black text-white">{dispatch.project}</p>
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
                        Handling Notes:
                      </span>
                      {dispatch.notes}
                    </div>
                  )}

                  {/* Outgoing Photos Carousel */}
                  {dispatch.photos && dispatch.photos.length > 0 && (
                    <div>
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

                  {/* Receiver Photos (if delivered) */}
                  {isDelivered && dispatch.receivingPhotos && dispatch.receivingPhotos.length > 0 && (
                    <div className="pt-2 border-t border-white/5">
                      <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                        <Icon name="check-square" size={14} />
                        Receiver Delivery Evidence ({dispatch.receivingPhotos.length} photos)
                      </p>
                      <div className="flex gap-2.5 overflow-x-auto pb-1">
                        {dispatch.receivingPhotos.map((photo, i) => (
                          <div
                            key={photo.id || i}
                            onClick={() => setActiveLightboxImage(photo.url)}
                            className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-emerald-500/30 bg-black cursor-pointer group"
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

                  {/* Card Actions (Receiver Confirmation) */}
                  {isInTransit && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setInspectingDispatch(dispatch);
                          setStagedIncomingFiles([]);
                          setIncomingPreviews([]);
                          setReceivingNotes('');
                        }}
                        className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <Icon name="check-square" size={16} />
                        <span>Confirm Receipt & Inspect</span>
                      </button>
                    </div>
                  )}
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
      {/* MODAL: CONFIRM RECEIPT & INSPECT (Receiver Cape Town/Destination) */}
      {/* ========================================================================= */}
      {inspectingDispatch && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-[#18181c] border border-white/15 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-mono text-[#ff8c00] font-black uppercase tracking-widest">
                  Destination Receiving Inspection
                </span>
                <h2 className="text-xl font-black uppercase tracking-tight text-white mt-0.5">
                  Confirm Receipt: {inspectingDispatch.dispatchNumber}
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

            <form onSubmit={handleConfirmInspection} className="space-y-5">
              {/* Reference: Outgoing Photos */}
              {inspectingDispatch.photos && inspectingDispatch.photos.length > 0 && (
                <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Sender Outgoing Photos for Reference:
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {inspectingDispatch.photos.map((p, idx) => (
                      <img
                        key={idx}
                        src={p.url}
                        alt="Sender item"
                        onClick={() => setActiveLightboxImage(p.url)}
                        className="w-16 h-16 rounded-lg object-cover cursor-pointer hover:opacity-80 border border-white/10"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Inspection Checklist */}
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                  Quality & Condition Checklist
                </p>
                <div className="space-y-2 bg-black/40 border border-white/10 rounded-xl p-3.5">
                  <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-white">
                    <input
                      type="checkbox"
                      checked={checklist.packagingIntact}
                      onChange={(e) => setChecklist({ ...checklist, packagingIntact: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-0 bg-black/60 border-white/20"
                    />
                    <span>Packaging Intact & Free of Transit Damage</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-white">
                    <input
                      type="checkbox"
                      checked={checklist.parcelCountMatches}
                      onChange={(e) => setChecklist({ ...checklist, parcelCountMatches: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-0 bg-black/60 border-white/20"
                    />
                    <span>Parcel & Crate Count Verified Correct</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-white">
                    <input
                      type="checkbox"
                      checked={checklist.qualityChecked}
                      onChange={(e) => setChecklist({ ...checklist, qualityChecked: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-0 bg-black/60 border-white/20"
                    />
                    <span>Goods Inspected & Accepted at Destination</span>
                  </label>
                </div>
              </div>

              {/* Receiver Name */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                  Receiver Name / ID *
                </label>
                <input
                  type="text"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  required
                  className="w-full bg-[#101012] border border-white/10 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none transition-colors"
                  placeholder="e.g. Johan Van Der Merwe (Cape Town Depot)"
                />
              </div>

              {/* Receiver Condition Notes */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                  Receiving & Condition Notes
                </label>
                <textarea
                  value={receivingNotes}
                  onChange={(e) => setReceivingNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-[#101012] border border-white/10 focus:border-emerald-500 rounded-xl p-3 text-sm text-white focus:outline-none transition-colors resize-none"
                  placeholder="e.g. All 4 crates received in 100% good order at Cape Town branch."
                />
              </div>

              {/* Native Camera Photo Capture for Receiving */}
              <div className="border border-white/10 bg-black/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                      <Icon name="camera" size={16} className="text-emerald-400" />
                      Receiving Photo Evidence
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Take photos of delivered items at destination.
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
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5"
                  >
                    <Icon name="camera" size={14} />
                    <span>Snap Photo</span>
                  </button>
                </div>

                {incomingPreviews.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2">
                    {incomingPreviews.map((src, i) => (
                      <div
                        key={i}
                        className="relative rounded-lg overflow-hidden border border-white/10 aspect-square bg-black"
                      >
                        <img src={src} alt={`Receiving photo ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeIncomingPhoto(i)}
                          className="absolute top-1 right-1 p-1 bg-red-500/80 rounded text-white"
                        >
                          <Icon name="x" size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setInspectingDispatch(null)}
                  className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-black uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isInspectingSubmitting}
                  className="px-7 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition-all"
                >
                  {isInspectingSubmitting ? (
                    <>
                      <Icon name="refresh-cw" size={16} className="animate-spin" />
                      <span>{inspectProgressText || 'Saving...'}</span>
                    </>
                  ) : (
                    <>
                      <Icon name="check" size={16} />
                      <span>Confirm Delivery & Sign-off</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FULL SCREEN PHOTO LIGHTBOX */}
      {/* ========================================================================= */}
      {activeLightboxImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md"
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
    </div>
  );
};
