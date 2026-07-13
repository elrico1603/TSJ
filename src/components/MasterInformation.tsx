import React from 'react';
import { KanbanCardMaster } from '../services/kanbanService';
import { ProductImageWidget } from './ProductImageWidget';

interface MasterInformationProps {
  cardData: KanbanCardMaster;
  borderWidth?: number; // mm
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'none';
  backgroundColor?: string;
  cornerRadius?: number; // mm
  padding?: number; // mm
  fontSizeScale?: number; // 0.8 to 1.5 multiplier
}

/**
 * MasterInformation section displaying core product description, specs, ordering criteria,
 * and delivery benchmarks. Fully styled via template layout configuration.
 */
export const MasterInformation: React.FC<MasterInformationProps> = ({
  cardData,
  borderWidth = 0.5,
  borderColor = '#000000',
  borderStyle = 'solid',
  backgroundColor = '#ffffff',
  cornerRadius = 2,
  padding = 4,
  fontSizeScale = 1.0
}) => {
  const containerStyle: React.CSSProperties = {
    border: borderStyle !== 'none' ? `${borderWidth}mm ${borderStyle} ${borderColor}` : 'none',
    backgroundColor: backgroundColor,
    borderRadius: `${cornerRadius}mm`,
    padding: `${padding}mm`,
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
      className="grid grid-rows-[22%_78%] overflow-hidden text-black select-none font-sans"
    >
      {/* Header Banner */}
      <div 
        className="flex items-center justify-between border-b border-black/15 pb-1 mb-1 font-sans"
        style={{ fontSize: `${11 * fontSizeScale}px` }}
      >
        <div className="flex flex-col">
          <span className="text-[8px] font-extrabold uppercase tracking-widest text-neutral-400 leading-none">DESCRIPTION / PART</span>
          <span className="font-extrabold text-neutral-900 mt-0.5 line-clamp-1 uppercase leading-none" style={textStyle}>
            {cardData.productDescription}
          </span>
        </div>
        <span className="font-mono font-black text-purple-700 bg-purple-50 px-2 py-0.5 border border-purple-200 rounded text-[9px] uppercase leading-none">
          {cardData.kanbanId}
        </span>
      </div>

      {/* Body Content: Split Product Image and Information Matrix */}
      <div className="grid grid-cols-[38%_62%] h-full gap-2 pt-1 font-sans">
        {/* Visual product representation */}
        <div className="h-full">
          <ProductImageWidget 
            imageUrl={cardData.imageUrl} 
            altText={cardData.productDescription}
            className="w-full h-full min-h-[50px] bg-white border border-neutral-200"
          />
        </div>

        {/* Specifications list */}
        <div 
          className="grid grid-rows-4 divide-y divide-black/10 text-neutral-800 h-full font-sans"
          style={{ fontSize: `${9 * fontSizeScale}px` }}
        >
          <div className="flex items-center justify-between py-1 font-sans">
            <span className="font-extrabold uppercase text-neutral-400 text-[8px] tracking-tight">Supplier P/No</span>
            <span className="font-bold text-neutral-900 truncate max-w-[120px]" style={textStyle}>
              {cardData.supplierPartNumber || 'N/A'}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 font-sans">
            <span className="font-extrabold uppercase text-neutral-400 text-[8px] tracking-tight">Supplier Name</span>
            <span className="font-bold text-neutral-900 truncate max-w-[120px]" style={textStyle}>
              {cardData.supplierName || 'N/A'}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 font-sans">
            <span className="font-extrabold uppercase text-neutral-400 text-[8px] tracking-tight">Order & Bin Qty</span>
            <span className="font-black text-purple-700 font-sans">
              {cardData.orderQuantity || '0'} (Cap: {cardData.binQuantity || '1 Bin'})
            </span>
          </div>

          <div className="flex items-center justify-between py-1 font-sans">
            <span className="font-extrabold uppercase text-neutral-400 text-[8px] tracking-tight">Lead Delivery</span>
            <span className="font-bold text-emerald-600 uppercase" style={textStyle}>
              {cardData.deliveryTime || 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
