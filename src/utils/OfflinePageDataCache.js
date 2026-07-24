/**
 * Offline Page Data Cache Manager
 * 
 * Smart caching untuk halaman offline:
 * - Cache data setelah berhasil fetch (tidak cache error)
 * - Reuse cache selama belum ada update dari server
 * - Invalidate cache saat user trigger refresh atau ada sync notification
 * - Gunakan timestamp untuk track freshness
 * - Minimal DB hits dengan strategy: Cache → DB → API
 */

const pageDataCache = new Map(); // { pageName: { data, timestamp, version } }
const PAGE_CACHE_TTL = 30 * 60 * 1000; // 30 menit default (bisa dikonfigurasi per page)

export class OfflinePageDataCache {
  constructor() {
    this.cache = pageDataCache;
    this.cacheConfig = new Map(); // { pageName: { ttl, validator, dataSource } }
    this.syncListeners = new Set();
  }

  /**
   * Register page cache dengan config
   */
  registerPage(pageName, config = {}) {
    const {
      ttl = PAGE_CACHE_TTL,
      validator = (data) => Array.isArray(data) || typeof data === 'object',
      dataSource = 'api' // 'api' | 'db' | 'hybrid'
    } = config;

    this.cacheConfig.set(pageName, { ttl, validator, dataSource });
  }

  /**
   * Get data dengan smart fallback: Cache → DB → API
   */
  async getPageData(pageName, fetchFn, dbFallbackFn = null) {
    try {
      // 1. Check cache first
      const cached = this.getCached(pageName);
      if (cached && !this.isStale(pageName)) {
        return { data: cached, source: 'cache', isFresh: true };
      }

      // 2. Try fetch from API
      try {
        if (!navigator.onLine) throw new Error('Offline');
        
        const data = await fetchFn();
        const config = this.cacheConfig.get(pageName);
        
        // Validate before caching
        if (config?.validator(data)) {
          this.setCached(pageName, data);
          return { data, source: 'api', isFresh: true };
        }
      } catch (apiError) {
        console.warn(`⚠️ API fetch failed for ${pageName}:`, apiError.message);
      }

      // 3. Fallback to DB
      if (dbFallbackFn) {
        try {
          const dbData = await dbFallbackFn();
          const config = this.cacheConfig.get(pageName);
          
          if (dbData && config?.validator(dbData)) {
            this.setCached(pageName, dbData);
            return { data: dbData, source: 'db', isFresh: false };
          }
        } catch (dbError) {
          console.warn(`⚠️ DB fallback failed for ${pageName}:`, dbError.message);
        }
      }

      // 4. Use stale cache if available
      if (cached) {
        return { data: cached, source: 'cache-stale', isFresh: false };
      }

      throw new Error(`No data available for ${pageName}`);
    } catch (error) {
      console.error(`❌ Failed to load ${pageName}:`, error.message);
      throw error;
    }
  }

  /**
   * Set cache dengan metadata
   */
  setCached(pageName, data) {
    if (!data) return;

    this.cache.set(pageName, {
      data,
      timestamp: Date.now(),
      version: (this.cache.get(pageName)?.version || 0) + 1
    });
  }

  /**
   * Get cache data
   */
  getCached(pageName) {
    const entry = this.cache.get(pageName);
    return entry?.data || null;
  }

  /**
   * Check if cache stale
   */
  isStale(pageName) {
    const entry = this.cache.get(pageName);
    if (!entry) return true;

    const config = this.cacheConfig.get(pageName);
    const ttl = config?.ttl || PAGE_CACHE_TTL;
    const age = Date.now() - entry.timestamp;

    return age > ttl;
  }

  /**
   * Get cache age in ms
   */
  getCacheAge(pageName) {
    const entry = this.cache.get(pageName);
    if (!entry) return 0;
    return Date.now() - entry.timestamp;
  }

  /**
   * Invalidate single page cache
   */
  invalidateCache(pageName) {
    this.cache.delete(pageName);
    this.notifyListeners(pageName);
  }

  /**
   * Invalidate multiple pages (e.g., after sync)
   */
  invalidateMultiple(pageNames = []) {
    pageNames.forEach(name => this.cache.delete(name));
    pageNames.forEach(name => this.notifyListeners(name));
  }

  /**
   * Invalidate all cache
   */
  invalidateAll() {
    const count = this.cache.size;
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    const stats = {
      totalCached: this.cache.size,
      pages: []
    };

    for (const [pageName, entry] of this.cache.entries()) {
      stats.pages.push({
        name: pageName,
        age: this.getCacheAge(pageName),
        version: entry.version,
        size: JSON.stringify(entry.data).length,
        isStale: this.isStale(pageName)
      });
    }

    return stats;
  }

  /**
   * Register listener untuk cache invalidation
   */
  onCacheInvalidate(listener) {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  /**
   * Notify listeners tentang invalidation
   */
  notifyListeners(pageName) {
    this.syncListeners.forEach(listener => {
      try {
        listener(pageName);
      } catch (e) {
        console.warn('Cache listener error:', e);
      }
    });
  }
}

// Singleton instance
const cacheManager = new OfflinePageDataCache();

export default cacheManager;
