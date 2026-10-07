import React, { useState } from 'react';
import { PurchaseOrder } from '../types';
import { Icon } from './Icon';
import { purchaseOrderService } from '../services/purchaseOrderService';
import { companyService } from '../services/companyService';
import { permissionService } from '../services/permissionService';
import { downloadPurchaseOrderPdf } from '../services/purchaseOrderPdfService';

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
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [showApprovalPrompt, setShowApprovalPrompt] = useState(false);
  const [showInternalAudit, setShowInternalAudit] = useState(false);

  // Authoritative company and branch information
  const companyInfo = companyService.getLocalCompanyInfo();
  const branches = companyService.getLocalBranches();
  const branch = branches.find(b => b.id === po.branchId || b.branchCode === po.branchId);

  const canApprove = (po.status === 'Draft' || po.status === 'Pending Approval') &&
    permissionService.hasPermission(currentUser, 'Purchase Orders', 'Approve');

  const handleApproveSubmit = async () => {
    setIsApproving(true);
    const approverName = currentUser?.name || currentUser?.email || 'Authorized Approver';
    try {
      await purchaseOrderService.approvePO(po.id, currentUser, approvalNotes || `Approved by ${approverName}`);
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
    const prevTitle = document.title;
    document.title = `Purchase_Order_${po.poNumber}`;
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
    }, 1000);
  };

  const handleExportPDF = async () => {
    const prevTitle = document.title;
    document.title = `Purchase_Order_${po.poNumber}`;
    setIsExportingPdf(true);
    if (announce) {
      announce(`Generating programmatic PDF for Purchase Order ${po.poNumber}...`);
    }

    try {
      await downloadPurchaseOrderPdf(po);
      if (announce) {
        announce(`Purchase Order ${po.poNumber} PDF generated and downloaded successfully.`);
      }
    } catch (err: any) {
      console.warn('[PDF Export] Programmatic generation notice, falling back to print dialog:', err);
      window.print();
    } finally {
      setIsExportingPdf(false);
      setTimeout(() => {
        document.title = prevTitle;
      }, 1000);
    }
  };

  // Document presentation filter: remove conversational greetings (e.g. "Hi Rowan...")
  const sanitizeDeliveryInstructions = (instructions?: string): string => {
    if (!instructions) return '';
    return instructions
      .replace(/hi\s+[a-z]+/gi, '')
      .replace(/here\s+is\s+our\s+order,?\s*thank\s+you\.?/gi, '')
      .replace(/here\s+is\s+our\s+order/gi, '')
      .replace(/thank\s+you\.?/gi, '')
      .trim();
  };

  const cleanedInstructions = sanitizeDeliveryInstructions(po.deliveryInstructions);

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
    <div className="print-wrapper fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn print:p-0 print:m-0 print:bg-white print:static print:min-h-0 print:h-auto print:overflow-visible">
      <div className="bg-[#151515] border border-white/10 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-6 flex flex-col max-h-[92vh] print:border-none print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-none print:static print:bg-white print:overflow-visible print:max-h-none">
        
        {/* Top Header Bar (Action Controls - Hidden during print) */}
        <div className="p-4 bg-[#1f1f1f] border-b border-white/10 flex flex-wrap items-center justify-between gap-3 no-print print:hidden">
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
              title="Print A4 Purchase Order"
            >
              <Icon name="printer" size={16} />
              <span>Print</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={isExportingPdf}
              className="px-3.5 py-2 bg-[#ff8c00] hover:bg-[#e07b00] disabled:opacity-50 text-black font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md"
              title="Generate and download authentic PDF"
            >
              <Icon name="download" size={16} />
              <span>{isExportingPdf ? 'Exporting...' : 'Export PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-all"
            >
              <Icon name="x" size={20} />
            </button>
          </div>
        </div>

        {/* Approval Prompt Box (Hidden during print) */}
        {showApprovalPrompt && (
          <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/30 space-y-3 no-print print:hidden">
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

        {/* PRINTABLE DOCUMENT BODY (A4 Isolated Print Container) */}
        <div 
          id="po-print-container" 
          className="po-document-print p-6 sm:p-10 bg-white text-slate-900 overflow-y-auto flex-1 font-sans space-y-6 print:p-0 print:m-0 print:w-full print:max-w-none print:static print:overflow-visible"
        >
          {/* Document Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-5 gap-6 po-avoid-break">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-500 text-slate-950 font-black rounded-xl flex items-center justify-center text-xl tracking-tighter shadow-sm">
                  TS
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                    {companyInfo.companyName || 'TS JOINERY & TIMBER WORKS'}
                  </h1>
                  <p className="text-xs font-bold text-slate-600">
                    {companyInfo.notes || 'Precision Joinery, Custom Cabinetry & Architectural Woodwork'}
                  </p>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-600 space-y-0.5 font-medium">
                <p>{companyInfo.physicalAddress || '14 Joiners Street, Industrial Area, Bloemfontein'}</p>
                <p>
                  {companyInfo.telephone ? `Tel: ${companyInfo.telephone}` : ''}
                  {companyInfo.email ? ` | Email: ${companyInfo.email}` : ''}
                </p>
                <p>
                  {companyInfo.vatNumber ? `VAT Reg: ${companyInfo.vatNumber}` : ''}
                  {companyInfo.registrationNumber ? ` | Co Reg: ${companyInfo.registrationNumber}` : ''}
                </p>
              </div>
            </div>

            <div className="text-right sm:text-right w-full sm:w-auto bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest text-amber-600">
                PURCHASE ORDER
              </h2>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between sm:justify-end gap-4 font-mono font-bold">
                  <span className="text-slate-500">PO NUMBER:</span>
                  <span className="text-slate-900 font-black">{po.poNumber}</span>
                </div>
                {po.masterPoNumber && po.masterPoNumber !== po.poNumber && (
                  <div className="flex justify-between sm:justify-end gap-4 font-mono">
                    <span className="text-slate-500">MASTER GROUP:</span>
                    <span className="text-purple-700 font-bold">{po.masterPoNumber}</span>
                  </div>
                )}
                <div className="flex justify-between sm:justify-end gap-4 font-mono">
                  <span className="text-slate-500">DATE:</span>
                  <span className="text-slate-900 font-semibold">{new Date(po.createdAt).toLocaleDateString('en-ZA')}</span>
                </div>
                {po.linkedRequestNumber && (
                  <div className="flex justify-between sm:justify-end gap-4 font-mono">
                    <span className="text-slate-500">LINKED REQ:</span>
                    <span className="text-amber-600 font-bold">{po.linkedRequestNumber}</span>
                  </div>
                )}
                <div className="flex justify-between sm:justify-end gap-4 font-mono">
                  <span className="text-slate-500">STATUS:</span>
                  <span className="font-bold text-slate-900 uppercase">{po.status}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Supplier & Delivery Address Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 po-avoid-break">
            {/* Vendor / Supplier Info */}
            <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50 space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-700 border-b border-slate-200 pb-1 flex items-center justify-between">
                <span>VENDOR / SUPPLIER DETAILS</span>
                <span className="font-mono text-[10px] text-slate-500">{po.supplierCode || 'SUP'}</span>
              </h3>
              <div className="text-xs text-slate-800 space-y-1 font-medium">
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
              <div className="text-xs text-slate-800 space-y-1 font-medium">
                <p className="font-black text-sm text-slate-900 uppercase">
                  {branch?.branchName || po.branchName || 'TS Joinery Workshop'}
                </p>
                <p className="font-medium text-slate-700">{po.deliveryAddress || branch?.physicalAddress || companyInfo.physicalAddress}</p>
                {cleanedInstructions && (
                  <p className="mt-2 text-[11px] text-slate-700 bg-amber-50/60 p-2 rounded border border-amber-200/60">
                    <span className="font-bold text-amber-900">Delivery Notes:</span> {cleanedInstructions}
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

            <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-black uppercase tracking-wider text-[10px] print:bg-slate-900 print:text-white print:table-header-group">
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
                    const prodDesc = item.productName || item.productDescription || 'Product';
                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50 font-medium po-avoid-break print:break-inside-avoid">
                        <td className="p-3 text-center text-slate-500 font-mono font-bold">{idx + 1}</td>
                        <td className="p-3">
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block font-mono">Product:</span>
                            <p className="font-bold text-slate-900 uppercase text-xs">{prodDesc}</p>
                            {item.productDescription && item.productDescription !== item.productName && (
                              <p className="text-[11px] text-slate-600">{item.productDescription}</p>
                            )}
                            {item.location && <p className="text-[10px] text-slate-500">Bin Location: {item.location}</p>}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-slate-700">
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block font-mono">Code:</span>
                            <p className="font-bold text-purple-800 text-xs">{item.internalProductCode || item.productId}</p>
                            {item.kanbanId && <p className="text-[10px] text-indigo-600 font-bold">Kanban: {item.kanbanId}</p>}
                            {item.supplierPartNumber && item.supplierPartNumber !== 'N/A' && (
                              <p className="text-[10px] text-slate-500">Supplier Part: {item.supplierPartNumber}</p>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center uppercase text-slate-600 font-bold">{item.unit || 'ea'}</td>
                        <td className="p-3 text-right font-black font-mono text-slate-900 text-sm">{item.orderQuantity}</td>
                        <td className="p-3 text-right font-mono text-slate-700">
                          {price > 0 ? `R ${price.toFixed(2)}` : '—'}
                        </td>
                        <td className="p-3 text-right font-black font-mono text-slate-900 text-sm">
                          {total > 0 ? `R ${total.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals & Terms Summary */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2 po-avoid-break">
            <div className="text-xs text-slate-600 space-y-1 max-w-md">
              <p className="font-bold text-slate-900 uppercase">Standard Purchase Terms & Conditions:</p>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 text-slate-500">
                <li>PO number must appear on all invoices, delivery notes, and packaging.</li>
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
                <span className="text-amber-700">
                  {(po.estimatedTotalValue && po.estimatedTotalValue > 0) ? `R ${po.estimatedTotalValue.toFixed(2)}` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Signatures & Authorisations Section */}
          <div className="pt-6 border-t-2 border-slate-200 grid grid-cols-2 gap-8 text-xs po-avoid-break">
            <div className="space-y-6">
              <div>
                <p className="font-bold text-slate-500 uppercase text-[10px]">PREPARED BY:</p>
                <p className="font-black text-slate-900 text-sm mt-1">{po.createdUser}</p>
                <p className="text-[10px] text-slate-500 font-mono">{new Date(po.createdAt).toLocaleDateString('en-ZA')}</p>
              </div>
              <div className="border-b border-slate-400 w-48" />
              <p className="text-[10px] text-slate-500 uppercase">Authorized Requisitioner Signature</p>
            </div>

            <div className="space-y-6">
              <div>
                <p className="font-bold text-slate-500 uppercase text-[10px]">APPROVED & AUTHORIZED BY:</p>
                <p className="font-black text-emerald-800 text-sm mt-1">
                  {po.status === 'Approved' ? (po.approvedBy || 'Authorized Approver') : 'Pending Approval'}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {po.approvedAt ? new Date(po.approvedAt).toLocaleDateString('en-ZA') : '(Not yet approved)'}
                </p>
              </div>
              <div className="border-b border-slate-400 w-48" />
              <p className="text-[10px] text-slate-500 uppercase">Procurement Approval Signature</p>
            </div>
          </div>

          {/* Minimal Document Footer */}
          <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500 font-mono po-avoid-break">
            <span>PO #{po.poNumber}</span>
            <span>TS Joinery ERP • Official Procurement Document</span>
            <span>Printed: {new Date().toLocaleDateString('en-ZA')}</span>
          </div>

          {/* Collapsible Internal Audit History (Screen Only - Hidden in Print) */}
          {po.auditTrail && po.auditTrail.length > 0 && (
            <div className="no-print print:hidden pt-4 border-t border-slate-200 text-xs">
              <button
                onClick={() => setShowInternalAudit(!showInternalAudit)}
                className="text-gray-500 hover:text-slate-800 font-bold uppercase text-[10px] flex items-center gap-1.5"
              >
                <Icon name={showInternalAudit ? "chevron-down" : "chevron-right"} size={14} />
                <span>{showInternalAudit ? "Hide Internal Audit Trail" : "View Internal Audit Trail (System Only)"}</span>
              </button>

              {showInternalAudit && (
                <div className="mt-3 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-[11px] font-mono text-slate-600">
                  {po.auditTrail.map((aud, idx) => (
                    <div key={idx} className="flex justify-between border-b border-slate-100 pb-1 last:border-none">
                      <span className="font-bold text-slate-800">{aud.timestamp.split('T')[0]} - {aud.action} ({aud.user})</span>
                      <span className="text-slate-500">{aud.notes}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
