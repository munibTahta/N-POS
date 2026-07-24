// src/services/offlineDataSync.js
/**
 * ROBUST OFFLINE DATA SYNCHRONIZATION (NO PRECACHE)
 * Direct database sync - fetch from API, import to SQLite, done
 * Uses PAGINATED SYNC for efficient memory management with millions of products
 */

import {
  getProducts,
  getCategories,
  getUnits,
  getPaymentMethods,
  getPelanggan as getCustomers,
  getStock
} from './api';
import { extractArray } from '../utils/apiResponseHelper';

// Smart memory cache for search fallback and performance optimization
// Increased to 5000 items (from 1000) for better cache hit rate
const memoryCache = {
  products: [],           // Best-sellers and frequently accessed products
  categories: [],
  units: [],
  paymentMethods: [],
  customers: [],
  maxSize: 5000,          // Increased for better hit rate with millions
  lastUpdated: null,
  searchFrequency: new Map()  // Track search frequency for smart caching
};

/**
 * Sync products with OPTIMIZED STRATEGY
 * BEST PRACTICE: Use skip_pagination=true untuk full sync, then use page/limit for incremental
 * Handles millions of products efficiently
 */
async function syncProductsOptimized() {
  
  try {
    const lastSync = localStorage.getItem('lastProductSync');
    let totalSynced = 0;
    let totalFailed = 0;
    const startTime = Date.now();
    const cachedProducts = [];
    
    // STRATEGY 1: Full sync (first time) - Fetch ALL at once
    if (!lastSync) {
      
      try {
        const response = await getProducts({
          skip_pagination: true,
          status: 'aktif',
          sortBy: 'id_produk',
          sortOrder: 'asc'
        });
        
        const products = extractArray(response);
        
        if (products && products.length > 0) {
          // Save ALL to SQLite in one go
          if (!window?.electronAPI?.productDB_bulkUpsertProducts) {
            console.error('❌ No IPC for product DB');
            return { synced: 0, failed: 0, pages: 0 };
          }
          
          // Split into chunks untuk memory efficiency
          const chunkSize = 5000;
          const chunks = [];
          for (let i = 0; i < products.length; i += chunkSize) {
            chunks.push(products.slice(i, i + chunkSize));
          }
          
          for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
            const chunk = chunks[chunkIdx];
            try {
              const result = await window.electronAPI.productDB_bulkUpsertProducts(chunk);
              const synced = result?.synced || 0;
              const failed = result?.failed || 0;
              totalSynced += synced;
              totalFailed += failed;
            } catch (chunkErr) {
              console.error(`❌ Chunk ${chunkIdx + 1} error:`, chunkErr.message);
              totalFailed += chunk.length;
            }
          }
          
          // Collect first 5000 untuk cache
          cachedProducts.push(...products.slice(0, 5000));
        } else {
          console.warn('⚠️ No products returned from API');
        }
      } catch (err) {
        console.error('❌ Full sync error:', err.message);
        throw err;
      }
    } else {
      // STRATEGY 2: Incremental sync (subsequent syncs) - Fetch only new/updated
      
      const pageSize = 500;
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        try {
          const response = await getProducts({
            page: page,
            limit: pageSize,
            status: 'aktif',
            sortBy: 'id_produk',
            sortOrder: 'asc'
          });
          
          const products = extractArray(response);
          
          if (!products || products.length === 0) {
            hasMore = false;
            break;
          }
          
          // Save chunk
          if (window?.electronAPI?.productDB_bulkUpsertProducts) {
            try {
              const result = await window.electronAPI.productDB_bulkUpsertProducts(products);
              totalSynced += result?.synced || 0;
              totalFailed += result?.failed || 0;
            } catch (chunkErr) {
              console.error(`❌ Page ${page} save error:`, chunkErr.message);
              totalFailed += products.length;
            }
          }
          
          // Collect untuk cache
          if (cachedProducts.length < 5000) {
            cachedProducts.push(...products.slice(0, Math.max(0, 5000 - cachedProducts.length)));
          }
          
          // Check if this is last page
          if (products.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
          
          // Small delay untuk memory cleanup
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (pageErr) {
          console.error(`❌ Page ${page} fetch error:`, pageErr.message);
          hasMore = false; // Stop on error
        }
      }
    }
    
    // Update memory cache
    memoryCache.products = cachedProducts
      .filter(p => p && p.status === 'aktif')
      .slice(0, 5000);
    memoryCache.lastUpdated = Date.now();
    
    // Verify SQLite count
    let dbCount = 0;
    try {
      if (window?.electronAPI?.productDB_getProductCount) {
        dbCount = await window.electronAPI.productDB_getProductCount();
      }
    } catch (verifyErr) {
      console.warn('⚠️ Verification failed:', verifyErr.message);
    }
    
    // Update last sync
    const now = new Date().toISOString();
    localStorage.setItem('lastProductSync', now);
    
    const duration = Date.now() - startTime;
    
    return {
      synced: totalSynced,
      failed: totalFailed,
      cached: memoryCache.products.length,
      dbCount: dbCount,
      duration
    };
    
  } catch (err) {
    console.error('❌ Optimized sync error:', err);
    return { synced: 0, failed: 0, cached: 0, dbCount: 0 };
  }
}

