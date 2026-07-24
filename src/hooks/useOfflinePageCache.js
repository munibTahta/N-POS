/**
 * useOfflinePageCache Hook
 * 
 * Smart hook untuk load page data dengan caching:
 * - Auto-cache hasil fetch
 * - Fallback ke cache saat offline/error
 * - Invalidate cache saat perlu refresh
 * - Progress tracking untuk large data
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import cacheManager from '../utils/OfflinePageDataCache';

export const useOfflinePageCache = (
  pageName,
  fetchFn,
  dbFallbackFn = null,
  cacheConfig = {}
) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState('loading'); // 'cache', 'api', 'db', 'cache-stale', 'loading'
  const [isFresh, setIsFresh] = useState(false);
  
  const abortControllerRef = useRef(null);
  const unsubscribeRef = useRef(null);

  // Register page cache config once
  useEffect(() => {
    cacheManager.registerPage(pageName, cacheConfig);
  }, [pageName, cacheConfig]);

  // Load data dengan smart caching
  const loadData = useCallback(async () => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const result = await cacheManager.getPageData(
        pageName,
        fetchFn,
        dbFallbackFn
      );

      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      setData(result.data);
      setSource(result.source);
      setIsFresh(result.isFresh);

      // Show visual feedback untuk cache source
      if (result.source === 'cache') {
      } else if (result.source === 'api') {
      } else if (result.source === 'db') {
      } else if (result.source === 'cache-stale') {
      }
    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      setError(err.message || 'Failed to load data');
      setData(null);
      setSource('error');
      console.error(`❌ ${pageName} load error:`, err);
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [pageName, fetchFn, dbFallbackFn]);

  // Initial load
  useEffect(() => {
    loadData();

    // Subscribe to cache invalidation
    unsubscribeRef.current = cacheManager.onCacheInvalidate((invalidatedPage) => {
      if (invalidatedPage === pageName) {
        loadData();
      }
    });

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [pageName, loadData]);

  // Manual refresh
  const refresh = useCallback(async () => {
    cacheManager.invalidateCache(pageName);
    await loadData();
  }, [pageName, loadData]);

  // Get cache info
  const getCacheInfo = useCallback(() => {
    const age = cacheManager.getCacheAge(pageName);
    const isStale = cacheManager.isStale(pageName);
    const cached = cacheManager.getCached(pageName);

    return {
      isCached: cached !== null,
      age,
      isStale,
      hasData: data !== null,
      source
    };
  }, [pageName, data, source]);

  return {
    data,
    loading,
    error,
    source,
    isFresh,
    refresh,
    cacheInfo: getCacheInfo(),
    isOffline: source === 'db' || source === 'cache' || source === 'cache-stale'
  };
};

export default useOfflinePageCache;
