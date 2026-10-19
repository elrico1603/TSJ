import React, { useState, useEffect } from 'react';
import { PurchaseOrder, Supplier } from '../types';
import { Icon } from './Icon';
import { supplierService, DEFAULT_PO_MESSAGE } from '../services/supplierService';
import { purchaseOrderService } from '../services/purchaseOrderService';
import { generatePurchaseOrderPdfBase64 } from '../services/purchaseOrderPdfService';
import { gmailClientService, GoogleConnectionStatus } from '../services/gmailClientService';
import { canSendLiveGmail } from '../services/previewSafety';

interface SendPurchaseOrderModalProps {
  po: PurchaseOrder;
  currentUser?: any;
  onClose: () => void;
  onSent?: () => void;
  announce?: (msg: string) => void;
}

export const SendPurchaseOrderModal: React.FC<SendPurchaseOrderModalProps> = ({
  po,
  currentUser,
  onClose,
  onSent,
  announce
}) => {
  // Supplier Master Resolution
  const [supplier, setSupplier] = useState<Supplier | null>(null);

  // Form Fields
  const [toEmail, setToEmail] = useState('');
  const [ccList, setCcList] = useState<string[]>([]);
  const [newCcInput, setNewCcInput] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // PDF payload state
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(true);

  // Google OAuth Connection State
  const [googleStatus, setGoogleStatus] = useState<GoogleConnectionStatus>({
    connected: false,
    googleEmail: null,
    canSend: false
  });
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  // Send Execution State
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);

  // Preview Safety Check
  const liveGmailAvailable = canSendLiveGmail();

  // 1. Initial Resolution from Supplier Master & PO
  useEffect(() => {
    // Resolve supplier canonically by supplierId
    const suppliers = supplierService.getLocalSuppliers();
    const resolvedSupplier = suppliers.find(
      s => (po.supplierId && (s.id === po.supplierId || s.supplierId === po.supplierId)) ||
           s.supplierName.toLowerCase() === (po.supplierName || '').toLowerCase()
    );

    setSupplier(resolvedSupplier || null);

    // Prefill fields
    const recipient = resolvedSupplier?.poEmail || resolvedSupplier?.email || po.supplierEmail || '';
    setToEmail(recipient);

    const initialCcs = resolvedSupplier?.poCcEmails && resolvedSupplier.poCcEmails.length > 0
      ? [...resolvedSupplier.poCcEmails]
      : [];
    setCcList(initialCcs);

    setSubject(`Purchase Order ${po.poNumber} — TS Joinery & Timber Works`);

    const defaultMsg = resolvedSupplier?.defaultPOMessage || DEFAULT_PO_MESSAGE;
    setMessage(defaultMsg);

    // 2. Generate PDF Base64 attachment in memory
    setIsGeneratingPdf(true);
    generatePurchaseOrderPdfBase64(po)
      .then(b64 => {
        setPdfBase64(b64);
      })
      .catch(err => {
        console.error('Failed to pre-generate PO PDF:', err);
      })
      .finally(() => {
        setIsGeneratingPdf(false);
      });

    // 3. Check for pending OAuth notices and Google Workspace OAuth Session Status
    const notice = gmailClientService.getAuthNotice();
    if (notice) {
      if (notice.type === 'error') {
        setSendError(`Google Workspace authorization failed: ${notice.message}`);
      } else if (notice.type === 'success') {
        setSendSuccessMessage(notice.message);
      }
      gmailClientService.clearAuthNotice();
    }

    const employeeEmail = currentUser?.email || 'elrico@tsjoinery.co.za';
    setIsCheckingStatus(true);
    gmailClientService
      .checkGoogleStatus(employeeEmail)
      .then(status => {
        setGoogleStatus(status);
      })
      .finally(() => {
        setIsCheckingStatus(false);
      });
  }, [po, currentUser?.email]);

  // CC Address Management
  const handleAddCc = () => {
    const trimmed = newCcInput.trim().toLowerCase();
    if (!trimmed) return;
    if (!trimmed.includes('@')) {
      setSendError('Please enter a valid email address.');
      return;
    }
    if (ccList.includes(trimmed)) {
      setNewCcInput('');
      return;
    }
    setCcList([...ccList, trimmed]);
    setNewCcInput('');
    setSendError(null);
  };

  const handleRemoveCc = (index: number) => {
    setCcList(ccList.filter((_, idx) => idx !== index));
  };

  // Google OAuth Authorization Trigger
  const handleConnectGoogle = async () => {
    const employeeEmail = currentUser?.email || 'elrico@tsjoinery.co.za';
    setIsConnectingGoogle(true);
    setSendError(null);

    try {
      const authUrl = await gmailClientService.getAuthorizeUrl(employeeEmail);
      // Navigate to Google OAuth consent screen
      window.location.href = authUrl;
    } catch (err: any) {
      setIsConnectingGoogle(false);
      setSendError(err.message || 'Failed to initiate Google authorization.');
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      const employeeEmail = currentUser?.email || 'elrico@tsjoinery.co.za';
      await gmailClientService.disconnectGoogle(employeeEmail);
      setGoogleStatus({ connected: false, googleEmail: null, canSend: false });
      if (announce) announce('Google Workspace disconnected.');
    } catch (err: any) {
      console.warn('Disconnect warning:', err);
    }
  };

  // Dispatch Purchase Order Email
  const handleSendPO = async () => {
    if (!liveGmailAvailable) {
      setSendError('Live Google Workspace sending is blocked in Preview environment to protect live suppliers.');
      return;
    }

    if (!googleStatus.connected || !googleStatus.googleEmail) {
      setSendError('Please connect your TS Joinery Google Workspace account before sending.');
      return;
    }

    if (!toEmail || !toEmail.includes('@')) {
      setSendError('Valid recipient email address (To) is required.');
      return;
    }

    if (!subject.trim()) {
      setSendError('Email subject line is required.');
      return;
    }

    if (!message.trim()) {
      setSendError('Email message body is required.');
      return;
    }

    if (!pdfBase64) {
      setSendError('Purchase Order PDF is still generating. Please try again in a moment.');
      return;
    }

    setIsSending(true);
    setSendError(null);

    try {
      const result = await gmailClientService.sendPurchaseOrder({
        employeeEmail: currentUser?.email || googleStatus.googleEmail,
        to: toEmail.trim(),
        cc: ccList,
        subject: subject.trim(),
        message: message.trim(),
        poNumber: po.poNumber,
        pdfFileName: `PO-${po.poNumber}.pdf`,
        pdfBase64
      });

      // Update PO Status to 'Sent' and record audit entry
      await purchaseOrderService.updatePOStatus(
        po.id,
        'Sent',
        currentUser,
        `Sent via Gmail (${result.gmailMessageId}) to ${toEmail}`
      );

      setSendSuccessMessage('Purchase Order sent successfully.');
      if (announce) announce(`Purchase Order ${po.poNumber} sent successfully.`);

      if (onSent) onSent();

      // Close modal after brief success presentation
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('Failed to send PO email:', err);
      setSendError(err.message || 'Failed to send Purchase Order via Gmail API.');
    } finally {
      setIsSending(false);
    }
  };

  const pdfAttachmentName = `PO-${po.poNumber}.pdf`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-[#151515] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh]">
        
        {/* Header Bar */}
        <div className="p-4 bg-[#1f1f1f] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Icon name="mail" size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider font-mono">
                Send Purchase Order
              </h2>
              <p className="text-xs text-gray-400 font-medium">
                PO: <span className="text-indigo-400 font-bold">{po.poNumber}</span> • Supplier: <span className="text-white font-bold">{po.supplierName}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSending}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-all"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-gray-300">
          
          {/* Preview Safety Warning Banner */}
          {!liveGmailAvailable && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-bold flex items-center gap-2.5">
              <Icon name="alert-triangle" size={18} className="shrink-0 text-amber-400" />
              <span>Google Workspace sending is unavailable in Preview. Live Gmail sending is active in production.</span>
            </div>
          )}

          {/* Missing Supplier PO Email Warning */}
          {(!supplier?.poEmail && !toEmail) && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="alert-circle" size={16} className="text-red-400 shrink-0" />
                <span>Supplier PO email is not configured in Supplier Master.</span>
              </div>
              <span className="text-[10px] text-gray-400">Enter manually below</span>
            </div>
          )}

          {/* Google Workspace Connection UX */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className={`w-3 h-3 rounded-full ${googleStatus.connected ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-gray-500'}`} />
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Google Workspace Sender</span>
                  {googleStatus.connected ? (
                    <span className="text-xs font-black text-emerald-400 font-mono">
                      Connected: {googleStatus.googleEmail}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">
                      Not connected (requires authorized @tsjoinery.co.za account)
                    </span>
                  )}
                </div>
              </div>

              <div>
                {googleStatus.connected ? (
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-lg text-[11px] font-bold uppercase transition-all"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnectGoogle}
                    disabled={isConnectingGoogle || isCheckingStatus}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
                  >
                    <Icon name="user-check" size={14} />
                    <span>{isConnectingGoogle ? 'Connecting...' : 'Connect Google Workspace'}</span>
                  </button>
                )}
              </div>
            </div>

            {!googleStatus.connected && (
              <p className="text-[11px] text-gray-400">
                Connect your TS Joinery Google Workspace account to send Purchase Orders through Gmail.
              </p>
            )}
          </div>

          {/* Email Composition Form */}
          <div className="space-y-4">
            
            {/* Recipient (To) */}
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">
                To (Supplier PO Email) <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={toEmail}
                onChange={e => setToEmail(e.target.value)}
                placeholder="orders@supplier.co.za"
                className="w-full bg-[#111111] border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-400 font-mono"
              />
            </div>

            {/* CC List */}
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">
                CC Email(s)
              </label>

              {/* Tag Pills */}
              {ccList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {ccList.map((cc, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[11px] font-mono text-gray-300"
                    >
                      {cc}
                      <button
                        type="button"
                        onClick={() => handleRemoveCc(idx)}
                        className="text-gray-400 hover:text-red-400 transition-colors ml-1"
                      >
                        <Icon name="x" size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add CC Input */}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newCcInput}
                  onChange={e => setNewCcInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCc();
                    }
                  }}
                  placeholder="Add CC email (press Enter or Add)..."
                  className="flex-1 bg-[#111111] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-400 font-mono"
                />
                <button
                  type="button"
                  onClick={handleAddCc}
                  className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase transition-all"
                >
                  Add CC
                </button>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">
                Subject <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Purchase Order subject line..."
                className="w-full bg-[#111111] border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-400"
              />
            </div>

            {/* Message Body */}
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">
                Message Body <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={5}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Write your email message..."
                className="w-full bg-[#111111] border border-white/15 rounded-xl p-3.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-400 font-sans leading-relaxed resize-none"
              />
            </div>

            {/* Automated PDF Attachment Badge */}
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">
                Attached Document
              </label>
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Icon name="file-text" size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white font-mono block">{pdfAttachmentName}</span>
                    <span className="text-[10px] text-gray-400">
                      {isGeneratingPdf ? 'Compiling PDF document...' : 'Official Phase 3 Vector A4 PDF ready for attachment'}
                    </span>
                  </div>
                </div>

                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {isGeneratingPdf ? 'Generating...' : 'Attached'}
                </span>
              </div>
            </div>

          </div>

          {/* Feedback Messages */}
          {sendError && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs font-bold flex items-center gap-2">
              <Icon name="alert-triangle" size={16} className="text-red-400 shrink-0" />
              <span>{sendError}</span>
            </div>
          )}

          {sendSuccessMessage && (
            <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-black flex items-center gap-2">
              <Icon name="check-circle" size={18} className="text-emerald-400 shrink-0" />
              <span>{sendSuccessMessage}</span>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#1f1f1f] border-t border-white/10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-xl text-xs font-bold uppercase transition-all"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSendPO}
            disabled={isSending || isGeneratingPdf || !googleStatus.connected || !toEmail || !liveGmailAvailable}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg"
          >
            <Icon name="send" size={16} />
            <span>{isSending ? 'Sending via Gmail...' : 'Send Purchase Order'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
