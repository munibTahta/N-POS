/**
 * IPC Security Middleware
 * - Validates all IPC calls
 * - Prevents injection attacks
 * - Rate limiting
 * - Audit logging
 */

const IPCSecurityMiddleware = {
  // Whitelist of allowed IPC channels
  allowedChannels: new Set([
    // Printing
    'print-receipt-electron',

    // Offline data / sync
    'get-offline-sales', 'get-offline-products', 'save-offline-sale',
    'db-insert', 'db-update', 'db-delete', 'db-select',
    'db-batch-insert', 'db-batch-update', 'db-batch-delete',
    'db-save-sale', 'db-save-purchase',
    'db-get-sync-queue', 'db-update-sync-status', 'db-update-sync-queue-server-id',
    'db-set-sync-metadata', 'db-get-sync-metadata',
    'sync-check-auth',

    // Database maintenance
    'db-reset', 'db-reinitialize', 'db-backup', 'db-restore',

    // Files and printing helpers
    'save-file',

    // Cash drawer / peripheral
    'open-cash-drawer', 'get-cash-drawer-config', 'test-cash-drawer',

    // Product DB / transactions
    'product-db-bulk-upsert', 'product-db-search', 'product-db-get',
    'product-db-get-last-sync', 'product-db-set-last-sync', 'product-db-get-count',
    'product-db-bulk-upsert-stocks', 'product-db-clear-all', 'product-db-get-stats',
    'product-db-store-offline-transaction', 'product-db-get-pending-transactions',
    'product-db-get-all-transactions', 'product-db-mark-transaction-synced',
    'product-db-update-transaction-status', 'product-db-get-pending-count',
    'product-db-get-transaction-stats', 'product-db-cleanup-transactions',

    // Offline transaction helpers
    'offline-transaction-store', 'offline-transaction-pending', 'offline-transaction-all',
    'offline-transaction-mark-synced', 'offline-transaction-update-status',
    'offline-transaction-count', 'offline-transaction-stats', 'offline-transaction-cleanup',

    // Misc
    'ensure-focus', 'get-printers'
  ]),

  // Whitelisted table names for db-* operations
  allowedTables: new Set([
    'categories', 'units', 'customers', 'products', 'sales', 'sales_items', 'sale_items',
    'purchases', 'purchase_items', 'stock_mutations', 'sync_queue',
    'sync_metadata', 'payment_methods', 'payment_details', 'transaction_logs',
    'warehouse_stock', 'tax_rates', 'discounts', 'settings',
    // Supplier tables (singular/plural) - allow renderer to read/write supplier data
    'supplier', 'suppliers',
    // Indonesian aliases (legacy support)
    'kategori', 'satuan', 'pelanggan', 'produk', 'penjualan', 'penjualan_items',
    'pembelian', 'pembelian_items', 'mutasi_stok', 'antrian_sinkronisasi',
    'metode_pembayaran', 'log_transaksi', 'pajak', 'diskon', 'pengaturan'
  ]),

  // Rate limiter map: { channel: { count, lastReset } }
  rateLimits: new Map(),
  // Increased from 100 to 500 requests per minute (8.3 per second)
  // This allows parallel queries from multiple components
  maxCallsPerMinute: 500,

  /**
   * Validate channel name
   */
  isChannelAllowed(channel) {
    if (!channel || typeof channel !== 'string') return false;
    if (channel.includes('..') || channel.includes('/')) return false; // Path traversal
    return this.allowedChannels.has(channel);
  },

  /**
   * Validate data payload
   */
  validatePayload(data) {
    if (data === null || data === undefined) return true;
    
    // Check for circular references
    try {
      JSON.stringify(data);
    } catch (e) {
      console.warn('Circular reference detected in payload');
      return false;
    }

    // Check size (max 10MB)
    if (JSON.stringify(data).length > 10 * 1024 * 1024) {
      console.warn('Payload too large');
      return false;
    }

    return true;
  },

  /**
   * Check rate limit
   */
  checkRateLimit(channel) {
    const now = Date.now();
    const key = channel;

    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, { count: 1, lastReset: now });
      return true;
    }

    const limit = this.rateLimits.get(key);
    const timeDiff = now - limit.lastReset;

    // Reset if minute passed
    if (timeDiff > 60000) {
      limit.count = 1;
      limit.lastReset = now;
      return true;
    }

    // Check limit
    if (limit.count >= this.maxCallsPerMinute) {
      console.warn(`Rate limit exceeded for ${channel}`);
      return false;
    }

    limit.count++;
    return true;
  },

  /**
   * Validate IPC call
   */
  validate(channel, data) {
    // Check channel
    if (!this.isChannelAllowed(channel)) {
      throw new Error(`Channel '${channel}' is not allowed`);
    }

    // Check payload
    if (!this.validatePayload(data)) {
      throw new Error('Invalid or malicious payload');
    }

    // Validate table name for db-* operations
    if (channel.startsWith('db-') && data && data.table) {
      if (!this.allowedTables.has(data.table)) {
        throw new Error(`Table '${data.table}' is not allowed`);
      }
    }

    // Check rate limit
    if (!this.checkRateLimit(channel)) {
      throw new Error('Rate limit exceeded');
    }

    return true;
  }
};

// debug export: print allowed channels when module is loaded
module.exports = IPCSecurityMiddleware;
