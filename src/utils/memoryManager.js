// src/utils/memoryManager.js

// Memory management utilities for better performance

class MemoryManager {
  constructor() {
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    this.maxCacheSize = 100; // Maximum cache entries
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.cleanupInterval = null;

    this.startCleanup();
  }

  // Cache with automatic cleanup
  set(key, value, expiryMs = this.cacheExpiry) {
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldest();
    }

    this.cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now() + expiryMs);
  }

  get(key) {
    const expiry = this.cacheTimestamps.get(key);
    if (!expiry || Date.now() > expiry) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }
    return this.cache.get(key);
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);
  }

  clear() {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  evictOldest() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, timestamp] of this.cacheTimestamps) {
      if (timestamp < oldestTime) {
        oldestTime = timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const keysToDelete = [];

      for (const [key, expiry] of this.cacheTimestamps) {
        if (now > expiry) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(key => this.delete(key));

      // Force garbage collection if available (development only)
      if (import.meta.env.DEV && window.gc) {
        window.gc();
      }
    }, 60000); // Cleanup every minute
  }

  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Memory usage monitoring
  getMemoryUsage() {
    if (performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        usagePercent: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100
      };
    }
    return null;
  }

  // Force cleanup if memory usage is high
  checkMemoryPressure() {
    const memory = this.getMemoryUsage();
    if (memory) {
      if (memory.usagePercent > 90) {
        console.error('🚨 Critical memory usage detected (>90%), clearing all caches');
        this.clear();
        // Force garbage collection if available
        if (window.gc) {
          window.gc();
        }
      } else if (memory.usagePercent > 75) {
        console.warn('⚠️ High memory usage detected (>75%), clearing oldest cache entries');
        // Clear oldest entries instead of everything
        const keysToDelete = [];
        for (const [key, _] of this.cacheTimestamps) {
          keysToDelete.push(key);
          if (keysToDelete.length >= Math.ceil(this.cache.size * 0.3)) break;
        }
        keysToDelete.forEach(key => this.delete(key));
      }
    }
  }
}

// Singleton instance
export const memoryManager = new MemoryManager();

// API response caching
export class ApiCache {
  constructor() {
    this.cache = new Map();
    this.maxAge = 5 * 60 * 1000; // 5 minutes
  }

  set(endpoint, data, maxAge = this.maxAge) {
    this.cache.set(endpoint, {
      data,
      timestamp: Date.now(),
      maxAge
    });
  }

  get(endpoint) {
    const cached = this.cache.get(endpoint);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.maxAge) {
      this.cache.delete(endpoint);
      return null;
    }

    return cached.data;
  }

  invalidate(endpoint) {
    this.cache.delete(endpoint);
  }

  clear() {
    this.cache.clear();
  }
}

export const apiCache = new ApiCache();

// Database connection pooling simulation
export class ConnectionPool {
  constructor(maxConnections = 5) {
    this.maxConnections = maxConnections;
    this.available = [];
    this.waitingQueue = [];
    this.activeConnections = 0;
  }

  async acquire() {
    return new Promise((resolve) => {
      if (this.available.length > 0) {
        resolve(this.available.pop());
      } else if (this.activeConnections < this.maxConnections) {
        this.activeConnections++;
        resolve(this.createConnection());
      } else {
        this.waitingQueue.push(resolve);
      }
    });
  }

  release(connection) {
    if (this.waitingQueue.length > 0) {
      const waitingResolve = this.waitingQueue.shift();
      waitingResolve(connection);
    } else {
      this.available.push(connection);
    }
  }

  createConnection() {
    // Simulate database connection
    return {
      id: Math.random().toString(36).substr(2, 9),
      execute: async (_query) => {
        // Simulate query execution
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        return { rows: [], rowCount: 0 };
      },
      close: () => {
        this.activeConnections--;
      }
    };
  }
}

export const dbConnectionPool = new ConnectionPool();

