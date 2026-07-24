import React from 'react';

const SearchIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const XIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const FilterIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

export const SearchFilterBar = ({
  children,
  searchTerm,
  onSearchChange,
  onClearSearch,
  onFilterToggle,
  isFilterActive = false,
  hasActiveFilters = false,
  onClearFilters,
  searchPlaceholder = 'Cari...',
  className = '',
  showFilterButton = true,
}) => {
  if (children) {
    return (
      <div className={`flex flex-wrap gap-2 items-center ${className}`}>
        {children}
      </div>
    );
  }

  const hasAnyActive = Boolean(searchTerm) || hasActiveFilters;

  return (
    <div className={`flex flex-wrap gap-2 items-center ${className}`}>
      <div className="relative flex-1 min-w-[220px]">
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchTerm || ''}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="w-full pl-11 pr-10 py-2 text-sm border border-slate-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
        />
        <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />

        {searchTerm && (
          <button
            type="button"
            onClick={() => onClearSearch?.()}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 bg-white hover:bg-slate-100 rounded-full transition text-slate-500"
            title="Clear search"
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {showFilterButton && (
        <button
          type="button"
          onClick={() => onFilterToggle?.()}
          className={`flex items-center justify-center px-3 py-2 rounded-lg font-medium transition flex-shrink-0 ${
            isFilterActive
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
          }`}
          title="Toggle filter"
        >
          <FilterIcon className="w-5 h-5" />
          <span className="hidden sm:inline ml-2">Filter</span>
        </button>
      )}

      {hasAnyActive && (
        <button
          type="button"
          onClick={() => {
            onClearSearch?.();
            onClearFilters?.();
          }}
          className="flex items-center justify-center px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium flex-shrink-0"
          title="Clear search and filters"
        >
          <XIcon className="w-5 h-5" />
          <span className="hidden sm:inline ml-2">Clear</span>
        </button>
      )}
    </div>
  );
};

export const FilterPanel = ({ visible = true, children, className = '' }) => {
  if (!visible) return null;
  return (
    <div className={`border border-slate-200 rounded-lg bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
};

export const FilterPanelGrid = ({ children, cols = 2, className = '' }) => (
  <div className={`grid gap-3 ${cols === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'} ${className}`}>
    {children}
  </div>
);

export const FilterField = ({ label, children, className = '' }) => (
  <div className={className}>
    {label && <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>}
    {children}
  </div>
);

FilterField.Select = ({ value = '', onChange = () => {}, options = [], placeholder = 'Semua', disabled = false, className = '' }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    disabled={disabled}
    className={`w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${className}`}
  >
    <option value="">{placeholder}</option>
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);
