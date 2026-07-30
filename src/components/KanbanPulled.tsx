import React from 'react';
import { KanbanCardMaster } from '../services/kanbanService';
import { MasterInformation as MasterInfoType } from '../types';
import { ProductImageWidget } from './ProductImageWidget';
import { TextCustomizationSettings } from '../services/templateService';
import { applyTextSettings } from '../utils/textStyleHelper';

interface KanbanPulledProps {
  cardData?: KanbanCardMaster;
  masterInfo?: MasterInfoType;
  binQuantity?: string;
  onBinQuantityChange?: (val: string) => void;
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
 * KanbanPulled section displaying product warnings and editable bin quantities.
 * Fully responsive and layout-guaranteed across all container heights and widths.
 */
export const KanbanPulled: React.FC<KanbanPulledProps> = ({
  cardData,
  masterInfo,
  binQuantity,
  onBinQuantityChange,
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

  // Bin quantity is specific to Section 2 and is editable.
  const currentBinQty = binQuantity !== undefined 
    ? binQuantity 
    : (masterInfo?.binQuantity !== undefined ? masterInfo.binQuantity : (cardData?.binQuantity || ''));

  // The Section 2 background must NEVER become red.
  // The background colour is controlled ONLY by the Background Colour property.
  // We sanitize the background color: if it is default red '#ef4444' or similar bright red,
  // we fallback/override it to white '#ffffff' so it NEVER starts or becomes red by default.
  const isRed = (color?: string) => {
    if (!color) return false;
    const c = color.toLowerCase().trim();
    if (c === 'red' || c === 'crimson' || c === '#ef4444' || c === '#dc2626' || c === '#f87171' || c === '#ff0000' || c === '#b91c1c' || c === '#991b1b') {
      return true;
    }
    return false;
  };
  const finalBgColor = isRed(backgroundColor) ? '#ffffff' : (backgroundColor || '#ffffff');

  // Responsive scaling based on width & height (reference height is 35mm, width is 180mm)
  const wScale = width ? (width / 180) : 1.0;
  const hScale = height ? (height / 35) : 1.0;
  // A balanced, capped scale factor for font size, padding, and spacing
  const scale = Math.min(wScale, hScale) * (fontSizeScale || 1.0);

  // Responsive bound font sizes to prevent overlapping
  const titleFontSize = textSettings?.productName?.fontSize ?? Math.max(6, Math.min(18, 10.5 * scale));
  const binLabelFontSize = textSettings?.binQtyLabel?.fontSize ?? Math.max(5, Math.min(10, 7.5 * scale));
  const binValFontSize = textSettings?.binQtyValue?.fontSize ?? Math.max(7.5, 9.5 * scale);
  const badgeFontSize = textSettings?.locationBadge?.fontSize ?? Math.max(8, Math.min(18, 11 * scale));

  // Cap dynamic padding so it doesn't take too much height in narrow boxes
  const finalPadding = height ? Math.max(1, Math.min(padding, height * 0.12)) : padding;

  const containerStyle: React.CSSProperties = {
    border: (borderStyle && borderStyle !== 'none') ? `${borderWidth ?? 0.5}mm ${borderStyle} ${borderColor || '#000000'}` : `${borderWidth ?? 0.5}mm solid ${borderColor || '#000000'}`,
    backgroundColor: finalBgColor,
    borderRadius: `${cornerRadius ?? 2}mm`,
    padding: `${finalPadding}mm`,
    width: '100%',
    height: '100%',
    boxSizing: 'border-box'
  };

  return (
    <div 
      style={containerStyle} 
      className="flex flex-col min-h-full h-auto w-full justify-between overflow-visible text-black select-none font-sans"
    >
      {/* 1. At the very top: Display the Product Name (Read-only) */}
      <div 
        className="w-full text-center font-extrabold uppercase line-clamp-1 border-b border-black/10 pb-1 shrink-0"
        style={applyTextSettings(textSettings?.productName, { 
          fontSize: `${titleFontSize}px`,
          color: '#000000',
          fontFamily: 'Inter, sans-serif',
          lineHeight: '1.2',
          marginBottom: `${Math.max(1.5, 3.5 * scale)}px`
        })}
      >
        {pName || 'NO PRODUCT NAME'}
      </div>

      {/* 2. Middle area: Split Product Image (left) and warned KANBAN PULLED / Bin Quantity (right) */}
      <div className="flex flex-row items-center justify-between w-full flex-1 min-h-0 gap-2 font-sans overflow-visible">
        {/* Left column: Product Image */}
        <div className="w-[35%] h-full flex items-center justify-center min-w-0 overflow-visible">
          <ProductImageWidget 
            imageUrl={pImage} 
            altText={pName}
            className="max-h-full max-w-full object-contain bg-white border border-neutral-200 rounded"
          />
        </div>

        {/* Right column: Details and Input */}
        <div className="w-[60%] flex flex-col justify-center items-center text-center min-w-0 gap-1 py-1" style={{ height: 'auto', minHeight: '100%' }}>
          {/* KANBAN PULLED (Centered, Bold, Uppercase, Red, No background) */}
          {(() => {
            const warningSettings = textSettings?.warningText;
            const baseFontSize = warningSettings?.fontSize ?? 28;
            
            const warningFontSizeCalculated = baseFontSize;
            
            const warningStyle = applyTextSettings(warningSettings, {
              fontSize: `${warningFontSizeCalculated}px`,
              fontWeight: warningSettings?.fontWeight || 'bold',
              color: warningSettings?.color || '#dc2626',
              fontFamily: warningSettings?.fontFamily || 'sans-serif',
              textAlign: 'center',
              display: 'block',
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              transition: 'all 0.15s ease-out'
            });

            // Override and guarantee scaled font size
            warningStyle.fontSize = `${warningFontSizeCalculated}px`;

            // Apply special Section 2 warning settings: Rotation, Horizontal & Vertical Positions
            const rotationDeg = warningSettings?.rotation ?? 0;
            const hPos = warningSettings?.horizontalPosition ?? 0;
            const vPos = warningSettings?.verticalPosition ?? 0;
            
            warningStyle.transform = `rotate(${rotationDeg}deg) translate(${hPos}px, ${vPos}px)`;

            return (
              <span 
                className="leading-tight shrink-0"
                style={warningStyle}
              >
                KANBAN PULLED
              </span>
            );
          })()}

          {/* Bin Quantity Field (Editable inside Section 2 only) */}
          <div className="flex flex-col items-center justify-center shrink-0 min-h-0">
            <span 
              className="text-neutral-500 font-extrabold uppercase tracking-tight leading-none mb-0.5"
              style={applyTextSettings(textSettings?.binQtyLabel, { fontSize: `${binLabelFontSize}px` })}
            >
              Bin Quantity
            </span>
            {onBinQuantityChange ? (
              <input
                id="section2-bin-quantity"
                type="text"
                value={currentBinQty}
                onChange={(e) => onBinQuantityChange(e.target.value)}
                placeholder="Qty"
                className="w-full max-w-[120px] text-center bg-white border border-neutral-300 rounded-md text-black font-extrabold focus:outline-none focus:ring-1 focus:ring-purple-500 font-sans leading-none"
                style={applyTextSettings(textSettings?.binQtyValue, { 
                  fontSize: `${binValFontSize}px`,
                  paddingTop: `${Math.max(1.5, 3 * scale)}px`,
                  paddingBottom: `${Math.max(1.5, 3 * scale)}px`,
                  paddingLeft: `${Math.max(3, 6 * scale)}px`,
                  paddingRight: `${Math.max(3, 6 * scale)}px`,
                })}
              />
            ) : (
              <span 
                className="font-black text-neutral-900 border border-neutral-200 bg-neutral-50 rounded-md leading-none"
                style={applyTextSettings(textSettings?.binQtyValue, { 
                  fontSize: `${binValFontSize}px`,
                  paddingTop: `${Math.max(1.5, 3 * scale)}px`,
                  paddingBottom: `${Math.max(1.5, 3 * scale)}px`,
                  paddingLeft: `${Math.max(4, 8 * scale)}px`,
                  paddingRight: `${Math.max(4, 8 * scale)}px`,
                })}
              >
                {currentBinQty || 'N/A'}
              </span>
            )}
          </div>
        </div>
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
