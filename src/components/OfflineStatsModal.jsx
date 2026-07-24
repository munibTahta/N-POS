import React from 'react';
import { useOfflineStats } from '../hooks/useOfflineStats';
import offlineDataSync from '../services/offlineDataSync';

export const OfflineStatsModal = ({ isOpen, onClose }) => {
  const stats = useOfflineStats();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  if (!isOpen) return null;

  const handleRefreshSync = async () => {
    setIsRefreshing(true);
    try {
      await offlineDataSync.preCacheEssentialData();
    } catch (err) {
      console.error('❌ Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-96 overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">📱 Data Offline</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-blue-50 rounded">
              <div className="text-lg font-bold text-blue-600">{stats.products}</div>
              <div className="text-xs text-gray-600">Produk</div>
            </div>
            
            <div className="p-3 bg-green-50 rounded">
              <div className="text-lg font-bold text-green-600">{stats.categories}</div>
              <div className="text-xs text-gray-600">Kategori</div>
            </div>

            <div className="p-3 bg-purple-50 rounded">
              <div className="text-lg font-bold text-purple-600">{stats.customers}</div>
              <div className="text-xs text-gray-600">Pelanggan</div>
            </div>

            <div className="p-3 bg-orange-50 rounded">
              <div className="text-lg font-bold text-orange-600">{stats.paymentMethods}</div>
              <div className="text-xs text-gray-600">Metode Bayar</div>
            </div>
          </div>

          {/* Total */}
          <div className="p-3 bg-gradient-to-r from-blue-100 to-blue-50 rounded border border-blue-300">
            <div className="text-sm font-bold text-blue-900">
              💾 Total: {stats.total} items
            </div>
            {stats.lastUpdate && (
              <div className="text-xs text-gray-600 mt-1">
                {stats.lastUpdate.toLocaleTimeString('id-ID')}
              </div>
            )}
          </div>

          {/* Status */}
          {stats.products > 0 ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
              ✅ Pencarian offline siap!
            </div>
          ) : (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
              ⏳ Menunggu sync data...
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={handleRefreshSync}
            disabled={isRefreshing}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 font-semibold text-sm"
          >
            {isRefreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfflineStatsModal;
