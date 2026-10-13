import React from 'react';

interface LocationWidgetProps {
  letter?: string;
  number?: string;
  colour?: string;
  className?: string;
}

/**
 * LocationWidget displays coordinates of where stock is located.
 */
export const LocationWidget: React.FC<LocationWidgetProps> = ({
  letter = '',
  number = '',
  colour = '',
  className = ''
}) => {
  const coordinate = `${letter}${number}`.trim() || 'N/A';
  const colorLabel = colour.trim() || 'N/A';

  // Return background highlight depending on coordinate color
  const getBadgeStyle = () => {
    const norm = colorLabel.toLowerCase();
    if (norm === 'red') return 'bg-red-500 text-white border-red-600';
    if (norm === 'blue') return 'bg-blue-600 text-white border-blue-700';
    if (norm === 'green') return 'bg-emerald-600 text-white border-emerald-700';
    if (norm === 'yellow') return 'bg-yellow-400 text-black border-yellow-500';
    if (norm === 'orange') return 'bg-orange-500 text-white border-orange-600';
    if (norm === 'purple') return 'bg-purple-600 text-white border-purple-700';
    return 'bg-neutral-800 text-white border-neutral-700';
  };

  return (
    <div className={`flex items-center gap-1.5 font-sans ${className}`}>
      <div className="flex flex-col">
        <span className="text-[8px] font-extrabold uppercase tracking-widest text-neutral-400 leading-none">LOC COORDINATE</span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-sm font-black text-black bg-neutral-100 border border-black/10 px-2.5 py-0.5 rounded-lg leading-tight uppercase font-mono">
            {coordinate}
          </span>
          <span className={`text-[10px] font-black border px-2 py-0.5 rounded-lg uppercase shadow-sm ${getBadgeStyle()}`}>
            {colorLabel}
          </span>
        </div>
      </div>
    </div>
  );
};
