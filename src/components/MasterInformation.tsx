import React from 'react';
import { KanbanCardMaster } from '../services/kanbanService';
import { ProductImageWidget } from './ProductImageWidget';
import { MasterInformation as MasterInfoType } from '../types';
import { QRCodeRenderer } from './QRCodeRenderer';

interface MasterInformationProps {
  cardData?: KanbanCardMaster;
  masterInfo?: MasterInfoType;
  borderWidth?: number; // mm
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'none';
  backgroundColor?: string;
  cornerRadius?: number; // mm
  padding?: number; // mm
  fontSizeScale?: number; // 0.8 to 1.5 multiplier
  width?: number; // mm
  height?: number; // mm
}

const getColourBg = (colour: string) => {
  const norm = (colour || 'GREEN').toUpperCase().trim();
  if (norm === 'RED') return '#ef4444';
  if (norm === 'BLUE') return '#2563eb';
  if (norm === 'GREEN') return '#10b981';
  if (norm === 'YELLOW') return '#facc15';
  if (norm === 'ORANGE') return '#f97316';
  if (norm === 'PURPLE') return '#8b5cf6';
  return '#4b5563';
};

const getColourText = (colour: string) => {
  const norm = (colour || 'GREEN').toUpperCase().trim();
  if (norm === 'YELLOW') return '#000000';
  return '#ffffff';
};

/**
 * MasterInformation section displaying core product description, specs, ordering criteria,
 * delivery benchmarks, and QR code representation. Fully responsive with auto-layout bounds.
 */
