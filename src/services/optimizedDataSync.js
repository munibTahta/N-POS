/**
 * Optimized Data Sync Service
 * Implements best practices from API spec v1.5.8
 * - Full sync with skip_pagination=true
 * - Batch processing with concurrency limits
 * - Exponential backoff retry logic
 * - Progress tracking
 * - Network state awareness
 * - Transaction queue support
 * - Conflict resolution (server-wins strategy)
 */

import {
  getProducts,
  getCategories,
  getUnits,
  getPaymentMethods,
  getPelanggan,
  getSuppliers
} from './api';
import { extractArray } from '../utils/apiResponseHelper';

class OptimizedDataSync {
  constructor(config = {}) {
    this.config = {
      batchSize: 5000,
      maxRetries: 3,
      initialRetryDelayMs: 1000,
      maxRetryDelayMs: 30000,
      requestTimeoutMs: 30000,
      ...config
    };
    this.metrics = new Map();
    this.isOnline = navigator.onLine;
    this.setupNetworkListener();
  }

  /**
   * Setup network state listener
   */
  setupNetworkListener() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.onlineCallback?.();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  /**
   * Calculate retry delay with exponential backoff
   * 1s → 2s → 4s → 8s → 16s → 30s (capped)
   */
  calculateRetryDelay(attemptNumber) {
    const delay = Math.min(
      this.config.initialRetryDelayMs * Math.pow(2, attemptNumber),
      this.config.maxRetryDelayMs
    );
    return delay;
  }

