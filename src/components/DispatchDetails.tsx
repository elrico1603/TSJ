import React, { useState } from 'react';
import { Icon } from './Icon';
import { DriveFileInfo } from '../services/googleDriveService';
import { DispatchPackage, calculatePackageSummary } from '../types/dispatchPackage';
import { getCourierTrackingUrl } from './DispatchWizard';

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
  packages?: DispatchPackage[];
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
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
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
  const [selectedPackageTab, setSelectedPackageTab] = useState<number>(0);

  const isModern = !!(dispatch.packages && dispatch.packages.length > 0);
  const packagesList = dispatch.packages || [];
  const packageSummary = isModern ? calculatePackageSummary(packagesList) : null;
  const trackingUrl = getCourierTrackingUrl(dispatch.courierCompany || dispatch.courier, dispatch.trackingNumber, dispatch.trackingUrl);

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

    const itemsRows = (dispatch.items || []).map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace;">${item.internalProductCode}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.productName}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      </tr>
    `).join('');

    const packagesRows = packagesList.map(pkg => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace; font-weight: bold;">${pkg.packageNumber} of ${pkg.totalPackages}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace;">${pkg.packageCode}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${pkg.description || 'Joinery Components'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace; text-align: center;">${pkg.weightKg ? `${pkg.weightKg} kg` : '-'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Dispatch Manifest - ${dispatch.dispatchNumber}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #111; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111; padding-bottom: 20px; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; text-transform: uppercase; }
            .subtitle { font-size: 14px; color: #555; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
            .card { border: 1px solid #ccc; padding: 15px; border-radius: 8px; }
            .label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 4px; }
            .val { font-size: 14px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { text-align: left; background: #f0f0f0; padding: 8px; font-size: 11px; text-transform: uppercase; }
            .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px; text-align: center; color: #777; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">TimberSmith Joinery</div>
              <div class="subtitle">Factory Dispatch Manifest & Delivery Note</div>
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
              <div class="val">${dispatch.courierCompany || dispatch.courier || 'Factory Direct'}</div>
              <div class="label" style="margin-top: 10px;">Tracking Number</div>
              <div class="val" style="font-family: monospace;">${dispatch.trackingNumber || 'N/A'}</div>
              <div class="label" style="margin-top: 10px;">Total Packages</div>
              <div class="val">${isModern ? `${packagesList.length} Packages` : dispatch.parcelCount || '1'}</div>
            </div>
          </div>

          ${isModern ? `
            <div style="margin-top: 20px;">
              <h3 style="font-size: 14px; text-transform: uppercase; margin-bottom: 5px;">Transport Packages Breakdown</h3>
              <table>
                <thead>
                  <tr>
                    <th>Pkg #</th>
                    <th>Package Code</th>
                    <th>Contents / Description</th>
                    <th>Weight</th>
                  </tr>
                </thead>
                <tbody>${packagesRows}</tbody>
              </table>
            </div>
          ` : ''}

          ${(dispatch.items && dispatch.items.length > 0) ? `
            <div style="margin-top: 20px;">
              <h3 style="font-size: 14px; text-transform: uppercase; margin-bottom: 5px;">Manifest Items</h3>
              <table>
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Product Name</th>
                    <th style="text-align: center;">Qty</th>
                  </tr>
                </thead>
                <tbody>${itemsRows}</tbody>
              </table>
            </div>
          ` : ''}

          ${dispatch.notes ? `
            <div class="card" style="margin-top: 20px;">
              <div class="label">Handling Notes</div>
              <div style="font-size: 12px;">${dispatch.notes}</div>
            </div>
          ` : ''}

          <div class="footer">
            Generated by TimberSmith Hub • ${new Date().toLocaleString()} • Authorized Factory Dispatch
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

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
              <div className="flex items-center space-x-3">
                <h2 className="text-lg font-black uppercase tracking-wider text-white">
                  {dispatch.dispatchNumber}
                </h2>
                {getStatusBadge(dispatch.status)}
              </div>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                {dispatch.customer} — {dispatch.project} ({dispatch.destinationBranch})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-colors"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Main Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
              <p className="text-sm font-bold text-[#ff8c00]">{dispatch.destinationBranch}</p>
            </div>

            <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Courier Service</span>
              <p className="text-sm font-bold text-white">{dispatch.courierCompany || dispatch.courier || 'N/A'}</p>
            </div>

            <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Tracking Number</span>
              {trackingUrl ? (
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono font-bold text-cyan-400 underline hover:text-cyan-300 flex items-center gap-1.5"
                >
                  <span>{dispatch.trackingNumber}</span>
                  <Icon name="external-link" size={14} />
                </a>
              ) : (
                <p className="text-sm font-mono font-bold text-cyan-400">{dispatch.trackingNumber || 'N/A'}</p>
              )}
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

          {/* MODERN PACKAGE BREAKDOWN SECTION */}
          {isModern ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Transport Packages Breakdown ({packagesList.length} Packages)
                </h3>

                {packageSummary && (
                  <span className="text-xs font-mono text-gray-400">
                    Total Packages: <strong className="text-cyan-400">{packageSummary.total}</strong> | Photos: <strong className="text-cyan-400">
                      {packagesList.reduce((acc, p) => acc + (p.dispatchPhotos?.length || 0), 0)}
                    </strong>
                  </span>
                )}
              </div>

              {/* Package Tabs */}
              <div className="flex flex-wrap gap-2">
                {packagesList.map((pkg, idx) => {
                  const isSelected = idx === selectedPackageTab;
                  const photoCount = pkg.dispatchPhotos?.length || 0;

                  return (
                    <button
                      key={pkg.id || idx}
                      type="button"
                      onClick={() => setSelectedPackageTab(idx)}
                      className={`px-3 py-2 rounded-2xl text-xs font-mono transition-all flex items-center space-x-2 border ${
                        isSelected
                          ? 'bg-[#ff8c00] border-[#ff8c00] text-black font-bold shadow'
                          : 'bg-black/40 hover:bg-black/60 border-white/10 text-gray-300'
                      }`}
                    >
                      <span>Pkg {pkg.packageNumber}/{pkg.totalPackages}</span>
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

              {/* Selected Package Card Details */}
              {packagesList[selectedPackageTab] && (
                <div className="bg-black/50 border border-white/10 p-5 rounded-3xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 font-mono font-bold flex items-center justify-center text-sm border border-cyan-500/30">
                        {packagesList[selectedPackageTab].packageNumber}/{packagesList[selectedPackageTab].totalPackages}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-mono font-bold text-white">
                            {packagesList[selectedPackageTab].packageCode}
                          </span>
                          {packagesList[selectedPackageTab].stickerCode && (
                            <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 px-2 py-0.5 rounded">
                              {packagesList[selectedPackageTab].stickerCode}
                            </span>
                          )}
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                            packagesList[selectedPackageTab].status === 'RECEIVED'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : packagesList[selectedPackageTab].status === 'MISSING'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : packagesList[selectedPackageTab].status === 'DAMAGED'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : packagesList[selectedPackageTab].status === 'INCORRECT'
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : packagesList[selectedPackageTab].status === 'DISPATCHED'
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : 'bg-white/10 text-gray-400 border border-white/10'
                          }`}>
                            {packagesList[selectedPackageTab].status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 mt-0.5">
                          {packagesList[selectedPackageTab].description || 'Joinery package'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-xs font-mono text-gray-400">
                      {packagesList[selectedPackageTab].weightKg && (
                        <div>Weight: <strong className="text-white">{packagesList[selectedPackageTab].weightKg} kg</strong></div>
                      )}
                      {packagesList[selectedPackageTab].receivedBy && (
                        <div className="text-emerald-400">Verified By: <strong className="text-white">{packagesList[selectedPackageTab].receivedBy}</strong></div>
                      )}
                    </div>
                  </div>

                  {/* Package Receiving Notes if present */}
                  {packagesList[selectedPackageTab].receivingNotes && (
                    <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-2xl text-xs space-y-1">
                      <span className="text-[10px] font-black uppercase text-amber-400 block tracking-wider">
                        Receiving Inspection Notes:
                      </span>
                      <p className="text-gray-200">{packagesList[selectedPackageTab].receivingNotes}</p>
                    </div>
                  )}

                  {/* Evidence Photos for this Package */}
                  <div className="space-y-4 pt-3 border-t border-white/5">
                    {/* Dispatch Photos */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                        Factory Evidence Photos ({packagesList[selectedPackageTab].dispatchPhotos?.length || 0})
                      </h4>

                      {(!packagesList[selectedPackageTab].dispatchPhotos || packagesList[selectedPackageTab].dispatchPhotos!.length === 0) ? (
                        <div className="p-3 text-center bg-black/30 border border-white/5 rounded-2xl text-xs text-gray-500">
                          No dispatch photographic evidence recorded for this package.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {packagesList[selectedPackageTab].dispatchPhotos!.map((photo) => (
                            <div
                              key={photo.id}
                              className="bg-black/60 border border-white/10 p-3 rounded-2xl space-y-2 text-xs"
                            >
                              <div className="aspect-video w-full rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex flex-col items-center justify-center text-cyan-400 p-2">
                                <Icon name="image" size={24} />
                                <span className="text-[9px] font-mono text-gray-400 mt-1 truncate max-w-full">
                                  {photo.originalFileName}
                                </span>
                              </div>
                              <div className="space-y-1 text-[10px]">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Type:</span>
                                  <span className="font-mono text-cyan-300">{photo.evidenceType.replace('_', ' ').toUpperCase()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Uploaded By:</span>
                                  <span className="text-gray-200">{photo.uploadedBy}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Date:</span>
                                  <span className="text-gray-300 font-mono">{new Date(photo.uploadedAt).toLocaleString()}</span>
                                </div>
                                <div className="p-2 bg-white/5 rounded-lg border border-white/5 text-[9px] text-gray-400 break-all font-mono">
                                  {photo.storagePath}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Receiving Photos if any */}
                    {packagesList[selectedPackageTab].receivingPhotos && packagesList[selectedPackageTab].receivingPhotos!.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                          Destination Receiving Evidence Photos ({packagesList[selectedPackageTab].receivingPhotos!.length})
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {packagesList[selectedPackageTab].receivingPhotos!.map((photo) => (
                            <div
                              key={photo.id}
                              className="bg-black/60 border border-emerald-500/20 p-3 rounded-2xl space-y-2 text-xs"
                            >
                              <div className="aspect-video w-full rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex flex-col items-center justify-center text-emerald-400 p-2">
                                <Icon name="camera" size={24} />
                                <span className="text-[9px] font-mono text-gray-400 mt-1 truncate max-w-full">
                                  {photo.originalFileName}
                                </span>
                              </div>
                              <div className="space-y-1 text-[10px]">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Type:</span>
                                  <span className="font-mono text-emerald-300">{photo.evidenceType.replace('_', ' ').toUpperCase()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Uploaded By:</span>
                                  <span className="text-gray-200">{photo.uploadedBy}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Date:</span>
                                  <span className="text-gray-300 font-mono">{new Date(photo.uploadedAt).toLocaleString()}</span>
                                </div>
                                <div className="p-2 bg-white/5 rounded-lg border border-white/5 text-[9px] text-gray-400 break-all font-mono">
                                  {photo.storagePath}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* LEGACY SECTION FALLBACK */
            <div className="space-y-4">
              {dispatch.googleDriveFolderId && (
                <div className="bg-purple-950/20 border border-purple-500/30 p-5 rounded-3xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl border border-purple-500/40">
                        <Icon name="folder" size={24} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase text-white">Legacy Google Drive Dispatch Archive</h3>
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
                </div>
              )}

              {/* Legacy Photos */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase text-gray-300 tracking-wider">
                  Legacy Shipment Photos ({dispatch.photos?.length || 0})
                </h3>
                {!dispatch.photos || dispatch.photos.length === 0 ? (
                  <div className="p-6 text-center bg-black/20 border border-white/5 rounded-2xl text-xs text-gray-500">
                    No photos attached to this legacy dispatch.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {dispatch.photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="bg-black/60 border border-white/10 rounded-2xl overflow-hidden aspect-square flex flex-col justify-end p-2 shadow"
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
            </div>
          )}

          {/* Audit History Timeline */}
          {dispatch.history && dispatch.history.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-white/10">
              <h3 className="text-xs font-black uppercase text-gray-300 tracking-wider">
                Audit Trail & History ({dispatch.history.length})
              </h3>
              <div className="space-y-2">
                {dispatch.history.map((h, i) => (
                  <div key={i} className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                      <span className="font-mono font-bold text-white">{h.action}</span>
                      {h.notes && <span className="text-gray-400">— {h.notes}</span>}
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono">
                      <span>{h.user}</span> • <span>{new Date(h.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata Footer */}
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-wrap justify-between text-[11px] text-gray-400 font-mono">
            <div>Created By: <strong className="text-gray-200">{dispatch.createdBy}</strong></div>
            <div>Created Date: <strong className="text-gray-200">{new Date(dispatch.createdAt).toLocaleString()}</strong></div>
            <div>Last Updated: <strong className="text-gray-200">{new Date(dispatch.updatedAt).toLocaleString()}</strong></div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-5 sm:p-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 sticky bottom-0 bg-[#121214] z-20">
          <button
            type="button"
            onClick={handlePrintWaybill}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all"
          >
            <Icon name="printer" size={16} />
            <span>Print Manifest / Waybill</span>
          </button>

          <div className="flex items-center space-x-3">
            {canEdit && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(dispatch)}
                className="px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all"
              >
                <Icon name="edit-3" size={16} />
                <span>Edit Dispatch</span>
              </button>
            )}

            {onDispatchShipment && dispatch.status !== 'Dispatched' && dispatch.status !== 'Received' && (
              <button
                type="button"
                onClick={() => onDispatchShipment(dispatch)}
                className="px-5 py-2.5 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all shadow-lg"
              >
                <Icon name="truck" size={16} />
                <span>Dispatch Shipment</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
