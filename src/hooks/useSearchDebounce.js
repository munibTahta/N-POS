/**
 * Hook untuk debounce pencarian produk
 * Mengurangi API calls dan meningkatkan performa
 */
import { useState, useCallback, useRef, useEffect } from 'react';

export const useSearchDebounce = (onSearch, delay = 300) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const timeoutRef = useRef(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleSearch = useCallback(async (searchQuery) => {
    setQuery(searchQuery);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Empty query - clear results immediately
    if (!searchQuery || searchQuery.trim().length === 0) {
      setResults([]);
      return;
    }

    // Set timeout for debounced search
    setIsSearching(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const searchResults = await onSearch(searchQuery);
        setResults(searchResults || []);
      } catch (err) {
        console.error('Search error:', err);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, delay);
  }, [onSearch, delay]);

  return {
    query,
    results,
    isSearching,
    handleSearch,
    clearSearch: () => {
      setQuery('');
      setResults([]);
    }
  };
};

export default useSearchDebounce;
