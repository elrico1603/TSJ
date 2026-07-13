import React from 'react';
import { KanbanCardMaster } from '../services/kanbanService';
import { QRCodeWidget } from './QRCodeWidget';

interface WarehouseDisplayProps {
  cardData: KanbanCardMaster;
  borderWidth?: number; // mm
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'none';
  backgroundColor?: string;
  cornerRadius?: number; // mm
  padding?: number; // mm
  fontSizeScale?: number;
}

/**
 * WarehouseDisplay displays shelf bin capacity values and a quick-scan QR code.
 */
export const WarehouseDisplay: React.FC<WarehouseDisplayProps> = ({
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
    fontFamily: 'Inter, sans-serif'
  };

  return (
    <div 
      style={containerStyle} 
      className="grid grid-cols-[68%_32%] overflow-hidden text-black select-none font-sans gap-2"
    >
      {/* Left Column: Product Name & Capacity Metrics */}
      <div className="flex flex-col justify-between py-1 h-full font-sans">
        <div>
          <span className="text-[8px] font-extrabold uppercase tracking-widest text-neutral-400 leading-none">BAY EDGE DISPLAY</span>
          <h4 className="font-black text-neutral-900 leading-tight uppercase mt-1 truncate" style={{ ...textStyle, fontSize: `${12 * fontSizeScale}px` }}>
            {cardData.productDescription}
          </h4>
        </div>

        {/* Capacity / Bin count */}
        <div className="bg-neutral-50 border border-neutral-200/60 p-2 rounded-xl mt-1.5 font-sans">
          <span className="text-[7px] font-extrabold text-neutral-400 uppercase tracking-widest leading-none">STOCK CAPACITY</span>
          <div className="flex items-baseline gap-1 mt-0.5 font-sans">
            <span className="text-sm font-black text-purple-700 leading-none">
              {cardData.binQuantity || '1 Bin'}
            </span>
            <span className="text-[8px] font-extrabold text-neutral-500 uppercase tracking-tight">
              Standard Capacity
            </span>
          </div>
        </div>

        {/* Mock Stock barcode */}
        <div className="flex flex-col items-start mt-1 font-sans">
          <div className="w-full h-4 flex items-end gap-[1px]">
            {[1, 3, 2, 1, 2, 4, 1, 3, 1, 2, 1, 3, 2, 4, 1].map((width, i) => (
              <div key={i} className="bg-neutral-800 h-full" style={{ width: `${width}px` }} />
            ))}
          </div>
          <span className="text-[7px] font-mono font-bold tracking-widest text-neutral-400 uppercase mt-0.5 leading-none">
            {cardData.kanbanId}
          </span>
        </div>
      </div>

      {/* Right Column: Scan code */}
      <div className="flex items-center justify-center h-full">
        <QRCodeWidget 
          kanbanId={cardData.kanbanId} 
          size={55} 
          className="border border-neutral-200 p-1 rounded-lg"
        />
      </div>
    </div>
  );
};
