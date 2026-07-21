import React from 'react';
import { getKanbanTargetUrl } from '../services/qrService';
import { QRCodeRenderer } from './QRCodeRenderer';

interface QRCodeWidgetProps {
  kanbanId: string;
  size?: number;
  className?: string;
}

/**
 * QRCodeWidget displays a scan target QR Code pointing directly to the PWA record.
 */
export const QRCodeWidget: React.FC<QRCodeWidgetProps> = ({
  kanbanId,
  size = 120,
  className = ''
}) => {
  const qrUrl = getKanbanTargetUrl(kanbanId);

  return (
    <div className={`flex flex-col items-center justify-center bg-white p-2 border border-black/10 rounded-xl shadow-sm ${className}`}>
      <QRCodeRenderer
        text={qrUrl}
        size={size}
        className="object-contain"
      />
      <span className="text-[9px] font-mono font-bold tracking-widest text-neutral-800 mt-1 uppercase">
        {kanbanId || 'KAN-000000'}
      </span>
    </div>
  );
};
