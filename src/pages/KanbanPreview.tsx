import React from 'react';
import { Icon } from '../components/Icon';
import { KanbanTemplateV2 } from '../services/templateService';
import { KanbanCardMaster } from '../services/kanbanService';
import { KanbanCardCanvas } from '../components/KanbanCardCanvas';

interface KanbanPreviewProps {
  template: KanbanTemplateV2;
  cardData: KanbanCardMaster;
  onClose: () => void;
  announce: (message: string) => void;
}

/**
 * KanbanPreview component provides a true 1:1 WYSIWYG print preview for Kanban cards.
 * Uses the exact same component tree and millimeter dimensions as the Designer Canvas.
 */
export const KanbanPreview: React.FC<KanbanPreviewProps> = ({
  template,
  cardData,
  onClose,
  announce
}) => {
  const handlePrint = () => {
    window.print();
    announce('Dispatched print job spooler.');
  };

  const marginMm = template.margins !== undefined ? template.margins : 10;

  return (
    <div className="fixed inset-0 z-[1100] bg-[#0c0c0c] flex flex-col font-sans overflow-hidden">
      {/* 1. Header Toolbar (Hidden during print) */}
      <header className="no-print h-16 border-b border-white/10 px-6 bg-[#121212] flex justify-between items-center text-white shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
            title="Back to Designer"
          >
            <Icon name="arrow-left" size={18} />
          </button>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-white">
              Print Dispatch Spooler
            </h2>
            <p className="text-[10px] text-gray-400">
              Template: <strong className="text-orange-400">{template.templateName}</strong> ({template.paperSize || 'A4'})
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2"
          >
            <Icon name="printer" size={14} /> Send to Printer / PDF
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
          >
            Close
          </button>
        </div>
      </header>

      {/* 2. Scrollable Canvas Viewport */}
      <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center custom-scrollbar">
        {/* Printable Guidelines Indicator */}
        <div className="no-print mb-6 text-center max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-600/15 border border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">
            <Icon name="check-circle" size={12} /> True WYSIWYG Print Engine
          </div>
          <p className="text-xs text-gray-400">
            Below is the exact A4 print page representation. For 100% true scale print, set browser print margins to <strong>"None"</strong> and scale to <strong>100%</strong>.
          </p>
        </div>

        {/* Print Document Area */}
        <div id="kanbanPrintArea" className="kanban-print-document">
          {/* Global print media query rules for native browser print */}
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 0 !important;
              }
              html, body {
                background: #ffffff !important;
                color: #000000 !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 210mm !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body * {
                visibility: hidden !important;
              }
              #kanbanPrintArea, #kanbanPrintArea * {
                visibility: visible !important;
              }
              #kanbanPrintArea {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 210mm !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .kanban-a4-sheet {
                box-shadow: none !important;
                border: none !important;
                width: 210mm !important;
                margin: 0 !important;
                padding: ${marginMm}mm !important;
              }
              .kanban-card-wrapper {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
              .no-print {
                display: none !important;
                visibility: hidden !important;
              }
            }
          `}</style>

          {/* Centered White A4 Sheet Container */}
          <div
            className="kanban-a4-sheet bg-white shadow-2xl relative border border-neutral-300 text-black box-sizing-border"
            style={{
              width: '210mm',
              minHeight: '297mm',
              padding: `${marginMm}mm`,
              boxSizing: 'border-box'
            }}
          >
            {/* Printable Margin Guideline (Screen only) */}
            <div
              className="no-print absolute border border-dashed border-neutral-300 pointer-events-none flex justify-between p-1"
              style={{
                left: `${marginMm}mm`,
                right: `${marginMm}mm`,
                top: `${marginMm}mm`,
                bottom: `${marginMm}mm`
              }}
            >
              <span className="text-[6px] text-gray-400 font-mono tracking-wider">PRINTABLE MARGIN ({marginMm}mm)</span>
              <span className="text-[6px] text-gray-400 font-mono tracking-wider">A4 Portrait Sheet</span>
            </div>

            {/* Stack of Cards starting inside printable margin */}
            <div className="flex flex-col gap-[5mm] relative w-full">
              <div
                className="kanban-card-wrapper"
                style={{
                  breakInside: 'avoid',
                  pageBreakInside: 'avoid'
                }}
              >
                <KanbanCardCanvas
                  template={template}
                  cardData={cardData}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