// Image lazy loading and caching with LRU eviction
export class ImageCache {
  constructor() {
    this.cache = new Map();
    this.loading = new Set();
    this.maxImages = 30; // Max images to cache
    this.accessOrder = []; // Track access order for LRU
  }

  async load(src) {
    if (this.cache.has(src)) {
      // Update access order for LRU
      this.accessOrder = this.accessOrder.filter(s => s !== src);
      this.accessOrder.push(src);
      return this.cache.get(src);
    }

    if (this.loading.has(src)) {
      // Wait for ongoing load
      return new Promise((resolve, reject) => {
        const checkLoaded = () => {
          if (this.cache.has(src)) {
            resolve(this.cache.get(src));
          } else if (this.loading.has(src)) {
            setTimeout(checkLoaded, 50);
          } else {
            reject(new Error('Image failed to load'));
          }
        };
        checkLoaded();
      });
    }

    this.loading.add(src);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Check if cache is full before adding
        if (this.cache.size >= this.maxImages) {
          const lruKey = this.accessOrder.shift();
          this.cache.delete(lruKey);
        }

        this.cache.set(src, img);
        this.accessOrder.push(src);
        this.loading.delete(src);
        resolve(img);
      };
      img.onerror = () => {
        this.loading.delete(src);
        reject(new Error(`Failed to load image: ${src}`));
      };
      img.src = src;
    });
  }

  clear() {
    this.cache.clear();
    this.loading.clear();
    this.accessOrder = [];
  }
}

export const imageCache = new ImageCache();

// Component unmount cleanup registry
export class CleanupRegistry {
  constructor() {
    this.cleanups = new Map();
  }

  register(componentId, cleanupFn) {
    if (!this.cleanups.has(componentId)) {
      this.cleanups.set(componentId, []);
    }
    this.cleanups.get(componentId).push(cleanupFn);
  }

  unregister(componentId) {
    const cleanups = this.cleanups.get(componentId);
    if (cleanups) {
      cleanups.forEach(fn => {
        try {
          fn();
        } catch (error) {
          console.warn('Cleanup function failed:', error);
        }
      });
      this.cleanups.delete(componentId);
    }
  }

  clear() {
    for (const [componentId] of this.cleanups) {
      this.unregister(componentId);
    }
  }
}

export const cleanupRegistry = new CleanupRegistry();

// Performance monitoring for memory
export const monitorMemoryUsage = () => {
  if (!performance.memory) return null;

  const memory = performance.memory;
  const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

  return {
    used: memory.usedJSHeapSize,
    total: memory.totalJSHeapSize,
    limit: memory.jsHeapSizeLimit,
    usagePercent,
    isHighUsage: usagePercent > 80,
    isCriticalUsage: usagePercent > 95
  };
};

// Automatic memory management with more aggressive cleanup
export const setupMemoryManagement = () => {
  // Monitor memory usage more frequently
  const memoryCheckInterval = setInterval(() => {
    const memoryInfo = monitorMemoryUsage();
    if (memoryInfo) {
      if (memoryInfo.isCriticalUsage) {
        console.error('🚨 CRITICAL memory usage (>95%), emergency cleanup');
        memoryManager.clear();
        apiCache.clear();
        imageCache.clear();
        cleanupRegistry.clear();

        if (window.gc) {
          window.gc();
        }
      } else if (memoryInfo.isHighUsage) {
        console.warn(`⚠️ HIGH memory usage (${memoryInfo.usagePercent.toFixed(1)}%), partial cleanup`);
        memoryManager.checkMemoryPressure();
        // Also clear old API cache
        for (const [endpoint, cached] of apiCache.cache) {
          if (Date.now() - cached.timestamp > cached.maxAge * 2) {
            apiCache.invalidate(endpoint);
          }
        }
      }
    }
  }, 15000); // Check every 15 seconds (more frequent for better responsiveness)

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    memoryManager.stopCleanup();
    cleanupRegistry.clear();
    clearInterval(memoryCheckInterval);
  });

  return () => {
    memoryManager.stopCleanup();
    clearInterval(memoryCheckInterval);
  };
};