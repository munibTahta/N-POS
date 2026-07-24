/**
 * Offline Product Sync Settings Component
 * User dapat memilih kategori mana saja yang ingin di-sync untuk offline
 */

import React, { useState, useEffect } from 'react';
import { useSmartProductSync } from '../hooks/useSmartProductSync';
import { getCategories } from '../services/api';

export const OfflineProductSyncSettings = () => {
  const {
    isSyncing,
    syncProgress,
    cachedProductCount,
    syncedCategories,
    lastSyncTime,
    syncError,
    syncByCategories,
    clearCache
  } = useSmartProductSync();

  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await getCategories();
        const cats = res.data?.data || [];
        setCategories(cats);
        // Pre-select synced categories
        setSelectedCategories(syncedCategories);
      } catch (error) {
        console.error('Error loading categories:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, [syncedCategories]);

  const handleCategoryToggle = (categoryId) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSync = async () => {
    if (selectedCategories.length === 0) {
      alert('Pilih minimal satu kategori untuk di-sync');
      return;
    }
    await syncByCategories(selectedCategories);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">📱 Offline Product Sync</h2>

      {/* Storage Info */}
      <div className="mb-6 p-4 bg-blue-50 rounded border border-blue-200">
        <div className="text-sm text-gray-600">
          <p>💾 Produk di-cache: <strong>{cachedProductCount}</strong> items</p>
          {lastSyncTime && (
            <p>🕐 Last sync: {lastSyncTime.toLocaleString('id-ID')}</p>
          )}
        </div>
      </div>

      {/* Category Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Pilih kategori untuk offline:</h3>
        {loading ? (
          <div>Loading categories...</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {categories.map(category => (
              <label key={category.id} className="flex items-center p-2 border rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category.id)}
                  onChange={() => handleCategoryToggle(category.id)}
                  className="mr-3"
                />
                <span>{category.nama_kategori}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Error Message */}
      {syncError && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700">
          {syncError}
        </div>
      )}

      {/* Progress Bar */}
      {isSyncing && (
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${syncProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">Syncing: {syncProgress}%</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSync}
          disabled={isSyncing || selectedCategories.length === 0}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isSyncing ? '🔄 Syncing...' : '📥 Sync Sekarang'}
        </button>
        <button
          onClick={clearCache}
          disabled={isSyncing || cachedProductCount === 0}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
        >
          🗑️ Clear
        </button>
      </div>

      {/* Info */}
      <div className="mt-6 p-4 bg-gray-50 rounded text-sm text-gray-600">
        <h4 className="font-semibold mb-2">💡 Tips:</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>Sync kategori yang sering dijual untuk offline access</li>
          <li>Setiap kategori bisa berisi ratusan produk</li>
          <li>Data tersimpan di device dan tersedia tanpa internet</li>
          <li>Barcode scan bekerja offline untuk kategori yang di-sync</li>
          <li>Sync otomatis setiap 24 jam saat online</li>
        </ul>
      </div>
    </div>
  );
};

export default OfflineProductSyncSettings;
