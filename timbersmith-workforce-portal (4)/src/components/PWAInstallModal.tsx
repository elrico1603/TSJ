import React, { useState, useEffect } from 'react';
import { Download, X, Sparkles, Smartphone } from 'lucide-react';

export const PWAInstallModal: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if user previously dismissed or installed
    const hasResponded = localStorage.getItem('ts_pwa_install_choice');
    if (hasResponded) {
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsOpen(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed
    const handleAppInstalled = () => {
      localStorage.setItem('ts_pwa_install_choice', 'installed');
      setIsOpen(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      localStorage.setItem('ts_pwa_install_choice', 'installed');
    } else {
      localStorage.setItem('ts_pwa_install_choice', 'dismissed');
    }
    setDeferredPrompt(null);
    setIsOpen(false);
  };

  const handleLaterClick = () => {
    localStorage.setItem('ts_pwa_install_choice', 'later');
    setIsOpen(false);
  };

  if (!isOpen || !deferredPrompt) return null;

  return (
    <div className="fixed inset-0 z-[999990] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div 
        className="w-full max-w-md bg-[#18181f] border border-white/10 rounded-3xl p-6 shadow-2xl text-white relative overflow-hidden"
        style={{
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <button 
          onClick={handleLaterClick}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/5 transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-black/40 border border-white/10 flex-shrink-0 p-1 shadow-inner">
            <img 
              src="/icons/icon-192x192.png" 
              alt="TS Hub Icon" 
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold tracking-wider uppercase mb-1">
              <Sparkles size={12} /> PWA Experience
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Install TS Hub
            </h2>
          </div>
        </div>

        <p className="text-sm text-gray-300 leading-relaxed mb-6">
          Install TS Hub for faster access, offline support and a better mobile experience.
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={handleLaterClick}
            className="flex-1 py-3.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold text-sm transition-all duration-200 text-center"
          >
            Later
          </button>
          <button
            onClick={handleInstallClick}
            className="flex-1 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-extrabold text-sm shadow-lg shadow-emerald-950/50 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Install
          </button>
        </div>
      </div>
    </div>
  );
};
