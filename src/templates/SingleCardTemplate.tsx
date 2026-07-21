import React from 'react';
import { KanbanCardMaster } from '../services/kanbanService';
import { KanbanTemplateV2 } from '../services/templateService';
import { MasterInformation } from '../components/MasterInformation';

interface SingleCardTemplateProps {
  cardData: KanbanCardMaster;
  template: KanbanTemplateV2;
  previewHeight?: number;
}

/**
 * SingleCardTemplate renders a large layout centered on a single Master Information card,
 * ideal for robust physical binders or item tagging.
 */
export const SingleCardTemplate: React.FC<SingleCardTemplateProps> = ({
  cardData,
  template,
  previewHeight = 720
}) => {
  const scaleFactor = previewHeight / 297;
  const mmToPx = (mm: number) => mm * scaleFactor;

  // Single card templates look specifically for the Master Info section configuration
  const masterInfoSec = template.sections?.find(s => s.id === 'master_info') || {
    id: 'master_info',
    name: 'Master Information',
    width: 180,
    height: 250,
    x: 15,
    y: 20,
    visible: true,
    borderWidth: 1,
    borderColor: '#000000',
    borderStyle: 'solid',
    backgroundColor: '#ffffff',
    cornerRadius: 4,
    padding: 8,
    rotation: 0,
    zIndex: 1
  };

  return (
    <div className="relative w-full h-full bg-white select-none overflow-hidden">
      {masterInfoSec.visible && (
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
            fontSizeScale={1.3} // upscale fonts slightly for large tags
            width={masterInfoSec.width}
            height={masterInfoSec.height}
          />
        </div>
      )}
    </div>
  );
};
