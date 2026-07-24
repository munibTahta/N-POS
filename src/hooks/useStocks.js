import { useCallback } from 'react';
import { getWarehouseStock } from '../services/api';
import { dbBatchInsert } from '../utils/dbBatchOperations';
import { createOfflineDataHook } from './createOfflineDataHook';

/**
 * Unified hook for warehouse stock management
 * - Prefers API when online
 * - Persists complete stock data to SQLite for offline fallback
 * - Provides search, fetch, and detailed stock utilities
 * - Handles large dataset efficiently using factory pattern
 */
export const useStocks = () => {
  // Normalize API response to match expected format
  const fetchStocksFromAPI = useCallback(async (params = {}) => {
    try {
      const response = await getWarehouseStock(params);
      const stocks = Array.isArray(response?.data)
        ? response.data
        : response?.data?.data || response?.data || [];
      // Normalize fields
      return stocks.map(stock => ({
        ...stock,
        id_produk: stock.id_produk || stock.id,
        id_cabang: stock.id_cabang,
        jumlah: Number(stock.jumlah || 0),
        stok_minimum: Number(stock.stok_minimum || 0),
        lokasi_rak: stock.lokasi_rak || stock.lokasi || '',
        nama_produk: stock.Produk?.nama_produk || '',
        kode_produk: stock.Produk?.kode_produk || '',
        nama_kategori: stock.Produk?.Kategori?.nama_kategori || '',
        id_kategori: stock.Produk?.Kategori?.id_kategori || null,
        harga_beli: stock.Produk?.harga_beli || 0,
        harga_jual: stock.Produk?.harga_jual || 0,
        harga_grosir: stock.Produk?.harga_grosir || 0,
        min_qty_grosir: stock.Produk?.min_qty_grosir || 0
      }));
    } catch (err) {
      console.error('[useStocks] API Fetch Error:', err);
      throw err;
    }
  }, []);

  // Batch persist to SQLite
  const storeToDB = useCallback(async (stocksData) => {
    if (!window.electronAPI?.dbBatchInsert) return;
    
    const records = stocksData.map(stock => ({
      id_produk: stock.id_produk,
      id_cabang: stock.id_cabang || null,
      jumlah: stock.jumlah || 0,
      stok_minimum: stock.stok_minimum || 0,
      lokasi_rak: stock.lokasi_rak || '',
      nama_produk: stock.Produk?.nama_produk || '',
      kode_produk: stock.Produk?.kode_produk || '',
      nama_kategori: stock.Produk?.Kategori?.nama_kategori || '',
      id_kategori: stock.Produk?.Kategori?.id_kategori || null,
      harga_beli: stock.Produk?.harga_beli || 0,
      harga_jual: stock.Produk?.harga_jual || 0,
      harga_grosir: stock.Produk?.harga_grosir || 0,
      min_qty_grosir: stock.Produk?.min_qty_grosir || 0,
      sync_at: new Date().toISOString()
    }));

    try {
      await dbBatchInsert('warehouse_stock', records);
    } catch (err) {
      console.warn('⚠️ Failed to persist warehouse stock:', err);
    }
  }, []);

  // Load from SQLite with limit for large dataset
  const loadFromDB = useCallback(async () => {
    if (!window.electronAPI?.dbSelect) {
      console.warn('[useStocks] dbSelect API not available');
      return [];
    }
    
    try {
      const result = await window.electronAPI.dbSelect({
        table: 'warehouse_stock',
        limit: 10000
      });
      return result || [];
    } catch (dbErr) {
      console.warn('⚠️ Failed to load warehouse stock from offline DB:', dbErr);
      return [];
    }
  }, []);

  // Use factory hook for all offline-first logic
  const offlineHook = createOfflineDataHook({
    tableName: 'warehouse_stock',
    fetchFn: fetchStocksFromAPI,
    storeFn: storeToDB,
    loadFn: loadFromDB
  });
  
  const { data, loading, error, lastSync, refetch, refresh, invalidateCache: invalidateCacheFactory } = offlineHook();

  /**
   * Search stocks locally
   */
  const searchStocks = useCallback((query) => {
    if (!query) return data;

    const q = query.toLowerCase();
    return data.filter(stock =>
      (stock.nama_produk?.toLowerCase().includes(q)) ||
      (stock.kode_produk?.toLowerCase().includes(q)) ||
      (stock.nama_kategori?.toLowerCase().includes(q)) ||
      (stock.lokasi_rak?.toLowerCase().includes(q))
    );
  }, [data]);

  /**
   * Get stock by product ID
   */
  const getStockByProductId = useCallback((productId) => {
    return data.find(s => s.id_produk === productId) || null;
  }, [data]);

  /**
   * Get low stock items (below minimum)
   */
  const getLowStockItems = useCallback(() => {
    return data.filter(stock => stock.jumlah < (stock.stok_minimum || 0));
  }, [data]);

  return {
    stocks: data,
    loading,
    error,
    lastSync,
    fetchStocks: refetch,
    searchStocks,
    getStockByProductId,
    getLowStockItems,
    invalidateCache: invalidateCacheFactory,
    refresh
  };
};

export default useStocks;