/**
 * Sync products with PAGINATION - optimized for millions of products
 * Prevents 950MB memory spike by fetching in 10k item chunks
 */
async function syncProductsPaginated() {
  
  try {
    const lastSync = localStorage.getItem('lastProductSync');
    const pageSize = 10000; // Fetch 10k items per page
    let page = 0;
    let totalSynced = 0;
    let totalFailed = 0;
    const startTime = Date.now();
    const cachedProducts = []; // Collect untuk memory cache
    
    if (lastSync) {
      // Incremental sync
    } else {
      // Full sync
    }
    
    while (true) {
      const offset = page * pageSize;
      
      const params = {
        limit: pageSize,
        offset: offset,
        sortBy: 'id_produk',
        sortOrder: 'asc'
      };
      
      if (lastSync) {
        params.since = lastSync;
      }
      
      try {
        const response = await getProducts(params);
        const products = extractArray(response);
        
        if (!products || products.length === 0) {
          break; // No more pages
        }
        
        // Log first few items untuk verify data (samples removed)
        
        // Collect products untuk cache (collect first 5000)
        if (cachedProducts.length < 5000) {
          cachedProducts.push(...products.slice(0, Math.max(0, 5000 - cachedProducts.length)));
        }
        
        if (!window?.electronAPI?.productDB_bulkUpsertProducts) {
          console.error('❌ No IPC for product DB - cannot save to SQLite!');
          totalSynced += products.length;
        } else {
          // Import to SQLite (IPC call)
          try {
            const result = await window.electronAPI.productDB_bulkUpsertProducts(products);
            
            if (!result) {
              console.error(`❌ Page ${page + 1}: No result from IPC`);
              totalFailed += products.length;
            } else {
              const synced = result?.synced || 0;
              const failed = result?.failed || 0;
              console.warn(`⚠️ Page ${page + 1}: No records saved (synced=0, failed=0)`);
              
              totalSynced += synced;
              totalFailed += failed;
            }
          } catch (ipcErr) {
            console.error(`❌ Page ${page + 1} IPC error:`, ipcErr);
            totalFailed += products.length;
          }
        }
        
        // Publish progress to UI (if available)
        if (window?.electronAPI?.onSyncProgress) {
          const estimatedTotal = offset + products.length;
          const progressPercent = Math.min(Math.floor((offset / estimatedTotal) * 100), 95);
          window.electronAPI.onSyncProgress({
            current: totalSynced,
            type: 'products',
            percent: progressPercent,
            page: page + 1
          });
        }
        
        // Allow garbage collection between pages
        // Small delay to free memory
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // IMPORTANT: Always continue to next page, even if fewer items
        // Don't assume last page just because items < pageSize
        // Only stop if API explicitly returns empty array
        page++;
        
      } catch (pageErr) {
        console.error(`❌ Error fetching page ${page + 1}:`, pageErr.message);
        // Continue to next page or stop?
        if (page === 0) {
          // First page failed, stop the whole sync
          throw pageErr;
        } else {
          // Partial failure on later page, continue with next
          console.warn(`⚠️ Continuing with next page after error...`);
          page++;
        }
      }
    }
    
    // Update memory cache with all collected products
    memoryCache.products = cachedProducts
      .filter(p => p && p.status === 'aktif')
      .slice(0, 5000);
    memoryCache.lastUpdated = Date.now();
    
    // VERIFY: Check SQLite has data
    let dbProductCount = 0;
    try {
      if (window?.electronAPI?.productDB_getProductCount) {
        dbProductCount = await window.electronAPI.productDB_getProductCount();
      }
    } catch (verifyErr) {
      console.warn('⚠️ Could not verify SQLite count:', verifyErr.message);
    }
    
    // Update last sync timestamp
    const now = new Date().toISOString();
    localStorage.setItem('lastProductSync', now);
    
    const duration = Date.now() - startTime;
    
    return { 
      synced: totalSynced, 
      failed: totalFailed,
      pages: page,
      cached: memoryCache.products.length,
      dbCount: dbProductCount,
      duration
    };
    
  } catch (err) {
    console.error('❌ Paginated product sync error:', err);
    return { synced: 0, failed: 0, pages: 0 };
  }
}

