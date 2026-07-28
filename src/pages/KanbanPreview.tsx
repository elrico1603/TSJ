import React, { useRef } from 'react';
import { Icon } from '../components/Icon';
import { KanbanTemplateV2 } from '../services/templateService';
import { KanbanCardMaster } from '../services/kanbanService';
import { StandardTemplate } from '../templates/StandardTemplate';
import { SingleCardTemplate } from '../templates/SingleCardTemplate';
import { WarehouseTemplate } from '../templates/WarehouseTemplate';

interface KanbanPreviewProps {
  template: KanbanTemplateV2;
  cardData: KanbanCardMaster;
  onClose: () => void;
  announce: (message: string) => void;
}

/**
 * KanbanPreview page renders pixel-perfect high-fidelity layouts for standard print jobs,
 * triggering the native window print utility styled dynamically.
 */
export const KanbanPreview: React.FC<KanbanPreviewProps> = ({
  template,
  cardData,
  onClose,
  announce
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Formulate custom CSS for the print-media page sizes dynamically
  const getPrintStyles = () => {
    return `
      @media print {
        @page {
          size: A4 portrait;
          margin: 0 !important;
        }
        html, body {
          background-color: #ffffff !important;
          color: #000000 !important;
          margin: 0 !important;
          padding: 0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          width: 100% !important;
          height: 100% !important;
          overflow: visible !important;
        }
        body {
          visibility: hidden !important;
        }
        #printCanvas, #printCanvas * {
          visibility: visible !important;
        }
        #printCanvas {
          display: block !important;
          position: fixed !important;
          left: 0 !important;
          top: 0 !important;
          width: 210mm !important;
          height: 297mm !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          box-shadow: none !important;
          background: white !important;
          border-radius: 0 !important;
          z-index: 9999999 !important;
          page-break-after: avoid !important;
        }
        .no-print {
          display: none !important;
          visibility: hidden !important;
        }
      }
    `;
  };

  const handlePrint = () => {
    // Dynamically insert style override block to enforce page guidelines
    const styleEl = document.createElement('style');
    styleEl.innerHTML = getPrintStyles();
    document.head.appendChild(styleEl);

    // Call browser spooler
    window.print();

    // Cleanup
    document.head.removeChild(styleEl);
    announce('Dispatched print job spooler.');
  };

  // Select layout engine based on blueprint specification or defaults
  const renderTemplateEngine = () => {
    const name = template.templateName.toLowerCase();
    if (name.includes('single') || template.sections.length === 1) {
      return <SingleCardTemplate cardData={cardData} template={template} previewHeight={1000} />;
    }
    if (name.includes('warehouse') || name.includes('bay')) {
      return <WarehouseTemplate cardData={cardData} template={template} previewHeight={1000} />;
    }
    return <StandardTemplate cardData={cardData} template={template} previewHeight={1000} />;
  };

  const isLandscape = template.orientation === 'Landscape';

  return (
    <div className="fixed inset-0 z-[1100] bg-black/95 backdrop-blur-xl flex flex-col font-sans overflow-hidden">
      {/* 1. Header Toolbar (Hidden during print) */}
      <header className="no-print h-16 border-b border-white/10 px-6 bg-[#121212] flex justify-between items-center text-white">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
          >
            <Icon name="arrow-left" size={18} />
          </button>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-white">
              Print Dispatch Spooler
            </h2>
            <p className="text-[10px] text-gray-400">
              Template: <strong className="text-orange-400">{template.templateName}</strong> ({template.paperSize} {template.orientation})
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
      <div className="flex-1 overflow-y-auto p-12 flex flex-col items-center bg-[#0d0d0d]/40 custom-scrollbar select-none">
        
        {/* Printable Guidelines Indicator */}
        <div className="no-print mb-6 text-center max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-600/15 border border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">
            <Icon name="check-circle" size={12} /> Layout Calibrated
          </div>
          <p className="text-xs text-gray-400">
            Below is the precise page sheet representation. For absolute precision, ensure your print spooler setting has **Margins set to "None"** and **Scale set to 100% (Default)**.
          </p>
        </div>

        {/* Scaled Print Page container (Print engine maps to exact millimeters inside media stylesheets) */}
        <div 
          ref={printAreaRef}
          id="printCanvas"
          className="print-canvas relative bg-white shadow-2xl overflow-hidden rounded-md border border-neutral-300"
          style={{
            width: isLandscape ? '1000px' : '707px', // A4 aspect-ratio (210/297) mapped visually
            height: isLandscape ? '707px' : '1000px'
          }}
        >
          {/* Outer Margin Guidelines frame (hidden during print) */}
          <div 
            className="no-print absolute border border-dashed border-neutral-300 pointer-events-none flex justify-between p-1.5"
            style={{
              left: `${template.margins * (1000 / 297)}px`,
              right: `${template.margins * (1000 / 297)}px`,
              top: `${template.margins * (1000 / 297)}px`,
              bottom: `${template.margins * (1000 / 297)}px`
            }}
          >
            <span className="text-[7px] text-gray-400 font-mono">PRINTABLE MARGIN ({template.margins}mm)</span>
            <span className="text-[7px] text-gray-400 font-mono">A4 Sheet Frame</span>
          </div>

          {/* Core render engine container */}
          <div className="w-full h-full relative" style={{ transform: isLandscape ? 'rotate(-90deg) scale(0.707)' : 'none', transformOrigin: 'center' }}>
            {renderTemplateEngine()}
          </div>
        </div>
      </div>
    </div>
  );
};
