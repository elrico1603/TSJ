import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeRendererProps {
  text: string;
  size?: number;
  className?: string;
  responsive?: boolean;
}

/**
 * QRCodeRenderer uses the official "qrcode" npm package to generate 
 * an ultra-sharp, scalable SVG representation of the provided text/URI.
 */
export const QRCodeRenderer: React.FC<QRCodeRendererProps> = ({
  text,
  size = 150,
  className = '',
  responsive = false
}) => {
  const [svgContent, setSvgContent] = useState<string>('');

  useEffect(() => {
    let active = true;

    const options: any = {
      type: 'svg',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    };

    if (!responsive) {
      options.width = size;
    }

    // Generate high-resolution SVG string from "qrcode"
    (QRCode.toString(text, options) as any as Promise<string>)
      .then(svg => {
        if (active) {
          setSvgContent(svg);
        }
      })
      .catch(err => {
        console.error('Error rendering QR code with npm "qrcode":', err);
      });

    return () => {
      active = false;
    };
  }, [text, size, responsive]);

  if (!svgContent) {
    return (
      <div 
        className={`bg-neutral-200 animate-pulse rounded flex items-center justify-center ${responsive ? 'w-full h-full aspect-square' : ''} ${className}`}
        style={responsive ? undefined : { width: `${size}px`, height: `${size}px` }}
      >
        <span className="text-[8px] text-neutral-400">QR</span>
      </div>
    );
  }

  if (responsive) {
    return (
      <div 
        className={`w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full aspect-square ${className}`}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    );
  }

  return (
    <div 
      className={`inline-block ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
};
