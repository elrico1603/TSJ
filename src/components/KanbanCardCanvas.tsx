import React from 'react';
import { KanbanCardMaster } from '../services/kanbanService';
import { KanbanTemplateV2, KanbanSectionConfig } from '../services/templateService';
import { MasterInformation as MasterInfoType } from '../types';
import { MasterInformation } from './MasterInformation';
import { KanbanPulled } from './KanbanPulled';
import { WarehouseIdentification } from './WarehouseIdentification';
import { WarehouseDisplay } from './WarehouseDisplay';

export interface KanbanCardCanvasProps {
  template: KanbanTemplateV2;
  cardData?: KanbanCardMaster;
  masterInfo?: MasterInfoType;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders the section content for a given KanbanSectionConfig.
 * Shared across Designer and Print Preview to ensure 100% identical component rendering.
 */
export const renderSectionContent = (
  sec: KanbanSectionConfig,
  masterInfo?: MasterInfoType,
  cardData?: KanbanCardMaster
) => {
  const scaleFactorFont = sec.height / 60; // relative font scale
  switch (sec.id) {
    case 'master_info':
      return (
        <MasterInformation
          masterInfo={masterInfo}
          cardData={cardData}
          borderWidth={sec.borderWidth}
          borderStyle={sec.borderStyle}
          borderColor={sec.borderColor}
          backgroundColor={sec.backgroundColor}
          cornerRadius={sec.cornerRadius}
          padding={sec.padding}
          fontSizeScale={scaleFactorFont}
          width={sec.width}
          height={sec.height}
          textSettings={sec.textSettings}
        />
      );
    case 'kanban_pulled':
      return (
        <KanbanPulled
          masterInfo={masterInfo}
          cardData={cardData}
          binQuantity={cardData?.binQuantity}
          onBinQuantityChange={() => {}}
          borderWidth={sec.borderWidth}
          borderStyle={sec.borderStyle}
          borderColor={sec.borderColor}
          backgroundColor={sec.backgroundColor}
          cornerRadius={sec.cornerRadius}
          padding={sec.padding}
          fontSizeScale={scaleFactorFont}
          width={sec.width}
          height={sec.height}
          textSettings={sec.textSettings}
        />
      );
    case 'warehouse_id':
      return (
        <WarehouseIdentification
          masterInfo={masterInfo}
          cardData={cardData}
          borderWidth={sec.borderWidth}
          borderStyle={sec.borderStyle}
          borderColor={sec.borderColor}
          backgroundColor={sec.backgroundColor}
          cornerRadius={sec.cornerRadius}
          padding={sec.padding}
          fontSizeScale={scaleFactorFont}
          width={sec.width}
          height={sec.height}
          textSettings={sec.textSettings}
        />
      );
    case 'warehouse_display':
      return (
        <WarehouseDisplay
          masterInfo={masterInfo}
          cardData={cardData}
          borderWidth={sec.borderWidth}
          borderStyle={sec.borderStyle}
          borderColor={sec.borderColor}
          backgroundColor={sec.backgroundColor}
          cornerRadius={sec.cornerRadius}
          padding={sec.padding}
          fontSizeScale={scaleFactorFont}
          width={sec.width}
          height={sec.height}
          textSettings={sec.textSettings}
        />
      );
    default:
      return null;
  }
};

/**
 * KanbanCardCanvas is the single, canonical WYSIWYG rendering engine for a Kanban Card.
 * It uses exact millimeter positioning matching the Designer canvas.
 */
export const KanbanCardCanvas: React.FC<KanbanCardCanvasProps> = ({
  template,
  cardData,
  masterInfo,
  className = '',
  style
}) => {
  const visibleSections = (template.sections || []).filter(s => s.visible !== false);

  // Compute total card height from sections in mm
  const computedHeightMm = visibleSections.reduce((max, sec) => {
    const bottom = (sec.y || 0) + (sec.height || 0);
    return bottom > max ? bottom : max;
  }, 0);

  // Fallback to 297mm if full sheet or 0
  const cardHeightMm = computedHeightMm > 0 ? computedHeightMm : 297;
  const cardWidthMm = template.dimensions?.width || 210;

  return (
    <div
      className={`kanban-card-canvas relative bg-white select-none overflow-hidden ${className}`}
      style={{
        width: `${cardWidthMm}mm`,
        height: `${cardHeightMm}mm`,
        position: 'relative',
        boxSizing: 'border-box',
        ...style
      }}
    >
      {visibleSections.map(sec => (
        <div
          key={sec.id}
          style={{
            position: 'absolute',
            left: `${sec.x}mm`,
            top: `${sec.y}mm`,
            width: `${sec.width}mm`,
            height: `${sec.height}mm`,
            zIndex: sec.zIndex || 1,
            transform: sec.rotation ? `rotate(${sec.rotation}deg)` : undefined,
            borderRadius: `${sec.cornerRadius || 0}mm`
          }}
          className={`overflow-hidden ${sec.borderStyle && sec.borderStyle !== 'none' ? `border-${sec.borderWidth} ${sec.borderStyle}` : ''}`}
        >
          {renderSectionContent(sec, masterInfo, cardData)}
        </div>
      ))}
    </div>
  );
};
