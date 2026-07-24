import React from 'react';
import { Smartphone, Package, Folder, Users, CreditCard, Ruler, BarChart3, Database, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import { useOfflineStats } from '../hooks/useOfflineStats';
import offlineDataSync from '../services/offlineDataSync';

export const OfflineDataStats = () => {
  const stats = useOfflineStats();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

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
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4 flex items-center">
        <Smartphone className="w-6 h-6 mr-2" />
        Manajemen Data Offline
      </h2>

      {/* Statistics Grid */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50 rounded border border-blue-200">
          <div className="text-2xl font-bold text-blue-600">{stats.products}</div>
          <div className="text-sm text-gray-600 flex items-center">
            <Package className="w-4 h-4 mr-1" />
            Produk
          </div>
        </div>
        
        <div className="p-4 bg-green-50 rounded border border-green-200">
          <div className="text-2xl font-bold text-green-600">{stats.categories}</div>
          <div className="text-sm text-gray-600 flex items-center">
            <Folder className="w-4 h-4 mr-1" />
            Kategori
          </div>
        </div>
        
        <div className="p-4 bg-purple-50 rounded border border-purple-200">
          <div className="text-2xl font-bold text-purple-600">{stats.customers}</div>
          <div className="text-sm text-gray-600 flex items-center">
            <Users className="w-4 h-4 mr-1" />
            Pelanggan
          </div>
        </div>

        <div className="p-4 bg-orange-50 rounded border border-orange-200">
          <div className="text-2xl font-bold text-orange-600">{stats.paymentMethods}</div>
          <div className="text-sm text-gray-600 flex items-center">
            <CreditCard className="w-4 h-4 mr-1" />
            Metode Bayar
          </div>
        </div>

        <div className="p-4 bg-yellow-50 rounded border border-yellow-200">
          <div className="text-2xl font-bold text-yellow-600">{stats.units}</div>
          <div className="text-sm text-gray-600 flex items-center">
            <Ruler className="w-4 h-4 mr-1" />
            Satuan
          </div>
        </div>

        <div className="p-4 bg-indigo-50 rounded border border-indigo-200">
          <div className="text-2xl font-bold text-indigo-600">{stats.stocks}</div>
          <div className="text-sm text-gray-600 flex items-center">
            <BarChart3 className="w-4 h-4 mr-1" />
            Stok
          </div>
        </div>
      </div>

      {/* Total Info */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-100 to-blue-50 rounded border border-blue-300">
        <div className="text-lg font-bold text-blue-900 flex items-center">
          <Database className="w-5 h-5 mr-2" />
          Total Data Offline: <span className="text-2xl">{stats.total}</span> items
        </div>
        {stats.lastUpdate && (
          <div className="text-sm text-gray-600 mt-1">
            Last updated: {stats.lastUpdate.toLocaleTimeString('id-ID')}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={handleRefreshSync}
          disabled={isRefreshing}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 font-semibold flex items-center justify-center"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {isRefreshing ? 'Refreshing...' : 'Refresh Data Offline'}
        </button>
      </div>

      {/* Status */}
      {stats.products > 0 ? (
        <div className="p-4 bg-green-50 border border-green-200 rounded text-green-700 flex items-center">
          <CheckCircle className="w-4 h-4 mr-2" />
          Data offline tersedia. Pencarian bekerja offline tanpa internet!
        </div>
      ) : (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 flex items-center">
          <Clock className="w-4 h-4 mr-2" />
          Menunggu data offline di-sync... Klik Refresh jika belum dimulai.
        </div>
      )}
    </div>
  );
};

export default OfflineDataStats;
