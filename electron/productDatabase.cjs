/**
 * Product Database Manager (better-sqlite3)
 * Manages offline product data storage in SQLite
 * 
 * This runs in Electron main process and exposed via contextBridge
 * Provides efficient bulk operations and fast queries
 */

const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

class ProductDatabase {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Initialize database connection and schema
   */
  initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      const dbPath = path.join(app.getPath('userData'), 'product_offline.db');
      this.db = new Database(dbPath);
      
      // Enable foreign keys and WAL mode for better concurrent access
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');

      // Create tables if not exist
      this.createTables();
      
      // Run migrations to update schema if needed
      this.migrateSchema();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ ProductDatabase initialization failed:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Create necessary tables for product storage
   */
  createTables() {
    this.db.exec(`
      -- Main products table
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        id_produk INTEGER UNIQUE NOT NULL,
        kode_produk TEXT UNIQUE,
        nama_produk TEXT NOT NULL,
        deskripsi TEXT,
        id_kategori INTEGER,
        id_satuan INTEGER,
        harga_jual REAL,
        harga_grosir REAL,
        min_qty_grosir INTEGER DEFAULT 0,
        stok_minimum INTEGER DEFAULT 0,
        id_supplier INTEGER,
        status TEXT DEFAULT 'aktif',
        created_at TEXT,
        updated_at TEXT,
        sync_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Index untuk fast queries
      CREATE INDEX IF NOT EXISTS idx_products_kode ON products(kode_produk);
      CREATE INDEX IF NOT EXISTS idx_products_nama ON products(nama_produk);
      CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);
      CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

      -- FTS5 virtual table for full-text search on product fields
      CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
        nama_produk, kode_produk, deskripsi, content='products', content_rowid='id'
      );

      -- Triggers to keep FTS index in sync with products table
      CREATE TRIGGER IF NOT EXISTS products_ai AFTER INSERT ON products BEGIN
        INSERT INTO products_fts(rowid, nama_produk, kode_produk, deskripsi)
        VALUES (new.id, new.nama_produk, new.kode_produk, new.deskripsi);
      END;

      CREATE TRIGGER IF NOT EXISTS products_ad AFTER DELETE ON products BEGIN
        DELETE FROM products_fts WHERE rowid = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS products_au AFTER UPDATE ON products BEGIN
        DELETE FROM products_fts WHERE rowid = old.id;
        INSERT INTO products_fts(rowid, nama_produk, kode_produk, deskripsi)
        VALUES (new.id, new.nama_produk, new.kode_produk, new.deskripsi);
      END;

      -- Sync metadata table
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Stock data table (for fast offline lookups)
      CREATE TABLE IF NOT EXISTS product_stocks (
        id INTEGER PRIMARY KEY,
        id_produk INTEGER NOT NULL,
        id_cabang INTEGER,
        stok REAL DEFAULT 0,
        lokasi_rak TEXT,
        updated_at TEXT,
        FOREIGN KEY (id_produk) REFERENCES products(id_produk),
        UNIQUE (id_produk, id_cabang)
      );

      CREATE INDEX IF NOT EXISTS idx_stocks_produk ON product_stocks(id_produk);
      CREATE INDEX IF NOT EXISTS idx_stocks_cabang ON product_stocks(id_cabang);

      -- Offline transactions table (replaces localStorage for better scalability)
      -- Stores pending sales/transactions when offline, syncs when back online
      CREATE TABLE IF NOT EXISTS offline_transactions (
        id TEXT PRIMARY KEY,
        transaction_id TEXT,
        transaction_data TEXT NOT NULL,
        cart_items TEXT NOT NULL,
        payment_info TEXT,
        customer_info TEXT,
        status TEXT DEFAULT 'pending',
        synced BOOLEAN DEFAULT 0,
        synced_at TEXT,
        synced_server_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_offline_transactions_status ON offline_transactions(status);
      CREATE INDEX IF NOT EXISTS idx_offline_transactions_synced ON offline_transactions(synced);
      CREATE INDEX IF NOT EXISTS idx_offline_transactions_created_at ON offline_transactions(created_at);
    `);
  }

