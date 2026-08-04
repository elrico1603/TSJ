import React, { useState } from 'react';
import { Icon } from './Icon';
import { googleDriveService, DriveFileInfo } from '../services/googleDriveService';

interface DispatchPhotoUploaderProps {
  folderId: string;
  folderUrl?: string;
  photos: DriveFileInfo[];
  onPhotosChange: (updatedPhotos: DriveFileInfo[]) => void;
  readOnly?: boolean;
}

export const DispatchPhotoUploader: React.FC<DispatchPhotoUploaderProps> = ({
  folderId,
  folderUrl,
  photos,
  onPhotosChange,
  readOnly = false
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = async (fileList: FileList | File[]) => {
    if (readOnly || !folderId) return;
    setIsUploading(true);

    const uploadedNewPhotos: DriveFileInfo[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        // Read image file as data URL for local display preview
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string || '');
          reader.readAsDataURL(file);
        });

        const uploadedInfo = await googleDriveService.uploadDispatchPhoto({
          folderId,
          file: {
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl
          }
        });
        uploadedNewPhotos.push(uploadedInfo);
      } catch (err) {
        console.error('Error uploading dispatch photo:', err);
      }
    }

    onPhotosChange([...photos, ...uploadedNewPhotos]);
    setIsUploading(false);
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

  const handleRemovePhoto = (photoId: string) => {
    if (readOnly) return;
    const filtered = photos.filter(p => p.id !== photoId);
    onPhotosChange(filtered);
  };

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-black/40 border border-white/10 p-4 rounded-2xl">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Icon name="folder" size={20} />
          </div>
          <div>
            <p className="text-xs font-black uppercase text-white">Google Drive Vault Folder</p>
            <p className="text-[10px] text-gray-400 font-mono">
              {folderId ? `Folder ID: ${folderId}` : 'Folder not created yet'}
            </p>
          </div>
        </div>

        {folderUrl && (
          <a
            href={folderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all"
          >
            <Icon name="external-link" size={14} />
            <span>Open Google Drive Folder</span>
          </a>
        )}
      </div>

      {!readOnly && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer relative ${
            dragActive
              ? 'border-[#ff8c00] bg-[#ff8c00]/10'
              : 'border-white/20 bg-black/20 hover:border-white/40 hover:bg-black/40'
          }`}
        >
          <input
            type="file"
            multiple
            accept="image/*"
            disabled={isUploading || !folderId}
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
            <div className="p-3 bg-white/5 rounded-2xl text-gray-300">
              <Icon name="upload" size={24} className={isUploading ? 'animate-bounce text-[#ff8c00]' : ''} />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-white">
                {isUploading ? 'Uploading Photos to Google Drive...' : 'Click or Drag Photos Here'}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                Upload shipment, quality check, and packaging photos directly to Google Drive storage
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Photos Grid */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-black uppercase text-gray-400 tracking-wider">
          <span>Attached Photos ({photos.length})</span>
          <span className="text-[10px] text-gray-500 font-mono">Permanent Cloud Storage</span>
        </div>

        {photos.length === 0 ? (
          <div className="p-8 text-center bg-black/20 border border-white/5 rounded-2xl text-xs text-gray-500">
            No dispatch photos uploaded yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative bg-black/60 border border-white/10 rounded-2xl overflow-hidden aspect-square flex flex-col justify-between p-2 hover:border-[#ff8c00]/50 transition-all shadow-md"
              >
                {photo.url && photo.url.startsWith('data:image') ? (
                  <img
                    src={photo.url}
                    alt={photo.name}
                    className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 to-black flex items-center justify-center">
                    <Icon name="image" size={32} className="text-purple-400/60" />
                  </div>
                )}

                <div className="relative z-10 flex justify-end">
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-all shadow-lg"
                      title="Remove Photo"
                    >
                      <Icon name="x" size={12} />
                    </button>
                  )}
                </div>

                <div className="relative z-10 bg-black/80 backdrop-blur-md p-1.5 rounded-xl border border-white/10 text-[10px]">
                  <p className="font-bold text-white truncate">{photo.name}</p>
                  <p className="text-[9px] text-gray-400 font-mono">{Math.round(photo.size / 1024)} KB</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