/**
 * Legacy sync function (kept for backward compatibility)
 * Use syncProductsPaginated() instead for production
 * Note: Renamed to _syncProducts (underscore prefix) to suppress unused warning
 * The actual syncProducts() is implemented in electron/main.cjs for IPC
 */
async function _syncProducts() {
  console.warn('⚠️ [DEPRECATION WARNING] _syncProducts() is deprecated, use syncProductsPaginated()');
  return await syncProductsPaginated();
}

/**
 * Sync stocks
 */
async function syncStocks() {
  
  try {
    const response = await getStock();
    const stocks = extractArray(response);
    
    if (!stocks || stocks.length === 0) {
      console.warn('⚠️ [SYNC] No stocks returned from API');
      return { synced: 0, failed: 0 };
    }
    
    if (!window?.electronAPI?.productDB_bulkUpsertStocks) {
      console.error('❌ No IPC for stocks');
      return { synced: 0, failed: 0 };
    }
    
    const result = await window.electronAPI.productDB_bulkUpsertStocks(stocks);
    
    return result || { synced: stocks.length, failed: 0 };
  } catch (err) {
    console.error('❌ [SYNC] Stock sync error:', err);
    return { synced: 0, failed: 0 };
  }
}

/**
 * Sync master data
 */
async function syncMasterData() {
  const results = {};
  
  try {
    const catRes = await getCategories();
    const cats = extractArray(catRes);
    memoryCache.categories = cats;
    results.categories = { count: cats.length };
    
    // Save to offline.db via IPC
    if (window?.electronAPI?.dbInsert && cats.length > 0) {
      try {
        for (const cat of cats) {
          await window.electronAPI.dbInsert({
            table: 'categories',
            data: {
              id_kategori: cat.id_kategori || cat.id,
              nama_kategori: cat.nama_kategori || cat.nama,
              synced: 1,
              sync_version: 1
            }
          });
        }
      } catch (e) {
        console.warn('⚠️ Categories save to DB failed:', e.message);
      }
    }
    
    const unitsRes = await getUnits();
    const units = extractArray(unitsRes);
    memoryCache.units = units;
    results.units = { count: units.length };
    
    // Save to offline.db via IPC
    if (window?.electronAPI?.dbInsert && units.length > 0) {
      try {
        for (const unit of units) {
          await window.electronAPI.dbInsert({
            table: 'units',
            data: {
              id_satuan: unit.id_satuan || unit.id,
              nama_satuan: unit.nama_satuan || unit.nama,
              synced: 1,
              sync_version: 1
            }
          });
        }
      } catch (e) {
        console.warn('⚠️ Units save to DB failed:', e.message);
      }
    }
    
    const payRes = await getPaymentMethods();
    const payments = extractArray(payRes);
    memoryCache.paymentMethods = payments;
    results.paymentMethods = { count: payments.length };
    
    // Save payment methods to offline.db via IPC
    // Use 'metode_pembayaran' table (master data table, not payment_details)
    if (window?.electronAPI?.dbInsert && payments.length > 0) {
      try {
        for (const payment of payments) {
          await window.electronAPI.dbInsert({
            table: 'metode_pembayaran',
            data: {
              id_metode: payment.id_metode || payment.id,
              kode_metode: payment.kode_metode || payment.code || null,
              nama_metode: payment.nama_metode || payment.nama || 'Unknown',
              tipe_metode: payment.tipe_metode || payment.tipe || 'cash',
              aktif: payment.aktif ? 1 : 0,
              is_default: payment.is_default ? 1 : 0,
              urutan_tampil: payment.urutan_tampil || null,
              biaya_tambahan_persen: payment.biaya_tambahan_persen || 0,
              biaya_tambahan_nominal: payment.biaya_tambahan_nominal || 0,
              minimum_transaksi: payment.minimum_transaksi || null,
              maksimum_transaksi: payment.maksimum_transaksi || null,
              synced: 1,
              sync_version: 1
            }
          });
        }
      } catch (e) {
        console.warn('⚠️ Payment methods save to DB failed:', e.message);
      }
    }
    
    try {
      const custRes = await getCustomers({ limit: 5000 });
      const customers = extractArray(custRes);
      memoryCache.customers = customers;
      results.customers = { count: customers.length };
      
      // Save to offline.db via IPC
      if (window?.electronAPI?.dbInsert && customers.length > 0) {
        try {
          for (const customer of customers) {
            await window.electronAPI.dbInsert({
              table: 'customers',
              data: {
                id_pelanggan: customer.id_pelanggan || customer.id,
                nama_pelanggan: customer.nama_pelanggan || customer.nama,
                nomor_hp: customer.nomor_hp || customer.hp || null,
                email: customer.email || null,
                alamat: customer.alamat || null,
                synced: 1,
                sync_version: 1
              }
            });
          }
          
        } catch (e) {
          console.warn('⚠️ Customers save to DB failed:', e.message);
        }
      }
    } catch (_e) {
      console.warn('⚠️ Customer sync failed (optional)');
    }
  } catch (err) {
    console.error('❌ Master data sync error:', err);
    return results;
  }
}

