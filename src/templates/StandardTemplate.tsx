import React from 'react';
import { KanbanCardMaster } from '../services/kanbanService';
import { KanbanTemplateV2 } from '../services/templateService';
import { KanbanCardCanvas } from '../components/KanbanCardCanvas';

interface StandardTemplateProps {
  cardData: KanbanCardMaster;
  template: KanbanTemplateV2;
  previewHeight?: number;
}

export const StandardTemplate: React.FC<StandardTemplateProps> = ({
  cardData,
  template
}) => {
  return <KanbanCardCanvas template={template} cardData={cardData} />;
};
