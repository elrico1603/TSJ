import React from 'react';
import { Icon } from './Icon';
import { DriveFileInfo } from '../services/googleDriveService';

export interface DispatchItem {
  id: string;
  productId?: string;
  internalProductCode: string;
  productName: string;
  supplier?: string;
  supplierPartNumber?: string;
  baseOrderQuantity?: string;
  binQuantity?: string;
  location?: string;
  deliveryTime?: string;
  category?: string;
  quantity: number;
  unitCost?: number;
  isCustom?: boolean;
}

export interface ReceivingPhoto {
  id: string;
  category: 'delivery_note' | 'parcel_condition' | 'unpacked_items';
  name: string;
  url: string;
  uploadedAt: string;
  size: number;
}

export interface DispatchRecord {
  id: string;
  dispatchNumber: string;
  customer: string;
  project: string;
  destinationBranch: string;
  installer?: string;
  courier?: string;
  courierCompany?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  parcelCount?: string;
  notes?: string;
  status: 'Draft' | 'Ready for Dispatch' | 'Dispatched' | 'In Transit' | 'Received' | 'Partially Received' | 'Issue Logged';
  items?: DispatchItem[];
  googleDriveFolderId?: string;
  googleDriveFolderName?: string;
  googleDriveFolderUrl?: string;
  googleDriveReceivingFolderId?: string;
  googleDriveReceivingFolderUrl?: string;
  photoCount?: number;
  photos?: DriveFileInfo[];
  receivingPhotos?: ReceivingPhoto[];
  receivingChecklist?: {
    packagingIntact: boolean;
    parcelCountMatches: boolean;
    correctProducts: boolean;
    qualityChecked: boolean;
  };
  receivingNotes?: string;
  receivedBy?: string;
  receivedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  history?: Array<{
    action: string;
    user: string;
    timestamp: string;
    notes?: string;
  }>;
}

interface DispatchDetailsProps {
  dispatch: DispatchRecord;
  onClose: () => void;
  onEdit?: (dispatch: DispatchRecord) => void;
  onDispatchShipment?: (dispatch: DispatchRecord) => void;
  canEdit?: boolean;
}

