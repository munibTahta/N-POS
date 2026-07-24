import { lazy, Suspense } from 'react';

/**
 * Route Preloader & Offline Cache Manager
 * - Pre-caches all critical routes and components
 * - Enables instant navigation (desktop-app feeling)
 * - Works fully offline
 * - Follows offline-first principle from copilot-instructions.md
 */

// Critical routes that must be available offline
const CRITICAL_ROUTES = [
  'menu', 'pos', 'laporan', 'penjualan', 'stok', 'stok/kasir', 'stok/gudang'
];

// Routes grouped by priority for preloading
const ROUTE_PRIORITIES = {
  CRITICAL: ['menu', 'pos', 'penjualan', 'laporan'],
  HIGH: ['stok', 'stok/kasir', 'stok/gudang', 'pelanggan', 'produk'],
  MEDIUM: ['kategori', 'supplier', 'pembelian', 'setting'],
  LOW: ['user', 'cabang', 'unit', 'diskon', 'loyalitas']
};

/**
 * Component cache for instant loading
 * Stores preloaded lazy components
 */
const componentCache = new Map();

/**
 * Preload a lazy component (non-blocking)
 */
export const preloadComponent = async (componentPromise, name) => {
  try {
    if (!componentCache.has(name)) {
      await componentPromise;
      componentCache.set(name, true);
    }
  } catch (error) {
    console.warn(`⚠️ Failed to preload ${name}:`, error.message);
  }
};

/**
 * Batch preload routes by priority
 * Non-blocking, happens in background
 */
export const preloadRoutesByPriority = (routeImports) => {
  return async () => {
    // Phase 1: Critical routes (immediate)
    const criticalPromises = ROUTE_PRIORITIES.CRITICAL
      .filter(route => routeImports[route])
      .map(route => preloadComponent(routeImports[route], route));
    
    await Promise.allSettled(criticalPromises);
    // Phase 2: High priority (after critical done)
    const highPromises = ROUTE_PRIORITIES.HIGH
      .filter(route => routeImports[route])
      .map(route => preloadComponent(routeImports[route], route));
    
    await Promise.allSettled(highPromises);
    // Phase 3: Medium & Low priority (background)
    const mediumPromises = ROUTE_PRIORITIES.MEDIUM
      .filter(route => routeImports[route])
      .map(route => preloadComponent(routeImports[route], route));
    
    await Promise.allSettled(mediumPromises);
    
    const lowPromises = ROUTE_PRIORITIES.LOW
      .filter(route => routeImports[route])
      .map(route => preloadComponent(routeImports[route], route));
    
    await Promise.allSettled(lowPromises);
  };
};

/**
 * Create optimized route loader with preloading
 * Usage: import RouteLoader from './hooks/RouteLoader'
 * const LoginPage = RouteLoader.lazy(() => import('./pages/LoginPage'), 'LoginPage')
 */
export const createOptimizedLazyRoute = (importFn, routeName) => {
  // Start preloading immediately when route file is requested
  const preloadPromise = preloadComponent(importFn(), routeName);
  
  return lazy(async () => {
    await preloadPromise;
    return importFn();
  });
};

/**
 * Cache route data locally for offline access
 * Stores UI state, navigation data, etc.
 */
export const routeDataCache = {
  store: new Map(),
  
  /**
   * Save route data to cache + localStorage for persistence
   */
  save(routeName, data, ttlSeconds = 86400) {
    const entry = {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000
    };
    
    this.store.set(routeName, entry);
    
    try {
      localStorage.setItem(
        `route_cache_${routeName}`,
        JSON.stringify(entry)
      );
    } catch (_e) {
      console.warn(`Failed to persist route cache for ${routeName}:`, _e.message);
    }
  },

  /**
   * Get cached route data
   */
  get(routeName) {
    // Check memory cache first
    let entry = this.store.get(routeName);
    
    if (!entry) {
      // Try localStorage
      try {
        const stored = localStorage.getItem(`route_cache_${routeName}`);
        if (stored) {
          entry = JSON.parse(stored);
          this.store.set(routeName, entry);
        }
      } catch (_e) {
        console.warn(`Failed to read route cache for ${routeName}:`, _e.message);
      }
    }

    // Check if expired
    if (entry && Date.now() - entry.timestamp < entry.ttl) {
      return entry.data;
    }

    // Expired or not found
    if (entry) {
      this.store.delete(routeName);
      try {
        localStorage.removeItem(`route_cache_${routeName}`);
      } catch (_e) {
        // Ignore
      }
    }

    return null;
  },

  /**
   * Clear all cache
   */
  clear() {
    this.store.clear();
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('route_cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (_e) {
      // Ignore localStorage errors
    }
  }
};

/**
 * Navigation prefetch manager
 * Loads data for next route before user navigates
 */
export const navigationPrefetch = {
  timers: new Map(),

  /**
   * Prefetch data for a route
   */
  prefetch(routeName, fetchFn, delayMs = 100) {
    // Clear existing timer
    if (this.timers.has(routeName)) {
      clearTimeout(this.timers.get(routeName));
    }

    // Set new timer (wait before fetching)
    const timer = setTimeout(async () => {
      try {
        const data = await fetchFn();
        routeDataCache.save(routeName, data);
      } catch (error) {
        console.warn(`Failed to prefetch ${routeName}:`, error.message);
      }
      this.timers.delete(routeName);
    }, delayMs);

    this.timers.set(routeName, timer);
  },

  /**
   * Cancel prefetch for a route
   */
  cancel(routeName) {
    if (this.timers.has(routeName)) {
      clearTimeout(this.timers.get(routeName));
      this.timers.delete(routeName);
    }
  },

  /**
   * Cancel all prefetches
   */
  cancelAll() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
};

/**
 * Offline route fallback handler
 * Provides graceful degradation for routes without data
 */
export const getOfflineRouteFallback = (routeName) => {
  const cached = routeDataCache.get(routeName);
  
  if (cached) {
    return {
      data: cached,
      isStale: true,
      message: 'Menampilkan data offline terbaru'
    };
  }

  return {
    data: null,
    isStale: false,
    message: `Data untuk ${routeName} tidak tersedia offline`
  };
};

export default {
  preloadRoutesByPriority,
  createOptimizedLazyRoute,
  routeDataCache,
  navigationPrefetch,
  getOfflineRouteFallback,
  CRITICAL_ROUTES,
  ROUTE_PRIORITIES
};
