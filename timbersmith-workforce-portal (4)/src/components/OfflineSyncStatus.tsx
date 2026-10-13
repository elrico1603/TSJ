import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Clock } from 'lucide-react';
import { offlineSyncService } from '../services/offlineSyncService';

interface OfflineSyncStatusProps {
  className?: string;
  announce?: (msg: string) => void;
}

export const OfflineSyncStatus: React.FC<OfflineSyncStatusProps> = ({ className = '', announce }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);

  const checkPending = () => {
    const queue = offlineSyncService.getQueue();
    setPendingCount(queue.length);
  };

  const handleSync = async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    if (announce) announce('Syncing queued offline actions with cloud database...');
    try {
      const res = await offlineSyncService.processQueue((remaining) => {
        setPendingCount(remaining);
      });
      if (res.success > 0 && announce) {
        announce(`Successfully synchronized ${res.success} offline transactions.`);
      }
    } catch (e) {
      console.error('Offline sync failed:', e);
    } finally {
      setIsSyncing(false);
      checkPending();
    }
  };

  useEffect(() => {
    checkPending();

    const handleOnline = () => {
      setIsOnline(true);
      if (announce) announce('Network connection restored. Online.');
      handleSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (announce) announce('Network connection lost. Operating in offline mode.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic check for pending queue changes
    const interval = setInterval(checkPending, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      {isSyncing ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase tracking-wider animate-pulse">
          <RefreshCw size={12} className="animate-spin text-blue-400" />
          <span>Syncing</span>
        </span>
      ) : pendingCount > 0 ? (
        <button
          onClick={handleSync}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-[10px] font-black uppercase tracking-wider transition-all"
          title="Click to process pending offline sync queue"
        >
          <Clock size={12} className="animate-bounce text-amber-400" />
          <span>Pending ({pendingCount})</span>
        </button>
      ) : isOnline ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
          <Wifi size={12} className="text-emerald-400" />
          <span>Online</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-wider">
          <WifiOff size={12} className="text-red-400" />
          <span>Offline</span>
        </span>
      )}
    </div>
  );
};