  /**
   * Migrate database schema - rename harga_eceran to harga_jual
   * This ensures the database column names match API field names
   */
  migrateSchema() {
    try {
      // Check if column harga_eceran still exists
      const tableInfo = this.db.prepare('PRAGMA table_info(products)').all();
      const hasOldColumn = tableInfo.some(col => col.name === 'harga_eceran');
      
      if (!hasOldColumn) {
        return;
      }

      // SQLite doesn't support direct column rename in older versions
      // So we need to: 1) create temp table, 2) copy data, 3) drop old, 4) rename
      this.db.exec(`
        BEGIN TRANSACTION;

        -- Create new table with correct schema
        CREATE TABLE products_new (
          id INTEGER PRIMARY KEY,
          id_produk INTEGER UNIQUE NOT NULL,
          kode_produk TEXT UNIQUE,
          nama_produk TEXT NOT NULL,
          deskripsi TEXT,
          id_kategori INTEGER,
          id_satuan INTEGER,
          harga_jual REAL,
          harga_grosir REAL,
          min_qty_grosir INTEGER DEFAULT 0,
          stok_minimum INTEGER DEFAULT 0,
          id_supplier INTEGER,
          status TEXT DEFAULT 'aktif',
          created_at TEXT,
          updated_at TEXT,
          sync_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Copy all data from old table
        INSERT INTO products_new
        SELECT id, id_produk, kode_produk, nama_produk, deskripsi, id_kategori, 
               id_satuan, harga_eceran, harga_grosir, min_qty_grosir, stok_minimum,
               id_supplier, status, created_at, updated_at, sync_timestamp
        FROM products;

        -- Drop old table
        DROP TABLE products;

        -- Rename new table
        ALTER TABLE products_new RENAME TO products;

        -- Recreate indices
        CREATE INDEX idx_products_kode ON products(kode_produk);
        CREATE INDEX idx_products_nama ON products(nama_produk);
        CREATE INDEX idx_products_updated_at ON products(updated_at);
        CREATE INDEX idx_products_status ON products(status);

        -- Recreate triggers for FTS
        CREATE TRIGGER products_ai AFTER INSERT ON products BEGIN
          INSERT INTO products_fts(rowid, nama_produk, kode_produk, deskripsi)
          VALUES (new.id, new.nama_produk, new.kode_produk, new.deskripsi);
        END;

        CREATE TRIGGER products_ad AFTER DELETE ON products BEGIN
          DELETE FROM products_fts WHERE rowid = old.id;
        END;

        CREATE TRIGGER products_au AFTER UPDATE ON products BEGIN
          DELETE FROM products_fts WHERE rowid = old.id;
          INSERT INTO products_fts(rowid, nama_produk, kode_produk, deskripsi)
          VALUES (new.id, new.nama_produk, new.kode_produk, new.deskripsi);
        END;

        COMMIT;
      `);
    } catch (error) {
      console.error('❌ Database migration failed:', error);
      throw error;
    }
  }

  /**
   * Get last sync timestamp
   * Format: ISO string or unix timestamp
   */
  getLastSyncTime() {
    try {
      const stmt = this.db.prepare('SELECT value FROM sync_metadata WHERE key = ?');
      const result = stmt.get('lastSyncTime');
      return result ? result.value : null;
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return null;
    }
  }

  /**
   * Set last sync timestamp
   */
  setLastSyncTime(timestamp) {
    try {
      const stmt = this.db.prepare(
        'INSERT OR REPLACE INTO sync_metadata (key, value) VALUES (?, ?)'
      );
      stmt.run('lastSyncTime', timestamp.toString());
      return true;
    } catch (error) {
      console.error('Error setting last sync time:', error);
      return false;
    }
  }