export const DispatchDetails: React.FC<DispatchDetailsProps> = ({
  dispatch,
  onClose,
  onEdit,
  onDispatchShipment,
  canEdit = true
}) => {
  const getStatusBadge = (status: DispatchRecord['status']) => {
    switch (status) {
      case 'Received':
        return (
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            RECEIVED
          </span>
        );
      case 'Partially Received':
        return (
          <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            PARTIALLY RECEIVED
          </span>
        );
      case 'Issue Logged':
        return (
          <span className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400"></span>
            ISSUE LOGGED
          </span>
        );
      case 'Dispatched':
      case 'In Transit':
        return (
          <span className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
            {status.toUpperCase()}
          </span>
        );
      case 'Ready for Dispatch':
        return (
          <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            READY FOR DISPATCH
          </span>
        );
      case 'Draft':
      default:
        return (
          <span className="px-3 py-1 bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-400"></span>
            DRAFT
          </span>
        );
    }
  };

  const handlePrintWaybill = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Dispatch Manifest - ${dispatch.dispatchNumber}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #111; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111; pb: 20px; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; text-transform: uppercase; }
            .subtitle { font-size: 14px; color: #555; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
            .card { border: 1px solid #ccc; padding: 15px; border-radius: 8px; }
            .label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 4px; }
            .val { font-size: 14px; font-weight: bold; }
            .footer { margin-top: 40px; border-top: 1px solid #ddd; pt: 20px; font-size: 12px; text-align: center; color: #777; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">TimberSmith Joinery</div>
              <div class="subtitle">Dispatch Manifest & Delivery Note</div>
            </div>
            <div style="text-align: right;">
              <div class="title" style="color: #d97706;">${dispatch.dispatchNumber}</div>
              <div class="subtitle">Status: ${dispatch.status}</div>
            </div>
          </div>

          <div class="grid">
            <div class="card">
              <div class="label">Customer / Client</div>
              <div class="val">${dispatch.customer}</div>
              <div class="label" style="margin-top: 10px;">Project Name</div>
              <div class="val">${dispatch.project}</div>
              <div class="label" style="margin-top: 10px;">Destination Branch</div>
              <div class="val">${dispatch.destinationBranch}</div>
            </div>

            <div class="card">
              <div class="label">Courier Service</div>
              <div class="val">${dispatch.courier || 'N/A'}</div>
              <div class="label" style="margin-top: 10px;">Tracking Number</div>
              <div class="val">${dispatch.trackingNumber || 'N/A'}</div>
              <div class="label" style="margin-top: 10px;">Installer</div>
              <div class="val">${dispatch.installer || 'N/A'}</div>
            </div>
          </div>

          <div class="card" style="margin-bottom: 20px;">
            <div class="label">Dispatch Notes & Instructions</div>
            <div class="val" style="font-weight: normal; font-size: 13px;">${dispatch.notes || 'No special instructions recorded.'}</div>
          </div>

          <div class="card" style="margin-bottom: 20px;">
            <div class="label">Google Drive Archive Folder</div>
            <div class="val" style="font-size: 12px; font-family: monospace;">${dispatch.googleDriveFolderUrl || 'N/A'}</div>
          </div>

          <div style="margin-top: 60px; display: flex; justify-content: space-between;">
            <div style="width: 45%; border-top: 1px solid #000; pt: 8px; text-align: center; font-size: 12px;">
              Dispatched By (Signature & Date)
            </div>
            <div style="width: 45%; border-top: 1px solid #000; pt: 8px; text-align: center; font-size: 12px;">
              Received By (Signature & Date)
            </div>
          </div>

          <div class="footer">
            Generated on ${new Date().toLocaleString()} • Created by ${dispatch.createdBy}
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto font-sans">
      <div className="bg-[#121214] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col my-auto">
        {/* Modal Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#121214]/90 backdrop-blur-md z-20">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-[#ff8c00]/10 text-[#ff8c00] rounded-2xl border border-[#ff8c00]/30">
              <Icon name="truck" size={24} />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-black uppercase text-white tracking-wider">{dispatch.dispatchNumber}</h2>
                {getStatusBadge(dispatch.status)}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Customer: <strong className="text-gray-200">{dispatch.customer}</strong> • Project: <strong className="text-gray-200">{dispatch.project}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Main Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Customer / Client</span>
              <p className="text-sm font-bold text-white">{dispatch.customer}</p>
            </div>

            <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Project Name</span>
              <p className="text-sm font-bold text-white">{dispatch.project}</p>
            </div>

            <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Destination Branch</span>
              <p className="text-sm font-bold text-amber-400">{dispatch.destinationBranch}</p>
            </div>

            <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Courier Service</span>
              <p className="text-sm font-bold text-white">{dispatch.courier || 'N/A'}</p>
            </div>

            <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Tracking Number</span>
              <p className="text-sm font-mono font-bold text-cyan-400">{dispatch.trackingNumber || 'N/A'}</p>
            </div>

            <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Installer / Recipient</span>
              <p className="text-sm font-bold text-white">{dispatch.installer || 'N/A'}</p>
            </div>
          </div>

          {/* Notes */}
          {dispatch.notes && (
            <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Dispatch Notes & Special Instructions</span>
              <p className="text-xs text-gray-300 whitespace-pre-wrap">{dispatch.notes}</p>
            </div>
          )}

          {/* Google Drive Folder Box */}
          <div className="bg-purple-950/20 border border-purple-500/30 p-5 rounded-3xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl border border-purple-500/40">
                  <Icon name="folder" size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-white">Google Drive Dispatch Archive</h3>
                  <p className="text-xs text-purple-300 font-mono mt-0.5">
                    {dispatch.googleDriveFolderName || `Folder: ${dispatch.dispatchNumber}`}
                  </p>
                </div>
              </div>

              {dispatch.googleDriveFolderUrl && (
                <a
                  href={dispatch.googleDriveFolderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all shadow-lg"
                >
                  <Icon name="external-link" size={16} />
                  <span>Open Drive Folder</span>
                </a>
              )}
            </div>

            <div className="text-[11px] text-gray-400 font-mono bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
              <div className="flex justify-between">
                <span>Folder ID:</span>
                <span className="text-gray-200">{dispatch.googleDriveFolderId || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Stored Photos:</span>
                <span className="text-purple-300 font-bold">{dispatch.photoCount || dispatch.photos?.length || 0} Photos</span>
              </div>
            </div>
          </div>

          {/* Photos Gallery */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase text-gray-300 tracking-wider">
              Dispatched Photos ({dispatch.photos?.length || 0})
            </h3>
            {!dispatch.photos || dispatch.photos.length === 0 ? (
              <div className="p-8 text-center bg-black/20 border border-white/5 rounded-2xl text-xs text-gray-500">
                No photos attached to this dispatch.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {dispatch.photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative bg-black/60 border border-white/10 rounded-2xl overflow-hidden aspect-square flex flex-col justify-end p-2 shadow"
                  >
                    {photo.url && photo.url.startsWith('data:image') ? (
                      <img
                        src={photo.url}
                        alt={photo.name}
                        className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-90"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 to-black flex items-center justify-center">
                        <Icon name="image" size={32} className="text-purple-400/60" />
                      </div>
                    )}
                    <div className="relative z-10 bg-black/80 backdrop-blur-md p-2 rounded-xl border border-white/10 text-[10px]">
                      <p className="font-bold text-white truncate">{photo.name}</p>
                      <p className="text-[9px] text-gray-400 font-mono">{Math.round(photo.size / 1024)} KB</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Metadata Footer */}
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-wrap justify-between text-[11px] text-gray-400 font-mono">
            <div>Created By: <strong className="text-gray-200">{dispatch.createdBy}</strong></div>
            <div>Created Date: <strong className="text-gray-200">{new Date(dispatch.createdAt).toLocaleString()}</strong></div>
            <div>Last Updated: <strong className="text-gray-200">{new Date(dispatch.updatedAt).toLocaleString()}</strong></div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 sticky bottom-0 bg-[#121214] z-20">
          <button
            onClick={handlePrintWaybill}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all"
          >
            <Icon name="printer" size={16} />
            <span>Print Manifest / Waybill</span>
          </button>

          <div className="flex items-center space-x-3">
            {canEdit && onEdit && (
              <button
                onClick={() => onEdit(dispatch)}
                className="px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all"
              >
                <Icon name="edit-3" size={16} />
                <span>Edit Dispatch</span>
              </button>
            )}

            {canEdit && onDispatchShipment && dispatch.status !== 'Dispatched' && (
              <button
                onClick={() => onDispatchShipment(dispatch)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all shadow-lg"
              >
                <Icon name="send" size={16} />
                <span>Dispatch Shipment</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
