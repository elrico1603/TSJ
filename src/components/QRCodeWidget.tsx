import React from 'react';
import { getKanbanTargetUrl } from '../services/qrService';
import { QRCodeRenderer } from './QRCodeRenderer';

interface QRCodeWidgetProps {
  text?: string;
  kanbanId?: string;
  width?: number;
  height?: number;
  size?: number;
  altText?: string;
  className?: string;
}

/**
 * QRCodeWidget displays a scan target QR Code pointing directly to the PWA record.
 * Accepts width, height, or size to dynamically configure QR code generation.
 */
export const QRCodeWidget: React.FC<QRCodeWidgetProps> = ({
  text,
  kanbanId,
  width,
  height,
  size,
  className = ''
}) => {
  const qrUrl = text || (kanbanId ? getKanbanTargetUrl(kanbanId) : '');
  const qrWidth = width || size || 90;
  const qrHeight = height || size || 90;

  const hasFullWidth = className.includes('w-full') || className.includes('w-');
  const hasFullHeight = className.includes('h-full') || className.includes('h-');

  return (
    <div 
      className={`flex items-center justify-center border border-black/15 bg-white rounded-xl overflow-hidden ${className}`}
      style={{
        ...(!hasFullWidth && qrWidth ? { width: `${qrWidth}px` } : {}),
        ...(!hasFullHeight && qrHeight ? { height: `${qrHeight}px` } : {}),
      }}
    >
      {qrUrl ? (
        <QRCodeRenderer
          text={qrUrl}
          width={qrWidth}
          height={qrHeight}
          responsive={false}
          className="w-full h-full object-contain flex items-center justify-center"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-neutral-400 p-2">
          <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-neutral-400">NO QR</span>
        </div>
      )}
    </div>
  );
};
