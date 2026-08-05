import React from 'react';
import { KanbanCardMaster } from '../services/kanbanService';
import { ProductImageWidget } from './ProductImageWidget';
import { MasterInformation as MasterInfoType } from '../types';
import { TextCustomizationSettings } from '../services/templateService';
import { applyTextSettings } from '../utils/textStyleHelper';

interface WarehouseDisplayProps {
  cardData?: KanbanCardMaster;
  masterInfo?: MasterInfoType;
  borderWidth?: number; // mm
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'none';
  backgroundColor?: string;
  cornerRadius?: number; // mm
  padding?: number; // mm
  fontSizeScale?: number;
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
 * WarehouseDisplay (Section 4) displaying Product Name at the top,
 * Product Image in the middle, and Location Badge at the bottom (NO QR code!).
 * Fully responsive and layout-guaranteed across all container heights and widths.
 */
export const WarehouseDisplay: React.FC<WarehouseDisplayProps> = ({
  cardData,
  masterInfo,
  borderWidth = 0.5,
  borderColor = '#000000',
  borderStyle = 'solid',
  backgroundColor = '#ffffff',
  cornerRadius = 2,
  padding = 3,
  fontSizeScale = 1.0,
  width,
  height,
  textSettings
}) => {
  // Extract read-only properties directly from Master Information (single source of truth)
  // fall back to cardData representation if masterInfo is not provided (e.g. for card print templates)
  const pName = masterInfo ? masterInfo.productName : (cardData?.productDescription || '');
  const pImage = masterInfo ? masterInfo.productImage : (cardData?.imageUrl || '');
  const pLocation = masterInfo ? masterInfo.location : (`${cardData?.location?.letter || ''}${cardData?.location?.number || ''}`.trim() || '');
  const pLocationColour = masterInfo ? masterInfo.locationColour : (cardData?.location?.colour || 'GREEN');

  // Responsive scaling based on width & height (reference height is 35mm, width is 180mm)
  const wScale = width ? (width / 180) : 1.0;
  const hScale = height ? (height / 35) : 1.0;
  const scale = Math.min(wScale, hScale) * (fontSizeScale || 1.0);

  // Responsive bound font sizes to prevent overlapping
  const titleFontSize = Math.max(6.5, Math.min(18, 10.5 * scale));
  const subTitleFontSize = Math.max(5, Math.min(10, 6.5 * scale));
  const badgeFontSize = Math.max(8, Math.min(18, 11 * scale));

  const finalPadding = padding ?? 5;
  const hasBorder = borderStyle && borderStyle !== 'none' && (borderWidth || 0) > 0;

  const containerStyle: React.CSSProperties = {
    border: hasBorder ? `${borderWidth}mm ${borderStyle} ${borderColor || '#000000'}` : 'none',
    backgroundColor: backgroundColor || '#ffffff',
    borderRadius: `${cornerRadius ?? 4}mm`,
    padding: `${finalPadding}mm`,
    width: '100%',
    height: '100%',
    boxSizing: 'border-box'
  };

  return (
    <div 
      style={containerStyle} 
      className="flex flex-col h-full w-full justify-between overflow-hidden text-black select-none font-sans"
    >
      {/* 1. At the very top: Display the Product Name (Read-only) */}
      <div 
        className="w-full flex flex-col border-b border-black/10 pb-0.5 shrink-0"
        style={{ marginBottom: `${Math.max(1.5, 3.5 * scale)}px` }}
      >
        <span 
          className="text-neutral-400 font-extrabold uppercase tracking-widest leading-none mb-0.5" 
          style={applyTextSettings(textSettings?.headerEyebrow, { fontSize: `${subTitleFontSize}px` })}
        >
          PRODUCT NAME
        </span>
        <div 
          className="font-extrabold text-neutral-900 uppercase leading-tight w-full break-words line-clamp-2"
          style={applyTextSettings(textSettings?.productName, { 
            fontSize: `${titleFontSize}px`,
            fontFamily: 'Inter, sans-serif'
          })}
        >
          {pName || 'NO PRODUCT NAME'}
        </div>
      </div>

      {/* 2. Middle area: Split Product Image (left) and empty space (right) */}
      <div className="flex flex-row items-stretch justify-between w-full flex-1 min-h-0 gap-2 font-sans overflow-hidden py-1">
        {/* Left side: Product Image */}
        <div className="w-[35%] h-full flex items-center justify-center min-w-0 overflow-hidden">
          <ProductImageWidget 
            imageUrl={pImage} 
            altText={pName}
            className="max-h-full max-w-full object-contain bg-white border border-neutral-200 rounded"
          />
        </div>

        {/* Right side: (empty for now) */}
        <div className="w-[60%] h-full flex flex-col justify-center items-center min-w-0 overflow-hidden" />
      </div>

      {/* 3. Bottom of Section: Location display with the selected Location Colour (Read-only) */}
      <div 
        className="w-full text-center font-black text-white tracking-widest uppercase transition-all shrink-0"
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
          marginTop: `${Math.max(1.5, 3.5 * scale)}px`
        })}
      >
        {pLocation || 'NO LOCATION'}
      </div>
    </div>
  );
};
