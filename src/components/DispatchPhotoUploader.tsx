import React, { useState, useRef } from 'react';
import { Icon } from './Icon';
import { DispatchPackage } from '../types/dispatchPackage';
import { EvidencePhoto, EvidenceType } from '../types/storage';
import { generateEvidenceStoragePath, generateStorageObjectName } from '../types/storagePath';

interface DispatchPhotoUploaderProps {
  dispatchNumber: string;
  customer: string;
  project: string;
  selectedPackage: DispatchPackage;
  onAddPhotoToPackage: (packageId: string, photo: EvidencePhoto, previewUrl?: string) => void;
  onRemovePhotoFromPackage: (packageId: string, photoId: string) => void;
  currentUser?: any;
  previewUrls?: Record<string, string>; // In-memory ephemeral preview URLs for browser session
  readOnly?: boolean;
}

const EVIDENCE_TYPE_OPTIONS: Array<{ value: EvidenceType; label: string; description: string }> = [
  { value: 'package_condition', label: 'Package Condition (Sealed/Packed)', description: 'External view of wrapped/boxed transport package' },
  { value: 'unpacked_items', label: 'Package Contents / Items', description: 'Internal joinery components before final seal' },
  { value: 'sticker_label', label: 'Package Sticker / Label', description: 'Affixed label with package code and sticker identifier' },
  { value: 'delivery_note', label: 'Delivery Note / Waybill', description: 'Accompanying paperwork or delivery manifest' },
  { value: 'damage_report', label: 'Pre-existing Mark / Defect Note', description: 'Any factory noted blemishes prior to shipment' },
  { value: 'general_evidence', label: 'General Dispatch Photo', description: 'General evidence photo of joinery package' },
];

