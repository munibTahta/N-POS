/**
 * Cache Manager untuk menyimpan GET responses
 * Digunakan untuk offline support dan performance optimization
 * 
 * Large reports (>10MB) tidak di-cache untuk mencegah memory overflow
 * Small/medium responses di-cache dengan intelligent eviction
 */

class CacheManager {
  static cache = new Map();
  static defaultTTL = 5 * 60 * 1000; // 5 minutes default
  static maxCacheSize = 50; // Maximum cache entries to prevent memory bloat
  static maxDataSize = 10 * 1024 * 1024; // 10MB max per cache entry
  static noCachePatterns = [
    '/produk',                 // Product bulk download - 22MB+, stored in SQLite instead
    '/laporan/stok',           // Stock report - often >10MB
    '/laporan/valuasi',        // Valuation report - large
    '/laporan/kartu-stok',     // Stock card - detailed
    '/laporan/segmentasi',     // Segmentation report - large
    '/export',                 // Export endpoints
    '/download'                // Download endpoints
  ];

  /**
   * Check if endpoint should be cached
   */
  static shouldCache(key) {
    // Never cache large report endpoints
    return !this.noCachePatterns.some(pattern => key.includes(pattern));
  }

  /**
   * Set cache value with size limits
   * @param {string} key - Cache key (biasanya URL)
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  static set(key, data, ttl = this.defaultTTL) {
    // Skip caching for large reports
    if (!this.shouldCache(key)) {
      return false;
    }

    // Check data size to prevent memory overflow
    let dataSize = 0;
    try {
      dataSize = JSON.stringify(data).length;
      if (dataSize > this.maxDataSize) {
        console.warn(`⚠️ Cache data too large (${(dataSize / 1024 / 1024).toFixed(2)}MB) for: ${key}`);
        return false;
      }
    } catch (e) {
      console.error(`Error calculating data size for ${key}:`, e);
      return false;
    }

    // Enforce max cache size - remove oldest if limit reached
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldest();
    }

    // Resolve TTL from pattern map if caller didn't explicitly pass a ttl
    const effectiveTTL = (typeof ttl === 'number') ? ttl : this.getTTL(key);

    const existing = this.cache.get(key);

    // If existing and still valid and unchanged, skip re-setting to avoid noisy logs
    if (existing && Date.now() <= existing.expires) {
      try {
        const same = JSON.stringify(existing.data) === JSON.stringify(data);
        if (same) {
          // nothing changed and not expired — don't re-write the cache
          return true;
        }
      } catch (_e) {
        // If serialization fails, fall back to replacing the cache
      }
    }

    this.cache.set(key, {
      data,
      expires: Date.now() + effectiveTTL,
      timestamp: Date.now(),
      size: dataSize
    });

    return true;
  }

  /**
   * Evict oldest cache entry
   */
  static evictOldest() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, value] of this.cache) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get cache value
   * @param {string} key - Cache key
   * @returns {any|null} Cached data or null if expired/not found
   */
  static get(key) {
    const item = this.cache.get(key);

    if (!item) return null;

    // Check if expired
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    // Return data without verbose logging to reduce noise
    return item.data;
  }

  /**
   * Check if cache exists and is valid
   */
  static has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Remove specific cache
   */
  static remove(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  static clear() {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  static getStats() {
    return {
      size: this.cache.size,
      items: Array.from(this.cache.entries()).map(([key, value]) => ({
        key,
        timestamp: new Date(value.timestamp).toLocaleString(),
        expires: new Date(value.expires).toLocaleString()
      }))
    };
  }

  /**
   * Get cache only when offline — helper to centralize fallback logic
   * @param {string} key
   * @returns {any|null}
   */
  static getCachedIfOffline(key) {
    if (typeof navigator !== 'undefined' && navigator.onLine) return null;
    return this.get(key);
  }

  /**
   * Set different TTL for different endpoints
   */
  static setTTL(pattern, ttl) {
    this.ttlMap = this.ttlMap || {};
    this.ttlMap[pattern] = ttl;
  }

  /**
   * Get TTL for specific URL
   */
  static getTTL(url) {
    const ttlMap = this.ttlMap || {};

    // Check for pattern matches
    for (const [pattern, ttl] of Object.entries(ttlMap)) {
      if (url.includes(pattern)) {
        return ttl;
      }
    }

    return this.defaultTTL;
  }
}

// Set custom TTL for specific endpoints
// Large reports (>10MB) are in noCachePatterns and won't be cached at all
CacheManager.setTTL('/produk', 10 * 60 * 1000); // 10 minutes for products
CacheManager.setTTL('/kategori', 30 * 60 * 1000); // 30 minutes for categories
CacheManager.setTTL('/satuan', 30 * 60 * 1000); // 30 minutes for units
CacheManager.setTTL('/pelanggan', 5 * 60 * 1000); // 5 minutes for customers
CacheManager.setTTL('/stok', 2 * 60 * 1000); // 2 minutes for stock (frequently changes)
CacheManager.setTTL('/metode-pembayaran', 30 * 60 * 1000); // 30 minutes for payment methods
CacheManager.setTTL('/penjualan', 5 * 60 * 1000); // 5 minutes for sales (use paging instead)
CacheManager.setTTL('/laporan/penjualan', 10 * 60 * 1000); // Small sales summary only, not full report

export default CacheManager;
