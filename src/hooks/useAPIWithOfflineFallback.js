/**
 * Hook: useAPIWithOfflineFallback
 * Menyediakan akses ke API dengan automatic fallback ke offline data
 * Membuat pages tidak perlu khawatir soal online/offline state
 */

import { useCallback } from 'react';
import APIWithOfflineSupport from '../services/apiWithOfflineSupport';
import { useSync } from '../context/SyncContext';

export const useAPIWithOfflineFallback = () => {
  const { isOnline } = useSync();

  // Derive offlineMode from isOnline - no setState needed
  const offlineMode = !isOnline;

  // Product functions
  const getProducts = useCallback(async (params = {}) => {
    return await APIWithOfflineSupport.getProducts(params);
  }, []);

  const searchProducts = useCallback(async (query, limit = 100) => {
    return await APIWithOfflineSupport.searchProducts(query, limit);
  }, []);

  const getProductById = useCallback(async (id) => {
    if (!isOnline) {
      console.warn('Cannot get single product detail in offline mode');
      return null;
    }
    try {
      const response = await APIWithOfflineSupport.getProductById(id);
      return response?.data;
    } catch (error) {
      console.error('Failed to get product:', error);
      return null;
    }
  }, [isOnline]);

  // Category functions
  const getCategories = useCallback(async () => {
    return await APIWithOfflineSupport.getCategories();
  }, []);

  // Unit functions
  const getUnits = useCallback(async () => {
    return await APIWithOfflineSupport.getUnits();
  }, []);

  // Payment method functions
  const getPaymentMethods = useCallback(async () => {
    return await APIWithOfflineSupport.getPaymentMethods();
  }, []);

  // Customer functions
  const getCustomers = useCallback(async (params = {}) => {
    return await APIWithOfflineSupport.getPelanggan(params);
  }, []);

  // Transaction functions
  const getTransactions = useCallback(async (filters = {}) => {
    return await APIWithOfflineSupport.getTransactions(filters);
  }, []);

  const saveTransaction = useCallback(async (data) => {
    return await APIWithOfflineSupport.saveTransaction(data);
  }, []);

  // Stock functions
  const getStock = useCallback(async (idCabang) => {
    return await APIWithOfflineSupport.getStock(idCabang);
  }, []);

  // Offline status
  const checkOfflineReadiness = useCallback(async () => {
    return await APIWithOfflineSupport.checkOfflineReadiness();
  }, []);

  const getCacheStatus = useCallback(() => {
    return APIWithOfflineSupport.getCacheStatus();
  }, []);

  return {
    // State
    offlineMode,
    isOnline,

    // Product API
    getProducts,
    searchProducts,
    getProductById,

    // Master Data API
    getCategories,
    getUnits,
    getPaymentMethods,
    getCustomers,

    // Transaction API
    getTransactions,
    saveTransaction,

    // Stock API
    getStock,

    // Offline utilities
    checkOfflineReadiness,
    getCacheStatus
  };
};

export default useAPIWithOfflineFallback;
