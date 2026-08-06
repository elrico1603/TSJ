import React from 'react';
import { KanbanCardMaster } from '../services/kanbanService';
import { Icon } from './Icon';
import { MasterInformation as MasterInfoType } from '../types';
import { TextCustomizationSettings } from '../services/templateService';
import { applyTextSettings } from '../utils/textStyleHelper';

export interface WarehouseSectionProps {
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
 * Shared Warehouse Section component for Section 3 (WarehouseIdentification)
 * and Section 4 (WarehouseDisplay).
 * Displays Product Image on the left and Product Description on the top right,
 * with Location Badge at the bottom.
 */
export const WarehouseSectionShared: React.FC<WarehouseSectionProps> = ({
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

  // Responsive bound font sizes
  const titleFontSize = Math.max(7, Math.min(22, 11 * scale));
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
      {/* Upper Area: Flex Row with Square Image Column (aspect-ratio: 1) and Flexible Description Column */}
      <div 
        className="flex flex-row items-stretch w-full flex-1 min-h-0 gap-2.5 overflow-hidden mb-1"
      >
        {/* Left Column: Fixed Square Image Container (aspect-ratio: 1, width derived from available height) */}
        <div 
          className="h-full relative overflow-hidden bg-white flex items-center justify-center shrink-0"
          style={{
            aspectRatio: '1 / 1',
            border: '1px solid #C9CDD4',
            borderRadius: `${Math.max(2, cornerRadius ?? 4)}px`,
            boxSizing: 'border-box'
          }}
        >
          {pImage ? (
            <img 
              src={pImage} 
              alt={pName || 'Product'} 
              className="w-full h-full object-cover block"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-neutral-400 p-1 text-center">
              <Icon name="camera" size={Math.max(14, Math.min(28, 20 * scale))} className="opacity-50 mb-0.5" />
              <span className="text-[8px] font-bold uppercase tracking-wider text-neutral-400 leading-none">NO PHOTO</span>
            </div>
          )}
        </div>

        {/* Right Column: Product Description Area (Top Aligned, fills remaining width) */}
        <div className="flex-1 min-w-0 h-full flex flex-col justify-start items-start overflow-hidden">
          <div 
            className="font-extrabold text-neutral-900 uppercase leading-tight w-full break-words text-left"
            style={applyTextSettings(textSettings?.productName, { 
              fontSize: `${titleFontSize}px`,
              fontFamily: 'Inter, sans-serif'
            })}
          >
            {pName || 'NO PRODUCT NAME'}
          </div>
        </div>
      </div>

      {/* Bottom of Section: Location display with the selected Location Colour (Read-only) */}
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
          lineHeight: '1.1'
        })}
      >
        {pLocation || 'NO LOCATION'}
      </div>
    </div>
  );
};
