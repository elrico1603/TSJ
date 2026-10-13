import React from 'react';

interface SplashScreenProps {
  isFadingOut?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ isFadingOut = false }) => {
  return (
    <div 
      className={`fixed inset-0 z-[999999] bg-[#111111] text-white flex flex-col items-center justify-center select-none transition-opacity duration-700 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      {/* Centered Brand Content */}
      <div className="flex flex-col items-center justify-center text-center px-6 -mt-8">
        {/* App Icon */}
        <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden shadow-2xl shadow-emerald-950/40 border border-white/10 mb-6 relative group transform hover:scale-105 transition-transform duration-300">
          <img 
            src="/icons/icon-192x192.png" 
            alt="TS Hub Icon" 
            className="w-full h-full object-cover" 
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/10 pointer-events-none" />
        </div>

        {/* Title */}
        <h1 className="text-xl sm:text-2xl font-black tracking-[0.2em] text-white uppercase mb-2 drop-shadow-md">
          TIMBERSMITH JOINERY
        </h1>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm font-medium text-emerald-400/90 tracking-wider flex items-center gap-2">
          <span>System Initialising...</span>
        </p>
      </div>

      {/* Animated Green Dots at Bottom */}
      <div className="absolute bottom-12 sm:bottom-16 left-0 right-0 flex items-center justify-center gap-2.5">
        <span className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s] shadow-lg shadow-emerald-500/50" />
        <span className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s] shadow-lg shadow-emerald-500/50" />
        <span className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce shadow-lg shadow-emerald-500/50" />
      </div>
    </div>
  );
};
