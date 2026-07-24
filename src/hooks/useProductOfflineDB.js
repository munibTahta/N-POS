import { useState, useCallback, useEffect } from 'react';
import { useNetworkState } from './useNetworkState';
import searchStrategy from '../utils/searchStrategy';
import offlineDataSync from '../services/offlineDataSync';

/**
 * Hook untuk offline product database SQLite
 * Menangani sync produk dan pencarian offline
 */
const useProductOfflineDB = () => {
  const { isOnline } = useNetworkState();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [dbStats, setDbStats] = useState({
    totalProducts: 0,
    lastSync: null,
    syncStatus: 'idle'
  });

  /**
   * Search products using smart strategy (API → Electron → Memory)
   * @param {string} query - Search term
   * @param {boolean} isBarcode - Whether searching by barcode
   * @returns {Promise<Array>} Products matching query
   */
  const searchOfflineProducts = useCallback(async (query, isBarcode = false) => {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      // Debug: check memory cache status
      const memProducts = offlineDataSync.memoryCache?.products || [];
      if (memProducts.length === 0) {
        console.warn(`⚠️ Memory cache empty! Products not pre-cached yet`);
      }

      // Build electronSearch wrapper that calls productDB_searchProducts IPC
      const electronSearch = async ({ query: q, isBarcode: ib, limit = 50 }) => {
        try {
          const searchQuery = q || query;
          if (window?.electronAPI?.productDB_searchProducts) {
            const resp = await window.electronAPI.productDB_searchProducts(searchQuery, { limit, isBarcode: ib });
            // productDB_searchProducts returns { data, total, limit, offset }
            return resp?.data || [];
          }
          // Fallback to older dbSearchProducts
          if (window?.electronAPI?.dbSearchProducts) {
            const resp = await window.electronAPI.dbSearchProducts(searchQuery, { limit });
            return resp?.data || [];
          }
          return [];
        } catch (err) {
          console.error('electronSearch IPC error:', err);
          return [];
        }
      };

      // Use search strategy for intelligent fallback (API -> Electron DB -> Memory)
      const results = await searchStrategy.search(query, {
        isOnline,
        isBarcode,
        electronSearch,
        memoryProducts: memProducts
      });

      return results || [];
    } catch (err) {
      console.error('Error searching products:', err);
      return [];
    }
  }, [isOnline]);

  /**
   * Get single product by ID from offline DB
   * @param {number} productId
   * @returns {Promise<Object|null>}
   */
  const getProduct = useCallback(async (productId) => {
    try {
      if (!window.electronAPI?.database?.getProduct) {
        return null;
      }

      return await window.electronAPI.database.getProduct(productId);
    } catch (err) {
      console.error('Error getting product:', err);
      return null;
    }
  }, []);

  /**
   * Sync all products from API to offline database
   * @returns {Promise<void>}
   */
  const syncAllProducts = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    try {
      setIsSyncing(true);
      setSyncProgress(0);

      if (!window.electronAPI?.database?.syncProducts) {
        // Silently skip if Electron IPC not available (normal during initial load)
        setIsSyncing(false);
        return;
      }

      // Call Electron IPC to trigger sync
      const result = await window.electronAPI.database.syncProducts({
        onProgress: (progress) => setSyncProgress(progress)
      });

      setTotalProducts(result?.totalProducts || 0);
      setDbStats({
        totalProducts: result?.totalProducts || 0,
        lastSync: new Date().toISOString(),
        syncStatus: 'success'
      });
    } catch (err) {
      console.error('Product sync failed:', err);
      setDbStats(prev => ({
        ...prev,
        syncStatus: 'failed'
      }));
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing]);

  /**
   * Get database statistics
   * @returns {Promise<Object>}
   */
  const getDBStats = useCallback(async () => {
    try {
      if (!window.electronAPI?.database?.getStats) {
        return dbStats;
      }

      const stats = await window.electronAPI.database.getStats();
      setDbStats(stats);
      setTotalProducts(stats.totalProducts);
      return stats;
    } catch (err) {
      console.error('Error getting DB stats:', err);
      return dbStats;
    }
  }, [dbStats]);

  // Initialize on mount - load stats
  useEffect(() => {
    getDBStats();
  }, [getDBStats]);

  return {
    // Search/Get methods
    searchOfflineProducts,
    getProduct,
    // Sync methods
    syncAllProducts,
    getDBStats,
    // State
    isSyncing,
    syncProgress,
    totalProducts,
    dbStats
  };
};

export default useProductOfflineDB;
