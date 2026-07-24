import { useCallback } from 'react';
import { getTaxRates } from '../services/api';
import { dbBatchInsert } from '../utils/dbBatchOperations';
import { createOfflineDataHook } from './createOfflineDataHook';

/**
 * Unified hook for tax rate management
 * - Prefers API when online
 * - Persists to SQLite for offline fallback
 * - Essential for receipt calculations
 * Uses factory pattern to eliminate code duplication
 */
export const useOfflineTaxRates = () => {
  // Normalize API response
  const fetchTaxRatesFromAPI = useCallback(async (params = {}) => {
    const response = await getTaxRates(params);
    const taxes = response?.data?.data || response?.data || [];
    
    return Array.isArray(taxes) ? taxes : [];
  }, []);

  // Batch persist to SQLite
  const storeToDB = useCallback(async (taxesData) => {
    if (!window.electronAPI?.dbBatchInsert) return;
    
    const records = taxesData.map(tax => ({
      id_pajak: tax.id_pajak || tax.id,
      kode_pajak: tax.kode_pajak || tax.code || '',
      nama_pajak: tax.nama_pajak || tax.name || '',
      persentase: Number(tax.persentase || tax.percentage || 0),
      deskripsi: tax.deskripsi || tax.description || '',
      aktif: tax.aktif === undefined ? 1 : (tax.aktif ? 1 : 0),
      tipe_pajak: tax.tipe_pajak || tax.type || 'penjualan',
      sync_at: new Date().toISOString()
    }));

    try {
      await dbBatchInsert('tax_rates', records);
    } catch (err) {
      console.warn('⚠️ Failed to persist tax rates:', err);
    }
  }, []);

  // Load from SQLite
  const loadFromDB = useCallback(async () => {
    if (!window.electronAPI?.dbSelect) return [];
    
    try {
      const result = await window.electronAPI.dbSelect({
        table: 'tax_rates',
        limit: 100
      });
      return result || [];
    } catch (dbErr) {
      console.warn('⚠️ Failed to load tax rates from offline DB:', dbErr);
      return [];
    }
  }, []);

  // Use factory hook for all offline-first logic
  const { data, loading, error, lastSync, refetch, refresh, invalidateCache: invalidateCacheFactory } = createOfflineDataHook({
    tableName: 'tax_rates',
    fetchFn: fetchTaxRatesFromAPI,
    storeFn: storeToDB,
    loadFn: loadFromDB
  });

  /**
   * Get active tax rates only
   */
  const getActiveTaxRates = useCallback(() => {
    return data.filter(tax => tax.aktif === 1 || tax.aktif === true);
  }, [data]);

  /**
   * Get tax by code
   */
  const getTaxByCode = useCallback((code) => {
    return data.find(tax => tax.kode_pajak === code) || null;
  }, [data]);

  /**
   * Get tax by ID
   */
  const getTaxById = useCallback((taxId) => {
    return data.find(tax => tax.id_pajak === taxId) || null;
  }, [data]);

  /**
   * Calculate tax amount for a given base amount
   */
  const calculateTax = useCallback((baseAmount, taxCode) => {
    const tax = getTaxByCode(taxCode);
    if (!tax) return 0;
    return (baseAmount * tax.persentase) / 100;
  }, [getTaxByCode]);

  return {
    taxes: data,
    loading,
    error,
    lastSync,
    fetchTaxRates: refetch,
    getActiveTaxRates,
    getTaxByCode,
    getTaxById,
    calculateTax,
    invalidateCache: invalidateCacheFactory,
    refresh
  };
};

export default useOfflineTaxRates;