  /**
   * Get product count in database
   */
  getProductCount() {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM products');
      const result = stmt.get();
      return result?.count || 0;
    } catch (error) {
      console.error('Error getting product count:', error);
      return 0;
    }
  }

  /**
   * Get database stats for debugging
   */
  getStats() {
    try {
      const totalCount = this.db.prepare('SELECT COUNT(*) as count FROM products').get();
      const statusCounts = this.db.prepare(`
        SELECT status, COUNT(*) as count FROM products GROUP BY status
      `).all();
      
      const sampleProducts = this.db.prepare(`
        SELECT id_produk, nama_produk, kode_produk, status FROM products LIMIT 5
      `).all();
      
      return {
        productCount: totalCount?.count || 0,
        byStatus: statusCounts,
        samples: sampleProducts
      };
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      return { totalProducts: 0, byStatus: [], samples: [] };
    }
  }

  /**
   * Bulk insert/upsert products
   * Efficient batch operation using transaction
   */
  bulkUpsertProducts(products, onProgress) {
    if (!this.isInitialized || !this.db) {
      throw new Error('ProductDatabase not initialized - call initialize() first');
    }

    if (!Array.isArray(products) || products.length === 0) {
      return { inserted: 0, updated: 0, failed: 0 };
    }

    const batchSize = 500; // Process in batches to avoid memory spike
    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const failedRows = [];

    try {
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        
        // Use transaction for each batch
        const transaction = this.db.transaction((items) => {
          // Simple INSERT OR IGNORE - if id_produk exists, skip
          const insertStmt = this.db.prepare(`
            INSERT OR IGNORE INTO products (
              id_produk, kode_produk, nama_produk, deskripsi, id_kategori,
              id_satuan, harga_jual, harga_grosir, min_qty_grosir,
              stok_minimum, id_supplier, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          // Update existing products
          const updateStmt = this.db.prepare(`
            UPDATE products SET
              kode_produk = ?,
              nama_produk = ?,
              deskripsi = ?,
              id_kategori = ?,
              id_satuan = ?,
              harga_jual = ?,
              harga_grosir = ?,
              min_qty_grosir = ?,
              stok_minimum = ?,
              id_supplier = ?,
              status = ?,
              updated_at = ?
            WHERE id_produk = ?
          `);

          for (const product of items) {
            try {
              // Determine if product with this id_produk already exists
              const incomingId = product.id_produk || product.id;
              const exists = this.db.prepare('SELECT 1 FROM products WHERE id_produk = ?').get(incomingId);

              if (exists) {
                // Update existing product
                const updateResult = updateStmt.run(
                  product.kode_produk || product.kd_produk || null,
                  product.nama_produk || product.nm_produk || 'Unknown',
                  product.deskripsi || null,
                  product.id_kategori || null,
                  product.id_satuan || null,
                  product.harga_jual || product.harga || 0,
                  product.harga_grosir || product.harga_grosir || 0,
                  product.min_qty_grosir || 0,
                  product.stok_minimum || 0,
                  product.id_supplier || null,
                  product.status || 'aktif',
                  product.updated_at || new Date().toISOString(),
                  incomingId
                );
                if (updateResult.changes > 0) updated++;
              } else {
                // Insert new product
                const insertResult = insertStmt.run(
                  incomingId,
                  product.kode_produk || product.kd_produk || null,
                  product.nama_produk || product.nm_produk || 'Unknown',
                  product.deskripsi || null,
                  product.id_kategori || null,
                  product.id_satuan || null,
                  product.harga_jual || product.harga || 0,
                  product.harga_grosir || product.harga_grosir || 0,
                  product.min_qty_grosir || 0,
                  product.stok_minimum || 0,
                  product.id_supplier || null,
                  product.status || 'aktif',
                  product.created_at || new Date().toISOString(),
                  product.updated_at || new Date().toISOString()
                );
                if (insertResult.changes > 0) inserted++;
              }
            } catch (err) {
              const pid = product.id_produk || product.id || null;
              console.error('Error upserting product:', pid, err && err.message ? err.message : err);
              failed++;
              failedRows.push({ id: pid, error: err && err.message ? err.message : String(err) });
            }
          }
        });

        transaction(batch);

        // Report progress
        if (onProgress) {
          onProgress({
            processed: Math.min(i + batchSize, products.length),
            total: products.length
          });
        }
      }
      return { inserted, updated, failed, failedRows };
    } catch (error) {
      console.error('❌ Bulk upsert failed:', error);
      throw error;
    }
  }

  /**
   * Search products locally with hard limit to prevent returning too many results
   * Optimized: prefix LIKE on indexed columns with proper stock aggregation
   * 
   * Max Results:
   * - Min 3 characters query: max 100 results
   * - Less than 3 chars: max 20 results
   */
  searchProducts(query, options = {}) {
    const MAX_RESULTS = 100;
    const MIN_QUERY_LENGTH = 3;
    
    const {
      limit = 50,
      offset = 0,
      sortBy = 'nama_produk',
      sortOrder = 'ASC'
    } = options;

    try {
      let sql;
      let params = [];
      let countSql;
      let countParams = [];

      // Enforce hard limit to prevent returning millions of results
      const effectiveLimit = Math.min(limit || 50, MAX_RESULTS);

      if (query && query.trim()) {
        // Use prefix LIKE (faster + better UX): "gal%" matches "galon", "gallon", etc.
        const q = String(query).trim().toLowerCase();
        
        // Display limit (show top N)
        const displayLimit = q.length < MIN_QUERY_LENGTH ? 20 : effectiveLimit;
        const searchTerm = q + '%'; // Prefix search
        
        // Query with stock aggregation - SEARCH ALL products but limit display
        // This ensures we find everything, even if there are thousands of matches
        sql = `
          SELECT p.id, p.id_produk, p.kode_produk, p.nama_produk, p.deskripsi, 
                 p.harga_jual, p.harga_grosir, p.min_qty_grosir, p.status, p.id_kategori,
                 p.id_satuan, p.id_supplier, p.created_at, p.updated_at,
                 COALESCE((SELECT SUM(stok) FROM product_stocks WHERE id_produk = p.id_produk), 0) as stok
          FROM products p
          WHERE (p.nama_produk COLLATE NOCASE LIKE ?
              OR p.kode_produk COLLATE NOCASE LIKE ?)
          ORDER BY 
            CASE 
              WHEN p.nama_produk COLLATE NOCASE LIKE ? THEN 0
              ELSE 1
            END,
            p.nama_produk ASC
          LIMIT ? OFFSET ?
        `;
        params = [searchTerm, searchTerm, q, displayLimit, offset];

        // Count ALL matching products (not limited)
        countSql = `
          SELECT COUNT(*) as count
          FROM products p
          WHERE (p.nama_produk COLLATE NOCASE LIKE ?
              OR p.kode_produk COLLATE NOCASE LIKE ?)
        `;
        countParams = [searchTerm, searchTerm];
      } else {
        // No query: return recent products (API already filtered by status)
        sql = `
          SELECT p.id, p.id_produk, p.kode_produk, p.nama_produk, p.deskripsi,
                 p.harga_jual, p.harga_grosir, p.min_qty_grosir, p.status, p.id_kategori,
                 p.id_satuan, p.id_supplier, p.created_at, p.updated_at,
                 COALESCE((SELECT SUM(stok) FROM product_stocks WHERE id_produk = p.id_produk), 0) as stok
          FROM products p
          ORDER BY p.updated_at DESC
          LIMIT ? OFFSET ?
        `;
        params = [effectiveLimit, offset];

        countSql = 'SELECT COUNT(*) as count FROM products';
        countParams = [];
      }

      try {
        const rows = this.db.prepare(sql).all(...params);
        const countResult = this.db.prepare(countSql).get(...countParams);
        const total = countResult?.count || 0;
        
        return { 
          data: rows || [], 
          total, 
          limit: Math.min(limit, MAX_RESULTS), 
          offset, 
          page: Math.floor(offset / Math.min(limit, MAX_RESULTS)) + 1,
          isLimited: total > MAX_RESULTS
        };
      } catch (queryErr) {
        console.warn('Search query failed:', queryErr.message);
        // Try simple fallback query without LIKE
        try {
          const fallbackSql = `SELECT * FROM products LIMIT ${Math.min(limit, MAX_RESULTS)} OFFSET ${offset}`;
          const fallbackRows = this.db.prepare(fallbackSql).all();
          return { 
            data: fallbackRows || [], 
            total: fallbackRows?.length || 0, 
            limit: Math.min(limit, MAX_RESULTS), 
            offset, 
            page: 1,
            isLimited: false
          };
        } catch (_e) {
          console.error('Even fallback query failed');
          return { data: [], total: 0, limit: Math.min(limit, MAX_RESULTS), offset, page: 1, isLimited: false };
        }
      }
    } catch (error) {
      console.error('Error searching products:', error);
      return { data: [], total: 0, limit: Math.min(limit, MAX_RESULTS), offset, page: 1, isLimited: false };
    }
  }

  /**
   * Get single product by ID or code
   */
  getProduct(id, idType = 'id_produk') {
    try {
      const stmt = this.db.prepare(`SELECT * FROM products WHERE ${idType} = ?`);
      return stmt.get(id);
    } catch (error) {
      console.error('Error getting product:', error);
      return null;
    }
  }

  /**
   * Bulk upsert stock data
   */
  bulkUpsertStocks(stocks) {
    if (!Array.isArray(stocks) || stocks.length === 0) {
      console.warn('⚠️ No stocks to upsert');
      return { inserted: 0, updated: 0, failed: 0 };
    }

    const batchSize = 500;
    let inserted = 0;
    let updated = 0;
    let failed = 0;

    try {
      for (let i = 0; i < stocks.length; i += batchSize) {
        const batch = stocks.slice(i, i + batchSize);
        
        const transaction = this.db.transaction((items) => {
          const upsertStmt = this.db.prepare(`
            INSERT INTO product_stocks (id_produk, id_cabang, stok, lokasi_rak, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id_produk, id_cabang) DO UPDATE SET
              stok = excluded.stok,
              lokasi_rak = excluded.lokasi_rak,
              updated_at = excluded.updated_at
          `);

          for (const stock of items) {
            try {
              const result = upsertStmt.run(
                stock.id_produk,
                stock.id_cabang || null,
                stock.stok || 0,
                stock.lokasi_rak || null,
                stock.updated_at || new Date().toISOString()
              );
              if (result && result.changes > 0) {
                inserted++;
              }
            } catch (err) {
              console.error('❌ Error upserting stock for id_produk:', stock.id_produk, err.message);
              failed++;
            }
          }
        });

        transaction(batch);
      }
      return { inserted, updated, failed };
    } catch (error) {
      console.error('❌ Bulk upsert stocks failed:', error);
      throw error;
    }
  }

  /**
   * Clear all products (for full resync)
   */
  clearAllProducts() {
    try {
      this.db.exec('DELETE FROM products; DELETE FROM product_stocks;');
      return true;
    } catch (error) {
      console.error('Error clearing products:', error);
      return false;
    }
  }

  /**
   * Store offline transaction to SQLite (replaces localStorage)
   * Better capacity, structured queries, and atomic operations
   */
  storeOfflineTransaction(transactionData, cartItems = [], paymentInfo = null, customerInfo = null) {
    try {
      const id = `OFFLINE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const stmt = this.db.prepare(`
        INSERT INTO offline_transactions 
        (id, transaction_id, transaction_data, cart_items, payment_info, customer_info, status, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        id,
        transactionData.id || transactionData.transaction_id || null,
        JSON.stringify(transactionData),
        JSON.stringify(cartItems),
        JSON.stringify(paymentInfo),
        JSON.stringify(customerInfo),
        'pending',
        0
      );
      
      return {
        success: true,
        id,
        changes: result.changes
      };
    } catch (error) {
      console.error('❌ Error storing offline transaction:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get pending offline transactions (not yet synced)
   */
  getPendingOfflineTransactions(limit = 100) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM offline_transactions 
        WHERE synced = 0 AND status = 'pending'
        ORDER BY created_at ASC
        LIMIT ?
      `);
      
      const transactions = stmt.all(limit);
      
      // Parse JSON fields
      return transactions.map(tx => ({
        ...tx,
        transaction_data: JSON.parse(tx.transaction_data || '{}'),
        cart_items: JSON.parse(tx.cart_items || '[]'),
        payment_info: JSON.parse(tx.payment_info || 'null'),
        customer_info: JSON.parse(tx.customer_info || 'null')
      }));
    } catch (error) {
      console.error('❌ Error getting pending transactions:', error);
      return [];
    }
  }

  /**
   * Get all offline transactions (including synced)
   */
  getAllOfflineTransactions(limit = 1000, offset = 0) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM offline_transactions 
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `);
      
      const transactions = stmt.all(limit, offset);
      
      // Parse JSON fields
      return transactions.map(tx => ({
        ...tx,
        transaction_data: JSON.parse(tx.transaction_data || '{}'),
        cart_items: JSON.parse(tx.cart_items || '[]'),
        payment_info: JSON.parse(tx.payment_info || 'null'),
        customer_info: JSON.parse(tx.customer_info || 'null')
      }));
    } catch (error) {
      console.error('❌ Error getting transactions:', error);
      return [];
    }
  }

  /**
   * Mark offline transaction as synced
   */
  markTransactionSynced(transactionId, serverId = null) {
    try {
      const stmt = this.db.prepare(`
        UPDATE offline_transactions 
        SET synced = 1, synced_at = ?, synced_server_id = ?, status = 'synced'
        WHERE id = ? OR transaction_id = ?
      `);
      
      const now = new Date().toISOString();
      const result = stmt.run(now, serverId, transactionId, transactionId);
      
      return {
        success: true,
        changes: result.changes
      };
    } catch (error) {
      console.error('❌ Error marking transaction synced:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update offline transaction status and error message
   */
  updateTransactionStatus(transactionId, status = 'failed', errorMessage = null) {
    try {
      const stmt = this.db.prepare(`
        UPDATE offline_transactions 
        SET status = ?, error_message = ?, updated_at = ?
        WHERE id = ? OR transaction_id = ?
      `);
      
      const now = new Date().toISOString();
      const result = stmt.run(status, errorMessage, now, transactionId, transactionId);
      
      return {
        success: true,
        changes: result.changes
      };
    } catch (error) {
      console.error('❌ Error updating transaction status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get count of pending transactions (for monitoring)
   */
  getPendingTransactionCount() {
    try {
      const result = this.db.prepare(`
        SELECT COUNT(*) as count FROM offline_transactions 
        WHERE synced = 0 AND status = 'pending'
      `).get();
      
      return result?.count || 0;
    } catch (error) {
      console.error('❌ Error getting transaction count:', error);
      return 0;
    }
  }

  /**
   * Delete old synced transactions (cleanup, keep last 30 days)
   */
  cleanupOldTransactions(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffISO = cutoffDate.toISOString();
      
      const stmt = this.db.prepare(`
        DELETE FROM offline_transactions 
        WHERE synced = 1 AND status = 'synced' AND created_at < ?
      `);
      
      const result = stmt.run(cutoffISO);
      
      return {
        success: true,
        deletedCount: result.changes
      };
    } catch (error) {
      console.error('❌ Error cleaning up transactions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get offline transaction statistics
   */
  getOfflineTransactionStats() {
    try {
      const pending = this.db.prepare(`
        SELECT COUNT(*) as count FROM offline_transactions WHERE synced = 0
      `).get();
      
      const synced = this.db.prepare(`
        SELECT COUNT(*) as count FROM offline_transactions WHERE synced = 1
      `).get();
      
      const failed = this.db.prepare(`
        SELECT COUNT(*) as count FROM offline_transactions WHERE status = 'failed'
      `).get();
      
      const totalValue = this.db.prepare(`
        SELECT SUM(json_extract(transaction_data, '$.total')) as total 
        FROM offline_transactions WHERE synced = 0
      `).get();
      
      return {
        pending: pending?.count || 0,
        synced: synced?.count || 0,
        failed: failed?.count || 0,
        totalPendingValue: totalValue?.total || 0
      };
    } catch (error) {
      console.error('❌ Error getting transaction stats:', error);
      return {
        pending: 0,
        synced: 0,
        failed: 0,
        totalPendingValue: 0
      };
    }
  }

  /**
   * Get all stocks for a specific branch
   */
  getStocksByCabang(idCabang) {
    try {
      const stmt = this.db.prepare(`
        SELECT id_produk, id_cabang, stok, lokasi_rak, updated_at 
        FROM product_stocks 
        WHERE id_cabang = ?
        ORDER BY id_produk ASC
      `);
      const stocks = stmt.all(idCabang) || [];
      return stocks;
    } catch (error) {
      console.error('❌ Error getting stocks by cabang:', error);
      return [];
    }
  }

  /**
   * Get stock for specific product and branch
   */
  getStockByProductAndCabang(idProduk, idCabang) {
    try {
      const stmt = this.db.prepare(`
        SELECT stok FROM product_stocks 
        WHERE id_produk = ? AND id_cabang = ?
        LIMIT 1
      `);
      const result = stmt.get(idProduk, idCabang);
      return result?.stok || 0;
    } catch (error) {
      console.error('❌ Error getting stock:', error);
      return 0;
    }
  }

  /**
   * Get total stock (sum all branches for a product)
   */
  getProductTotalStock(idProduk) {
    try {
      const stmt = this.db.prepare(`
        SELECT COALESCE(SUM(stok), 0) as total 
        FROM product_stocks 
        WHERE id_produk = ?
      `);
      const result = stmt.get(idProduk);
      return result?.total || 0;
    } catch (error) {
      console.error('❌ Error getting product total stock:', error);
      return 0;
    }
  }

  /**
   * Close database connection
   */
  close() {
    try {
      if (this.db) {
        this.db.close();
        this.isInitialized = false;
      }
    } catch (error) {
      console.error('Error closing database:', error);
    }
  }
}

// Export singleton instance
module.exports = new ProductDatabase();
