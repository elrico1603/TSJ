import React, { useState } from 'react';
import { PurchaseOrder } from '../types';
import { Icon } from './Icon';
import { purchaseOrderService } from '../services/purchaseOrderService';

interface PurchaseOrderDocumentModalProps {
  po: PurchaseOrder;
  currentUser?: any;
  onClose: () => void;
  onStatusChanged: () => void;
  announce?: (msg: string) => void;
}

export const PurchaseOrderDocumentModal: React.FC<PurchaseOrderDocumentModalProps> = ({
  po,
  currentUser,
  onClose,
  onStatusChanged,
  announce
}) => {
  const [isApproving, setIsApproving] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [showApprovalPrompt, setShowApprovalPrompt] = useState(false);

  const canApprove = po.status === 'Draft' || po.status === 'Pending Approval';

  const handleApproveSubmit = async () => {
    setIsApproving(true);
    const username = currentUser?.name || currentUser?.email || 'Janah (Procurement Manager)';
    try {
      await purchaseOrderService.approvePO(po.id, username, approvalNotes || 'Approved by Janah');
      if (announce) announce(`Purchase Order ${po.poNumber} has been approved.`);
      setShowApprovalPrompt(false);
      onStatusChanged();
    } catch (e: any) {
      alert(`Failed to approve PO: ${e?.message || 'Unknown error'}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    // Generate simple print-to-pdf instruction or trigger print dialog
    window.print();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Approved</span>;
      case 'Pending Approval':
        return <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">Pending Approval</span>;
      case 'Draft':
        return <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gray-500/20 text-gray-400 border border-gray-500/30">Draft</span>;
      case 'Sent':
        return <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">Sent to Supplier</span>;
      case 'Completed':
        return <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30">Completed</span>;
      case 'Cancelled':
        return <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30">Cancelled</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gray-500/20 text-gray-400">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-[#151515] border border-white/10 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-6 flex flex-col max-h-[92vh]">
        
        {/* Top Header Bar (Action Controls) */}
        <div className="p-4 bg-[#1f1f1f] border-b border-white/10 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ff8c00]/10 border border-[#ff8c00]/30 flex items-center justify-center text-[#ff8c00]">
              <Icon name="file-text" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white uppercase tracking-wider font-mono">
                  {po.poNumber}
                </h2>
                {getStatusBadge(po.status)}
              </div>
              <p className="text-xs text-gray-400 font-medium">
                Linked Stock Request: <span className="text-[#ff8c00] font-mono font-bold">{po.linkedRequestNumber || 'N/A'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canApprove && (
              <button
                onClick={() => setShowApprovalPrompt(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg"
              >
                <Icon name="check-circle" size={16} />
                <span>Approve PO</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 border border-white/10"
            >
              <Icon name="printer" size={16} />
              <span>Print</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="px-3.5 py-2 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5"
            >
              <Icon name="download" size={16} />
              <span>Export PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-all"
            >
              <Icon name="x" size={20} />
            </button>
          </div>
        </div>

        {/* Approval Prompt Box */}
        {showApprovalPrompt && (
          <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/30 space-y-3 print:hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase text-emerald-400 flex items-center gap-2">
                <Icon name="check-circle" size={16} />
                <span>Approve Purchase Order {po.poNumber}</span>
              </h3>
              <button onClick={() => setShowApprovalPrompt(false)} className="text-gray-400 hover:text-white text-xs">
                Cancel
              </button>
            </div>
            <input
              type="text"
              value={approvalNotes}
              onChange={e => setApprovalNotes(e.target.value)}
              placeholder="Approval notes or vendor dispatch instructions (optional)..."
              className="w-full bg-[#111111] border border-emerald-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={handleApproveSubmit}
                disabled={isApproving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              >
                {isApproving ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        )}

        {/* PRINTABLE DOCUMENT BODY */}
        <div className="p-6 sm:p-10 bg-white text-slate-900 overflow-y-auto flex-1 font-sans space-y-8 print:p-0 print:overflow-visible">
          
          {/* Document Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-6 gap-6">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-500 text-slate-950 font-black rounded-xl flex items-center justify-center text-xl tracking-tighter">
                  TS
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                    TS JOINERY & TIMBER PRODUCTS
                  </h1>
                  <p className="text-xs font-bold text-slate-600">
                    Precision Joinery, Custom Cabinetry & Architectural Woodwork
                  </p>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-600 space-y-0.5">
                <p>14 Factory Road, Montague Gardens, Cape Town, 7441</p>
                <p>Tel: +27 (0) 21 551 9000 | Email: procurement@tsjoinery.co.za</p>
                <p>VAT Reg: 4900128491 | Co Reg: 2018/392011/07</p>
              </div>
            </div>

            <div className="text-right sm:text-right w-full sm:w-auto bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest text-amber-600">
                PURCHASE ORDER
              </h2>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between sm:justify-end gap-4 font-mono font-bold">
                  <span className="text-slate-500">PO NUMBER:</span>
                  <span className="text-slate-900">{po.poNumber}</span>
                </div>
                <div className="flex justify-between sm:justify-end gap-4 font-mono">
                  <span className="text-slate-500">DATE:</span>
                  <span className="text-slate-900">{new Date(po.createdAt).toLocaleDateString('en-ZA')}</span>
                </div>
                <div className="flex justify-between sm:justify-end gap-4 font-mono">
                  <span className="text-slate-500">LINKED REQ:</span>
                  <span className="text-amber-600 font-bold">{po.linkedRequestNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between sm:justify-end gap-4 font-mono">
                  <span className="text-slate-500">STATUS:</span>
                  <span className="font-bold text-slate-900 uppercase">{po.status}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Supplier & Delivery Address Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Vendor / Supplier Info */}
            <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50 space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-700 border-b border-slate-200 pb-1 flex items-center justify-between">
                <span>VENDOR / SUPPLIER DETAILS</span>
                <span className="font-mono text-[10px] text-slate-500">{po.supplierCode || 'SUP'}</span>
              </h3>
              <div className="text-xs text-slate-800 space-y-1">
                <p className="font-black text-sm text-slate-900 uppercase">{po.supplierName}</p>
                {po.supplierContactPerson && <p><span className="font-bold text-slate-600">Attn:</span> {po.supplierContactPerson}</p>}
                {po.supplierTelephone && <p><span className="font-bold text-slate-600">Tel:</span> {po.supplierTelephone}</p>}
                {po.supplierEmail && <p><span className="font-bold text-slate-600">Email:</span> {po.supplierEmail}</p>}
                {po.supplierAddress && <p><span className="font-bold text-slate-600">Address:</span> {po.supplierAddress}</p>}
              </div>
            </div>

            {/* Delivery Destination */}
            <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50 space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                DELIVERY DESTINATION
              </h3>
              <div className="text-xs text-slate-800 space-y-1">
                <p className="font-black text-sm text-slate-900 uppercase">TS Joinery Central Factory</p>
                <p className="font-medium">{po.deliveryAddress}</p>
                {po.deliveryInstructions && (
                  <p className="mt-2 text-[11px] text-slate-600 bg-amber-50 p-2 rounded border border-amber-200/50">
                    <span className="font-bold text-amber-800">Instructions:</span> {po.deliveryInstructions}
                  </p>
                )}
                {po.expectedDeliveryDate && (
                  <p className="font-bold text-slate-900 mt-1">
                    Expected Delivery: <span className="font-mono text-amber-700">{po.expectedDeliveryDate}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              ORDER ITEMS & SPECIFICATIONS
            </h3>

            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-black uppercase tracking-wider text-[10px]">
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3">Product Description</th>
                    <th className="p-3 font-mono">Code / Part #</th>
                    <th className="p-3 text-center">Unit</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Est. Unit Price</th>
                    <th className="p-3 text-right">Total (ZAR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {po.items.map((item, idx) => {
                    const price = item.unitPrice || 0;
                    const total = item.totalPrice || (price * item.orderQuantity);
                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50 font-medium">
                        <td className="p-3 text-center text-slate-500 font-mono font-bold">{idx + 1}</td>
                        <td className="p-3">
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block font-mono">Product:</span>
                            <p className="font-bold text-slate-900 uppercase text-xs">{item.productName}</p>
                            {item.location && <p className="text-[10px] text-slate-500">Bin Location: {item.location}</p>}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-slate-700">
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block font-mono">Code:</span>
                            <p className="font-bold text-purple-800 text-xs">{item.internalProductCode || item.productId}</p>
                            {item.supplierPartNumber && <p className="text-[10px] text-slate-500">Supplier Part: {item.supplierPartNumber}</p>}
                          </div>
                        </td>
                        <td className="p-3 text-center uppercase text-slate-600 font-bold">{item.unit}</td>
                        <td className="p-3 text-right font-black font-mono text-slate-900 text-sm">{item.orderQuantity}</td>
                        <td className="p-3 text-right font-mono text-slate-700">R {price.toFixed(2)}</td>
                        <td className="p-3 text-right font-black font-mono text-slate-900 text-sm">R {total.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals & Terms Summary */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
            <div className="text-xs text-slate-600 space-y-1 max-w-md">
              <p className="font-bold text-slate-900 uppercase">Standard Purchase Terms & Conditions:</p>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 text-slate-500">
                <li>PO number must appear on all invoices, delivery notes, and packages.</li>
                <li>Delivery times must comply with stated lead times unless authorized in writing.</li>
                <li>All materials subject to quality inspection upon arrival at receiving bay.</li>
              </ul>
            </div>

            <div className="w-full sm:w-72 bg-slate-100 p-4 rounded-xl border border-slate-300 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-600">
                <span>TOTAL ITEMS:</span>
                <span className="font-bold text-slate-900">{po.totalProducts} Line Items</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>TOTAL QUANTITY:</span>
                <span className="font-bold text-slate-900">{po.totalQuantity} Units</span>
              </div>
              <div className="border-t border-slate-300 pt-2 flex justify-between text-sm font-black text-slate-900">
                <span>ESTIMATED TOTAL:</span>
                <span className="text-amber-700">R {(po.estimatedTotalValue || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Signatures & Approvals Section */}
          <div className="pt-8 border-t-2 border-slate-200 grid grid-cols-2 gap-8 text-xs">
            <div className="space-y-8">
              <div>
                <p className="font-bold text-slate-500 uppercase text-[10px]">PREPARED BY:</p>
                <p className="font-black text-slate-900 text-sm mt-1">{po.createdUser}</p>
                <p className="text-[10px] text-slate-500 font-mono">{new Date(po.createdAt).toLocaleString()}</p>
              </div>
              <div className="border-b border-slate-400 w-48" />
              <p className="text-[10px] text-slate-500 uppercase">Authorized Requisitioner Signature</p>
            </div>

            <div className="space-y-8">
              <div>
                <p className="font-bold text-slate-500 uppercase text-[10px]">APPROVED & AUTHORIZED BY:</p>
                <p className="font-black text-emerald-800 text-sm mt-1">{po.approvedBy || 'Pending Approval'}</p>
                {po.approvedAt && <p className="text-[10px] text-slate-500 font-mono">{new Date(po.approvedAt).toLocaleString()}</p>}
              </div>
              <div className="border-b border-slate-400 w-48" />
              <p className="text-[10px] text-slate-500 uppercase">Procurement Approval Signature</p>
            </div>
          </div>

          {/* Audit History Log Footer */}
          {po.auditTrail && po.auditTrail.length > 0 && (
            <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 space-y-1">
              <p className="font-bold text-slate-700 uppercase">Document Audit Log:</p>
              {po.auditTrail.map((aud, idx) => (
                <div key={idx} className="flex justify-between font-mono">
                  <span>{aud.timestamp.split('T')[0]} - {aud.action} ({aud.user})</span>
                  <span>{aud.notes}</span>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
