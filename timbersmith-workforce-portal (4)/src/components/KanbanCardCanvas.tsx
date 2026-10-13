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
  const scaleFactorFont = 1.0; // Font scale is handled proportionally by width & height inside each section component
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

  const effectiveMasterInfo: MasterInfoType = masterInfo || {
    productName: template.productName || cardData?.productDescription || 'Sample Product',
    supplier: template.supplier || cardData?.supplierName || 'Sample Supplier',
    supplierPartNumber: template.supplierPartNumber || cardData?.supplierPartNumber || 'ABC-123',
    orderQuantity: template.orderQuantity || cardData?.orderQuantity || '100',
    deliveryTime: template.deliveryTime || cardData?.deliveryTime || '3 Days',
    location: template.location || (cardData?.location ? `${cardData.location.letter || ''}${cardData.location.number || ''}` : 'A-01-B-01'),
    locationColour: template.locationColour || cardData?.location?.colour || 'GREEN',
    internalProductNumber: template.kanbanId || cardData?.kanbanId || 'KAN-001',
    productImage: template.productImage || template.imageUrl || cardData?.imageUrl || cardData?.productImage || 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=200',
    qrCode: cardData?.qrCodeUrl || '',
    templateName: template.templateName || '',
    templateType: template.paperSize || 'A4',
    binQuantity: template.binQuantity || cardData?.binQuantity || '100',
    cardColour: cardData?.cardColour || '#ffffff',
    status: 'ACTIVE'
  };

  // Step 5: Log image values before rendering KanbanCardCanvas
  console.log("Canvas Product Image", {
    templateProductImage: template.productImage,
    templateImageUrl: template.imageUrl,
    masterInfoProductImage: masterInfo?.productImage,
    effectiveProductImage: effectiveMasterInfo.productImage
  });
  const cardWidthMm = template.dimensions?.width || (template.paperSize === 'A5' ? 148 : 210);
  const cardHeightMm = template.dimensions?.height || (template.paperSize === 'A5' ? 210 : 297);

  // Designer reference canvas height (680px for 297mm A4 height -> 2.28956228956 px/mm)
  const canvasHeightPx = 680;
  const scaleFactor = canvasHeightPx / 297;

  const widthPx = cardWidthMm * scaleFactor;
  const heightPx = cardHeightMm * scaleFactor;

  return (
    <div
      className={`kanban-card-canvas relative bg-white select-none overflow-hidden ${className}`}
      style={{
        width: `${widthPx}px`,
        height: `${heightPx}px`,
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
            left: `${sec.x * scaleFactor}px`,
            top: `${sec.y * scaleFactor}px`,
            width: `${sec.width * scaleFactor}px`,
            height: `${sec.height * scaleFactor}px`,
            zIndex: sec.zIndex || 1,
            transform: sec.rotation ? `rotate(${sec.rotation}deg)` : undefined,
            borderRadius: `${(sec.cornerRadius || 0) * scaleFactor}px`
          }}
          className="overflow-hidden"
        >
          {renderSectionContent(sec, effectiveMasterInfo, cardData)}
        </div>
      ))}
    </div>
  );
};
