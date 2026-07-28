import React from 'react';
import { KanbanCardMaster } from '../services/kanbanService';
import { ProductImageWidget } from './ProductImageWidget';
import { MasterInformation as MasterInfoType } from '../types';
import { QRCodeWidget } from './QRCodeWidget';
import { TextCustomizationSettings } from '../services/templateService';
import { applyTextSettings } from '../utils/textStyleHelper';

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
  textSettings?: Record<string, TextCustomizationSettings>;
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
  height,
  textSettings
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

  const finalCardColour = masterInfo?.cardColour || cardData?.cardColour || cardData?.cardColor || (cardData as any)?.cardData?.cardColour || (cardData as any)?.cardData?.cardColor || backgroundColor;

  const containerStyle: React.CSSProperties = {
    border: borderStyle !== 'none' ? `${borderWidth}mm ${borderStyle} ${borderColor}` : 'none',
    backgroundColor: finalCardColour,
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

  // Independent picture and QR layout coordinates
  const propSection = (cardData as any)?.section;
  const cardWidth = width ?? 200;
  const cardHeight = height ?? 60;
  const DESIGN_WIDTH = 200; // Baseline design width in mm

  // Designed media dimensions for BOTH Picture and QR Code
  const DESIGN_MEDIA_WIDTH = propSection?.qr?.width ?? propSection?.picture?.width ?? (cardData as any)?.qr?.width ?? (cardData as any)?.qrWidth ?? 40;
  const DESIGN_MEDIA_HEIGHT = propSection?.qr?.height ?? propSection?.picture?.height ?? (cardData as any)?.qr?.height ?? (cardData as any)?.qrHeight ?? 40;

  // Scale factor: 1.0 at or above baseline design size, scales down proportionally when smaller
  const mediaScale = Math.min(1, cardWidth / DESIGN_WIDTH);

  const mediaWidth = DESIGN_MEDIA_WIDTH * mediaScale;
  const mediaHeight = DESIGN_MEDIA_HEIGHT * mediaScale;

  const rightMargin = propSection?.qr?.rightMargin ?? (cardData as any)?.qr?.rightMargin ?? (cardData as any)?.qrRightMargin ?? 4;
  const qrGutter = 7; // Fixed 7mm whitespace gap between supplier table and QR container

  return (
    <div 
      style={containerStyle} 
      className="relative flex flex-col h-full w-full justify-between overflow-hidden text-black select-none font-sans"
    >
      {/* 1. PRODUCT NAME: Top area of Section 1 */}
      <div 
        className="flex items-center justify-between border-b border-black/10 pb-1 shrink-0 gap-2"
        style={{ 
          width: `${((cardWidth - rightMargin) / cardWidth) * 100}%`,
          marginBottom: `${Math.max(1, 3 * scale)}px` 
        }}
      >
        <div 
          className="font-extrabold text-neutral-900 uppercase leading-tight flex-1 min-w-0 break-words line-clamp-2"
          style={applyTextSettings(textSettings?.productName, { 
            ...textStyle,
            fontSize: `${titleFontSize}px`,
          })}
        >
          {pName || 'NO PRODUCT NAME'}
        </div>
        <span 
          className="font-mono font-black text-purple-700 bg-purple-50 px-1.5 py-0.5 border border-purple-200 rounded uppercase leading-none shrink-0"
          style={applyTextSettings(textSettings?.productCode, { fontSize: `${subTitleFontSize + 1}px` })}
        >
          {pId || 'N/A'}
        </span>
      </div>

      {/* 2. MAIN CONTENT: Picture & Supplier Information */}
      <div className="flex items-start justify-start flex-1 min-h-0 w-full gap-2 py-1 overflow-hidden relative">
        
        {/* COLUMN 1: Product Image */}
        <div 
          className="flex items-start justify-center overflow-hidden shrink-0"
          style={{
            width: `${(mediaWidth / cardWidth) * 100}%`,
            height: '100%',
          }}
        >
          <ProductImageWidget 
            imageUrl={pImage} 
            altText={pName}
            className="h-full w-full max-h-full max-w-full rounded border border-neutral-200 bg-white object-contain"
          />
        </div>

        {/* COLUMN 2: Supplier Information (Expands dynamically between Picture and QR with gutter) */}
        <div 
          className="h-full flex flex-col justify-between text-neutral-800 min-w-0 divide-y divide-black/10 overflow-hidden flex-1"
          style={{ 
            fontSize: `${specFontSize}px`,
            marginRight: `${((rightMargin + mediaWidth + qrGutter) / cardWidth) * 100}%` 
          }}
        >
          {/* Row 1: Sup No: */}
          <div className="flex-1 min-h-0 flex items-center justify-between py-0.5 gap-1 font-sans">
            <span 
              className="font-extrabold uppercase text-neutral-400 tracking-tight shrink-0" 
              style={applyTextSettings(textSettings?.supplierPartNoLabel, { fontSize: `${specLabelFontSize}px` })}
            >
              Sup No:
            </span>
            <span 
              className="font-bold text-neutral-950 truncate text-right flex-1 min-w-0 font-sans" 
              style={applyTextSettings(textSettings?.supplierPartNoValue, { ...textStyle, fontSize: `${specFontSize}px` })}
            >
              {pSupplierPartNumber || 'N/A'}
            </span>
          </div>

          {/* Row 2: Sup Name: */}
          <div className="flex-1 min-h-0 flex items-center justify-between py-0.5 gap-1 font-sans">
            <span 
              className="font-extrabold uppercase text-neutral-400 tracking-tight shrink-0" 
              style={applyTextSettings(textSettings?.supplierNameLabel, { fontSize: `${specLabelFontSize}px` })}
            >
              Sup Name:
            </span>
            <span 
              className="font-bold text-neutral-950 truncate text-right flex-1 min-w-0 font-sans" 
              style={applyTextSettings(textSettings?.supplierNameValue, { ...textStyle, fontSize: `${specFontSize}px` })}
            >
              {pSupplierName || 'N/A'}
            </span>
          </div>

          {/* Row 3: Order Qty: */}
          <div className="flex-1 min-h-0 flex items-center justify-between py-0.5 gap-1 font-sans">
            <span 
              className="font-extrabold uppercase text-neutral-400 tracking-tight shrink-0" 
              style={applyTextSettings(textSettings?.orderQtyLabel, { fontSize: `${specLabelFontSize}px` })}
            >
              Order Qty:
            </span>
            <span 
              className="font-black text-purple-700 text-right flex-1 min-w-0 font-sans" 
              style={applyTextSettings(textSettings?.orderQtyValue, { fontSize: `${specFontSize}px` })}
            >
              {pOrderQuantity || '0'}
            </span>
          </div>

          {/* Row 4: Delivery: */}
          <div className="flex-1 min-h-0 flex items-center justify-between py-0.5 gap-1 font-sans">
            <span 
              className="font-extrabold uppercase text-neutral-400 tracking-tight shrink-0" 
              style={applyTextSettings(textSettings?.deliveryLabel, { fontSize: `${specLabelFontSize}px` })}
            >
              Delivery:
            </span>
            <span 
              className="font-bold text-emerald-600 uppercase text-right flex-1 min-w-0 font-sans" 
              style={applyTextSettings(textSettings?.deliveryValue, { ...textStyle, fontSize: `${specFontSize}px` })}
            >
              {pDeliveryTime || 'N/A'}
            </span>
          </div>
        </div>

        {/* ABSOLUTE QR OBJECT - Positioned inside Section 2 */}
        <div 
          className="absolute flex items-start justify-center overflow-hidden z-20 pointer-events-auto py-1"
          style={{
            right: `${(rightMargin / cardWidth) * 100}%`,
            top: 0,
            bottom: 0,
            width: `${(mediaWidth / cardWidth) * 100}%`,
          }}
        >
          <QRCodeWidget
            text={pQrCode}
            altText={pName}
            className="h-full w-full max-h-full max-w-full rounded border border-neutral-200 bg-white object-contain"
          />
        </div>
      </div>

      {/* 3. LOCATION BADGE: Location badge aligned with content width */}
      <div 
        className="text-center font-black text-white tracking-widest uppercase transition-all shrink-0"
        style={applyTextSettings(textSettings?.locationBadge, { 
          backgroundColor: getColourBg(pLocationColour),
          color: getColourText(pLocationColour),
          fontSize: `${badgeFontSize}px`,
          paddingTop: `${Math.max(2, 4.5 * scale)}px`,
          paddingBottom: `${Math.max(2, 4.5 * scale)}px`,
          paddingLeft: `${Math.max(4, 10 * scale)}px`,
          paddingRight: `${Math.max(4, 10 * scale)}px`,
          borderRadius: `${Math.max(2, 6 * scale)}px`,
          lineHeight: '1.1',
          marginTop: `${Math.max(1.5, 3.5 * scale)}px`,
          width: `${((cardWidth - rightMargin) / cardWidth) * 100}%`
        })}
      >
        {pLocation || 'NO LOCATION'}
      </div>
    </div>
  );
};
