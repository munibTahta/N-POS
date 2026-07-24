/**
 * Offline Request Queue Manager
 * Menyimpan requests saat offline dan sync saat online
 */

class OfflineQueue {
  static dbName = 'TokoPOS';
  static storeName = 'offlineQueue';
  static db = null;

  /**
   * Clear and reinitialize IndexedDB if corrupted
   */
  static async clearIndexedDB() {
    return new Promise((resolve) => {
      try {
        this.db = null; // Clear reference
        const request = indexedDB.deleteDatabase(this.dbName);
        
        request.onsuccess = () => {
          resolve(true);
        };
        
        request.onerror = () => {
          console.warn('Error clearing IndexedDB:', request.error);
          resolve(true); // Still resolve to continue
        };
      } catch (error) {
        console.warn('Error clearing IndexedDB:', error);
        resolve(true);
      }
    });
  }

  /**
   * Initialize IndexedDB with auto-recovery for corrupted databases
   */
  static async initDB(retryCount = 0) {
    const MAX_RETRIES = 3;

    return new Promise((resolve, reject) => {
      if (this.db) {
        // Verify the objectStore exists before returning
        try {
          if (this.db.objectStoreNames.contains(this.storeName)) {
            resolve(this.db);
            return;
          } else {
            // Store doesn't exist, close and reinitialize
            this.db.close();
            this.db = null;
          }
        } catch (_error) {
          // Database reference is invalid, clear it
          this.db = null;
        }
      }

      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        if (retryCount < MAX_RETRIES) {
          // Retry after clearing
          this.clearIndexedDB().then(() => {
            this.initDB(retryCount + 1).then(resolve).catch(reject);
          });
        } else {
          reject(request.error);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        
        // Verify object store exists
        if (!db.objectStoreNames.contains(this.storeName)) {
          // Object store doesn't exist, need to increment version and recreate
          console.warn('Object store not found, recreating IndexedDB...');
          db.close();
          this.db = null;
          
          if (retryCount < MAX_RETRIES) {
            // Delete and retry with fresh database
            this.clearIndexedDB().then(() => {
              this.initDB(retryCount + 1).then(resolve).catch(reject);
            });
          } else {
            reject(new Error('Failed to create IndexedDB object store after retries'));
          }
          return;
        }
        
        this.db = db;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        try {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
          }
        } catch (error) {
          console.error('Error in onupgradeneeded:', error);
        }
      };

      request.onblocked = () => {
        console.warn('IndexedDB open blocked - close other tabs using this database');
      };
    });
  }

  /**
   * Add request to queue
   */
  static async add(method, url, data = null) {
    try {
      const db = await this.initDB();

      // Verify object store exists
      if (!db.objectStoreNames.contains(this.storeName)) {
        throw new Error(`Object store '${this.storeName}' not found`);
      }

      const request = {
        method,
        url,
        data,
        timestamp: Date.now(),
        status: 'pending',
        attempts: 0,
        maxRetries: 3,
        nextRetryTime: Date.now()
      };

      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction([this.storeName], 'readwrite');
          const store = tx.objectStore(this.storeName);
          const addReq = store.add(request);

          addReq.onsuccess = () => {
            resolve(addReq.result);
          };

          addReq.onerror = () => {
            reject(addReq.error);
          };
        } catch (txError) {
          console.warn('IndexedDB transaction error in add, using localStorage:', txError.message);
          this.addToLocalStorage(method, url, data);
          resolve(null);
        }
      });
    } catch (error) {
      console.error('Error adding to queue:', error);
      // Fallback to localStorage if IndexedDB fails
      this.addToLocalStorage(method, url, data);
    }
  }

  /**
   * Add to localStorage as fallback
   */
  static addToLocalStorage(method, url, data) {
    try {
      const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
      queue.push({
        method,
        url,
        data,
        timestamp: Date.now(),
        status: 'pending'
      });
      localStorage.setItem('offlineQueue', JSON.stringify(queue));
    } catch (error) {
      console.error('Error adding to localStorage:', error);
    }
  }

  /**
   * Get all queued requests
   */
  static async getAll() {
    try {
      const db = await this.initDB();

      return new Promise((resolve, reject) => {
        try {
          // Double-check object store exists
          if (!db.objectStoreNames.contains(this.storeName)) {
            throw new Error(`Object store '${this.storeName}' not found in database`);
          }

          const tx = db.transaction([this.storeName], 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.getAll();

          req.onsuccess = () => {
            resolve(req.result);
          };

          req.onerror = () => {
            reject(req.error);
          };
        } catch (txError) {
          // Object store not found, return fallback
          console.warn('IndexedDB transaction error, using localStorage:', txError.message);
          resolve(JSON.parse(localStorage.getItem('offlineQueue') || '[]'));
        }
      });
    } catch (error) {
      console.error('Error getting queue:', error);
      // Fallback to localStorage
      return JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    }
  }

  /**
   * Sync all queued requests
   */
  static async syncAll(apiClient) {
    const requests = await this.getAll();
    if (requests.length === 0) {
      return { success: true, synced: 0 };
    }
    let synced = 0;
    let failed = 0;

    for (let req of requests) {
      try {
        // Skip logout requests - they should only work when online
        // and if they fail, we simply remove them from queue
        if (req.url.includes('/logout')) {
          await this.remove(req.id);
          synced++;
          continue;
        }

        const config = {
          method: req.method,
          url: req.url,
          data: req.data
        };

        const response = await apiClient(config);

        if (response.status >= 200 && response.status < 300) {
          await this.remove(req.id);
          synced++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`❌ Sync error: ${req.method} ${req.url}`, error);
        failed++;
      }
    }
    return { success: true, synced, failed };
  }

  /**
   * Remove synced request
   */
  static async remove(id) {
    try {
      const db = await this.initDB();

      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction([this.storeName], 'readwrite');
          const store = tx.objectStore(this.storeName);
          const req = store.delete(id);

          req.onsuccess = () => {
            resolve();
          };

          req.onerror = () => {
            reject(req.error);
          };
        } catch (txError) {
          // Object store not found, fallback to removing from localStorage
          console.warn('IndexedDB transaction error, removing from localStorage:', txError.message);
          const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
          const filtered = queue.filter(item => item.id !== id);
          localStorage.setItem('offlineQueue', JSON.stringify(filtered));
          resolve();
        }
      });
    } catch (error) {
      console.error('Error removing from queue:', error);
    }
  }

  /**
   * Clear entire queue
   */
  static async clear() {
    try {
      // Clear localStorage backup
      localStorage.removeItem('offlineQueue');
      
      const db = await this.initDB();

      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction([this.storeName], 'readwrite');
          const store = tx.objectStore(this.storeName);
          const req = store.clear();

          req.onsuccess = () => {
            resolve();
          };

          req.onerror = () => {
            reject(req.error);
          };
        } catch (txError) {
          // Object store not found, just resolve since localStorage already cleared
          console.warn('IndexedDB transaction error clearing queue:', txError.message);
          resolve();
        }
      });
    } catch (error) {
      console.error('Error clearing queue:', error);
    }
  }

  /**
   * Get queue size
   */
  static async size() {
    const requests = await this.getAll();
    return requests.length;
  }

  /**
   * Update request retry info with exponential backoff
   */
  static async updateRetry(id, success = false) {
    try {
      const db = await this.initDB();

      return new Promise((resolve, reject) => {
        const tx = db.transaction([this.storeName], 'readwrite');
        const store = tx.objectStore(this.storeName);
        const getReq = store.get(id);

        getReq.onsuccess = () => {
          const req = getReq.result;
          if (!req) return resolve();

          if (success) {
            req.status = 'success';
            req.syncedAt = Date.now();
          } else {
            req.attempts = (req.attempts || 0) + 1;
            // Exponential backoff: 1s, 2s, 4s, 8s, etc
            const backoffMs = Math.min(1000 * Math.pow(2, req.attempts - 1), 30000);
            req.nextRetryTime = Date.now() + backoffMs;
            
            if (req.attempts >= (req.maxRetries || 3)) {
              req.status = 'failed';
            } else {
              req.status = 'retry';
            }
          }

          const updateReq = store.put(req);
          updateReq.onsuccess = () => resolve();
          updateReq.onerror = () => reject(updateReq.error);
        };

        getReq.onerror = () => reject(getReq.error);
      });
    } catch (error) {
      console.error('Error updating retry:', error);
    }
  }

  /**
   * Get requests ready for retry (past nextRetryTime)
   */
  static async getRetryable() {
    try {
      const all = await this.getAll();
      const now = Date.now();
      return all.filter(req => 
        req.status === 'retry' && 
        req.nextRetryTime <= now &&
        req.attempts < (req.maxRetries || 3)
      );
    } catch (error) {
      console.error('Error getting retryable requests:', error);
      return [];
    }
  }

  /**
   * Batch sync dengan priority dan grouping
   * Group by endpoint + priority, sync dalam batches
   */
  static async syncInBatches(batchSize = 50) {
    try {
      const queue = await this.getAll();
      if (queue.length === 0) {
        return { synced: 0, failed: 0, batches: 0 };
      }
      // Group by endpoint
      const grouped = this.groupByEndpoint(queue);
      
      let totalSynced = 0;
      let totalFailed = 0;
      let batchCount = 0;

      // Process each endpoint group
      for (const [endpoint, requests] of Object.entries(grouped)) {
        // Create batches
        for (let i = 0; i < requests.length; i += batchSize) {
          const batch = requests.slice(i, i + batchSize);
          
          try {
            // Try batch API jika ada
            const result = await this.syncBatch(endpoint, batch);
            totalSynced += result.synced;
            totalFailed += result.failed;
            batchCount++;
            // Delay antar batch untuk jangan overload server
            if (i + batchSize < requests.length) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (error) {
            console.error(`❌ Batch sync error for ${endpoint}:`, error);
            totalFailed += batch.length;
          }
        }
      }
      return {
        synced: totalSynced,
        failed: totalFailed,
        batches: batchCount,
        total: queue.length
      };
    } catch (error) {
      console.error('Batch sync error:', error);
      return { synced: 0, failed: 0, batches: 0 };
    }
  }

  /**
   * Group requests by endpoint
   */
  static groupByEndpoint(requests) {
    const grouped = {};
    
    requests.forEach(req => {
      const endpoint = new URL(req.url, 'http://localhost').pathname;
      if (!grouped[endpoint]) {
        grouped[endpoint] = [];
      }
      grouped[endpoint].push(req);
    });

    return grouped;
  }

  /**
   * Sync batch of requests (one endpoint)
   */
  static async syncBatch(endpoint, batch) {
    let synced = 0;
    let failed = 0;

    for (const request of batch) {
      try {
        // Import di sini untuk avoid circular dependency
        const axios = (await import('axios')).default;

        const config = {
          method: request.method.toLowerCase(),
          url: request.url,
          ...(request.data && { data: request.data })
        };

        const response = await axios(config);

        if (response.status >= 200 && response.status < 300) {
          await this.updateRetry(request.id, true);
          synced++;
        } else {
          await this.updateRetry(request.id, false);
          failed++;
        }
      } catch (error) {
        console.error(`Failed to sync: ${request.method} ${request.url}`, error);
        await this.updateRetry(request.id, false);
        failed++;
      }
    }

    return { synced, failed };
  }

  /**
   * Get sync status summary
   */
  static async getSyncStatus() {
    try {
      const all = await this.getAll();
      if (!Array.isArray(all)) {
        return {
          total: 0,
          pending: 0,
          retry: 0,
          success: 0,
          failed: 0,
          percentage: {
            pending: 0,
            retry: 0,
            success: 0,
            failed: 0
          },
          readyForRetry: false,
          hasFailures: false
        };
      }

      const pending = all.filter(r => r.status === 'pending').length;
      const retry = all.filter(r => r.status === 'retry').length;
      const success = all.filter(r => r.status === 'success').length;
      const failed = all.filter(r => r.status === 'failed').length;

      const total = all.length;

      return {
        total,
        pending,
        retry,
        success,
        failed,
        percentage: total > 0 ? {
          pending: Math.round((pending / total) * 100),
          retry: Math.round((retry / total) * 100),
          success: Math.round((success / total) * 100),
          failed: Math.round((failed / total) * 100)
        } : {
          pending: 0,
          retry: 0,
          success: 0,
          failed: 0
        },
        readyForRetry: retry > 0,
        hasFailures: failed > 0
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return {
        total: 0,
        pending: 0,
        retry: 0,
        success: 0,
        failed: 0,
        percentage: {
          pending: 0,
          retry: 0,
          success: 0,
          failed: 0
        },
        readyForRetry: false,
        hasFailures: false
      };
    }
  }
}

export default OfflineQueue;
