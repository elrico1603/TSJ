import React from 'react';
import { KanbanCardMaster } from '../services/kanbanService';

interface WarehouseIdentificationProps {
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
 * WarehouseIdentification displays warehouse coordinate maps and location indicators
 * in ultra-high resolution display style.
 */
export const WarehouseIdentification: React.FC<WarehouseIdentificationProps> = ({
  cardData,
  borderWidth = 0.5,
  borderColor = '#000000',
  borderStyle = 'solid',
  backgroundColor = '#f8fafc',
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

  const loc = cardData.location || { letter: '', number: '', colour: '' };
  const coordinate = `${loc.letter || ''}${loc.number || ''}`.trim() || 'N/A';
  const colour = loc.colour?.trim() || 'N/A';

  const getColourBg = () => {
    const norm = colour.toLowerCase();
    if (norm === 'red') return '#ef4444';
    if (norm === 'blue') return '#2563eb';
    if (norm === 'green') return '#10b981';
    if (norm === 'yellow') return '#facc15';
    if (norm === 'orange') return '#f97316';
    if (norm === 'purple') return '#8b5cf6';
    return '#4b5563';
  };

  const getColourText = () => {
    const norm = colour.toLowerCase();
    if (norm === 'yellow') return '#000000';
    return '#ffffff';
  };

  return (
    <div 
      style={containerStyle} 
      className="grid grid-rows-[25%_75%] overflow-hidden text-black select-none font-sans"
    >
      {/* Title */}
      <div className="flex items-center justify-between border-b border-black/10 pb-1 mb-1 font-sans">
        <span className="text-[8px] font-extrabold uppercase tracking-widest text-neutral-400 leading-none">WAREHOUSE LOCATION MAP</span>
        <span className="text-[8px] font-extrabold uppercase tracking-widest text-neutral-400 leading-none">TS JOINERY STORES</span>
      </div>

      {/* HUGE COORDINATE DISPLAY */}
      <div className="flex items-center justify-between h-full py-1 font-sans">
        <div className="flex flex-col justify-center font-sans">
          <span className="text-[8px] font-extrabold uppercase tracking-widest text-neutral-400 leading-none">AISLE COORDINATE</span>
          <span 
            className="font-black text-neutral-900 tracking-tighter leading-none mt-1 font-sans uppercase"
            style={{ fontSize: `${32 * fontSizeScale}px` }}
          >
            {coordinate}
          </span>
        </div>

        <div className="flex flex-col items-end justify-center font-sans">
          <span className="text-[8px] font-extrabold uppercase tracking-widest text-neutral-400 leading-none mb-1">BIN COLOUR</span>
          <span 
            className="font-black border px-4 py-2 rounded-2xl shadow-sm text-center uppercase tracking-wide leading-none"
            style={{ 
              fontSize: `${14 * fontSizeScale}px`,
              backgroundColor: getColourBg(),
              color: getColourText(),
              borderColor: 'rgba(0, 0, 0, 0.15)'
            }}
          >
            {colour}
          </span>
        </div>
      </div>
    </div>
  );
};