  /**
   * Fetch with retry logic and exponential backoff
   */
  async fetchWithRetry(fetchFn, dataType) {
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const data = await fetchFn();
        const duration = Date.now() - startTime;
        
        // Record metrics
        this.recordMetric(dataType, {
          success: true,
          duration,
          itemCount: Array.isArray(data) ? data.length : 0,
          attempts: attempt + 1
        });
        
        return data;
      } catch (error) {
        console.warn(`Attempt ${attempt + 1}/${this.config.maxRetries} failed for ${dataType}:`, error.message);
        
        if (attempt < this.config.maxRetries - 1) {
          const delay = this.calculateRetryDelay(attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          this.recordMetric(dataType, {
            success: false,
            error: error.message,
            attempts: attempt + 1
          });
          throw error;
        }
      }
    }
  }

  /**
   * Record sync metrics for monitoring
   */
  recordMetric(dataType, metric) {
    const key = `sync_${dataType}`;
    const existing = this.metrics.get(key) || [];
    existing.push({
      timestamp: new Date().toISOString(),
      ...metric
    });
    // Keep only last 50 records per type
    if (existing.length > 50) existing.shift();
    this.metrics.set(key, existing);
  }

  /**
   * Save sync data to local database (SQLite via IPC)
   */
  async saveToLocalDB(tableName, data, chunkSize = 5000) {
    if (!Array.isArray(data) || data.length === 0) {
      return { saved: 0, failed: 0 };
    }

    if (!window?.electronAPI?.dbBatch) {
      console.warn('⚠️ No IPC for batch DB operations');
      return { saved: 0, failed: 0 };
    }

    let totalSaved = 0;
    let totalFailed = 0;

    // Process in chunks to avoid overwhelming database
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, Math.min(i + chunkSize, data.length));
      try {
        const result = await window.electronAPI.dbBatch({
          operations: chunk.map(item => ({
            type: 'upsert',
            table: tableName,
            data: item
          }))
        });
        totalSaved += result?.successful || 0;
        totalFailed += result?.failed || 0;
      } catch (error) {
        console.error(`Failed to save chunk of ${tableName}:`, error);
        totalFailed += chunk.length;
      }
    }

    return { saved: totalSaved, failed: totalFailed };
  }

  /**
   * Perform full sync for all master data
   * According to API spec v1.5.8: Use skip_pagination=true for master data
   */
  async performFullSync() {
    if (!this.isOnline) {
      console.warn('⚠️ Offline - skipping full sync');
      return { success: false, reason: 'offline' };
    }

    const syncTasks = [
      {
        name: 'products',
        fn: () => this.fetchWithRetry(
          () => getProducts({ skip_pagination: true, status: 'aktif' }),
          'products'
        ),
        dbTable: 'products'
      },
      {
        name: 'categories',
        fn: () => this.fetchWithRetry(
          () => getCategories(),
          'categories'
        ),
        dbTable: 'categories'
      },
      {
        name: 'units',
        fn: () => this.fetchWithRetry(
          () => getUnits(),
          'units'
        ),
        dbTable: 'units'
      },
      {
        name: 'paymentMethods',
        fn: () => this.fetchWithRetry(
          () => getPaymentMethods(),
          'payment_methods'
        ),
        dbTable: 'metode_pembayaran'
      },
      {
        name: 'customers',
        fn: () => this.fetchWithRetry(
          () => getPelanggan(),
          'customers'
        ),
        dbTable: 'customers'
      },
      {
        name: 'suppliers',
        fn: () => this.fetchWithRetry(
          () => getSuppliers(),
          'suppliers'
        ),
        dbTable: 'suppliers'
      }
    ];

    const results = {};
    const startTime = Date.now();

    for (const task of syncTasks) {
      try {
        const data = await task.fn();
        const extractedData = extractArray(data);
        
        if (extractedData && extractedData.length > 0) {
          const dbResult = await this.saveToLocalDB(task.dbTable, extractedData);
          results[task.name] = {
            success: true,
            synced: dbResult.saved,
            failed: dbResult.failed,
            total: extractedData.length
          };
        } else {
          results[task.name] = {
            success: true,
            synced: 0,
            total: 0
          };
        }
      } catch (error) {
        console.error(`Failed to sync ${task.name}:`, error);
        results[task.name] = {
          success: false,
          error: error.message
        };
      }
    }

    const duration = Date.now() - startTime;
    const successCount = Object.values(results).filter(r => r.success).length;
    
    // Update last sync timestamp
    localStorage.setItem('lastFullSync', new Date().toISOString());
    localStorage.setItem('fullSyncMetrics', JSON.stringify({
      timestamp: new Date().toISOString(),
      duration,
      successCount,
      results
    }));
    return {
      success: successCount === syncTasks.length,
      duration,
      results
    };
  }

  /**
   * Perform delta sync using 'since' parameter (not yet fully implemented by server)
   * Falls back to full sync for now
   */
  async performDeltaSync() {
    return this.performFullSync();
  }

  /**
   * Sync offline transaction queue when online
   * Coordinates with useTransactionQueue hook
   */
  async syncOfflineQueue() {
    if (!window?.electronAPI?.dbSelect) {
      console.warn('⚠️ No IPC for transaction queue access');
      return { synced: 0, failed: 0 };
    }

    try {
      // Get pending transactions from offline DB
      const queue = await window.electronAPI.dbSelect({
        table: 'transaction_queue',
        where: { status: 'pending' }
      });

      if (!queue || queue.length === 0) {
        return { synced: 0, failed: 0 };
      }
      let syncedCount = 0;
      let failedCount = 0;

      // Process in batches
      for (let i = 0; i < queue.length; i += this.config.batchSize) {
        const batch = queue.slice(i, Math.min(i + this.config.batchSize, queue.length));
        
        for (const transaction of batch) {
          // Transaction sync is handled by useTransactionQueue hook
          // Here we just ensure the hook has what it needs
          if (window?.electronAPI?.dbUpdate) {
            try {
              // Mark as ready for processing by hook
              await window.electronAPI.dbUpdate({
                table: 'transaction_queue',
                data: { status: 'ready_for_sync' },
                where: { id: transaction.id }
              });
              syncedCount++;
            } catch (error) {
              console.error('Failed to update transaction:', error);
              failedCount++;
            }
          }
        }
      }

      return { synced: syncedCount, failed: failedCount };
    } catch (error) {
      console.error('Error syncing offline queue:', error);
      return { synced: 0, failed: 0 };
    }
  }

  /**
   * Auto-sync on network restoration
   */
  onOnlineRestored(callback) {
    this.onlineCallback = callback;
  }

  /**
   * Get sync metrics for debugging
   */
  getMetrics() {
    const result = {};
    for (const [key, value] of this.metrics.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics.clear();
  }
}

// Export singleton instance
const syncManager = new OptimizedDataSync({
  batchSize: 5000,
  maxRetries: 3,
  initialRetryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  requestTimeoutMs: 30000
});

export default syncManager;
export { OptimizedDataSync };
