import { useCallback } from 'react';
import { getDiscounts } from '../services/api';
import { dbBatchInsert } from '../utils/dbBatchOperations';
import { createOfflineDataHook } from './createOfflineDataHook';

/**
 * Unified hook for discount/coupon management
 * - Prefers API when online
 * - Persists to SQLite for offline fallback
 * - Handles discount validation and calculation
 * Uses factory pattern to eliminate code duplication
 */
export const useOfflineDiscounts = () => {
  // Normalize API response
  const fetchDiscountsFromAPI = useCallback(async (params = {}) => {
    const response = await getDiscounts(params);
    const discounts = response?.data?.data || response?.data || [];
    
    return Array.isArray(discounts) ? discounts : [];
  }, []);

  // Batch persist to SQLite
  const storeToDB = useCallback(async (discountsData) => {
    if (!window.electronAPI?.dbBatchInsert) return;
    
    const records = discountsData.map(discount => ({
      id_diskon: discount.id_diskon || discount.id,
      kode_diskon: discount.kode_diskon || discount.code || '',
      nama_diskon: discount.nama_diskon || discount.name || '',
      tipe_diskon: discount.tipe_diskon || discount.type || 'nominal',
      nilai_diskon: Number(discount.nilai_diskon || discount.value || 0),
      minimum_transaksi: Number(discount.minimum_transaksi || 0),
      maksimum_transaksi: discount.maksimum_transaksi || null,
      tanggal_mulai: discount.tanggal_mulai || discount.start_date || null,
      tanggal_selesai: discount.tanggal_selesai || discount.end_date || null,
      aktif: discount.aktif === undefined ? 1 : (discount.aktif ? 1 : 0),
      dapat_dikombinasi: discount.dapat_dikombinasi === undefined ? 0 : (discount.dapat_dikombinasi ? 1 : 0),
      deskripsi: discount.deskripsi || discount.description || '',
      sync_at: new Date().toISOString()
    }));

    try {
      await dbBatchInsert('discounts', records);
    } catch (err) {
      console.warn('⚠️ Failed to persist discounts:', err);
    }
  }, []);

  // Load from SQLite
  const loadFromDB = useCallback(async () => {
    if (!window.electronAPI?.dbSelect) return [];
    
    try {
      const result = await window.electronAPI.dbSelect({
        table: 'discounts',
        limit: 500
      });
      return result || [];
    } catch (dbErr) {
      console.warn('⚠️ Failed to load discounts from offline DB:', dbErr);
      return [];
    }
  }, []);

  // Use factory hook for all offline-first logic
  const { data, loading, error, lastSync, refetch, refresh, invalidateCache: invalidateCacheFactory } = createOfflineDataHook({
    tableName: 'discounts',
    fetchFn: fetchDiscountsFromAPI,
    storeFn: storeToDB,
    loadFn: loadFromDB
  });

  /**
   * Get active discounts only
   */
  const getActiveDiscounts = useCallback(() => {
    return data.filter(discount => {
      const now = new Date();
      const isActive = discount.aktif === 1 || discount.aktif === true;
      const isBeforeStart = !discount.tanggal_mulai || new Date(discount.tanggal_mulai) <= now;
      const isAfterEnd = !discount.tanggal_selesai || new Date(discount.tanggal_selesai) >= now;
      
      return isActive && isBeforeStart && isAfterEnd;
    });
  }, [data]);

  /**
   * Get discount by code
   */
  const getDiscountByCode = useCallback((code) => {
    return data.find(d => d.kode_diskon === code) || null;
  }, [data]);

  /**
   * Calculate discount value
   */
  const calculateDiscount = useCallback((amount, discountCode) => {
    const discount = getDiscountByCode(discountCode);
    if (!discount) return 0;
    
    if (amount < discount.minimum_transaksi) return 0;
    
    let discountValue = 0;
    if (discount.tipe_diskon === 'nominal') {
      discountValue = discount.nilai_diskon;
    } else if (discount.tipe_diskon === 'persentase') {
      discountValue = (amount * discount.nilai_diskon) / 100;
    }
    
    // Check maximum discount
    if (discount.maksimum_transaksi && discountValue > discount.maksimum_transaksi) {
      discountValue = discount.maksimum_transaksi;
    }
    
    return discountValue;
  }, [getDiscountByCode]);

  return {
    discounts: data,
    loading,
    error,
    lastSync,
    fetchDiscounts: refetch,
    getActiveDiscounts,
    getDiscountByCode,
    calculateDiscount,
    invalidateCache: invalidateCacheFactory,
    refresh
  };
};

export default useOfflineDiscounts;
