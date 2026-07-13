import React from 'react';
import { KanbanCardMaster } from '../services/kanbanService';

interface KanbanPulledProps {
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
 * KanbanPulled section displaying high-visibility stock replenishment trigger warnings.
 * Designed to capture warehouse attention on visual cards.
 */
export const KanbanPulled: React.FC<KanbanPulledProps> = ({
  cardData,
  borderWidth = 0.5,
  borderColor = '#000000',
  borderStyle = 'solid',
  backgroundColor = '#ef4444', // Default red alert background
  cornerRadius = 2,
  padding = 3,
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

  return (
    <div 
      style={containerStyle} 
      className="flex flex-col items-center justify-center text-white text-center font-sans select-none overflow-hidden"
    >
      <span 
        className="font-black tracking-widest text-white leading-none uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
        style={{ fontSize: `${20 * fontSizeScale}px` }}
      >
        KANBAN PULLED
      </span>
      <div className="flex items-center gap-1.5 mt-1.5 bg-black/30 border border-white/10 px-2.5 py-0.5 rounded text-[8px] font-mono tracking-wide">
        <span className="font-extrabold uppercase text-white/80">ID:</span>
        <span className="font-black text-yellow-300">{cardData.kanbanId}</span>
      </div>
    </div>
  );
};
