/**
 * API Wrapper dengan Automatic Offline Fallback
 * Menambah layer yang memastikan data selalu tersedia (online atau offline)
 */

import * as api from './api';
import offlineAPIFallback from './offlineAPIFallback';

class APIWithOfflineSupport {
  /**
   * Wrapper untuk getProducts dengan fallback
   */
  static async getProducts(params = {}) {
    try {
      // Cek online status
      if (!navigator.onLine) {
        return await offlineAPIFallback.getProducts(params);
      }

      // Try API first
      const response = await api.getProducts(params);
      const data = response?.data?.data || response?.data || [];
      return {
        data: Array.isArray(data) ? data : [],
        total: response?.data?.total || data.length,
        cached: response?.cached || false,
        source: 'api'
      };
    } catch (error) {
      console.warn('❌ API failed for products, using offline fallback:', error.message);
      // Fallback ke offline
      return await offlineAPIFallback.getProducts(params);
    }
  }

  /**
   * Wrapper untuk searchProducts dengan fallback
   */
  static async searchProducts(query, limit = 100) {
    try {
      if (!navigator.onLine) {
        const products = await offlineAPIFallback.getProducts({ search: query, limit });
        return products.data || [];
      }

      const results = await api.searchProducts(query, limit);
      return Array.isArray(results) ? results : [];
    } catch (error) {
      console.warn('❌ API search failed, using offline search:', error.message);
      const products = await offlineAPIFallback.getProducts({ search: query, limit });
      return products.data || [];
    }
  }

  /**
   * Wrapper untuk getCategories dengan fallback
   */
  static async getCategories() {
    try {
      if (!navigator.onLine) {
        return await offlineAPIFallback.getCategories();
      }

      const response = await api.getCategories();
      const data = response?.data?.data || response?.data || [];
      return {
        data: Array.isArray(data) ? data : [],
        cached: response?.cached || false,
        source: 'api'
      };
    } catch (_error) {
      console.warn('❌ API failed for categories, using offline fallback');
      return await offlineAPIFallback.getCategories();
    }
  }

  /**
   * Wrapper untuk getUnits dengan fallback
   */
  static async getUnits() {
    try {
      if (!navigator.onLine) {
        return await offlineAPIFallback.getUnits();
      }

      const response = await api.getUnits();
      const data = response?.data?.data || response?.data || [];
      return {
        data: Array.isArray(data) ? data : [],
        cached: response?.cached || false,
        source: 'api'
      };
    } catch (_error) {
      console.warn('❌ API failed for units, using offline fallback');
      return await offlineAPIFallback.getUnits();
    }
  }

  /**
   * Wrapper untuk getPaymentMethods dengan fallback
   */
  static async getPaymentMethods() {
    try {
      if (!navigator.onLine) {
        return await offlineAPIFallback.getPaymentMethods();
      }

      const response = await api.getPaymentMethods();
      const data = response?.data?.data || response?.data || [];
      return {
        data: Array.isArray(data) ? data : [],
        cached: response?.cached || false,
        source: 'api'
      };
    } catch (_error) {
      console.warn('❌ API failed for payment methods, using offline fallback');
      return await offlineAPIFallback.getPaymentMethods();
    }
  }

  /**
   * Wrapper untuk getPelanggan (customers) dengan fallback
   */
  static async getPelanggan(params = {}) {
    try {
      if (!navigator.onLine) {
        return await offlineAPIFallback.getCustomers();
      }

      const response = await api.getPelanggan?.(params) || api.getCustomers?.(params);
      const data = response?.data?.data || response?.data || [];
      return {
        data: Array.isArray(data) ? data : [],
        cached: response?.cached || false,
        source: 'api'
      };
    } catch (_error) {
      console.warn('❌ API failed for customers, using offline fallback');
      return await offlineAPIFallback.getCustomers();
    }
  }

  /**
   * Wrapper untuk save transaction - dengan queue offline jika diperlukan
   */
  static async saveTransaction(data) {
    try {
      if (!navigator.onLine) {
        return await offlineAPIFallback.saveTransaction(data);
      }

      // Try API first
      const response = await api.createTransaction?.(data) || api.saveTransaction?.(data);
      return {
        success: true,
        id: response?.data?.id,
        offline: false,
        message: 'Transaksi disimpan ke server'
      };
    } catch (_error) {
      console.warn('❌ API failed for transaction, saving offline:', _error.message);
      // Fallback ke offline save
      return await offlineAPIFallback.saveTransaction(data);
    }
  }

  /**
   * Get transactions dengan fallback
   */
  static async getTransactions(filters = {}) {
    try {
      if (!navigator.onLine) {
        return await offlineAPIFallback.getTransactions(filters);
      }

      const response = await api.getTransactions?.(filters) || api.getSalesHistory?.(filters);
      const data = response?.data?.data || response?.data || [];
      return {
        data: Array.isArray(data) ? data : [],
        cached: response?.cached || false,
        source: 'api'
      };
    } catch (_error) {
      console.warn('❌ API failed for transactions, using offline fallback');
      return await offlineAPIFallback.getTransactions(filters);
    }
  }

  /**
   * Wrapper untuk getStock dengan fallback
   */
  static async getStock(idCabang) {
    try {
      if (!navigator.onLine) {
        return await offlineAPIFallback.getStock(idCabang);
      }

      const response = await api.getStock?.(idCabang);
      const data = response?.data?.data || response?.data || [];
      return {
        data: Array.isArray(data) ? data : [],
        cached: response?.cached || false,
        source: 'api'
      };
    } catch (_error) {
      console.warn('❌ API failed for stock, using offline fallback');
      return await offlineAPIFallback.getStock(idCabang);
    }
  }

  /**
   * Check offline readiness sebelum melakukan operasi
   */
  static async checkOfflineReadiness() {
    return await offlineAPIFallback.checkOfflineReadiness();
  }

  /**
   * Get cache status
   */
  static getCacheStatus() {
    return offlineAPIFallback.getCacheStatus();
  }

  /**
   * Passthrough untuk API methods yang tidak butuh offline support
   */
  static getProductById(id) {
    return api.getProductById(id);
  }

  static createUser(userData) {
    return api.createUser(userData);
  }

  static updateUser(id, userData) {
    return api.updateUser(id, userData);
  }

  static deleteUser(id) {
    return api.deleteUser(id);
  }

  static login(credentials) {
    return api.login(credentials);
  }

  static getMySettings() {
    return api.getMySettings();
  }

  static addProduct(productData) {
    return api.addProduct(productData);
  }

  static updateProduct(id, productData) {
    return api.updateProduct(id, productData);
  }

  static deleteProduct(id) {
    return api.deleteProduct(id);
  }

  static addCategory(categoryData) {
    return api.addCategory(categoryData);
  }

  static updateCategory(id, categoryData) {
    return api.updateCategory(id, categoryData);
  }

  static deleteCategory(id) {
    return api.deleteCategory(id);
  }

  static addCustomer(customerData) {
    return api.addCustomer?.(customerData) || api.createCustomer?.(customerData);
  }

  static updateCustomer(id, customerData) {
    return api.updateCustomer?.(id, customerData);
  }

  static deleteCustomer(id) {
    return api.deleteCustomer?.(id);
  }
}

export default APIWithOfflineSupport;
export { APIWithOfflineSupport };
