// Generic data loader hook with caching and error handling
import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../utils/logger';

/**
 * Generic hook for loading data with automatic error handling and loading states
 * @param {Function} loadFn - Async function that returns data
 * @param {any} initialValue - Initial value for data state
 * @param {Object} options - Configuration options
 * @returns {Object} { data, loading, error, refetch }
 */
export const useDataLoader = (loadFn, initialValue = [], options = {}) => {
  const {
    onError = null,
    context = 'useDataLoader',
    cacheKey = null,
    cacheDuration = 0
  } = options;

  const [data, setData] = useState(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cacheRef = useRef(null);
  const cacheTimeRef = useRef(null);

  const refetch = useCallback(async (_forceRefresh = false) => {
    // Check cache if not forcing refresh
    if (!_forceRefresh && cacheKey && cacheRef.current && cacheDuration > 0) {
      const now = Date.now();
      if (now - cacheTimeRef.current < cacheDuration) {
        setData(cacheRef.current);
        setLoading(false);
        logger.debug(context, 'Data loaded from cache', cacheKey);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const result = await loadFn();
      setData(result);
      setError(null);

      // Cache result
      if (cacheKey) {
        cacheRef.current = result;
        cacheTimeRef.current = Date.now();
      }

      logger.debug(context, 'Data loaded successfully', { count: Array.isArray(result) ? result.length : 1 });
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Gagal memuat data';
      setError(errorMsg);
      logger.error(context, 'Failed to load data', err);

      if (onError) {
        onError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [loadFn, cacheKey, cacheDuration, context, onError]);

  // Run initial load on mount. Avoid depending on `refetch` identity
  // to prevent infinite loops when callers pass unstable load functions.
  useEffect(() => {
    refetch();
    // Intentionally empty deps: callers should call `refetch()` manually
    // if they need reload when their loadFn changes.
    // This prevents repeated re-renders when loadFn is recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading, error, refetch };
};

/**
 * Hook for loading multiple data sources in parallel
 * @param {Object} dataSources - { key: loadFn, ... }
 * @param {Object} options - Configuration options
 * @returns {Object} { data: { key: data, ... }, loading, errors, refetch }
 */
export const useMultiDataLoader = (dataSources, options = {}) => {
  const { onError = null, context = 'useMultiDataLoader' } = options;

  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  const refetch = useCallback(async (_forceRefresh = false) => {
    setLoading(true);
    setErrors({});

    const results = {};
    const newErrors = {};

    // Load all in parallel
    const promises = Object.entries(dataSources).map(async ([key, loadFn]) => {
      try {
        const result = await loadFn();
        results[key] = result;
      } catch (err) {
        const errorMsg = err?.response?.data?.message || err?.message || `Gagal memuat ${key}`;
        newErrors[key] = errorMsg;
        logger.error(context, `Failed to load ${key}`, err);
        if (onError) onError(err, key);
      }
    });

    await Promise.all(promises);

    setData(results);
    setErrors(newErrors);
    setLoading(false);
  }, [dataSources, context, onError]);

  useEffect(() => {
    // Run initial multi-load on mount only to avoid loops caused by
    // unstable `dataSources` / loadFns passed inline. Call `refetch()`
    // to reload manually when needed.
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setErrors({});

      const results = {};
      const newErrors = {};

      // Load all in parallel
      const promises = Object.entries(dataSources).map(async ([key, loadFn]) => {
        try {
          const result = await loadFn();
          results[key] = result;
        } catch (err) {
          const errorMsg = err?.response?.data?.message || err?.message || `Gagal memuat ${key}`;
          newErrors[key] = errorMsg;
          logger.error(context, `Failed to load ${key}`, err);
          if (onError) onError(err, key);
        }
      });

      await Promise.all(promises);

      if (isMounted) {
        setData(results);
        setErrors(newErrors);
        setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
    // Intentionally do not depend on `dataSources` identity to prevent
    // automatic reload loops when callers pass non-memoized functions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading, errors, refetch };
};

/**
 * Hook for paginated data loading
 * @param {Function} loadFn - Async function that takes page, limit parameters
 * @param {number} initialPage - Starting page (1-indexed)
 * @param {number} pageSize - Items per page
 * @returns {Object} { data, page, pageSize, total, loading, error, goToPage, nextPage, prevPage, refetch }
 */
export const usePaginatedDataLoader = (loadFn, initialPage = 1, pageSize = 10) => {
  const [page, setPage] = useState(initialPage);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await loadFn(page, pageSize);
      setData(result.data || []);
      setTotal(result.total || 0);
      logger.debug('usePaginatedDataLoader', `Page ${page} loaded`, { count: result.data?.length || 0 });
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Gagal memuat data';
      setError(errorMsg);
      logger.error('usePaginatedDataLoader', 'Failed to load page', err);
    } finally {
      setLoading(false);
    }
  }, [loadFn, page, pageSize]);

  useEffect(() => {
    refetch();
  }, [refetch]); // Re-run when refetch function changes

  const goToPage = (newPage) => {
    if (newPage >= 1 && newPage <= Math.ceil(total / pageSize)) {
      setPage(newPage);
    }
  };

  const nextPage = () => goToPage(page + 1);
  const prevPage = () => goToPage(page - 1);

  return {
    data,
    page,
    pageSize,
    total,
    loading,
    error,
    goToPage,
    nextPage,
    prevPage,
    refetch,
    totalPages: Math.ceil(total / pageSize)
  };
};
