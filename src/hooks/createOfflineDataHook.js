import { useCallback, useEffect, useRef, useState } from 'react';
import { useNetworkState } from './useNetworkState';

/**
 * Factory for creating unified offline data hooks
 * Eliminates code duplication across useCustomers, useStocks, etc.
 * Implements offline-first pattern: API → SQLite persistence → cache
 */
export const createOfflineDataHook = (config) => {
  const {
    tableName,
    fetchFn, // async () => fetch from API
    storeFn, // (data) => store to SQLite
    loadFn   // async () => load from SQLite
  } = config;

  return () => {
    const { isOnline } = useNetworkState();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastSync, setLastSync] = useState(null);
    const cacheRef = useRef(null);

    // Fetch from API, persist to SQLite, update cache
    const fetchAndCache = useCallback(async () => {
      try {
        setLoading(true);
        setError(null);

        const apiData = await fetchFn();

        // Persist to SQLite for offline
        if (storeFn) {
          await storeFn(apiData);
        }

        // Update cache
        cacheRef.current = apiData;
        setData(apiData);
        setLastSync(new Date().toISOString());

        return apiData;
      } catch (err) {
        setError(err);
        // Fall back to cached data
        if (cacheRef.current) {
          setData(cacheRef.current);
        }
        throw err;
      } finally {
        setLoading(false);
      }
    }, []);

    // Load from SQLite (offline)
    const loadFromCache = useCallback(async () => {
      try {
        setLoading(true);

        const cachedData = await loadFn();
        cacheRef.current = cachedData;
        setData(cachedData);

        return cachedData;
      } catch (err) {
        setError(err);
        console.warn(`Failed to load ${tableName} from cache:`, err);
      } finally {
        setLoading(false);
      }
    }, []);

    // Main effect: decide online vs offline strategy
    useEffect(() => {
      if (isOnline && fetchFn) {
        fetchAndCache().catch(err => {
          console.warn(`Failed to sync ${tableName}, using cache:`, err.message);
        });
      } else if (!isOnline && loadFn) {
        loadFromCache();
      }
    }, [isOnline, fetchAndCache, loadFromCache]);

    return {
      data,
      loading,
      error,
      lastSync,
      // Expose fetch/load functions for manual refresh
      refetch: fetchAndCache,           // Fetch from API, persist to SQLite
      refresh: fetchAndCache,           // ALIAS for consistency - also fetches from API
      loadOffline: loadFromCache,       // Load from SQLite only (offline mode)
      invalidateCache: () => {
        cacheRef.current = null;
        setData([]);
      }
    };
  };
};

export default createOfflineDataHook;
