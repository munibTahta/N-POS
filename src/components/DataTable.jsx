import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { SearchFilterBar } from './SearchFilterBar';
import { FilterPanel, FilterPanelGrid, FilterField } from './FilterPanel';
import Pagination from './Pagination';
import ResponsiveTable from './common/ResponsiveTable';
import { usePagination } from '../hooks/usePagination';
import useSearchAndFilter from '../hooks/useSearchAndFilter';
import ActionButton from './ActionButton';
import DropdownActionMenu from './common/DropdownActionMenu';
import { resolveColumnAlign } from '../utils/columnAlign';
import { togglePage, pageSelectionState, rangeIds, toggleId } from '../utils/bulk';

/**
 * Standardized Data Table component with built-in pagination, search, filters, and sorting
 */
const DataTable = ({
  // Data props
  data = [],
  columns = [],
  actions = [],

  // Pagination props
  itemsPerPage = 15,
  alwaysShowPagination = true,
  showPagination = true,

  // Search props
  searchPlaceholder = 'Cari...',
  searchKeys = [],

  // Filter props
  filters = [],
  filterGridCols = 2,

  // Sorting props
  initialSort = { key: null, direction: 'asc' },

  // Loading and error states
  loading = false,
  error = null,

  // Custom components
  customSearchBar = null,
  customFilters = null,
  customPagination = null,

  // Styling
  className = '',
  tableClassName = '',
  emptyMessage = 'Tidak ada data',

  // Callbacks
  onRowClick = null,
  onActionClick = null,
  onFilterChange = null,
  onSortChange = null,

  // Selection props
  selectable = false,
  selectedRows = [],
  onSelectedRowsChange = null,

  // Server-side props
  serverSide = false,
  totalItems = 0,
  currentPage = 1,
  onPageChange = null,
  onItemsPerPageChange = null,
  onSearchChange = null,
  onFilterValueChange = null,
}) => {
  const lastClickedRef = useRef(null); // jangkar untuk pilih rentang dengan Shift+klik
  const [searchTerm, setSearchTerm] = useState('');
  const [filterValues, setFilterValues] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [currentItemsPerPage, setCurrentItemsPerPage] = useState(itemsPerPage);
  const [sortConfig, setSortConfig] = useState(initialSort);

  // Initialize filter values
  React.useEffect(() => {
    const initialFilters = {};
    filters.forEach(filter => {
      initialFilters[filter.key] = filter.defaultValue || '';
    });
    setFilterValues((prev) => {
      const valuesAreSame = filters.length === Object.keys(prev).length && filters.every(filter => {
        const currentValue = prev[filter.key] ?? '';
        const defaultValue = filter.defaultValue || '';
        return currentValue === defaultValue;
      });
      return valuesAreSame ? prev : initialFilters;
    });
  }, [filters]);

  // Sorting logic
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    const newSort = { key, direction };
    setSortConfig(newSort);
    if (serverSide && onSortChange) {
      onSortChange(newSort);
    }
  };

  // Use search and filter hook
  const { filteredItems } = useSearchAndFilter(data, {
    searchTerm,
    searchKeys,
    filters: filterValues,
    debounceDelay: 300,
  });

  // Client-side sorting with null safety
  const sortedItems = useMemo(() => {
    if (serverSide || !sortConfig.key) return filteredItems;
    return [...filteredItems].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      // Push nulls/undefined to end regardless of direction
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      // Numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      // String comparison (case-insensitive)
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortConfig, serverSide]);

  // Use pagination hook
  const { currentData, currentPage: internalCurrentPage, totalPages: internalTotalPages, setPage } = usePagination({
    data: sortedItems,
    itemsPerPage: currentItemsPerPage,
  });

  const actualCurrentPage = serverSide ? currentPage : internalCurrentPage;
  const actualTotalPages = serverSide ? Math.ceil(totalItems / currentItemsPerPage) : internalTotalPages;
  const actualData = serverSide ? data : currentData;
  const actualTotalItems = serverSide ? totalItems : sortedItems.length;

  const handlePageChange = (newPage) => {
    if (serverSide) {
      if (onPageChange) onPageChange(newPage);
    } else {
      setPage(newPage);
    }
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setCurrentItemsPerPage(newItemsPerPage);
    if (serverSide) {
      if (onItemsPerPageChange) onItemsPerPageChange(newItemsPerPage);
      if (onPageChange) onPageChange(1);
    } else {
      setPage(1);
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilterValues = { ...filterValues, [key]: value };
    setFilterValues(newFilterValues);
    if (!serverSide) setPage(1);
    if (onFilterValueChange) onFilterValueChange(newFilterValues);
    if (onFilterChange) onFilterChange({ searchTerm, filterValues: newFilterValues });
  };

  const searchDebounceRef = useRef(null);

  useEffect(() => {
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, []);

  const handleSearchTermChange = (term) => {
    setSearchTerm(term);
    if (!serverSide) setPage(1);
    if (onSearchChange) {
      if (serverSide) {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => { onSearchChange(term); }, 400);
      } else {
        onSearchChange(term);
      }
    }
    if (onFilterChange) onFilterChange({ searchTerm: term, filterValues });
  };

  const handleClearFilters = () => {
    const clearedFilters = {};
    filters.forEach(filter => { clearedFilters[filter.key] = ''; });
    setFilterValues(clearedFilters);
    setSearchTerm('');
    if (serverSide) {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      if (onSearchChange) onSearchChange('');
      if (onFilterValueChange) onFilterValueChange(clearedFilters);
    } else {
      setPage(1);
    }
    if (onFilterChange) onFilterChange({ searchTerm: '', filterValues: clearedFilters });
  };

  const hasActiveFilters = useMemo(() => {
    return Boolean(searchTerm) || Object.values(filterValues).some(value => value !== '' && value !== null && value !== undefined);
  }, [searchTerm, filterValues]);

  const getItemId = (item) => item.id_produk || item.id_pelanggan || item.id || item.id_satuan || item.id_kategori || item.id_supplier;

  if (error && !loading) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search and Filter Section — always rendered to preserve input focus */}
      {customSearchBar || (
        <SearchFilterBar
          searchTerm={searchTerm}
          onSearchChange={handleSearchTermChange}
          onClearSearch={() => handleSearchTermChange('')}
          onFilterToggle={() => setShowFilters(!showFilters)}
          isFilterActive={showFilters}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          searchPlaceholder={searchPlaceholder}
          showFilterButton={filters.length > 0 || Boolean(customFilters)}
        />
      )}

      {showFilters && (customFilters || filters.length > 0) && (
        <FilterPanel visible={showFilters}>
          {customFilters || (
            <FilterPanelGrid cols={filterGridCols}>
              {filters.map(filter => (
                <FilterField key={filter.key} label={filter.label}>
                  {filter.render ? (
                    filter.render({ value: filterValues[filter.key], onChange: (value) => handleFilterChange(filter.key, value) })
                  ) : filter.type === 'select' ? (
                    <select
                      value={filterValues[filter.key] || ''}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">{filter.placeholder || 'Semua'}</option>
                      {(filter.options || []).map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                    </select>
                  ) : (
                    <input
                      type={filter.type || 'text'}
                      value={filterValues[filter.key] || ''}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      placeholder={filter.placeholder || ''}
                      className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </FilterField>
              ))}
            </FilterPanelGrid>
          )}
        </FilterPanel>
      )}

      {/* Table area: show skeleton overlay or actual table */}
      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-10 bg-gray-200 rounded"></div>
          {[...Array(5)].map((_, i) => (<div key={i} className="h-12 bg-gray-200 rounded"></div>))}
        </div>
      ) : (
        <ResponsiveTable className={tableClassName}>
          <table className="min-w-full divide-y divide-gray-200 table-fixed sm:table-auto">
            <thead className="bg-gray-50">
              <tr>
                {selectable && (
                  <th className="px-2 sm:px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      aria-label="Pilih semua baris di halaman ini"
                      checked={pageSelectionState(selectedRows, actualData.map(getItemId)) === 'all'}
                      ref={(el) => { if (el) el.indeterminate = pageSelectionState(selectedRows, actualData.map(getItemId)) === 'some'; }}
                      onChange={(e) => {
                        if (!onSelectedRowsChange) return;
                        onSelectedRowsChange(togglePage(selectedRows, actualData.map(getItemId), e.target.checked));
                      }}
                      className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                )}
                {columns.map((column, index) => {
                  const align = resolveColumnAlign(column); // angka/uang rata kanan, judul mengikuti isinya
                  return (
                  <th
                    key={column.key || index}
                    className={`px-2 sm:px-4 py-3 ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} text-xs font-semibold text-gray-600 uppercase tracking-wider ${column.headerClassName || ''} ${column.sortable ? 'cursor-pointer hover:bg-gray-100 active:bg-gray-200 transition-colors select-none' : ''} ${sortConfig.key === (column.sortKey || column.key) ? 'bg-blue-50 text-blue-700' : ''}`}
                    onClick={() => column.sortable && handleSort(column.sortKey || column.key)}
                    style={column.width ? { width: column.width, minWidth: column.width } : {}}
                    title={column.sortable ? (sortConfig.key === (column.sortKey || column.key) ? (sortConfig.direction === 'asc' ? 'Urut menurun ▼' : 'Urut menaik ▲') : `Urutkan: ${column.header}`) : undefined}
                  >
                    <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
                      <span className="hidden sm:inline">{column.header}</span>
                      <span className="sm:hidden">{column.header.length > 10 ? column.header.substring(0, 8) + '...' : column.header}</span>
                      {column.sortable && (
                        <span className={`text-xs ${sortConfig.key === (column.sortKey || column.key) ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                          {sortConfig.key === (column.sortKey || column.key)
                            ? (sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5 inline" /> : <ChevronDown className="w-3.5 h-3.5 inline" />)
                            : <ChevronsUpDown className="w-3.5 h-3.5 inline" />}
                        </span>
                      )}
                    </div>
                  </th>
                  );
                })}
                {actions.length > 0 && (
                  <th className="px-2 sm:px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-16 sm:w-24">
                    <span className="hidden sm:inline">Aksi</span>
                    <span className="sm:hidden">Act</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {actualData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (actions.length > 0 ? 1 : 0) + (selectable ? 1 : 0)} className="px-2 sm:px-4 py-8 text-center text-sm text-gray-500">{emptyMessage}</td>
                </tr>
              ) : (
                actualData.map((item, rowIndex) => (
                  <tr key={item.id || rowIndex} aria-selected={selectable ? selectedRows.includes(getItemId(item)) : undefined} className={`transition-colors duration-100 ${selectable && selectedRows.includes(getItemId(item)) ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-gray-50'} ${onRowClick ? 'cursor-pointer' : ''}`} onClick={() => onRowClick && onRowClick(item)}>
                    {selectable && (
                      <td className="px-2 sm:px-4 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Pilih baris ${rowIndex + 1}`}
                          checked={selectedRows.includes(getItemId(item))}
                          onChange={(e) => {
                            if (!onSelectedRowsChange) return;
                            const itemId = getItemId(item);
                            const on = e.target.checked;
                            // Shift+klik memilih/melepas rentang dari baris terakhir yang diklik (seperti Gmail/Excel)
                            if (e.nativeEvent && e.nativeEvent.shiftKey && lastClickedRef.current !== null) {
                              const ids = rangeIds(actualData.map(getItemId), lastClickedRef.current, itemId);
                              onSelectedRowsChange(on ? togglePage(selectedRows, ids, true) : togglePage(selectedRows, ids, false));
                            } else {
                              onSelectedRowsChange(toggleId(selectedRows, itemId, on));
                            }
                            lastClickedRef.current = itemId;
                          }}
                          className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((column, colIndex) => {
                      const align = resolveColumnAlign(column);
                      return (
                      <td key={column.key || colIndex} className={`px-2 sm:px-4 py-4 text-sm text-gray-900 ${align === 'right' ? 'text-right tabular-nums whitespace-nowrap' : align === 'center' ? 'text-center break-words' : 'break-words'} ${column.cellClassName || ''}`} style={column.width ? { width: column.width, minWidth: column.width } : {}}>
                        <div className="max-w-full overflow-hidden">{column.render ? column.render(item, rowIndex) : item[column.key]}</div>
                      </td>
                      );
                    })}
                    {actions.length > 0 && (
                      <td className="px-2 sm:px-4 py-4 whitespace-nowrap text-sm font-medium text-center w-16 sm:w-24">
                        <DropdownActionMenu actions={actions} item={item} onActionClick={onActionClick} />
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ResponsiveTable>
      )}

      {/* Pagination */}
      {showPagination && !loading && (customPagination || (
        <Pagination
          currentPage={actualCurrentPage}
          totalPages={actualTotalPages}
          onPageChange={handlePageChange}
          itemsPerPage={currentItemsPerPage}
          onItemsPerPageChange={handleItemsPerPageChange}
          totalItems={actualTotalItems}
          alwaysShow={alwaysShowPagination}
          showItemsPerPageSelector={true}
          itemsPerPageOptions={[10, 20, 50, 100]}
        />
      ))}
    </div>
  );
};

export default DataTable;