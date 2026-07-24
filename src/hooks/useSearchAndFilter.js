import { useMemo } from 'react';
import { useDebounce } from './useDebounce';

function normalizeValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.toLowerCase().trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).toLowerCase();
  return JSON.stringify(value).toLowerCase();
}

function getValueByPath(item, path) {
  if (item === null || item === undefined || typeof path !== 'string') return undefined;
  const keys = path.split('.');
  return keys.reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    return current[key];
  }, item);
}

function defaultFilterFn(item, key, value) {
  const itemValue = normalizeValue(getValueByPath(item, key));
  const filterValue = normalizeValue(value);
  return itemValue.includes(filterValue);
}

export default function useSearchAndFilter(
  items = [],
  {
    searchTerm = '',
    searchKeys = [],
    filters = {},
    filterFns = {},
    debounceDelay = 0,
  } = {}
) {
  const debouncedSearchTerm = useDebounce(searchTerm, debounceDelay > 0 ? debounceDelay : 0);

  const normalizedSearchTerm = useMemo(
    () => normalizeValue(debouncedSearchTerm),
    [debouncedSearchTerm]
  );

  const filteredItems = useMemo(() => {
    if (!Array.isArray(items)) return [];

    return items.filter((item) => {
      if (normalizedSearchTerm && searchKeys.length > 0) {
        const searchMatched = searchKeys.some((key) => {
          const value = normalizeValue(getValueByPath(item, key));
          return value.includes(normalizedSearchTerm);
        });

        if (!searchMatched) {
          return false;
        }
      }

      for (const [filterKey, filterValue] of Object.entries(filters || {})) {
        if (filterValue === null || filterValue === undefined || String(filterValue).trim() === '') {
          continue;
        }

        const filterFn = filterFns[filterKey];
        if (typeof filterFn === 'function') {
          if (!filterFn(item, filterValue)) {
            return false;
          }
        } else if (!defaultFilterFn(item, filterKey, filterValue)) {
          return false;
        }
      }

      return true;
    });
  }, [items, normalizedSearchTerm, filters, filterFns, searchKeys]);

  return {
    filteredItems,
    debouncedSearchTerm,
  };
}
