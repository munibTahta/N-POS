import { useCallback } from 'react';
import { getPelanggan } from '../services/api';
import { dbBatchInsert } from '../utils/dbBatchOperations';
import { createOfflineDataHook } from './createOfflineDataHook';

/**
 * Unified hook for customer management
 * - Prefers API when online
 * - Persists to SQLite for offline fallback
 * - Provides search, fetch, and cache utilities
 * Uses factory pattern to eliminate code duplication
 */
export const useCustomers = () => {
  // Transform API response to normalized format
  const fetchCustomersFromAPI = useCallback(async (params = {}) => {
    const response = await getPelanggan(params);
    return Array.isArray(response?.data)
      ? response.data
      : response?.data?.data || response?.data?.results || [];
  }, []);

  // Batch persist to SQLite using optimized batch operations
  const storeToDB = useCallback(async (customersData) => {
    if (!window.electronAPI?.dbBatchInsert) return;
    
    const records = customersData.map(customer => ({
      id_pelanggan: customer.id_pelanggan || customer.id,
      nama_pelanggan: customer.nama_pelanggan,
      nomor_hp: customer.no_hp || customer.nomor_hp,
      email: customer.email,
      alamat: customer.alamat,
      created_at: customer.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    try {
      await dbBatchInsert('customers', records);
    } catch (err) {
      console.warn('⚠️ Failed to persist customers to offline DB:', err);
    }
  }, []);

  // Load from SQLite with limit
  const loadFromDB = useCallback(async () => {
    if (!window.electronAPI?.dbSelect) return [];
    
    try {
      const result = await window.electronAPI.dbSelect({
        table: 'customers',
        limit: 1000
      });
      return result || [];
    } catch (dbErr) {
      console.warn('⚠️ Failed to load customers from offline DB:', dbErr);
      return [];
    }
  }, []);

  // Use factory hook for all offline-first logic
  const { data, loading, error, lastSync, refetch, refresh, invalidateCache: invalidateCacheFactory } = createOfflineDataHook({
    tableName: 'customers',
    fetchFn: fetchCustomersFromAPI,
    storeFn: storeToDB,
    loadFn: loadFromDB
  });

  /**
   * Search customers locally
   */
  const searchCustomers = useCallback((query) => {
    if (!query) return data;

    const q = query.toLowerCase();
    return data.filter(customer =>
      (customer.nama_pelanggan?.toLowerCase().includes(q)) ||
      (customer.no_hp?.includes(q)) ||
      (customer.nomor_hp?.includes(q)) ||
      (customer.email?.toLowerCase().includes(q)) ||
      (customer.alamat?.toLowerCase().includes(q))
    );
  }, [data]);

  /**
   * Get customer by ID
   */
  const getCustomerById = useCallback((customerId) => {
    return data.find(c => 
      c.id_pelanggan === customerId || c.id === customerId
    ) || null;
  }, [data]);

  return {
    customers: data,
    loading,
    error,
    lastSync,
    fetchCustomers: refetch,
    searchCustomers,
    getCustomerById,
    invalidateCache: invalidateCacheFactory,
    refresh
  };
};

export default useCustomers;
