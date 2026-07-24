const { contextBridge, ipcRenderer } = require('electron');

/**
 * The `contextBridge` is a secure way to expose Node.js/Electron APIs
 * to your renderer process (your React app).
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Invokes a handler in the main process to get the list of available printers.
   * @returns {Promise<Electron.PrinterInfo[]>} A promise that resolves with an array of printers.
   */
  getPrinters: () => ipcRenderer.invoke('get-printers'),

  /**
   * Mengirim konten teks mentah untuk dicetak ke printer tertentu.
   * @param {string} printerName - Nama printer yang akan digunakan.
   * @param {string} content - Teks yang akan dicetak.
   * @returns {Promise<{success: boolean}>} Promise yang akan resolve setelah perintah cetak dikirim.
   */
  // expose print-thermal for direct usage/debug if needed
  printThermal: (params) => {

    return ipcRenderer.invoke('print-thermal', params);
  },

  // expose print-regular for regular printers (inkjet, laser, etc)
  printRegular: (params) => {
    void 0 && ('[PRELOAD] printRegular ->', { 
      printerName: params?.printerName, 
      type: params?.printerType,
      hasHTML: !!params?.htmlContent,
      hasText: !!params?.plainText
    });
    return ipcRenderer.invoke('print-regular', params);
  },

  // QZ Tray health and printer discovery helper
  checkQzTray: () => {

    return ipcRenderer.invoke('check-qz-tray');
  },

  // QZ Tray certificate management
  getQzCertificate: () => {

    return ipcRenderer.invoke('get-qz-certificate');
  },

  saveQzCertificate: (certificate) => {

    return ipcRenderer.invoke('save-qz-certificate', certificate);
  },

  generateQzCertificate: () => {

    return ipcRenderer.invoke('generate-qz-certificate');
  },

  // TEST HANDLER - REMOVE AFTER DEBUGGING
  testPrintThermal: () => {

    return ipcRenderer.invoke('test-print-thermal');
  },

  // receive debug messages from main process
  onPrintDebug: (callback) => ipcRenderer.on('print-debug', (event, msg) => {
    try { callback(msg); } catch (_) {}
  }),
  // utility to start forwarding all console calls back to main for debugging
  enableConsoleForwarding: () => {
    ['log', 'warn', 'error', 'info', 'debug'].forEach(level => {
      const orig = console[level];
      console[level] = (...args) => {
        try { ipcRenderer.send('renderer-console', level, ...args.map(a => String(a))); } catch (e) {}
        orig.apply(console, args);
      };
    });
    return true;
  },

  /**
   * Get offline sales data
   * @returns {Promise<Array>} Array of offline sales
   */
  getOfflineSales: () => ipcRenderer.invoke('get-offline-sales'),

  /**
   * Get offline products data
   * @returns {Promise<Array>} Array of offline products
   */
  getOfflineProducts: () => ipcRenderer.invoke('get-offline-products'),

  /**
   * Save sale to offline database
   * @param {Object} saleData - Sale data to save
   * @returns {Promise<Object>} Result of the save operation
   */
  saveOfflineSale: (saleData) => ipcRenderer.invoke('save-offline-sale', saleData),

  /**
   * Generic database operations
   */
  dbInsert: (params) => ipcRenderer.invoke('db-insert', params),
  dbUpdate: (params) => ipcRenderer.invoke('db-update', params),
  dbDelete: (params) => ipcRenderer.invoke('db-delete', params),
  dbSelect: (params) => ipcRenderer.invoke('db-select', params),
  dbTransaction: (operations) => ipcRenderer.invoke('db-transaction', operations),
  dbGetSyncQueue: () => ipcRenderer.invoke('db-get-sync-queue'),
  dbUpdateSyncStatus: (params) => ipcRenderer.invoke('db-update-sync-status', params),
  dbSetSyncMetadata: (params) => ipcRenderer.invoke('db-set-sync-metadata', params),
  dbGetSyncMetadata: (params) => ipcRenderer.invoke('db-get-sync-metadata', params),
  dbRepairCorruption: () => ipcRenderer.invoke('db-repair-corruption'),

  /**
   * Reset database (for development/testing)
   * @returns {Promise<Object>} Result of the reset operation
   */
  dbReset: () => {

    return ipcRenderer.invoke('db-reset');
  },

  /**
   * Reinitialize database schema (fix schema without deleting data)
   * @returns {Promise<Object>} Result of the reinitialize operation
   */
  dbReinitialize: () => {

    return ipcRenderer.invoke('db-reinitialize');
  },

  /**
   * Backup database to file
   * @returns {Promise<Object>} Result of the backup operation
   */
  dbBackup: () => ipcRenderer.invoke('db-backup'),

  /**
   * Restore database from file
   * @param {Object} options - Restore options
   * @param {boolean} options.skipIntegrityCheck - Skip database integrity check
   * @returns {Promise<Object>} Result of the restore operation
   */
  dbRestore: (options = {}) => ipcRenderer.invoke('db-restore', options),

  /**
   * Query database ready status
   * @returns {Promise<Object>} {ready: boolean, timestamp: string}
   */
  queryDbReady: () => ipcRenderer.invoke('query-db-ready'),

  /**
   * Save complete sale with items and payments
   * @param {Object} params - { saleData, items, payments }
   * @returns {Promise<Object>} Result of the save operation
   */
  dbSaveSale: (params) => ipcRenderer.invoke('db-save-sale', params),

  /**
   * Save file to disk (for Excel export)
   * @param {ArrayBuffer} buffer - File buffer
   * @param {string} filename - Default filename
   * @returns {Promise<Object>} Result of save operation
   */
  saveFile: (buffer, filename) => ipcRenderer.invoke('save-file', buffer, filename),

  /**
   * Open cash drawer
   * @param {Object} config - Cash drawer configuration
   * @returns {Promise<Object>} Result of open operation
   */
  openCashDrawer: (config) => ipcRenderer.invoke('open-cash-drawer', config),

  /**
   * Get cash drawer configuration
   * @returns {Promise<Object>} Cash drawer configuration
   */
  getCashDrawerConfig: () => ipcRenderer.invoke('get-cash-drawer-config'),

  /**
   * Test cash drawer connection
   * @param {Object} config - Test configuration
   * @returns {Promise<Object>} Test result
   */
  testCashDrawer: (config) => ipcRenderer.invoke('test-cash-drawer', config),

  /**
   * Bulk insert products ke offline.db (OPTIMIZED - bypass CacheManager)
   * @param {Array} products - Products to insert
   * @returns {Promise<{success, inserted, updated, failed}>}
   */
  dbInsertProducts: (products) => ipcRenderer.invoke('db-insert-products', products),

  /**
   * Search products dari offline.db (fast indexed query)
   * @param {string} query - Search text
   * @param {Object} options - { limit, offset, status }
   * @returns {Promise<{data, total, limit, offset}>}
   */
  dbSearchProducts: (query, options) => ipcRenderer.invoke('db-search-products', query, options),

  /**
   * Ensure window and webContents focus for input handling
   * @returns {Promise<void>}
   */
  ensureFocus: () => ipcRenderer.invoke('ensure-focus'),

  // ===== PRODUCT DATABASE API (SQLite via better-sqlite3) =====
  /**
   * Bulk upsert products to offline SQLite database
   * @param {Array} products - Products to insert/update
   * @returns {Promise<Object>} { inserted, updated, failed }
   */
  productDB_bulkUpsertProducts: (products) => ipcRenderer.invoke('product-db-bulk-upsert', products),

  /**
   * Search products in offline database
   * @param {string} query - Search text
   * @param {Object} options - { limit, offset, status, sortBy, sortOrder }
   * @returns {Promise<Object>} { data: [], total, limit, offset, page }
   */
  productDB_searchProducts: (query, options) => ipcRenderer.invoke('product-db-search', query, options),

  /**
   * Get single product by ID
   * @param {number|string} id - Product ID
   * @param {string} idType - 'id_produk' or 'kode_produk'
   * @returns {Promise<Object>} Product object
   */
  productDB_getProduct: (id, idType = 'id_produk') => ipcRenderer.invoke('product-db-get', id, idType),

  /**
   * Get last sync timestamp for delta sync
   * @returns {Promise<string|null>} ISO timestamp or null
   */
  productDB_getLastSyncTime: () => ipcRenderer.invoke('product-db-get-last-sync'),

  /**
   * Set last sync timestamp
   * @param {string} timestamp - ISO timestamp
   * @returns {Promise<boolean>}
   */
  productDB_setLastSyncTime: (timestamp) => ipcRenderer.invoke('product-db-set-last-sync', timestamp),

  /**
   * Get product count in database
   * @returns {Promise<number>}
   */
  productDB_getProductCount: () => ipcRenderer.invoke('product-db-get-count'),

  /**
   * Bulk upsert stock data
   * @param {Array} stocks - Stock records to insert/update
   * @returns {Promise<Object>} { inserted, updated, failed }
   */
  productDB_bulkUpsertStocks: (stocks) => ipcRenderer.invoke('product-db-bulk-upsert-stocks', stocks),

  /**
   * Clear all products (for full resync)
   * @returns {Promise<boolean>}
   */
  productDB_clearAllProducts: () => ipcRenderer.invoke('product-db-clear-all'),

  /**
   * Get database statistics
   * @returns {Promise<Object>} { productCount, stockCount, lastSyncTime, dbSize }
   */
  productDB_getStats: () => ipcRenderer.invoke('product-db-get-stats'),

  /**
   * Get transaction statistics
   * @returns {Promise<Object>} { pending, synced, failed, totalPendingValue }
   */
  productDB_getTransactionStats: () => ipcRenderer.invoke('product-db-get-transaction-stats'),

  /**
   * Get all stocks for a specific branch (offline stock loading)
   * @param {number} idCabang - Branch ID
   * @returns {Promise<Array>} Array of stock records for the branch
   */
  productDB_getStocksByCabang: (idCabang) => ipcRenderer.invoke('product-db-get-stocks-by-cabang', idCabang),

  /**
   * Get stock for specific product and branch
   * @param {number} idProduk - Product ID
   * @param {number} idCabang - Branch ID
   * @returns {Promise<number>} Stock quantity (or 0 if not found)
   */
  productDB_getStock: (idProduk, idCabang) => ipcRenderer.invoke('product-db-get-stock', idProduk, idCabang),

  /**
   * Get total stock across all branches for a product
   * @param {number} idProduk - Product ID
   * @returns {Promise<number>} Total stock quantity across all branches
   */
  productDB_getProductTotalStock: (idProduk) => ipcRenderer.invoke('product-db-get-product-total-stock', idProduk),

  // ===== OFFLINE TRANSACTIONS (SQLite-based, replaces localStorage) =====
  /**
   * Store offline transaction to SQLite
   * @param {Object} transactionData - Main transaction object
   * @param {Array} cartItems - Cart items array
   * @param {Object} paymentInfo - Payment information
   * @param {Object} customerInfo - Customer information
   * @returns {Promise<Object>} { success, id, changes }
   */
  offlineTransaction_store: (transactionData, cartItems, paymentInfo, customerInfo) => 
    ipcRenderer.invoke('offline-transaction-store', transactionData, cartItems, paymentInfo, customerInfo),

  /**
   * Get pending offline transactions (not yet synced)
   * @param {number} limit - Max records to return
   * @returns {Promise<Array>} Array of pending transactions
   */
  offlineTransaction_getPending: (limit = 100) => 
    ipcRenderer.invoke('offline-transaction-pending', limit),

  /**
   * Get all offline transactions (including synced)
   * @param {number} limit - Max records to return
   * @param {number} offset - Pagination offset
   * @returns {Promise<Array>} Array of transactions
   */
  offlineTransaction_getAll: (limit = 1000, offset = 0) => 
    ipcRenderer.invoke('offline-transaction-all', limit, offset),

  /**
   * Mark transaction as synced on server
   * @param {string} transactionId - Transaction ID
   * @param {string} serverId - Server-assigned ID
   * @returns {Promise<Object>} { success, changes }
   */
  offlineTransaction_markSynced: (transactionId, serverId) => 
    ipcRenderer.invoke('offline-transaction-mark-synced', transactionId, serverId),

  /**
   * Update offline transaction status
   * @param {string} transactionId - Transaction ID
   * @param {string} status - Status: 'pending', 'synced', 'failed'
   * @param {string} errorMessage - Error details if failed
   * @returns {Promise<Object>} { success, changes }
   */
  offlineTransaction_updateStatus: (transactionId, status, errorMessage) => 
    ipcRenderer.invoke('offline-transaction-update-status', transactionId, status, errorMessage),

  /**
   * Get count of pending transactions
   * @returns {Promise<number>} Count of unsync'ed transactions
   */
  offlineTransaction_getPendingCount: () => 
    ipcRenderer.invoke('offline-transaction-count'),

  /**
   * Get offline transaction statistics
   * @returns {Promise<Object>} { pending, synced, failed, totalPendingValue }
   */
  offlineTransaction_getStats: () => 
    ipcRenderer.invoke('offline-transaction-stats'),

  /**
   * Cleanup old synced transactions (older than daysToKeep)
   * @param {number} daysToKeep - Days to keep (default 30)
   * @returns {Promise<Object>} { success, deletedCount }
   */
  offlineTransaction_cleanup: (daysToKeep = 30) => 
    ipcRenderer.invoke('offline-transaction-cleanup', daysToKeep),
});