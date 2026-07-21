import React, { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { Icon } from './Icon';
import { KanbanTemplate, KanbanCardData } from '../types';
import { getKanbanMailtoQRCodeUrl } from '../services/kanbanService';
import { QRCodeRenderer } from './QRCodeRenderer';

interface StructuredSection1LayoutProps {
  cardData: KanbanCardData;
  sampleImage?: string | null;
}

export const StructuredSection1Layout: React.FC<StructuredSection1LayoutProps> = ({ cardData, sampleImage }) => {
  const productDesc = cardData?.productDescription || cardData?.partDescription || 'EXAMPLE KANBAN CARD';
  const imgUrl = sampleImage || cardData?.imageUrl || cardData?.productImage;
  const supPartNo = cardData?.supplierPartNumber || cardData?.partNumber || 'N/A';
  const supName = cardData?.supplierName || cardData?.supplier || 'N/A';
  const ordQty = cardData?.orderQuantity || '0';
  const binQty = cardData?.binQuantity || '1 Bin';
  const delTime = cardData?.deliveryTime || 'NEXT DAY';
  const kId = cardData?.kanbanId || 'KAN-000000';

  // Format location
  let locStr = 'N/A';
  if (cardData?.location && typeof cardData.location === 'object') {
    const l = cardData.location;
    locStr = `${l.letter || ''}${l.number || ''} ${l.colour || ''}`.trim();
  } else {
    locStr = cardData?.locationRaw || (typeof cardData?.location === 'string' ? cardData.location : 'N/A');
  }

  const textStyle: React.CSSProperties = { color: 'black', wordBreak: 'break-word' };
  const headerStyle: React.CSSProperties = { ...textStyle, backgroundColor: '#D8E8C8', borderBottom: '1px solid black' };
  const tableCellStyle: React.CSSProperties = { ...textStyle, backgroundColor: '#F5F2DC' };
  const tableLabelStyle: React.CSSProperties = { ...tableCellStyle, borderRight: '1px solid black' };

  return (
    <div className="w-full h-full grid grid-rows-[15%_65%_20%] text-black bg-white overflow-hidden" style={{ border: '1px solid black' }}>
      {/* Row 1: Header */}
      <div className="flex items-center justify-between font-bold uppercase px-3 py-1" style={headerStyle}>
        <span className="text-[10px] truncate" style={textStyle}>{productDesc}</span>
        <span className="text-[10px] font-mono font-black text-purple-700 bg-purple-50 px-2 py-0.5 border border-purple-200 rounded">{kId}</span>
      </div>

      {/* Row 2: Content */}
      <div className="grid grid-cols-[38%_62%]" style={{ borderBottom: '1px solid black' }}>
        {/* Image Area */}
        <div className="flex items-center justify-center p-1" style={{ borderRight: '1px solid black' }}>
          {imgUrl ? <img src={imgUrl} alt="Product" className="w-full h-full object-contain" /> : <Icon name="camera" size={32} className="text-gray-400" />}
        </div>
        {/* Info Table */}
        <div className="grid grid-rows-4 text-xs">
          <div className="grid grid-cols-[40%_60%] border-b border-black">
            <div className="font-bold p-1 flex items-center" style={tableLabelStyle}><span style={textStyle}>SUPPLIER P/NO.</span></div>
            <div className="p-1 flex items-center" style={tableCellStyle}><span style={textStyle}>{supPartNo}</span></div>
          </div>
          <div className="grid grid-cols-[40%_60%] border-b border-black">
            <div className="font-bold p-1 flex items-center" style={tableLabelStyle}><span style={textStyle}>SUPPLIER</span></div>
            <div className="p-1 flex items-center" style={tableCellStyle}><span style={textStyle}>{supName}</span></div>
          </div>
          <div className="grid grid-cols-[40%_60%] border-b border-black">
            <div className="font-bold p-1 flex items-center" style={tableLabelStyle}><span style={textStyle}>ORD / BIN QTY</span></div>
            <div className="p-1 flex items-center font-bold" style={tableCellStyle}><span style={textStyle}>{ordQty} (Bin: {binQty})</span></div>
          </div>
          <div className="grid grid-cols-[40%_60%]">
            <div className="font-bold p-1 flex items-center" style={tableLabelStyle}><span style={textStyle}>DELIVERY TIME</span></div>
            <div className="p-1 flex items-center" style={tableCellStyle}><span style={textStyle}>{delTime}</span></div>
          </div>
        </div>
      </div>

      {/* Row 3: Footer */}
      <div className="grid grid-cols-3 text-[10px]">
        <div className="font-bold p-1 flex items-center" style={{ borderRight: '1px solid black' }}>
          <span style={textStyle}>LOCATION : {locStr}</span>
        </div>
        <div className="font-bold p-1 flex items-center" style={{ borderRight: '1px solid black' }}>
          <span style={textStyle}>DELIVERY TIME</span>
        </div>
        <div className="p-1 flex items-center">
          <span style={textStyle}>{delTime}</span>
        </div>
      </div>
    </div>
  );
};

interface InventoryDetailsSectionLayoutProps {
  cardData: KanbanCardData;
}

export const InventoryDetailsSectionLayout: React.FC<InventoryDetailsSectionLayoutProps> = ({ cardData }) => {
  const supPartNo = cardData?.supplierPartNumber || cardData?.partNumber || '';
  const ordQty = cardData?.orderQuantity || '';
  const binQty = cardData?.binQuantity || '';
  const notesText = cardData?.notes || '';
  const kanbanId = cardData?.kanbanId || 'KAN-000000';
  const reorderPoint = cardData?.reorderPoint || '2 BINS';
  const contactDetails = cardData?.contactDetails || 'janah@tsjoinery.co.za';
  const reorderInfo = cardData?.reorderInfo || 'ORDER STOCK WHEN 1 BIN EMPTY';

  let locStr = 'N/A';
  if (cardData?.location && typeof cardData.location === 'object') {
    const l = cardData.location;
    locStr = `${l.letter || ''}${l.number || ''} ${l.colour || ''}`.trim();
  } else {
    locStr = cardData?.locationRaw || (typeof cardData?.location === 'string' ? cardData.location : 'N/A');
  }

  const textStyle: React.CSSProperties = { color: 'black', wordBreak: 'break-word' };
  const headerStyle: React.CSSProperties = { ...textStyle, backgroundColor: '#3B82F6', color: 'white', borderBottom: '1px solid black' };
  const cellStyle: React.CSSProperties = { ...textStyle, backgroundColor: '#EFF6FF' };

  return (
    <div className="w-full h-full grid grid-rows-[20%_80%] text-black bg-white overflow-hidden" style={{ border: '1px solid black' }}>
      {/* Header */}
      <div className="flex items-center justify-center text-center font-bold uppercase p-1 font-sans" style={headerStyle}>
        <span className="text-[10px] font-black tracking-wide">INVENTORY REORDER SHEET: {kanbanId}</span>
      </div>
      {/* Grid of details */}
      <div className="grid grid-cols-2 text-[10px] h-full font-sans">
        <div className="p-2 border-r border-b border-black flex flex-col justify-between" style={cellStyle}>
          <span className="font-extrabold text-[8px] text-blue-600 uppercase tracking-tight">Reorder Point / Bin</span>
          <span className="font-bold text-xs mt-0.5 leading-none">{ordQty} (Bin: {binQty})</span>
        </div>
        <div className="p-2 border-b border-black flex flex-col justify-between" style={cellStyle}>
          <span className="font-extrabold text-[8px] text-blue-600 uppercase tracking-tight">Storage Location</span>
          <span className="font-bold text-xs mt-0.5 leading-none">{locStr}</span>
        </div>
        <div className="p-2 border-r border-black flex flex-col justify-between" style={cellStyle}>
          <span className="font-extrabold text-[8px] text-blue-600 uppercase tracking-tight">Supplier Contacts</span>
          <span className="text-[9px] font-bold mt-0.5 leading-tight truncate">{contactDetails}</span>
          <span className="text-[7px] text-gray-400 truncate mt-0.5">{reorderInfo}</span>
        </div>
        <div className="p-2 flex flex-col justify-between" style={cellStyle}>
          <span className="font-extrabold text-[8px] text-blue-600 uppercase tracking-tight">Instructions & Notes</span>
          <span className="text-[8px] mt-0.5 text-gray-700 leading-tight italic line-clamp-2">{notesText || 'Verify stock levels before order submission.'}</span>
        </div>
      </div>
    </div>
  );
};

interface QRBarcodeSectionLayoutProps {
  cardData: KanbanCardData;
}

export const QRBarcodeSectionLayout: React.FC<QRBarcodeSectionLayoutProps> = ({ cardData }) => {
  const productDesc = cardData?.productDescription || cardData?.partDescription || 'LAMINATING POUCH';
  const kId = cardData?.kanbanId || 'KAN-000001';

  let locStr = 'N/A';
  if (cardData?.location && typeof cardData.location === 'object') {
    const l = cardData.location;
    locStr = `${l.letter || ''}${l.number || ''} ${l.colour || ''}`.trim();
  } else {
    locStr = cardData?.locationRaw || (typeof cardData?.location === 'string' ? cardData.location : 'N/A');
  }

  const supPartNo = cardData?.supplierPartNumber || cardData?.partNumber || '';
  const supName = cardData?.supplierName || cardData?.supplier || '';
  const ordQty = cardData?.orderQuantity || '';
  const binQty = cardData?.binQuantity || '1 Bin';
  const delTime = cardData?.deliveryTime || '';

  const qrCodeUrl = getKanbanMailtoQRCodeUrl({
    internalProductNumber: kId,
    productName: productDesc,
    supplierPartNumber: supPartNo,
    supplier: supName,
    orderQuantity: ordQty,
    binQuantity: binQty,
    location: locStr,
    deliveryTime: delTime,
  });

  return (
    <div className="w-full h-full grid grid-cols-[35%_65%] text-black bg-white overflow-hidden" style={{ border: '1px solid black' }}>
      {/* Left side: QR Code containing mailto link */}
      <div className="flex flex-col items-center justify-center p-1.5 bg-white border-r border-black font-sans">
        <QRCodeRenderer
          text={qrCodeUrl}
          size={48}
          className="flex items-center justify-center animate-fade-in"
        />
        <span className="text-[6px] font-mono mt-1 tracking-wider leading-none text-center truncate w-full">{kId}</span>
      </div>
      {/* Right side: Barcode & Quick Info */}
      <div className="flex flex-col justify-between p-2.5 bg-neutral-50 font-sans">
        <div>
          <h4 className="text-[8px] font-black text-gray-400 uppercase tracking-wider leading-none">Kanban Scan Target</h4>
          <p className="font-black text-[11px] text-neutral-800 leading-tight uppercase mt-1 truncate">{productDesc}</p>
        </div>
        
        {/* Mock Barcode */}
        <div className="flex flex-col items-center mt-1">
          <div className="w-full h-6 flex items-end justify-center gap-[1px]">
            {[2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 1, 3, 2, 4, 1, 2, 1, 3, 1].map((width, i) => (
              <div key={i} className="bg-black h-full" style={{ width: `${width}px` }} />
            ))}
          </div>
          <p className="text-[8px] font-mono tracking-wider text-center mt-1 leading-none">{locStr}</p>
        </div>
      </div>
    </div>
  );
};

interface StatusBadgeSectionLayoutProps {
  sectionLayout: any;
}

export const StatusBadgeSectionLayout: React.FC<StatusBadgeSectionLayoutProps> = ({ sectionLayout }) => {
  const style = sectionLayout?.style || {};
  const text = style.text || "PULLED";
  const fontSize = style.fontSize || 18;
  const fontColor = style.fontColor || '#FFFFFF';
  const backgroundColor = style.backgroundColor || '#EF4444';
  const borderWidth = style.borderWidth || 0;
  const borderColor = style.borderColor || '#000000';

  return (
    <div style={{ 
      fontSize: `${fontSize}px`, 
      color: fontColor, 
      backgroundColor: backgroundColor, 
      border: borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : 'none', 
      fontWeight: 'bold', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100%', 
      width: '100%', 
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      fontFamily: 'Inter, sans-serif'
    }}>
      {text}
    </div>
  );
};

interface CardPreviewProps {
  template: KanbanTemplate;
  setTemplate: React.Dispatch<React.SetStateAction<KanbanTemplate | null>>;
  activeField: string | null;
  setActiveField: React.Dispatch<React.SetStateAction<string | null>>;
  sampleImage: string | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const sanitizeTemplateLayout = (template: KanbanTemplate): KanbanTemplate => {
  const t = JSON.parse(JSON.stringify(template));
  
  if (!t.dimensions) {
    t.dimensions = { width: 210, height: 297, margin: 5, sectionGap: 3 };
  }
  t.dimensions.width = 210;
  t.dimensions.height = 297;

  const defaults: Record<string, { x: number; y: number; width: number; height: number }> = {
    section1: { x: 5, y: 10, width: 95, height: 80 },
    section2: { x: 110, y: 10, width: 95, height: 80 },
    section3: { x: 5, y: 100, width: 95, height: 80 },
    section4: { x: 110, y: 100, width: 95, height: 80 },
    section5: { x: 5, y: 190, width: 200, height: 90 },
  };

  if (!t.layout) {
    t.layout = {} as any;
  }

  for (const key of ['section1', 'section2', 'section3', 'section4', 'section5']) {
    const section = (t.layout as any)[key];
    if (!section) {
      (t.layout as any)[key] = {
        width: defaults[key].width,
        height: defaults[key].height,
        x: defaults[key].x,
        y: defaults[key].y,
        fields: []
      };
    } else {
      if (section.width === undefined || section.width === 0) section.width = defaults[key].width;
      if (section.height === undefined || section.height === 0) section.height = defaults[key].height;
      if (section.x === undefined) section.x = defaults[key].x;
      if (section.y === undefined) section.y = defaults[key].y;
    }
  }

  return t;
};

export const CardPreview: React.FC<CardPreviewProps> = ({ 
  template, 
  setTemplate, 
  activeTab, 
  setActiveTab 
}) => {
  const { layout } = template;

  // Enforce sanitization on load if missing x/y positions
  useEffect(() => {
    const needsSanitization = template.dimensions.width !== 210 ||
                              template.dimensions.height !== 297 ||
                              !layout.section1 || layout.section1.x === undefined ||
                              !layout.section2 || layout.section2.x === undefined ||
                              !layout.section3 || layout.section3.x === undefined ||
                              !layout.section4 || layout.section4.x === undefined ||
                              !layout.section5 || layout.section5.x === undefined;
    
    if (needsSanitization) {
      const sanitized = sanitizeTemplateLayout(template);
      setTemplate(sanitized);
    }
  }, [template, setTemplate, layout]);

  // A4 Page Sizing
  const previewHeight = 720; // Perfect visual size for the viewports
  const previewWidth = Math.round(previewHeight * (210 / 297)); // ~509px
  const scaleFactor = previewHeight / 297; // px per mm

  const mmToPx = (mm: number) => (mm || 0) * scaleFactor;
  const pxToMm = (px: number) => Math.round(px / scaleFactor);

  const updateSectionLayout = (sectionKey: string, updates: { x?: number; y?: number; width?: number; height?: number }) => {
    setTemplate((prev: any) => {
      if (!prev) return null;
      const newLayout = JSON.parse(JSON.stringify(prev.layout));
      newLayout[sectionKey] = { ...newLayout[sectionKey], ...updates };
      return { ...prev, layout: newLayout };
    });
  };

  const sectionsList = ['section1', 'section2', 'section3', 'section4', 'section5'];

  const sectionMeta: Record<string, { label: string; bg: string; border: string; text: string; ring: string }> = {
    section1: { label: 'Section 1', bg: 'bg-blue-600/10 hover:bg-blue-600/20', border: 'border-blue-500/40', text: 'text-blue-400', ring: 'ring-blue-500' },
    section2: { label: 'Section 2', bg: 'bg-amber-600/10 hover:bg-amber-600/20', border: 'border-amber-500/40', text: 'text-amber-400', ring: 'ring-amber-500' },
    section3: { label: 'Section 3', bg: 'bg-emerald-600/10 hover:bg-emerald-600/20', border: 'border-emerald-500/40', text: 'text-emerald-400', ring: 'ring-emerald-500' },
    section4: { label: 'Section 4', bg: 'bg-rose-600/10 hover:bg-rose-600/20', border: 'border-rose-500/40', text: 'text-rose-400', ring: 'ring-rose-500' },
    section5: { label: 'Section 5', bg: 'bg-fuchsia-600/10 hover:bg-fuchsia-600/20', border: 'border-fuchsia-500/40', text: 'text-fuchsia-400', ring: 'ring-fuchsia-500' },
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#151515]/30 overflow-y-auto select-none">
      
      {/* Canvas Meta Header */}
      <div className="mb-4 text-center">
        <span className="px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">
          📐 A4 Portrait Workspace (210mm × 297mm)
        </span>
        <p className="text-[10px] text-gray-500 mt-2 font-sans">
          Click, drag or resize any section below to customize your Kanban layout.
        </p>
      </div>

      {/* A4 Portrait Frame Container */}
      <div 
        className="relative bg-white rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border border-neutral-200 overflow-hidden"
        style={{ 
          width: `${previewWidth}px`, 
          height: `${previewHeight}px` 
        }}
      >
        {/* Decorative Grid Mesh */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
          backgroundSize: '10px 10px'
        }} />

        {/* Outer margin guideline */}
        <div 
          className="absolute inset-4 border border-dashed border-gray-300 pointer-events-none flex items-start justify-between p-1"
          style={{ margin: '15px' }}
        >
          <span className="text-[7px] text-gray-400 font-mono">PRINTABLE MARGIN (15mm)</span>
          <span className="text-[7px] text-gray-400 font-mono">A4 Portrait Canvas</span>
        </div>

        {/* 5 Absolutely Positioned Resizable & Draggable Layout Sections */}
        {sectionsList.map((key) => {
          const section = (layout as any)[key] || { width: 95, height: 80, x: 5, y: 10 };
          const meta = sectionMeta[key];
          const isSelected = activeTab === key;

          const widthMm = section.width || 0;
          const heightMm = section.height || 0;
          const xMm = section.x ?? 0;
          const yMm = section.y ?? 0;

          return (
            <Rnd
              key={key}
              size={{ 
                width: mmToPx(widthMm), 
                height: mmToPx(heightMm) 
              }}
              position={{ 
                x: mmToPx(xMm), 
                y: mmToPx(yMm) 
              }}
              bounds="parent"
              onDragStop={(e, d) => {
                const newX = pxToMm(d.x);
                const newY = pxToMm(d.y);
                updateSectionLayout(key, { x: newX, y: newY });
                setActiveTab(key);
              }}
              onResizeStop={(e, direction, ref, delta, position) => {
                const newW = pxToMm(parseInt(ref.style.width, 10));
                const newH = pxToMm(parseInt(ref.style.height, 10));
                const newX = pxToMm(position.x);
                const newY = pxToMm(position.y);
                updateSectionLayout(key, { 
                  width: newW, 
                  height: newH, 
                  x: newX, 
                  y: newY 
                });
                setActiveTab(key);
              }}
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab(key);
              }}
              className={`rounded-xl border-2 transition-all duration-150 backdrop-blur-[1px] flex flex-col justify-between overflow-hidden cursor-grab active:cursor-grabbing ${meta.bg} ${meta.border} ${
                isSelected 
                  ? 'ring-4 ring-offset-2 ring-purple-600 shadow-2xl z-50 scale-[1.01]' 
                  : 'z-20 hover:scale-[1.005]'
              }`}
            >
              <div className={`w-full h-full flex flex-col justify-between p-3 ${meta.text}`}>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black tracking-widest uppercase bg-black/60 px-2.5 py-1 rounded-md text-white font-sans shadow-sm border border-white/5">
                    {meta.label}
                  </span>
                  {isSelected && (
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping" />
                  )}
                </div>

                <div className="space-y-1 text-center bg-white/90 p-2.5 rounded-xl border border-neutral-200/50 shadow-md text-neutral-800">
                  <p className="text-xs font-black tracking-tight font-sans">
                    {widthMm}mm × {heightMm}mm
                  </p>
                  <p className="text-[9px] font-bold text-gray-500 font-mono tracking-tighter">
                    X: {xMm}mm , Y: {yMm}mm
                  </p>
                </div>

                <div className="text-[8px] font-black text-center uppercase tracking-widest opacity-50 font-sans">
                  {isSelected ? 'SELECTED & ACTIVE' : 'DRAG / RESIZE'}
                </div>
              </div>
            </Rnd>
          );
        })}
      </div>
    </div>
  );
};
