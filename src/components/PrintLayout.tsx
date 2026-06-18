import React from 'react';
import { Icon } from './Icon';
import { StructuredSection1Layout } from './CardPreview';
import { KanbanTemplate, KanbanCardData } from '../types';

interface PrintLayoutProps {
  template: KanbanTemplate;
  cardData: KanbanCardData;
}

export const PrintLayout: React.FC<PrintLayoutProps> = ({ template, cardData }) => {
  const { dimensions, layout } = template;
  const { margin, sectionGap } = dimensions;

  const totalWidthMm = Math.max(
    (layout.section1?.width || 0) + (layout.section2?.width || 0) + (sectionGap || 0),
    (layout.section3?.width || 0) + (layout.section4?.width || 0) + (sectionGap || 0),
    (layout.section5?.width || 0)
  );
  const totalHeightMm = (Math.max(layout.section1?.height || 0, layout.section2?.height || 0)) +
                        (Math.max(layout.section3?.height || 0, layout.section4?.height || 0)) +
                        (layout.section5?.height || 0) +
                        ((sectionGap || 0) * 2);

  const renderField = (field: any) => {
    const dataValue = cardData[field.type] || (field.type === 'customText' ? field.value : `[${field.type}]`);
    let content: React.ReactNode = dataValue;

    if (field.type === 'productImage' && cardData.productImage) {
      content = <img src={cardData.productImage} className="w-full h-full object-contain" alt="Product" />;
    } else if (field.type === 'productImage') {
      content = <Icon name="camera" size={32} className="text-gray-400" />;
    }

    if (field.type === 'qrCode' && cardData.partNumber) {
      content = <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${cardData.partNumber}`} className="w-full h-full object-contain" alt="QR Code" />;
    }

    const fieldStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${field.x}%`, top: `${field.y}%`,
      width: `${field.width}%`, height: `${field.height}%`,
      fontSize: `${field.fontSize || 12}pt`,
      fontWeight: field.fontWeight || 'normal',
      color: field.fontColor || 'black',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2px',
      overflow: 'hidden',
      wordBreak: 'break-word',
      textAlign: 'center'
    };

    return <div key={field.id} style={fieldStyle}>{content}</div>;
  };

  const Section = ({ sectionKey, className = "" }: { sectionKey: string; className?: string }) => {
    const sectionLayout = (layout as any)[sectionKey];
    const sectionStyle: React.CSSProperties = {
      width: `${sectionLayout?.width || 0}mm`,
      height: `${sectionLayout?.height || 0}mm`,
    };
    return sectionKey === 'section1' ? (
      <div className={`relative ${className}`} style={sectionStyle}>
        <StructuredSection1Layout cardData={cardData} />
      </div>
    ) : (
      <div className={`relative ${className}`} style={{ ...sectionStyle, border: '1px solid #eee' }}>
        {(layout as any)[sectionKey]?.fields?.filter((f: any) => f.visible).map(renderField)}
        {sectionKey === 'section4' && (layout.section4 as any).style && (
          <div style={{ 
            fontSize: `${(layout.section4 as any).style.fontSize || 24}pt`, 
            color: (layout.section4 as any).style.fontColor || '#FF0000', 
            backgroundColor: (layout.section4 as any).style.backgroundColor || '#FFFF00', 
            border: `${(layout.section4 as any).style.borderWidth || 0}px solid ${(layout.section4 as any).style.borderColor || '#000000'}`, 
            fontWeight: 'bold', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%', 
            width: '100%', 
            textAlign: 'center' 
          }}>
            {(layout.section4 as any).style.text}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="print-wrapper fixed inset-0 z-[9999] bg-white p-4 flex items-center justify-center font-sans">
      <style>{`
        @media print {
          @page {
            size: portrait;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      <div style={{
        width: `${totalWidthMm + (margin * 2)}mm`,
        height: `${totalHeightMm + (margin * 2)}mm`,
        padding: `${margin}mm`,
        border: '1px solid black',
        background: 'white',
        color: 'black',
        display: 'flex',
        flexDirection: 'column',
        gap: `${sectionGap}mm`,
        boxSizing: 'border-box'
      }}>
        <div className="flex" style={{ gap: `${sectionGap}mm` }}>
          <Section sectionKey="section1" />
          <Section sectionKey="section2" />
        </div>
        <div className="flex" style={{ gap: `${sectionGap}mm` }}>
          <Section sectionKey="section3" />
          <Section sectionKey="section4" />
        </div>
        <div className="flex">
          <Section sectionKey="section5" />
        </div>
      </div>
    </div>
  );
};
