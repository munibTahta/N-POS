// src/hooks/useOptimizedStockReport.js
/**
 * Optimized Stock Report Hook
 * Handles large stock reports with pagination to prevent memory bloat
 * 
 * Instead of loading all stock data (14MB+) at once:
 * - Load categories first (cached)
 * - Load stock per-category on demand
 * - Use pagination for large categories
 * - Cache only small summaries
 */

import { useState, useCallback, useRef } from 'react';
import { getStockReport, getProducts, searchProducts } from '../services/api';
import { logger } from '../utils/logger';
import CacheManager from '../utils/CacheManager';

export const useOptimizedStockReport = () => {
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cacheRef = useRef(new Map()); // Local cache for current session

  /**
   * Load stock for specific category (on-demand)
   * This prevents loading all stock data at once
   */
  const loadStockByCategory = useCallback(async (categoryId) => {
    // Check session cache first
    if (cacheRef.current.has(categoryId)) {
      return cacheRef.current.get(categoryId);
    }

    try {
      setLoading(true);
      
      // Load products in this category
      const response = await searchProducts({ 
        kategori_id: categoryId,
        limit: 1000, // Load in chunks
        page: 1
      });

      const products = response.data.data || [];
      cacheRef.current.set(categoryId, products);

      logger.info(`✅ Loaded ${products.length} products for category ${categoryId}`);
      return products;
    } catch (err) {
      logger.error(`Error loading category ${categoryId}:`, err);
      setError(`Gagal memuat stok kategori`);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load stock summary only (lightweight)
   * Returns aggregated data without individual item details
   */
  const loadStockSummary = useCallback(async () => {
    try {
      setLoading(true);

      // Use centralized helper: only use cache when offline
      const cachedSummary = CacheManager.getCachedIfOffline('/stok-summary');
      if (cachedSummary) {
        logger.info('📦 Using cached stock summary (offline)');
        setStockData(cachedSummary);
        return cachedSummary;
      }

      // Load all products (cached already)
      const productsResponse = await getProducts({ limit: 99999 });
      const products = productsResponse.data.data || [];

      // Build summary: count + total value per category
      const summary = {};
      products.forEach(product => {
        const catId = product.kategori_id;
        if (!summary[catId]) {
          summary[catId] = {
            kategori_id: catId,
            kategori_nama: product.kategori_nama,
            total_items: 0,
            total_quantity: 0,
            total_value: 0
          };
        }
        summary[catId].total_items += 1;
        summary[catId].total_quantity += product.stok || 0;
        summary[catId].total_value += (product.harga_jual || 0) * (product.stok || 0);
      });

      const summaryArray = Object.values(summary);

      // Cache for 30 minutes (summary is small)
      CacheManager.set('/stok-summary', summaryArray, 30 * 60 * 1000);
      setStockData(summaryArray);

      logger.info(`✅ Loaded stock summary: ${summaryArray.length} categories`);
      return summaryArray;
    } catch (err) {
      logger.error('Error loading stock summary:', err);
      setError('Gagal memuat ringkasan stok');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Search products efficiently without loading full report
   */
  const searchStock = useCallback(async (query) => {
    try {
      setLoading(true);

      const response = await searchProducts({
        search: query,
        limit: 100 // Paginated search
      });

      const results = response.data.data || [];
      logger.info(`✅ Found ${results.length} products matching: ${query}`);
      return results;
    } catch (err) {
      logger.error('Stock search error:', err);
      setError('Gagal mencari produk');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Full stock report (use cautiously - data is large)
   * Only use when absolutely needed
   */
  const loadFullStockReport = useCallback(async (options = {}) => {
    const { skipCache = false } = options;

    try {
      setLoading(true);

      // Only use cached full report when offline or when explicitly requested
      if (!skipCache) {
        const cached = CacheManager.getCachedIfOffline('/laporan/stok-full');
        if (cached) {
          logger.info('📦 Using cached full stock report (offline)');
          setStockData(cached);
          return cached;
        }
      }

      logger.warn('⚠️ Loading full stock report (14MB+) - this may cause memory pressure');

      const response = await getStockReport();
      const report = response.data.data || [];

      // Note: This won't be cached because /laporan/stok is in noCachePatterns
      logger.info(`✅ Loaded full stock report: ${report.length} items`);
      setStockData(report);

      return report;
    } catch (err) {
      logger.error('Error loading full stock report:', err);
      setError('Gagal memuat laporan stok lengkap');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Clear session cache
   */
  const clearSessionCache = useCallback(() => {
    cacheRef.current.clear();
    logger.info('🗑️ Cleared session stock cache');
  }, []);

  /**
   * Get memory usage estimate
   */
  const getMemoryEstimate = useCallback(() => {
    let totalSize = 0;
    for (const data of cacheRef.current.values()) {
      try {
        totalSize += JSON.stringify(data).length;
      } catch (_e) {
        // ignore serialization errors
      }
    }
    return (totalSize / 1024 / 1024).toFixed(2); // MB
  }, []);

  return {
    stockData,
    loading,
    error,
    // Methods
    loadStockByCategory,      // Load specific category (on-demand)
    loadStockSummary,         // Load lightweight summary
    searchStock,              // Search products
    loadFullStockReport,      // Full report (use cautiously)
    clearSessionCache,
    getMemoryEstimate
  };
};

export default useOptimizedStockReport;