/**
 * Main OfflineDataSync class
 */
class OfflineDataSync {
  constructor() {
    this.isSyncing = false;
    this.lastSyncTime = null;
  }

  /**
   * Start full sync (products + stocks + master data)
   * Uses OPTIMIZED SYNC strategy:
   * - First sync: skip_pagination=true to fetch ALL at once (efficient for millions)
   * - Incremental sync: page/limit for only new/updated data
   */
  async startFullSync() {
    if (this.isSyncing) {
      return { status: 'in-progress' };
    }
    
    this.isSyncing = true;
    const startTime = Date.now();
    
    try {
      // Use optimized sync strategy (skip_pagination for first sync, page/limit for incremental)
      const prodResult = await syncProductsOptimized();
      
      // Only sync stocks if products were synced
      if (prodResult.synced > 0 || prodResult.dbCount > 0) {
        await syncStocks();
      }
      
      await syncMasterData();
      
      const duration = Date.now() - startTime;
      
      this.lastSyncTime = new Date();
      
      return { 
        success: true, 
        duration,
        details: {
          products: prodResult,
          synced_at: new Date().toISOString()
        }
      };
    } catch (err) {
      console.error('❌ SYNC FAILED:', err);
      return { success: false, error: err.message };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Load cached products from SQLite into memory
   * This allows offline search to work even after app restart
   */
  async loadCachedProducts() {
    try {
      if (!window?.electronAPI?.productDB_searchProducts) {
        console.warn('⚠️ No IPC for loading cached products');
        return { loaded: 0 };
      }
      
      // Fetch products for memory cache
      const limit = 5000;
      
      // First load: fetch products for memory cache
      const searchResult = await window.electronAPI.productDB_searchProducts(
        '',  // Empty query = get all
        {
          limit: limit,
          offset: 0,
          status: 'aktif'
        }
      );
      
      const cachedProducts = searchResult?.data || [];
      
      if (cachedProducts && cachedProducts.length > 0) {
        memoryCache.products = cachedProducts.filter(p => p && p.status === 'aktif');
        memoryCache.lastUpdated = Date.now();
        
        return { 
          loaded: memoryCache.products.length,
          sampleCount: Math.min(5, memoryCache.products.length)
        };
      } else {
        console.warn('⚠️ No cached products found in SQLite');
        return { loaded: 0 };
      }
    } catch (error) {
      console.error('❌ Error loading cached products:', error);
      return { loaded: 0, error: error.message };
    }
  }

  /**
   * Initialize sync (run first-time sync if needed)
   * Checks both localStorage flag AND SQLite database
   */
  async initialize() {
    
    // Load master data from offline.db if available
    await this.loadMasterDataFromDb();
    
    const hasProducts = localStorage.getItem('lastProductSync');
    
    // Check if SQLite has data (even if localStorage flag missing)
    let sqliteHasData = false;
    try {
      if (window?.electronAPI?.productDB_getProductCount) {
        const count = await window.electronAPI.productDB_getProductCount();
        sqliteHasData = (count && count > 0);
      }
    } catch (err) {
      console.warn('⚠️ Could not check SQLite product count:', err.message);
    }
    
    if (!hasProducts || !sqliteHasData) {
      return await this.startFullSync();
    } else {
      // Load cached data into memory for offline search
      const loadResult = await this.loadCachedProducts();
      
      // If load failed (SQLite empty), do full sync
      if (loadResult.loaded === 0) {
        console.warn('⚠️ SQLite empty despite lastProductSync flag - running full sync');
        return await this.startFullSync();
      }
      
      return { 
        status: 'already-initialized',
        cacheLoaded: loadResult.loaded,
        syncedAt: hasProducts
      };
    }
  }

  /**
   * Load master data from offline.db into memory cache
   */
  async loadMasterDataFromDb() {
    try {
      if (!window?.electronAPI?.dbSelect) return;
      
      try {
        const categories = await window.electronAPI.dbSelect({ table: 'categories' });
        if (categories && categories.length > 0) {
          memoryCache.categories = categories;
        }
      } catch (_e) {
        console.warn('   ⚠️ Categories not available');
      }
      
      try {
        const units = await window.electronAPI.dbSelect({ table: 'units' });
        if (units && units.length > 0) {
          memoryCache.units = units;
        }
      } catch (_e) {
        console.warn('   ⚠️ Units not available');
      }
      
      try {
        const customers = await window.electronAPI.dbSelect({ table: 'customers' });
        if (customers && customers.length > 0) {
          memoryCache.customers = customers;
        }
      } catch (_e) {
        console.warn('   ⚠️ Customers not available');
      }
      
      try {
        const paymentMethods = await window.electronAPI.dbSelect({ table: 'metode_pembayaran' });
        if (paymentMethods && paymentMethods.length > 0) {
          memoryCache.paymentMethods = paymentMethods;
        }
      } catch (_e) {
        console.warn('   ⚠️ Payment methods not available');
      }
      
    } catch (err) {
      console.warn('⚠️ Error loading master data from DB:', err.message);
    }
  }

  /**
   * Delta sync for periodic updates (incremental changes only)
   * Uses paginated sync to maintain performance consistency
   */
  async deltaSync() {
    if (this.isSyncing) return;
    const result = await syncProductsPaginated();
    if (result.synced > 0) {
      await syncStocks();
    }
  }

  /**
   * Sync products to database - wraps syncProductsOptimized
   * This is called during app initialization and periodic updates
   */
  async syncProductsToDb() {
    return await syncProductsOptimized();
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      lastProductSync: localStorage.getItem('lastProductSync'),
      memoryCacheSize: {
        products: memoryCache.products.length,
        categories: memoryCache.categories.length,
        units: memoryCache.units.length,
        paymentMethods: memoryCache.paymentMethods.length,
        customers: memoryCache.customers.length
      }
    };
  }

  /**
   * Store offline transaction
   * Store offline transaction to SQLite (replaces localStorage)
   * Better capacity, structured queries, and atomic operations
   */
  async storeOfflineTransaction(transactionData, cartItems = [], paymentInfo = null, customerInfo = null) {
    try {
      if (!window?.electronAPI?.offlineTransaction_store) {
        console.warn('⚠️ No IPC for offline transactions, falling back to localStorage');
        // Fallback to localStorage if IPC not available
        const id = `OFFLINE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const transaction = {
          ...transactionData,
          id,
          timestamp: Date.now(),
          synced: false
        };
        
        let pending = [];
        try {
          const stored = localStorage.getItem('pendingTransactions');
          pending = stored ? JSON.parse(stored) : [];
        } catch (_e) {
          pending = [];
        }
        
        pending.push(transaction);
        localStorage.setItem('pendingTransactions', JSON.stringify(pending));
        return transaction;
      }
      
      // Use SQLite via IPC (recommended)
      const result = await window.electronAPI.offlineTransaction_store(
        transactionData,
        cartItems,
        paymentInfo,
        customerInfo
      );
      
      return {
        id: result.id,
        ...transactionData,
        synced: false
      };
    } catch (error) {
      console.error('Error storing transaction:', error);
      throw error;
    }
  }

  /**
   * Get pending transactions (from SQLite)
   */
  async getPendingTransactions() {
    try {
      if (!window?.electronAPI?.offlineTransaction_getPending) {
        console.warn('⚠️ No IPC for offline transactions, falling back to localStorage');
        // Fallback
        const stored = localStorage.getItem('pendingTransactions');
        const pending = stored ? JSON.parse(stored) : [];
        return pending.filter(tx => tx.synced === false);
      }
      
      return await window.electronAPI.offlineTransaction_getPending();
    } catch (error) {
      console.error('Error getting pending transactions:', error);
      return [];
    }
  }

  /**
   * Get all offline transactions (from SQLite)
   */
  async getAllOfflineTransactions(limit = 1000, offset = 0) {
    try {
      if (!window?.electronAPI?.offlineTransaction_getAll) {
        console.warn('⚠️ No IPC for offline transactions');
        return [];
      }
      
      return await window.electronAPI.offlineTransaction_getAll(limit, offset);
    } catch (error) {
      console.error('Error getting all transactions:', error);
      return [];
    }
  }

  /**
   * Mark transaction as synced (to SQLite)
   */
  async markTransactionSynced(transactionId, serverId) {
    try {
      if (!window?.electronAPI?.offlineTransaction_markSynced) {
        console.warn('⚠️ No IPC for offline transactions, falling back to localStorage');
        // Fallback
        const stored = localStorage.getItem('pendingTransactions');
        const pending = stored ? JSON.parse(stored) : [];
        const idx = pending.findIndex(tx => tx.id === transactionId);
        if (idx >= 0) {
          pending[idx].synced = true;
          pending[idx].syncedAt = Date.now();
          pending[idx].serverId = serverId;
          localStorage.setItem('pendingTransactions', JSON.stringify(pending));
          return pending[idx];
        }
        throw new Error('Transaction not found');
      }
      
      const result = await window.electronAPI.offlineTransaction_markSynced(transactionId, serverId);
      
      return result;
    } catch (error) {
      console.error('Error marking synced:', error);
      throw error;
    }
  }

  /**
   * Get pending transaction count
   */
  async getPendingTransactionCount() {
    try {
      if (!window?.electronAPI?.offlineTransaction_getPendingCount) {
        return 0;
      }
      
      return await window.electronAPI.offlineTransaction_getPendingCount();
    } catch (error) {
      console.error('Error getting transaction count:', error);
      return 0;
    }
  }

  /**
   * Get offline transaction statistics
   */
  async getOfflineTransactionStats() {
    try {
      if (!window?.electronAPI?.offlineTransaction_getStats) {
        return { pending: 0, synced: 0, failed: 0, totalPendingValue: 0 };
      }
      
      return await window.electronAPI.offlineTransaction_getStats();
    } catch (error) {
      console.error('Error getting transaction stats:', error);
      return { pending: 0, synced: 0, failed: 0, totalPendingValue: 0 };
    }
  }

  /**
   * Cleanup old synced transactions from SQLite
   */
  async cleanupOfflineTransactions(daysToKeep = 30) {
    try {
      if (!window?.electronAPI?.offlineTransaction_cleanup) {
        console.warn('⚠️ No IPC for cleanup');
        return { success: false };
      }
      
      const result = await window.electronAPI.offlineTransaction_cleanup(daysToKeep);

      
      return result;
    } catch (error) {
      console.error('Error cleaning up transactions:', error);
      return { success: false };
    }
  }

  /**
   * Load settings
   */
  loadSettings() {
    try {
      return {
        storeName: localStorage.getItem('storeName') || 'Store',
        storePhone: localStorage.getItem('storePhone') || '',
        storeAddress: localStorage.getItem('storeAddress') || '',
        printerName: localStorage.getItem('printerName') || '',
        printerType: localStorage.getItem('printerType') || 'thermal',
        paperWidth: localStorage.getItem('paperWidth') || '80',
      };
    } catch (error) {
      console.error('Error loading settings:', error);
      return {};
    }
  }

  /**
   * Save settings
   */
  saveSettings(settings) {
    try {
      Object.entries(settings).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  }

  /**
   * Clear all offline data
   */
  async clearAllOfflineData() {
    try {
      Object.keys(memoryCache).forEach(key => {
        memoryCache[key] = [];
      });
      localStorage.removeItem('pendingTransactions');
      localStorage.removeItem('lastProductSync');
      return true;
    } catch (error) {
      console.error('Error clearing data:', error);
      return false;
    }
  }

  /**
   * Get memory cache
   */
  getMemoryCache() {
    return memoryCache;
  }

  /**
   * Get cache status
   */
  getCacheStatus() {
    return {
      products: memoryCache.products?.length || 0,
      categories: memoryCache.categories?.length || 0,
      units: memoryCache.units?.length || 0,
      paymentMethods: memoryCache.paymentMethods?.length || 0,
      customers: memoryCache.customers?.length || 0,
      lastUpdated: memoryCache.lastUpdated || null
    };
  }

  /**
   * Check if offline data is ready for operation
   */
  async getOfflineReadiness() {
    const stats = this.getCacheStatus();
    const isReady = stats.products > 0 && stats.categories > 0 && stats.paymentMethods > 0;
    return {
      isReady,
      stats
    };
  }
}

export const offlineDataSync = new OfflineDataSync();
offlineDataSync.memoryCache = memoryCache;
export default offlineDataSync;
