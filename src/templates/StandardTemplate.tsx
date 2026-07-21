import React from 'react';
import { KanbanCardMaster } from '../services/kanbanService';
import { KanbanTemplateV2 } from '../services/templateService';
import { MasterInformation } from '../components/MasterInformation';
import { KanbanPulled } from '../components/KanbanPulled';
import { WarehouseIdentification } from '../components/WarehouseIdentification';
import { WarehouseDisplay } from '../components/WarehouseDisplay';

interface StandardTemplateProps {
  cardData: KanbanCardMaster;
  template: KanbanTemplateV2;
  previewHeight?: number; // overall canvas height in pixels for scaling
}

/**
 * StandardTemplate renders all 4 customizable sections onto an A4 page.
 * Scales position and dimensions dynamically from mm to container pixels.
 */
export const StandardTemplate: React.FC<StandardTemplateProps> = ({
  cardData,
  template,
  previewHeight = 720
}) => {
  const scaleFactor = previewHeight / 297; // A4 height is 297mm
  const mmToPx = (mm: number) => mm * scaleFactor;

  // Find configurations for each of our 4 modular sections
  const sections = template.sections || [];
  const masterInfoSec = sections.find(s => s.id === 'master_info');
  const kanbanPulledSec = sections.find(s => s.id === 'kanban_pulled');
  const warehouseIdSec = sections.find(s => s.id === 'warehouse_id');
  const warehouseDisplaySec = sections.find(s => s.id === 'warehouse_display');

  return (
    <div className="relative w-full h-full bg-white select-none overflow-hidden">
      {/* 1. Master Information Section */}
      {masterInfoSec && masterInfoSec.visible && (
        <div
          className="absolute"
          style={{
            width: `${mmToPx(masterInfoSec.width)}px`,
            height: `${mmToPx(masterInfoSec.height)}px`,
            left: `${mmToPx(masterInfoSec.x)}px`,
            top: `${mmToPx(masterInfoSec.y)}px`,
            zIndex: masterInfoSec.zIndex || 1
          }}
        >
          <MasterInformation
            cardData={cardData}
            borderWidth={masterInfoSec.borderWidth}
            borderColor={masterInfoSec.borderColor}
            borderStyle={masterInfoSec.borderStyle}
            backgroundColor={masterInfoSec.backgroundColor}
            cornerRadius={masterInfoSec.cornerRadius}
            padding={masterInfoSec.padding}
            width={masterInfoSec.width}
            height={masterInfoSec.height}
          />
        </div>
      )}

      {/* 2. Kanban Pulled Section */}
      {kanbanPulledSec && kanbanPulledSec.visible && (
        <div
          className="absolute"
          style={{
            width: `${mmToPx(kanbanPulledSec.width)}px`,
            height: `${mmToPx(kanbanPulledSec.height)}px`,
            left: `${mmToPx(kanbanPulledSec.x)}px`,
            top: `${mmToPx(kanbanPulledSec.y)}px`,
            zIndex: kanbanPulledSec.zIndex || 2
          }}
        >
          <KanbanPulled
            cardData={cardData}
            borderWidth={kanbanPulledSec.borderWidth}
            borderColor={kanbanPulledSec.borderColor}
            borderStyle={kanbanPulledSec.borderStyle}
            backgroundColor={kanbanPulledSec.backgroundColor}
            cornerRadius={kanbanPulledSec.cornerRadius}
            padding={kanbanPulledSec.padding}
            width={kanbanPulledSec.width}
            height={kanbanPulledSec.height}
          />
        </div>
      )}

      {/* 3. Warehouse Identification Section */}
      {warehouseIdSec && warehouseIdSec.visible && (
        <div
          className="absolute"
          style={{
            width: `${mmToPx(warehouseIdSec.width)}px`,
            height: `${mmToPx(warehouseIdSec.height)}px`,
            left: `${mmToPx(warehouseIdSec.x)}px`,
            top: `${mmToPx(warehouseIdSec.y)}px`,
            zIndex: warehouseIdSec.zIndex || 3
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
            width={warehouseIdSec.width}
            height={warehouseIdSec.height}
          />
        </div>
      )}

      {/* 4. Warehouse Display Section */}
      {warehouseDisplaySec && warehouseDisplaySec.visible && (
        <div
          className="absolute"
          style={{
            width: `${mmToPx(warehouseDisplaySec.width)}px`,
            height: `${mmToPx(warehouseDisplaySec.height)}px`,
            left: `${mmToPx(warehouseDisplaySec.x)}px`,
            top: `${mmToPx(warehouseDisplaySec.y)}px`,
            zIndex: warehouseDisplaySec.zIndex || 4
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
            width={warehouseDisplaySec.width}
            height={warehouseDisplaySec.height}
          />
        </div>
      )}
    </div>
  );
};