export const DispatchPhotoUploader: React.FC<DispatchPhotoUploaderProps> = ({
  dispatchNumber,
  customer,
  project,
  selectedPackage,
  onAddPhotoToPackage,
  onRemovePhotoFromPackage,
  currentUser,
  previewUrls = {},
  readOnly = false
}) => {
  const [selectedType, setSelectedType] = useState<EvidenceType>('package_condition');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentPhotos = selectedPackage.dispatchPhotos || [];

  const handleFiles = async (fileList: FileList | File[]) => {
    if (readOnly || !fileList || fileList.length === 0) return;
    setIsProcessing(true);

    const userName = currentUser?.name || currentUser?.displayName || currentUser?.email || 'Factory Dispatch Officer';

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file) continue;

      try {
        const photoId = `ev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const storagePath = generateEvidenceStoragePath({
          customer: customer || 'General',
          project: project || 'General',
          item: selectedPackage.description || selectedPackage.productName || 'Joinery',
          dispatchNumber: dispatchNumber || 'DSP-NEW',
          stage: 'dispatch',
          packageNumber: selectedPackage.packageNumber,
          totalPackages: selectedPackage.totalPackages
        });
        const storageObjectName = generateStorageObjectName(selectedType, file.name);

        // Ephemeral in-memory object URL for temporary visual feedback in the current browser tab
        // Note: this preview URL is NOT stored in Firestore or cloud storage
        let localPreviewUrl: string | undefined = undefined;
        try {
          localPreviewUrl = URL.createObjectURL(file);
        } catch {
          // Ignore if object URL cannot be constructed
        }

        const evidencePhoto: EvidencePhoto = {
          id: photoId,
          dispatchNumber: dispatchNumber || 'DSP-NEW',
          packageId: selectedPackage.id,
          packageNumber: selectedPackage.packageNumber,
          totalPackages: selectedPackage.totalPackages,
          evidenceStage: 'dispatch',
          evidenceType: selectedType,
          originalFileName: file.name,
          storagePath,
          storageObjectName,
          mimeType: file.type || 'image/jpeg',
          size: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedBy: userName
        };

        onAddPhotoToPackage(selectedPackage.id, evidencePhoto, localPreviewUrl);
      } catch (err) {
        console.error('Error preparing evidence photo:', err);
      }
    }

    setIsProcessing(false);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Target Package Banner */}
      <div className="p-4 bg-black/40 border border-white/10 rounded-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 font-mono font-bold flex items-center justify-center text-sm border border-cyan-500/30">
            {selectedPackage.packageNumber}/{selectedPackage.totalPackages}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white">
                {selectedPackage.packageCode}
              </span>
              {selectedPackage.stickerCode && (
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 px-2 py-0.5 rounded">
                  {selectedPackage.stickerCode}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-300 mt-0.5">
              {selectedPackage.description || `Package ${selectedPackage.packageNumber} of ${selectedPackage.totalPackages}`}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-gray-300">
            Photos Attached: <strong className="text-cyan-400">{currentPhotos.length}</strong>
          </span>
        </div>
      </div>

      {!readOnly && (
        <div className="space-y-3 bg-black/30 border border-white/10 p-4 rounded-2xl">
          {/* Evidence Category Selector */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
              Photo Evidence Category
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as EvidenceType)}
              className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#ff8c00] transition-colors"
            >
              {EVIDENCE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-500 mt-1">
              {EVIDENCE_TYPE_OPTIONS.find((o) => o.value === selectedType)?.description}
            </p>
          </div>

          {/* Hidden inputs for Mobile Camera Capture & File Selection */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />

          {/* Mobile Camera and File Selection Action Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all ${
              dragActive
                ? 'border-[#ff8c00] bg-[#ff8c00]/5'
                : 'border-white/10 hover:border-white/20 bg-black/20'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {/* Primary Take Photo Button (Mobile Camera) */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => cameraInputRef.current?.click()}
                className="w-full sm:w-auto px-5 py-3 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition-all"
              >
                <Icon name="camera" size={18} />
                <span>Take Photo (Camera)</span>
              </button>

              {/* Browse / File Picker Button */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto px-5 py-3 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all"
              >
                <Icon name="upload" size={18} />
                <span>Choose Files</span>
              </button>
            </div>

            <p className="text-[11px] text-gray-400 mt-3">
              Drag & drop photos or capture directly from your phone camera
            </p>
          </div>

          {/* Honest Status Note regarding Cloud Storage */}
          <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-[10px] text-gray-400 flex items-start space-x-2">
            <Icon name="info" size={14} className="text-cyan-400 shrink-0 mt-0.5" />
            <span>
              <strong>Storage Status:</strong> Photo metadata will be recorded with deterministic storage paths. Cloud upload to Google Cloud Storage is pending server configuration. No Base64 binary is saved to the database.
            </span>
          </div>
        </div>
      )}

      {/* Package Photos List */}
      <div className="space-y-3">
        <h4 className="text-xs font-black uppercase tracking-wider text-gray-300">
          Attached Photos for {selectedPackage.packageCode} ({currentPhotos.length})
        </h4>

        {currentPhotos.length === 0 ? (
          <div className="p-6 text-center bg-black/20 border border-white/5 rounded-2xl text-xs text-gray-500">
            No photos attached to this package yet. Take a photograph using the camera button above.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {currentPhotos.map((photo) => {
              const preview = previewUrls[photo.id];

              return (
                <div
                  key={photo.id}
                  className="bg-black/60 border border-white/10 p-3 rounded-2xl space-y-2 relative group flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    {preview ? (
                      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black relative border border-white/10">
                        <img
                          src={preview}
                          alt={photo.originalFileName}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 rounded text-[9px] font-mono text-cyan-300">
                          LOCAL PREVIEW
                        </span>
                      </div>
                    ) : (
                      <div className="aspect-video w-full rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex flex-col items-center justify-center text-cyan-400 p-2">
                        <Icon name="image" size={24} />
                        <span className="text-[9px] font-mono text-gray-400 mt-1">METADATA ATTACHED</span>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white truncate" title={photo.originalFileName}>
                          {photo.originalFileName}
                        </span>
                        <span className="text-[10px] font-mono text-gray-400">
                          {Math.round(photo.size / 1024)} KB
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded text-[9px] font-mono">
                          {photo.evidenceType.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!readOnly && (
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[9px] font-mono text-gray-500">
                        {new Date(photo.uploadedAt).toLocaleTimeString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemovePhotoFromPackage(selectedPackage.id, photo.id)}
                        className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition-colors"
                      >
                        <Icon name="trash-2" size={12} />
                        <span>Remove</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