export const MasterInformation: React.FC<MasterInformationProps> = ({
  cardData,
  masterInfo,
  borderWidth = 0.5,
  borderColor = '#000000',
  borderStyle = 'solid',
  backgroundColor = '#ffffff',
  cornerRadius = 2,
  padding = 4,
  fontSizeScale = 1.0,
  width,
  height
}) => {
  // Source values directly from Master Information (single source of truth)
  // fall back to cardData representation if masterInfo is not provided (e.g. for card print templates)
  const pName = masterInfo ? masterInfo.productName : (cardData?.productDescription || '');
  const pId = masterInfo ? masterInfo.internalProductNumber : (cardData?.kanbanId || '');
  const pImage = masterInfo ? masterInfo.productImage : (cardData?.imageUrl || '');
  const pQrCode = masterInfo ? masterInfo.qrCode : (cardData?.qrCodeUrl || '');
  const pSupplierPartNumber = masterInfo ? masterInfo.supplierPartNumber : (cardData?.supplierPartNumber || '');
  const pSupplierName = masterInfo ? masterInfo.supplier : (cardData?.supplierName || '');
  const pOrderQuantity = masterInfo ? masterInfo.orderQuantity : (cardData?.orderQuantity || '');
  const pDeliveryTime = masterInfo ? masterInfo.deliveryTime : (cardData?.deliveryTime || '');
  
  // Location variables
  const fallbackLocation = cardData?.location ? `${cardData.location.letter || ''}${cardData.location.number || ''}`.trim() : '';
  const fallbackLocationColour = cardData?.location?.colour || 'GREEN';
  const pLocation = masterInfo ? masterInfo.location : fallbackLocation;
  const pLocationColour = masterInfo ? masterInfo.locationColour : fallbackLocationColour;

  // Responsive scaling based on width & height (reference height is 60mm, width is 180mm)
  const wScale = width ? (width / 180) : 1.0;
  const hScale = height ? (height / 60) : 1.0;
  const scale = Math.min(wScale, hScale) * (fontSizeScale || 1.0);

  // Responsive bound font sizes to prevent overlapping
  const titleFontSize = Math.max(7, Math.min(20, 11 * scale));
  const subTitleFontSize = Math.max(5, Math.min(11, 7 * scale));
  const specFontSize = Math.max(6, Math.min(13.5, 8.5 * scale));
  const specLabelFontSize = Math.max(5, Math.min(10.5, 7 * scale));
  const badgeFontSize = Math.max(7.5, Math.min(16, 11 * scale));

  // Cap dynamic padding so it doesn't take too much height in narrow boxes
  const finalPadding = height ? Math.max(1, Math.min(padding, height * 0.12)) : padding;

  const containerStyle: React.CSSProperties = {
    border: borderStyle !== 'none' ? `${borderWidth}mm ${borderStyle} ${borderColor}` : 'none',
    backgroundColor: backgroundColor,
    borderRadius: `${cornerRadius}mm`,
    padding: `${finalPadding}mm`,
    width: '100%',
    height: '100%',
    boxSizing: 'border-box'
  };

  const textStyle: React.CSSProperties = {
    color: '#000000',
    wordBreak: 'break-word',
    fontFamily: 'Inter, sans-serif'
  };

  return (
    <div 
      style={containerStyle} 
      className="flex flex-col h-full w-full justify-between overflow-hidden text-black select-none font-sans"
    >
      {/* 1. PRODUCT NAME: Top area of Section 1 */}
      <div 
        className="w-full flex flex-col border-b border-black/10 pb-1 shrink-0"
        style={{ marginBottom: `${Math.max(1, 3 * scale)}px` }}
      >
        <div className="flex justify-between items-start w-full gap-2">
          <span className="text-neutral-400 font-extrabold uppercase tracking-widest leading-none" style={{ fontSize: `${subTitleFontSize}px` }}>
            DESCRIPTION / PART
          </span>
          <span 
            className="font-mono font-black text-purple-700 bg-purple-50 px-1.5 py-0.5 border border-purple-200 rounded uppercase leading-none shrink-0"
            style={{ fontSize: `${subTitleFontSize + 1}px` }}
          >
            {pId || 'N/A'}
          </span>
        </div>
        <div 
          className="font-extrabold text-neutral-900 mt-1 uppercase leading-tight w-full break-words line-clamp-2"
          style={{ 
            ...textStyle,
            fontSize: `${titleFontSize}px`,
          }}
        >
          {pName || 'NO PRODUCT NAME'}
        </div>
      </div>

      {/* 2. MAIN CONTENT: Three responsive columns below the Product Name using a 3-column CSS Grid */}
      <div className="grid grid-cols-[30%_45%_25%] items-stretch justify-between flex-1 min-h-0 w-full gap-2 py-1 overflow-hidden">
        
        {/* COLUMN 1: Product Image */}
        <div className="h-full w-full flex items-center justify-center overflow-hidden">
          <ProductImageWidget 
            imageUrl={pImage} 
            altText={pName}
            className="h-full w-full max-h-full max-w-full aspect-square rounded border border-neutral-200 bg-white object-contain"
          />
        </div>

        {/* COLUMN 2: Supplier Information */}
        <div 
          className="h-full flex flex-col justify-between text-neutral-800 min-w-0 divide-y divide-black/10 overflow-hidden"
          style={{ fontSize: `${specFontSize}px` }}
        >
          {/* Row 1: Sup No: */}
          <div className="flex-1 min-h-0 flex items-center justify-between py-0.5 gap-1 font-sans">
            <span className="font-extrabold uppercase text-neutral-400 tracking-tight shrink-0" style={{ fontSize: `${specLabelFontSize}px` }}>
              Sup No:
            </span>
            <span className="font-bold text-neutral-950 truncate text-right flex-1 min-w-0 font-sans" style={{ ...textStyle, fontSize: `${specFontSize}px` }}>
              {pSupplierPartNumber || 'N/A'}
            </span>
          </div>

          {/* Row 2: Sup Name: */}
          <div className="flex-1 min-h-0 flex items-center justify-between py-0.5 gap-1 font-sans">
            <span className="font-extrabold uppercase text-neutral-400 tracking-tight shrink-0" style={{ fontSize: `${specLabelFontSize}px` }}>
              Sup Name:
            </span>
            <span className="font-bold text-neutral-950 truncate text-right flex-1 min-w-0 font-sans" style={{ ...textStyle, fontSize: `${specFontSize}px` }}>
              {pSupplierName || 'N/A'}
            </span>
          </div>

          {/* Row 3: Order Qty: */}
          <div className="flex-1 min-h-0 flex items-center justify-between py-0.5 gap-1 font-sans">
            <span className="font-extrabold uppercase text-neutral-400 tracking-tight shrink-0" style={{ fontSize: `${specLabelFontSize}px` }}>
              Order Qty:
            </span>
            <span className="font-black text-purple-700 text-right flex-1 min-w-0 font-sans" style={{ fontSize: `${specFontSize}px` }}>
              {pOrderQuantity || '0'}
            </span>
          </div>

          {/* Row 4: Delivery: */}
          <div className="flex-1 min-h-0 flex items-center justify-between py-0.5 gap-1 font-sans">
            <span className="font-extrabold uppercase text-neutral-400 tracking-tight shrink-0" style={{ fontSize: `${specLabelFontSize}px` }}>
              Delivery:
            </span>
            <span className="font-bold text-emerald-600 uppercase text-right flex-1 min-w-0 font-sans" style={{ ...textStyle, fontSize: `${specFontSize}px` }}>
              {pDeliveryTime || 'N/A'}
            </span>
          </div>
        </div>

        {/* COLUMN 3: QR Code */}
        <div className="h-full w-full flex items-center justify-center overflow-hidden bg-white p-0.5 border border-neutral-200 rounded max-h-full max-w-full aspect-square mx-auto">
          {pQrCode ? (
            <QRCodeRenderer
              text={pQrCode}
              responsive={true}
              className="w-full h-full max-h-full max-w-full flex items-center justify-center"
            />
          ) : (
            <div className="text-[6px] text-neutral-400 italic font-mono uppercase text-center">NO QR</div>
          )}
        </div>
      </div>

      {/* 3. LOCATION BADGE: Single full-width location badge at the bottom */}
      <div 
        className="w-full text-center font-black text-white tracking-widest uppercase transition-all shrink-0"
        style={{ 
          backgroundColor: getColourBg(pLocationColour),
          color: getColourText(pLocationColour),
          fontSize: `${badgeFontSize}px`,
          paddingTop: `${Math.max(2, 4.5 * scale)}px`,
          paddingBottom: `${Math.max(2, 4.5 * scale)}px`,
          paddingLeft: `${Math.max(4, 10 * scale)}px`,
          paddingRight: `${Math.max(4, 10 * scale)}px`,
          borderRadius: `${Math.max(2, 6 * scale)}px`,
          lineHeight: '1.1',
          marginTop: `${Math.max(1.5, 3.5 * scale)}px`
        }}
      >
        {pLocation || 'NO LOCATION'}
      </div>
    </div>
  );
};
