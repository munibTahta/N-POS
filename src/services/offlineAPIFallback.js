/**
 * Offline API Fallback Service
 * Menyediakan data dari SQLite ketika API tidak tersedia
 * Membuat aplikasi fully operational offline seperti native desktop app
 */

import offlineDataSync from './offlineDataSync';

class OfflineAPIFallback {
  constructor() {
    this.memoryCache = offlineDataSync.memoryCache;
  }

  /**
   * Get products dengan fallback ke SQLite offline DB
   */
  async getProducts(params = {}) {
    const searchTerm = params.search || '';
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    try {
      // Cek memoryCache dulu (lebih cepat)
      if (searchTerm && this.memoryCache.products?.length > 0) {
        const filtered = this.memoryCache.products.filter(p => {
          const nama = (p.nama_produk || '').toLowerCase();
          const kode = (p.kode_produk || '').toLowerCase();
          return nama.includes(searchTerm.toLowerCase()) || kode.includes(searchTerm.toLowerCase());
        });
        return {
          data: filtered.slice(offset, offset + limit),
          total: filtered.length,
          cached: true,
          source: 'memory'
        };
      }

      // Jika tidak ada search atau cache kosong, query SQLite
      if (window.electronAPI?.productDB_searchProducts) {
        const result = await window.electronAPI.productDB_searchProducts(searchTerm, {
          limit: limit,
          offset: offset,
          status: 'aktif'
        });
        return {
          data: result.data || [],
          total: result.total || 0,
          cached: true,
          source: 'sqlite'
        };
      }

      return { data: [], total: 0, cached: true, source: 'empty' };
    } catch (error) {
      console.error('Error fetching products offline:', error);
      return { data: [], total: 0, cached: true, source: 'error', error };
    }
  }

  /**
   * Get categories dari memory cache atau SQLite
   */
  async getCategories() {
    try {
      // Memory cache priority
      if (this.memoryCache.categories?.length > 0) {
        return {
          data: this.memoryCache.categories,
          cached: true,
          source: 'memory'
        };
      }

      // Fallback ke SQLite
      if (window.electronAPI?.dbSelect) {
        const result = await window.electronAPI.dbSelect({
          table: 'kategori'
        });
        return {
          data: result || [],
          cached: true,
          source: 'sqlite'
        };
      }

      return { data: [], cached: true, source: 'empty' };
    } catch (error) {
      console.error('Error fetching categories offline:', error);
      return { data: [], cached: true, source: 'error', error };
    }
  }

  /**
   * Get units (satuan)
   */
  async getUnits() {
    try {
      if (this.memoryCache.units?.length > 0) {
        return {
          data: this.memoryCache.units,
          cached: true,
          source: 'memory'
        };
      }

      if (window.electronAPI?.dbSelect) {
        const result = await window.electronAPI.dbSelect({
          table: 'satuan'
        });
        return {
          data: result || [],
          cached: true,
          source: 'sqlite'
        };
      }

      return { data: [], cached: true, source: 'empty' };
    } catch (error) {
      console.error('Error fetching units offline:', error);
      return { data: [], cached: true, source: 'error', error };
    }
  }

  /**
   * Get payment methods
   */
  async getPaymentMethods() {
    try {
      if (this.memoryCache.paymentMethods?.length > 0) {
        return {
          data: this.memoryCache.paymentMethods,
          cached: true,
          source: 'memory'
        };
      }

      if (window.electronAPI?.dbSelect) {
        const result = await window.electronAPI.dbSelect({
          table: 'metode_pembayaran'
        });
        return {
          data: result || [],
          cached: true,
          source: 'sqlite'
        };
      }

      return { data: [], cached: true, source: 'empty' };
    } catch (error) {
      console.error('Error fetching payment methods offline:', error);
      return { data: [], cached: true, source: 'error', error };
    }
  }

  /**
   * Get customers (pelanggan)
   */
  async getCustomers() {
    try {
      if (this.memoryCache.customers?.length > 0) {
        return {
          data: this.memoryCache.customers,
          cached: true,
          source: 'memory'
        };
      }

      if (window.electronAPI?.dbSelect) {
        const result = await window.electronAPI.dbSelect({
          table: 'pelanggan'
        });
        return {
          data: result || [],
          cached: true,
          source: 'sqlite'
        };
      }

      return { data: [], cached: true, source: 'empty' };
    } catch (error) {
      console.error('Error fetching customers offline:', error);
      return { data: [], cached: true, source: 'error', error };
    }
  }

