import React from 'react';
import { Icon } from './Icon';
import { StructuredSection1Layout, InventoryDetailsSectionLayout, QRBarcodeSectionLayout, StatusBadgeSectionLayout } from './CardPreview';
import { KanbanTemplate, KanbanCardData } from '../types';

interface PrintLayoutProps {
  template: KanbanTemplate;
  cardData: KanbanCardData;
}

export const PrintLayout: React.FC<PrintLayoutProps> = ({ template, cardData }) => {
  const { layout } = template;

  const sectionsList = ['section1', 'section2', 'section3', 'section4', 'section5'];

  const sectionColors: Record<string, string> = {
    section1: 'border-blue-600 bg-white',
    section2: 'border-amber-600 bg-white',
    section3: 'border-emerald-600 bg-white',
    section4: 'border-rose-600 bg-white',
    section5: 'border-fuchsia-600 bg-white',
  };

  return (
    <div className="print-wrapper fixed inset-0 z-[9999] bg-neutral-100 p-4 flex items-center justify-center font-sans overflow-auto">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            margin: 0;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-wrapper {
            position: absolute;
            inset: 0;
            background: white;
            padding: 0;
            margin: 0;
            display: block !important;
            z-index: 9999;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Floating printing instructions panel (only shown on screen) */}
      <div className="no-print absolute top-6 left-6 max-w-sm bg-black/90 p-6 rounded-3xl border border-white/10 text-white space-y-4 shadow-2xl backdrop-blur-xl">
        <h4 className="text-sm font-black uppercase tracking-widest text-purple-400">🖨️ A4 Print Layout Sheet</h4>
        <p className="text-xs text-gray-400 leading-relaxed font-sans">
          This printable page is styled precisely to represent a physical <strong>A4 Portrait page (210mm × 297mm)</strong>.
        </p>
        <p className="text-xs text-gray-400 leading-relaxed font-sans">
          Use this layout test printout to physically verify your slot alignments, margins, and section spacing.
        </p>
        <div className="flex gap-2">
          <button 
            onClick={() => window.print()} 
            className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all shadow-lg"
          >
            Print Sheet
          </button>
          <button 
            onClick={() => {
              const el = document.querySelector('.print-wrapper');
              if (el) el.remove();
            }} 
            className="px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold uppercase text-gray-300 transition-colors border border-white/5"
          >
            Close
          </button>
        </div>
      </div>

      {/* A4 Page Printable Sheet Container */}
      <div 
        className="bg-white shadow-2xl border border-neutral-300 relative"
        style={{
          width: '210mm',
          height: '297mm',
          boxSizing: 'border-box',
          position: 'relative',
          backgroundColor: 'white',
        }}
      >
        {/* Printable Margin Indicator Guideline */}
        <div 
          className="absolute border border-dashed border-neutral-200 pointer-events-none flex items-start justify-between p-1"
          style={{ 
            inset: '15mm',
            boxSizing: 'border-box'
          }}
        >
          <span className="text-[7px] text-neutral-300 font-mono">PRINTABLE AREA</span>
          <span className="text-[7px] text-neutral-300 font-mono">A4 Sheet Frame</span>
        </div>

        {/* Sections placed precisely based on customized (x, y) coordinates and width/height in millimeters */}
        {sectionsList.map((key) => {
          const section = (layout as any)[key] || { width: 95, height: 80, x: 5, y: 10 };

          const widthMm = section.width || 0;
          const heightMm = section.height || 0;
          const xMm = section.x ?? 0;
          const yMm = section.y ?? 0;

          // Render the high-fidelity component
          let panelContent = null;
          if (key === 'section1') {
            panelContent = <StructuredSection1Layout cardData={cardData} />;
          } else if (key === 'section2') {
            panelContent = <InventoryDetailsSectionLayout cardData={cardData} />;
          } else if (key === 'section3') {
            panelContent = <QRBarcodeSectionLayout cardData={cardData} />;
          } else if (key === 'section4' || key === 'section5') {
            if (section.style) {
              panelContent = <StatusBadgeSectionLayout sectionLayout={section} />;
            } else {
              panelContent = (
                <div className="w-full h-full flex flex-col justify-between p-3 text-black bg-[#fafafa] font-sans" style={{ border: '1px solid black' }}>
                  <div className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Notes & Guidelines</div>
                  <div className="text-xs text-neutral-800 leading-relaxed mt-2 italic flex-1 overflow-hidden">
                    {cardData.notes || 'No custom guidelines assigned.'}
                  </div>
                  <div className="text-[8px] font-bold text-gray-400 font-mono text-right mt-1">TS JOINERY KANBAN</div>
                </div>
              );
            }
          }

          return (
            <div
              key={key}
              className="absolute overflow-hidden flex flex-col justify-between"
              style={{
                left: `${xMm}mm`,
                top: `${yMm}mm`,
                width: `${widthMm}mm`,
                height: `${heightMm}mm`,
                boxSizing: 'border-box'
              }}
            >
              {panelContent}
            </div>
          );
        })}
      </div>
    </div>
  );
};
