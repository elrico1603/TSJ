import React from 'react';
import { KanbanCardMaster } from '../services/kanbanService';
import { KanbanTemplateV2 } from '../services/templateService';
import { WarehouseIdentification } from '../components/WarehouseIdentification';
import { WarehouseDisplay } from '../components/WarehouseDisplay';

interface WarehouseTemplateProps {
  cardData: KanbanCardMaster;
  template: KanbanTemplateV2;
  previewHeight?: number;
}

/**
 * WarehouseTemplate renders location coordinates and display tags,
 * leaving off standard parts details.
 */
export const WarehouseTemplate: React.FC<WarehouseTemplateProps> = ({
  cardData,
  template,
  previewHeight = 720
}) => {
  const scaleFactor = previewHeight / 297;
  const mmToPx = (mm: number) => mm * scaleFactor;

  const sections = template.sections || [];
  const warehouseIdSec = sections.find(s => s.id === 'warehouse_id');
  const warehouseDisplaySec = sections.find(s => s.id === 'warehouse_display');

  return (
    <div className="relative w-full h-full bg-white select-none overflow-hidden">
      {/* 1. Warehouse Identification Section */}
      {warehouseIdSec && warehouseIdSec.visible && (
        <div
          className="absolute"
          style={{
            width: `${mmToPx(warehouseIdSec.width)}px`,
            height: `${mmToPx(warehouseIdSec.height)}px`,
            left: `${mmToPx(warehouseIdSec.x)}px`,
            top: `${mmToPx(warehouseIdSec.y)}px`,
            zIndex: warehouseIdSec.zIndex || 1
          }}
        >
          <WarehouseIdentification
            cardData={cardData}
            borderWidth={warehouseIdSec.borderWidth}
            borderColor={warehouseIdSec.borderColor}
            borderStyle={warehouseIdSec.borderStyle}
            backgroundColor={warehouseIdSec.backgroundColor}
            cornerRadius={warehouseIdSec.cornerRadius}
            padding={warehouseIdSec.padding}
            fontSizeScale={1.2}
            width={warehouseIdSec.width}
            height={warehouseIdSec.height}
          />
        </div>
      )}

      {/* 2. Warehouse Display Section */}
      {warehouseDisplaySec && warehouseDisplaySec.visible && (
        <div
          className="absolute"
          style={{
            width: `${mmToPx(warehouseDisplaySec.width)}px`,
            height: `${mmToPx(warehouseDisplaySec.height)}px`,
            left: `${mmToPx(warehouseDisplaySec.x)}px`,
            top: `${mmToPx(warehouseDisplaySec.y)}px`,
            zIndex: warehouseDisplaySec.zIndex || 2
          }}
        >
          <WarehouseDisplay
            cardData={cardData}
            borderWidth={warehouseDisplaySec.borderWidth}
            borderColor={warehouseDisplaySec.borderColor}
            borderStyle={warehouseDisplaySec.borderStyle}
            backgroundColor={warehouseDisplaySec.backgroundColor}
            cornerRadius={warehouseDisplaySec.cornerRadius}
            padding={warehouseDisplaySec.padding}
            fontSizeScale={1.1}
            width={warehouseDisplaySec.width}
            height={warehouseDisplaySec.height}
          />
        </div>
      )}
    </div>
  );
};
