import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export interface QRCodeRendererProps {
  text: string;
  width?: number;
  height?: number;
  size?: number;
  className?: string;
  responsive?: boolean;
}

/**
 * QRCodeRenderer uses the official "qrcode" npm package to generate 
 * an ultra-sharp, scalable SVG representation of the provided text/URI.
 * Dynamically generated at target width/height without hardcoded 90x90 limits or clipping.
 */
export const QRCodeRenderer: React.FC<QRCodeRendererProps> = ({
  text,
  width,
  height,
  size,
  className = '',
  responsive = false
}) => {
  const [qrData, setQrData] = useState<{ matrixSize: number; innerHtml: string } | null>(null);

  const targetWidth = width || size;

  useEffect(() => {
    let active = true;

    if (!text) {
      setQrData(null);
      return;
    }

    const options: any = {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 1, // minimal margin so QR modules use maximum area without clipping
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    };

    if (targetWidth) {
      options.width = targetWidth;
    }

    // Generate high-resolution SVG string from "qrcode"
    (QRCode.toString(text, options) as any as Promise<string>)
      .then(rawSvg => {
        if (!active) return;

        // 1. Extract SIZE from viewBox (e.g. viewBox="0 0 23 23") or matrix background path
        const viewBoxMatch = rawSvg.match(/viewBox=["']\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*["']/i);
        let matrixSize = 23;
        if (viewBoxMatch && viewBoxMatch[3]) {
          matrixSize = parseFloat(viewBoxMatch[3]);
        } else {
          const dMatch = rawSvg.match(/d=["']M0 0h([\d.]+)v\1H0z["']/i);
          if (dMatch && dMatch[1]) {
            matrixSize = parseFloat(dMatch[1]);
          }
        }

        // Extract inner SVG content without outer <svg> tag and remove white background path
        let innerHtml = rawSvg
          .replace(/<svg[^>]*>/i, '')
          .replace(/<\/svg>/i, '');
        
        // Strip out the white background rectangle path
        innerHtml = innerHtml.replace(/<path[^>]*fill=["']#(?:ffffff|fff)["'][^>]*\/?>/gi, '');

        setQrData({ matrixSize, innerHtml });
      })
      .catch(err => {
        console.error('Error rendering QR code with npm "qrcode":', err);
      });

    return () => {
      active = false;
    };
  }, [text, targetWidth, height, size]);

  if (!qrData) {
    return (
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 23 23"
        preserveAspectRatio="xMidYMid meet"
        className={`w-full h-full min-w-0 flex-shrink object-contain ${className}`}
        style={{ minWidth: 0, flexShrink: 1, width: '100%', height: '100%' }}
      />
    );
  }

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${qrData.matrixSize} ${qrData.matrixSize}`}
      preserveAspectRatio="xMidYMid meet"
      className={`w-full h-full min-w-0 flex-shrink object-contain ${className}`}
      style={{ minWidth: 0, flexShrink: 1, width: '100%', height: '100%' }}
      dangerouslySetInnerHTML={{ __html: qrData.innerHtml }}
    />
  );
};

