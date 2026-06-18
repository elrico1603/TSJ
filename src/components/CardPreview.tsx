import React, { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { Icon } from './Icon';
import { KanbanTemplate, KanbanCardData } from '../types';

interface StructuredSection1LayoutProps {
  cardData: KanbanCardData;
  sampleImage?: string | null;
}

export const StructuredSection1Layout: React.FC<StructuredSection1LayoutProps> = ({ cardData, sampleImage }) => {
  const { partDescription, supplierPartNumber, supplier, orderQuantity, deliveryTime, location, productImage } = cardData || {};
  const imageSrc = sampleImage || productImage;

  const textStyle: React.CSSProperties = { color: 'black', wordBreak: 'break-word' };
  const headerStyle: React.CSSProperties = { ...textStyle, backgroundColor: '#D8E8C8', borderBottom: '1px solid black' };
  const tableCellStyle: React.CSSProperties = { ...textStyle, backgroundColor: '#F5F2DC' };
  const tableLabelStyle: React.CSSProperties = { ...tableCellStyle, borderRight: '1px solid black' };

  return (
    <div className="w-full h-full grid grid-rows-[15%_65%_20%] text-black bg-white overflow-hidden" style={{ border: '1px solid black' }}>
      {/* Row 1: Header */}
      <div className="flex items-center justify-center text-center font-bold uppercase p-1" style={headerStyle}>
        <span style={textStyle}>{partDescription || 'EXAMPLE KANBAN : LAMINATING POUCH'}</span>
      </div>

      {/* Row 2: Content */}
      <div className="grid grid-cols-[38%_62%]" style={{ borderBottom: '1px solid black' }}>
        {/* Image Area */}
        <div className="flex items-center justify-center p-1" style={{ borderRight: '1px solid black' }}>
          {imageSrc ? <img src={imageSrc} alt="Product" className="w-full h-full object-contain" /> : <Icon name="camera" size={32} className="text-gray-400" />}
        </div>
        {/* Info Table */}
        <div className="grid grid-rows-4 text-xs">
          <div className="grid grid-cols-[40%_60%] border-b border-black">
            <div className="font-bold p-1 flex items-center" style={tableLabelStyle}><span style={textStyle}>SUPPLIER P/NO.</span></div>
            <div className="p-1 flex items-center" style={tableCellStyle}><span style={textStyle}>{supplierPartNumber || ''}</span></div>
          </div>
          <div className="grid grid-cols-[40%_60%] border-b border-black">
            <div className="font-bold p-1 flex items-center" style={tableLabelStyle}><span style={textStyle}>SUPPLIER</span></div>
            <div className="p-1 flex items-center" style={tableCellStyle}><span style={textStyle}>{supplier || ''}</span></div>
          </div>
          <div className="grid grid-cols-[40%_60%] border-b border-black">
            <div className="font-bold p-1 flex items-center" style={tableLabelStyle}><span style={textStyle}>ORDER QTY</span></div>
            <div className="p-1 flex items-center" style={tableCellStyle}><span style={textStyle}>{orderQuantity || ''}</span></div>
          </div>
          <div className="grid grid-cols-[40%_60%]">
            <div className="font-bold p-1 flex items-center" style={tableLabelStyle}><span style={textStyle}>DELIVERY TIME</span></div>
            <div className="p-1 flex items-center" style={tableCellStyle}><span style={textStyle}>{deliveryTime || ''}</span></div>
          </div>
        </div>
      </div>

      {/* Row 3: Footer */}
      <div className="grid grid-cols-3 text-xs">
        <div className="font-bold p-1 flex items-center" style={{ borderRight: '1px solid black' }}>
          <span style={textStyle}>LOCATION : {location || 'XXXXXXX'}</span>
        </div>
        <div className="font-bold p-1 flex items-center" style={{ borderRight: '1px solid black' }}>
          <span style={textStyle}>DELIVERY TIME</span>
        </div>
        <div className="p-1 flex items-center">
          <span style={textStyle}>{deliveryTime || 'NEXT DAY'}</span>
        </div>
      </div>
    </div>
  );
};

interface CardPreviewProps {
  template: KanbanTemplate;
  setTemplate: React.Dispatch<React.SetStateAction<KanbanTemplate | null>>;
  activeField: string | null;
  setActiveField: React.Dispatch<React.SetStateAction<string | null>>;
  sampleImage: string | null;
}

export const CardPreview: React.FC<CardPreviewProps> = ({ template, setTemplate, activeField, setActiveField, sampleImage }) => {
  const { dimensions, layout } = template;
  const { margin, sectionGap } = dimensions;
  const [dragOverSection, setDragOverSection] = useState<string | null>(null);

  // Calculate total dimensions to determine aspect ratio
  const totalWidthMm = Math.max(
    (layout.section1?.width || 0) + (layout.section2?.width || 0) + (sectionGap || 0),
    (layout.section3?.width || 0) + (layout.section4?.width || 0) + (sectionGap || 0),
    (layout.section5?.width || 0)
  );

  const totalHeightMm = (Math.max(layout.section1?.height || 0, layout.section2?.height || 0)) +
                        (Math.max(layout.section3?.height || 0, layout.section4?.height || 0)) +
                        (layout.section5?.height || 0) +
                        ((sectionGap || 0) * 2);

  const aspect = totalWidthMm / (totalHeightMm || 1);
  const previewHeight = 650; // Max height for the preview area
  const previewWidth = previewHeight * aspect;

  const scaleFactor = previewHeight / (totalHeightMm || 1);
  const mmToPx = (mm: number) => (mm || 0) * scaleFactor;

  const addFieldToSection = (sectionKey: string, fieldType: string, x: number, y: number) => {
    setTemplate((prev: any) => {
      if (!prev) return null;
      const newLayout = JSON.parse(JSON.stringify(prev.layout));
      const defaultWidth = 40;
      const defaultHeight = 25;
      const newField = {
        id: `field_${Date.now()}`,
        type: fieldType,
        visible: true,
        x: Math.max(0, x - (defaultWidth / 2)),
        y: Math.max(0, y - (defaultHeight / 2)),
        width: defaultWidth,
        height: defaultHeight,
        fontSize: 12,
        fontWeight: 'normal',
        value: fieldType === 'customText' ? 'Custom Text' : undefined
      };
      if (!newLayout[sectionKey].fields) {
        newLayout[sectionKey].fields = [];
      }
      newLayout[sectionKey].fields.push(newField);
      return { ...prev, layout: newLayout };
    });
  };

  const updateField = (sectionKey: string, fieldId: string, updates: Record<string, any>) => {
    setTemplate((prev: any) => {
      if (!prev) return null;
      const newLayout = JSON.parse(JSON.stringify(prev.layout));
      const fields = newLayout[sectionKey].fields || [];
      const fieldIndex = fields.findIndex((f: any) => f.id === fieldId);
      if (fieldIndex > -1) {
        fields[fieldIndex] = { ...fields[fieldIndex], ...updates };
      }
      return { ...prev, layout: newLayout };
    });
  };

  const renderField = (field: any, sectionKey: string, parentWidth: number, parentHeight: number) => {
    let content: React.ReactNode = `[${field.type}]`;
    if (field.type === 'productImage') {
      content = sampleImage 
        ? <img src={sampleImage} alt="Sample" className="w-full h-full object-contain" />
        : <Icon name="camera" size={32} className="text-white/20" />;
    }
    if (field.type === 'qrCode') {
      content = (
        <div className="w-full h-full bg-white p-1">
          <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${field.sourceField || 'PN-12345'}`} 
            className="w-full h-full object-contain" 
            alt="QR Code"
          />
        </div>
      );
    }
    if (field.type === 'customText') {
      content = field.value || 'Custom Text';
    }
    const isSelected = activeField === field.id;

    return (
      <Rnd
        key={field.id}
        size={{ width: `${field.width}%`, height: `${field.height}%` }}
        position={{ x: (field.x / 100) * parentWidth, y: (field.y / 100) * parentHeight }}
        onDragStop={(e, d) => {
          updateField(sectionKey, field.id, { x: (d.x / parentWidth) * 100, y: (d.y / parentHeight) * 100 });
        }}
        onResizeStop={(e, direction, ref, delta, position) => {
          updateField(sectionKey, field.id, {
            width: (parseInt(ref.style.width, 10) / parentWidth) * 100,
            height: (parseInt(ref.style.height, 10) / parentHeight) * 100,
            x: (position.x / parentWidth) * 100,
            y: (position.y / parentHeight) * 100
          });
        }}
        onClick={(e) => {
          e.stopPropagation();
          setActiveField(field.id);
        }}
        className={`flex items-center justify-center overflow-hidden p-1 transition-all duration-200 ${isSelected ? 'border-2 border-purple-500 shadow-2xl shadow-purple-500/50 z-50 bg-purple-500/10' : 'border border-dashed border-white/20'}`}
        bounds="parent"
      >
        <div 
          className="text-xs text-center w-full h-full flex items-center justify-center pointer-events-none" 
          style={{ fontSize: `${field.fontSize || 10}px`, fontWeight: field.fontWeight || 'normal', color: field.fontColor || 'white' }}
        >
          {content}
        </div>
      </Rnd>
    );
  };
  
  const Section = ({ sectionKey, className = "" }: { sectionKey: string; className?: string }) => {
    const sectionRef = useRef<HTMLDivElement>(null);
    const [dims, setDims] = useState({ width: 0, height: 0 });

    const sectionLayout = (layout as any)[sectionKey];
    const sectionWidthPx = mmToPx(sectionLayout?.width);
    const sectionHeightPx = mmToPx(sectionLayout?.height);

    useEffect(() => {
      if (sectionRef.current) {
        if (sectionKey === 'section1') return;
        setDims({ width: sectionWidthPx, height: sectionHeightPx });
      }
    }, [sectionWidthPx, sectionHeightPx]);
    
    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    };

    if (sectionKey === 'section1') {
      const previewData: KanbanCardData = {
        partDescription: 'EXAMPLE KANBAN : LAMINATING POUCH',
        supplierPartNumber: 'SPN-98765',
        supplier: 'Sample Supplier Inc.',
        orderQuantity: '100',
        deliveryTime: '5 Days',
        location: 'Aisle 5, Bin 3',
      };
      return (
        <div className={`relative overflow-hidden rounded-lg ${className}`} style={{ width: `${sectionWidthPx}px`, height: `${sectionHeightPx}px` }}>
          <StructuredSection1Layout cardData={previewData} sampleImage={sampleImage} />
        </div>
      );
    }

    const handleDragEnter = (e: React.DragEvent) => {
      e.preventDefault();
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data.sourceSection === sectionKey) {
          setDragOverSection(sectionKey);
        }
      } catch (err) { /* Do nothing if data is invalid */ }
    };

    const handleDragLeave = () => setDragOverSection(null);

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverSection(null);
      try {
        const dataStr = e.dataTransfer.getData('application/json');
        if (!dataStr) return;
        const data = JSON.parse(dataStr);
        if (data.sourceSection !== sectionKey) return;

        if (sectionRef.current) {
          const rect = sectionRef.current.getBoundingClientRect();
          const dropX = ((e.clientX - rect.left) / rect.width) * 100;
          const dropY = ((e.clientY - rect.top) / rect.height) * 100;
          addFieldToSection(sectionKey, data.fieldType, dropX, dropY);
        }
      } catch (err) {
        console.warn("Drop failed:", err);
      }
    };

    const isDragOver = dragOverSection === sectionKey;
    const currentSectionLayout = (layout as any)[sectionKey] || { fields: [] };

    return (
      <div
        ref={sectionRef}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`bg-black/30 rounded-lg relative overflow-hidden p-2 transition-all ${className} ${isDragOver ? 'border-2 border-purple-500 bg-purple-500/10' : 'border-2 border-transparent'}`}
        style={{ width: `${sectionWidthPx}px`, height: `${sectionHeightPx}px` }}
      >
        <span className="absolute top-1 left-2 text-[8px] text-white/20 font-mono">{sectionKey.replace('section', '')}</span>
        {sectionKey === 'section4' && currentSectionLayout.style && (
          <div style={{ 
            fontSize: `${currentSectionLayout.style.fontSize || 24}px`, 
            color: currentSectionLayout.style.fontColor || '#FF0000', 
            backgroundColor: currentSectionLayout.style.backgroundColor || '#FFFF00', 
            border: `${currentSectionLayout.style.borderWidth || 2}px solid ${currentSectionLayout.style.borderColor || '#000000'}`, 
            fontWeight: 'bold', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%', 
            width: '100%', 
            textAlign: 'center' 
          }}>
            {currentSectionLayout.style.text}
          </div>
        )}
        {(currentSectionLayout.fields || []).filter((f: any) => f.visible).map((field: any) => renderField(field, sectionKey, dims.width, dims.height))}
      </div>
    );
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-[#151515]/50">
      <div className="p-4 bg-black/20 rounded-3xl shadow-2xl" style={{ width: `${previewWidth + 32}px` }}>
        <div style={{
          width: `${previewWidth}px`,
          height: `${previewHeight}px`,
          padding: `${mmToPx(margin)}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: `${mmToPx(sectionGap)}px`,
          boxSizing: 'content-box'
        }}>
          <div className="flex" style={{ gap: `${mmToPx(sectionGap)}px` }}>
            <Section sectionKey="section1" />
            <Section sectionKey="section2" />
          </div>
          <div className="flex" style={{ gap: `${mmToPx(sectionGap)}px` }}>
            <Section sectionKey="section3" />
            <Section sectionKey="section4" />
          </div>
          <Section sectionKey="section5" />
        </div>
      </div>
    </div>
  );
};
