import React, { useState, useMemo } from 'react';
import { SearchFilterBar } from './SearchFilterBar';
import { FilterPanel, FilterPanelGrid, FilterField } from './FilterPanel';
import Pagination from './Pagination';
import ResponsiveTable from './common/ResponsiveTable';
import { usePagination } from '../hooks/usePagination';
import useSearchAndFilter from '../hooks/useSearchAndFilter';
import ActionButton from './ActionButton';
import DropdownActionMenu from './common/DropdownActionMenu';

/**
 * Standardized Data Table component with built-in pagination, search, and filters
 */
const DataTable = ({
  // Data props
  data = [],
  columns = [],
  actions = [],

  // Pagination props
  itemsPerPage = 15,
  alwaysShowPagination = true,
  showPagination = true, // New prop to control pagination rendering

  // Search props
  searchPlaceholder = 'Cari...',
  searchKeys = [],

  // Filter props
  filters = [],
  filterGridCols = 2,

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
  onFilterChange = null, // Callback untuk parent component ketika filter berubah

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
  onFilterValueChange = null
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterValues, setFilterValues] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [currentItemsPerPage, setCurrentItemsPerPage] = useState(itemsPerPage);

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

      if (valuesAreSame) {
        return prev;
      }

      return initialFilters;
    });
  }, [filters]);

  // Use search and filter hook
  const { filteredItems } = useSearchAndFilter(data, {
    searchTerm,
    searchKeys,
    filters: filterValues,
    debounceDelay: 300,
  });

  // Use pagination hook
  const { currentData, currentPage: internalCurrentPage, totalPages: internalTotalPages, setPage } = usePagination({
    data: filteredItems,
    itemsPerPage: currentItemsPerPage,
  });

  const actualCurrentPage = serverSide ? currentPage : internalCurrentPage;
  const actualTotalPages = serverSide ? Math.ceil(totalItems / currentItemsPerPage) : internalTotalPages;
  const actualData = serverSide ? data : currentData;
  const actualTotalItems = serverSide ? totalItems : filteredItems.length;

  const handlePageChange = (newPage) => {
    if (serverSide) {
      if (onPageChange) onPageChange(newPage);
    } else {
      setPage(newPage);
    }
  };

  // Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage) => {
    setCurrentItemsPerPage(newItemsPerPage);
    if (serverSide) {
      if (onItemsPerPageChange) onItemsPerPageChange(newItemsPerPage);
      if (onPageChange) onPageChange(1);
    } else {
      setPage(1); // Reset to first page when changing items per page
    }
  };

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    const newFilterValues = { ...filterValues, [key]: value };
    setFilterValues(newFilterValues);
    if (!serverSide) {
      setPage(1); // Reset to first page when filtering
    }
    if (onFilterValueChange) {
      onFilterValueChange(newFilterValues);
    }
    if (onFilterChange) {
      onFilterChange({ searchTerm, filterValues: newFilterValues });
    }
  };

  // Handle search term changes
  const handleSearchTermChange = (term) => {
    setSearchTerm(term);
    if (!serverSide) {
      setPage(1);
    }
    if (onSearchChange) {
      onSearchChange(term);
    }
    if (onFilterChange) {
      onFilterChange({ searchTerm: term, filterValues });
    }
  };

  // Handle clear filters
  const handleClearFilters = () => {
    const clearedFilters = {};
    filters.forEach(filter => {
      clearedFilters[filter.key] = '';
    });
    setFilterValues(clearedFilters);
    setSearchTerm('');
    if (serverSide) {
      if (onSearchChange) onSearchChange('');
      if (onFilterValueChange) onFilterValueChange(clearedFilters);
    } else {
      setPage(1);
    }
    if (onFilterChange) {
      onFilterChange({ searchTerm: '', filterValues: clearedFilters });
    }
  };

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return Boolean(searchTerm) || Object.values(filterValues).some(value =>
      value !== '' && value !== null && value !== undefined
    );
  }, [searchTerm, filterValues]);

  // Render loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const getItemId = (item) => {
    return item.id_produk || item.id_pelanggan || item.id || item.id_satuan || item.id_kategori || item.id_supplier;
  };

  // Render error state
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search and Filter Section */}
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

      {/* Filter Panel */}
      {showFilters && (customFilters || filters.length > 0) && (
        <FilterPanel visible={showFilters}>
          {customFilters || (
            <FilterPanelGrid cols={filterGridCols}>
              {filters.map(filter => (
                <FilterField key={filter.key} label={filter.label}>
                  {filter.render ? (
                    filter.render({
                      value: filterValues[filter.key],
                      onChange: (value) => handleFilterChange(filter.key, value)
                    })
                  ) : filter.type === 'select' ? (
                    <select
                      value={filterValues[filter.key] || ''}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">{filter.placeholder || 'Semua'}</option>
                      {(filter.options || []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
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

      {/* Table */}
      <ResponsiveTable className={tableClassName}>
        <table className="min-w-full divide-y divide-gray-200 table-fixed sm:table-auto">
          <thead className="bg-gray-50">
            <tr>
              {selectable && (
                <th className="px-2 sm:px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={actualData.length > 0 && actualData.every(item => selectedRows.includes(getItemId(item)))}
                    onChange={(e) => {
                      if (!onSelectedRowsChange) return;
                      const pageIds = actualData.map(item => getItemId(item));
                      if (e.target.checked) {
                        onSelectedRowsChange([...new Set([...selectedRows, ...pageIds])]);
                      } else {
                        onSelectedRowsChange(selectedRows.filter(id => !pageIds.includes(id)));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
              )}
              {columns.map((column, index) => (
                <th
                  key={column.key || index}
                  className={`px-2 sm:px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider ${column.headerClassName || ''}`}
                  style={column.width ? { width: column.width, minWidth: column.width } : {}}
                >
                  <span className="hidden sm:inline">{column.header}</span>
                  <span className="sm:hidden">{column.header.length > 10 ? column.header.substring(0, 8) + '...' : column.header}</span>
                </th>
              ))}
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
                <td
                  colSpan={columns.length + (actions.length > 0 ? 1 : 0) + (selectable ? 1 : 0)}
                  className="px-2 sm:px-4 py-8 text-center text-sm text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              actualData.map((item, rowIndex) => (
                <tr
                  key={item.id || rowIndex}
                  className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick && onRowClick(item)}
                >
                  {selectable && (
                    <td className="px-2 sm:px-4 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(getItemId(item))}
                        onChange={(e) => {
                          if (!onSelectedRowsChange) return;
                          const itemId = getItemId(item);
                          if (e.target.checked) {
                            onSelectedRowsChange([...selectedRows, itemId]);
                          } else {
                            onSelectedRowsChange(selectedRows.filter(id => id !== itemId));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map((column, colIndex) => (
                    <td
                      key={column.key || colIndex}
                      className={`px-2 sm:px-4 py-4 text-sm text-gray-900 break-words ${column.cellClassName || ''}`}
                      style={column.width ? { width: column.width, minWidth: column.width } : {}}
                    >
                      <div className="max-w-full overflow-hidden">
                        {column.render ? column.render(item, rowIndex) : item[column.key]}
                      </div>
                    </td>
                  ))}
                  {actions.length > 0 && (
                    <td className="px-2 sm:px-4 py-4 whitespace-nowrap text-sm font-medium text-center w-16 sm:w-24">
                      <DropdownActionMenu
                        actions={actions}
                        item={item}
                        onActionClick={onActionClick}
                      />
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ResponsiveTable>

      {/* Pagination */}
      {showPagination && (customPagination || (
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