  /**
   * Get stock data untuk cabang tertentu
   */
  async getStock(idCabang) {
    try {
      if (window.electronAPI?.dbSelect) {
        const result = await window.electronAPI.dbSelect({
          table: 'stok',
          whereClause: `id_cabang = '${idCabang}'`
        });
        return {
          data: result || [],
          cached: true,
          source: 'sqlite'
        };
      }

      return { data: [], cached: true, source: 'empty' };
    } catch (error) {
      console.error('Error fetching stock offline:', error);
      return { data: [], cached: true, source: 'error', error };
    }
  }

  /**
   * Get transactions (penjualan) from offline DB
   */
  async getTransactions(filters = {}) {
    try {
      if (window.electronAPI?.dbSelect) {
        let whereClause = '';
        if (filters.idCabang) {
          whereClause = `id_cabang = '${filters.idCabang}'`;
        }
        if (filters.startDate && filters.endDate) {
          const dateCondition = `tanggal_transaksi BETWEEN '${filters.startDate}' AND '${filters.endDate}'`;
          whereClause = whereClause ? `${whereClause} AND ${dateCondition}` : dateCondition;
        }

        const result = await window.electronAPI.dbSelect({
          table: 'payment_details',
          whereClause: whereClause || undefined
        });
        return {
          data: result || [],
          cached: true,
          source: 'sqlite'
        };
      }

      return { data: [], cached: true, source: 'empty' };
    } catch (error) {
      console.error('Error fetching transactions offline:', error);
      return { data: [], cached: true, source: 'error', error };
    }
  }

  /**
   * Save transaction to offline DB (akan di-sync kemudian)
   */
  async saveTransaction(data) {
    try {
      if (window.electronAPI?.dbInsert) {
        const result = await window.electronAPI.dbInsert({
          table: 'payment_details',
          data: {
            ...data,
            synced: 0,
            created_at: new Date().toISOString()
          }
        });
        return {
          success: true,
          id: result,
          offline: true,
          message: 'Transaksi disimpan (akan disinkronkan)'
        };
      }

      return {
        success: false,
        offline: true,
        error: 'No IPC available'
      };
    } catch (error) {
      console.error('Error saving transaction offline:', error);
      return {
        success: false,
        offline: true,
        error: error.message
      };
    }
  }

  /**
   * Update product stock locally
   */
  async updateLocalStock(idProduk, idCabang, quantity) {
    try {
      if (window.electronAPI?.dbSelect) {
        // Get current stock
        const current = await window.electronAPI.dbSelect({
          table: 'stok',
          whereClause: `id_produk = '${idProduk}' AND id_cabang = '${idCabang}'`
        });

        if (current && current.length > 0) {
          // Update existing
          const newQty = current[0].quantity + quantity;
          if (window.electronAPI?.dbUpdate) {
            await window.electronAPI.dbUpdate({
              table: 'stok',
              data: { quantity: newQty, updated_at: new Date().toISOString() },
              whereClause: `id_produk = '${idProduk}' AND id_cabang = '${idCabang}'`
            });
          }
        } else {
          // Insert new
          if (window.electronAPI?.dbInsert) {
            await window.electronAPI.dbInsert({
              table: 'stok',
              data: {
                id_produk: idProduk,
                id_cabang: idCabang,
                quantity: quantity,
                created_at: new Date().toISOString()
              }
            });
          }
        }

        return { success: true, offline: true };
      }

      return { success: false, offline: true };
    } catch (error) {
      console.error('Error updating local stock:', error);
      return { success: false, offline: true, error: error.message };
    }
  }

  /**
   * Check if we have essential data available for offline operation
   */
  async checkOfflineReadiness() {
    const hasProducts = this.memoryCache.products?.length > 0;
    const hasCategories = this.memoryCache.categories?.length > 0;
    const hasPaymentMethods = this.memoryCache.paymentMethods?.length > 0;

    return {
      isReady: hasProducts && hasCategories && hasPaymentMethods,
      stats: {
        products: this.memoryCache.products?.length || 0,
        categories: this.memoryCache.categories?.length || 0,
        units: this.memoryCache.units?.length || 0,
        paymentMethods: this.memoryCache.paymentMethods?.length || 0,
        customers: this.memoryCache.customers?.length || 0
      }
    };
  }

  /**
   * Get memory cache status
   */
  getCacheStatus() {
    return {
      products: this.memoryCache.products?.length || 0,
      categories: this.memoryCache.categories?.length || 0,
      units: this.memoryCache.units?.length || 0,
      paymentMethods: this.memoryCache.paymentMethods?.length || 0,
      customers: this.memoryCache.customers?.length || 0,
      lastUpdated: this.memoryCache.lastUpdated || null
    };
  }
}

const offlineAPIFallback = new OfflineAPIFallback();

export default offlineAPIFallback;
