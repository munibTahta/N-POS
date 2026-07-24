import React, { useState, useEffect } from 'react';
import { useNetworkState } from '../hooks/useNetworkState';

/**
 * Offline Status Indicator Component
 * Shows current online/offline status, sync queue count, and cached data info
 * Now uses NetworkStateService for reliable network detection
 * Details shown on hover/click only
 */
export const OfflineStatusIndicator = () => {
  const { isOnline, offlineTimeFormatted } = useNetworkState();
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [showDetails, setShowDetails] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  useEffect(() => {
    // Show notification via toast or console
    const showNotification = (message, type = 'info', duration = 2000) => {
      // Try to dispatch custom event for any listeners
      try {
        window.dispatchEvent(new CustomEvent('notification', { 
          detail: { message, type, duration } 
        }));
      } catch (_err) {
        // Silent fail - notification system may not be available
      }
    };

    // Listen for sync events
    const handleSyncStart = () => {
      setIsSyncing(true);
      setSyncStatus('syncing');
    };

    const handleSyncComplete = (detail) => {
      setIsSyncing(false);
      setSyncStatus('complete');
      if (detail.synced > 0) {
        showNotification(`✅ Synced ${detail.synced} requests`, 'success', 2000);
      }
      setTimeout(() => setSyncStatus('idle'), 3000);
    };

    const handleSyncError = (detail) => {
      setIsSyncing(false);
      setSyncStatus('error');
      showNotification(`⚠️ Sync error: ${detail.failed} failed`, 'error', 3000);
    };

    window.addEventListener('syncStart', handleSyncStart);
    window.addEventListener('syncComplete', handleSyncComplete);
    window.addEventListener('syncError', handleSyncError);

    // Update queue count periodically
    const updateQueueCount = async () => {
      try {
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open('TokoPOS');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        const tx = db.transaction(['offlineQueue'], 'readonly');
        const store = tx.objectStore('offlineQueue');
        const request = store.getAll();

        request.onsuccess = () => {
          setQueueCount(request.result.length);
        };
      } catch (_error) {
        // Ignore errors
      }
    };

    updateQueueCount();
    const interval = setInterval(updateQueueCount, 5000);

    return () => {
      window.removeEventListener('syncStart', handleSyncStart);
      window.removeEventListener('syncComplete', handleSyncComplete);
      window.removeEventListener('syncError', handleSyncError);
      clearInterval(interval);
    };
  }, []);

  const handleClick = () => {
    if (!isOnline) {
      setIsClicked(!isClicked);
      setShowDetails(!showDetails);
    }
  };

  const handleMouseEnter = () => {
    if (!isOnline && !isClicked) {
      setShowDetails(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isOnline && !isClicked) {
      setShowDetails(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {/* Offline Mode Details - Shown on Hover/Click (Above Badge) */}
      {!isOnline && showDetails && (
        <div 
          className="absolute bottom-full mb-2 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 text-sm text-yellow-900 max-w-sm shadow-lg animate-in fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="font-bold mb-3 flex items-center gap-2">
            <span className="text-lg">📴</span>
            <span>Mode Offline Aktif</span>
          </div>
          <p className="text-xs mb-3 bg-yellow-100 px-2 py-1 rounded">⏱️ Offline sejak: {offlineTimeFormatted}</p>
          <div className="mb-3">
            <h4 className="text-xs font-semibold mb-2 text-yellow-900">✅ Fitur yang Tersedia:</h4>
            <ul className="text-xs space-y-1 ml-2">
              <li>✓ Lihat & cari produk (dari cache)</li>
              <li>✓ Lihat data pelanggan</li>
              <li>✓ Buat penjualan & transaksi</li>
              <li>✓ Cetak struk offline</li>
              <li>✓ Navigasi ke semua halaman</li>
            </ul>
          </div>
          {queueCount > 0 && (
            <div className="bg-orange-100 border border-orange-300 rounded px-2 py-2 text-xs">
              <div className="font-semibold text-orange-900">⏳ Menunggu Sinkronisasi:</div>
              <div className="font-bold text-orange-700 mt-1">{queueCount} transaksi akan tersinkron saat online</div>
            </div>
          )}
          <p className="text-xs mt-3 text-yellow-700 italic">💡 Klik badge di bawah untuk tutup panel ini</p>
        </div>
      )}

      {/* Main Status Badge - Always Visible */}
      <button
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={isOnline ? 'Online - Semua fitur tersedia' : 'Offline - Klik untuk detail fitur yang tersedia'}
        className={`
          flex items-center gap-2 px-3 py-2.5 rounded-lg shadow-lg font-semibold
          transition-all duration-200 cursor-pointer hover:shadow-xl
          ${isOnline 
            ? 'bg-green-500 text-white border-2 border-green-600' 
            : 'bg-yellow-500 text-white border-2 border-yellow-600'
          }
        `}
      >
        {/* Status Indicator Dot */}
        <div className={`
          w-2.5 h-2.5 rounded-full 
          ${isOnline ? 'bg-green-200' : 'bg-white'}
          ${!isOnline && 'animate-pulse'}
        `} />

        {/* Status Text */}
        <span className="text-sm">
          {isOnline ? ' Online' : ' Offline'}
        </span>

        {/* Queue Count Badge */}
        {queueCount > 0 && (
          <div className="ml-1 px-2 py-0.5 bg-red-600 text-white text-xs rounded-full font-bold">
            {queueCount}
          </div>
        )}

        {/* Sync Status */}
        {isSyncing && (
          <div className="ml-1 flex items-center gap-1">
            <div className="w-2 h-2 rounded-full border-1.5 border-blue-300 border-t-white animate-spin" />
            <span className="text-xs">Sync</span>
          </div>
        )}

        {syncStatus === 'complete' && (
          <span className="ml-2 text-xs text-green-700">✓ Tersinkron</span>
        )}
      </button>
    </div>
  );
};

export default OfflineStatusIndicator;
