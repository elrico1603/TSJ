import React from 'react';
import { Icon } from './Icon';

interface ProductImageWidgetProps {
  imageUrl?: string;
  altText?: string;
  className?: string;
}

/**
 * ProductImageWidget renders product photos with robust fallback handling.
 */
export const ProductImageWidget: React.FC<ProductImageWidgetProps> = ({
  imageUrl,
  altText = 'Product Image',
  className = ''
}) => {
  return (
    <div className={`flex items-center justify-center border border-black/15 bg-neutral-100 rounded-xl overflow-hidden ${className}`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={altText}
          className="w-full h-full object-contain max-h-[140px]"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-neutral-400 p-4">
          <Icon name="camera" size={32} className="opacity-60 mb-1" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">NO PHOTO</span>
        </div>
      )}
    </div>
  );
};
