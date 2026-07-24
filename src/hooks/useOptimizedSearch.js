import { useState, useEffect, useMemo, useCallback } from 'react';

/**
 * Custom hook untuk search dengan debounce yang dioptimasi
 * Mengurangi API calls dan meningkatkan performance
 */
export const useDebouncedSearch = (initialQuery = '', delay = 300) => {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce effect
  useEffect(() => {
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setIsSearching(false);
    }, delay);

    return () => clearTimeout(timer);
  }, [query, delay]);

  // Memoized handlers
  const updateQuery = useCallback((newQuery) => {
    setQuery(newQuery);
  }, []);

  const clearQuery = useCallback(() => {
    setQuery('');
  }, []);

  // Memoized search state
  const searchState = useMemo(() => ({
    query,
    debouncedQuery,
    isSearching,
    hasQuery: query.length > 0,
    hasDebouncedQuery: debouncedQuery.length > 0
  }), [query, debouncedQuery, isSearching]);

  return {
    ...searchState,
    updateQuery,
    clearQuery,
    setQuery: updateQuery // alias for backward compatibility
  };
};

/**
 * Hook untuk search dengan results filtering
 */
export const useSearchWithFilter = (items = [], searchFields = [], options = {}) => {
  const {
    query: searchQuery,
    debouncedQuery,
    isSearching,
    updateQuery
  } = useDebouncedSearch('', options.debounceDelay || 300);

  // Memoized filtered results
  const filteredItems = useMemo(() => {
    if (!debouncedQuery || !searchFields.length) return items;

    const query = debouncedQuery.toLowerCase();
    return items.filter(item =>
      searchFields.some(field => {
        const value = item[field];
        if (typeof value === 'string') {
          return value.toLowerCase().includes(query);
        }
        if (typeof value === 'number') {
          return value.toString().includes(query);
        }
        return false;
      })
    );
  }, [items, searchFields, debouncedQuery]);

  // Memoized search stats
  const searchStats = useMemo(() => ({
    totalItems: items.length,
    filteredCount: filteredItems.length,
    hasResults: filteredItems.length > 0,
    isFiltered: debouncedQuery.length > 0
  }), [items.length, filteredItems.length, debouncedQuery]);

  return {
    // Search state
    searchQuery,
    debouncedQuery,
    isSearching,
    updateQuery,

    // Results
    filteredItems,
    originalItems: items,

    // Stats
    ...searchStats
  };
};

/**
 * Hook untuk autocomplete search dengan caching
 */
export const useAutocompleteSearch = (searchFn, options = {}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cache, setCache] = useState(new Map());

  const {
    query,
    debouncedQuery,
    isSearching,
    updateQuery
  } = useDebouncedSearch('', options.debounceDelay || 300);

  // Search effect
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery) {
        setSuggestions([]);
        return;
      }

      // Check cache first
      if (cache.has(debouncedQuery)) {
        setSuggestions(cache.get(debouncedQuery));
        return;
      }

      setIsLoading(true);
      try {
        const results = await searchFn(debouncedQuery);

        // Cache results
        setCache(prev => new Map(prev).set(debouncedQuery, results));
        setSuggestions(results);
      } catch (error) {
        console.error('Search error:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery, searchFn, cache]);

  const clearCache = useCallback(() => {
    setCache(new Map());
  }, []);

  const selectSuggestion = useCallback((suggestion) => {
    updateQuery(suggestion.label || suggestion);
    setSuggestions([]);
  }, [updateQuery]);

  return {
    query,
    debouncedQuery,
    isSearching: isSearching || isLoading,
    suggestions,
    updateQuery,
    selectSuggestion,
    clearCache,
    hasSuggestions: suggestions.length > 0
  };
};