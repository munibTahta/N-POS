import React from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';

/**
 * Bilah pencarian + filter (Material 3):
 *  - kolom pencarian "search bar" 48 px (bulat, latar tonal), ikon kiri, tombol hapus di dalam, Esc mengosongkan;
 *  - "Filter" = tombol outlined (tonal saat panel terbuka, titik penanda saat ada filter aktif) -> aksi sekunder;
 *  - "Reset" = tombol teks (bukan tombol merah solid): aksi tersier tidak boleh lebih menonjol dari pencarian.
 */
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
    return <div className={`flex flex-wrap items-center gap-2 ${className}`}>{children}</div>;
  }

  const hasAnyActive = Boolean(searchTerm) || hasActiveFilters;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500 dark:text-zinc-400" aria-hidden="true" />
        <input
          type="search"
          role="searchbox"
          aria-label={searchPlaceholder}
          placeholder={searchPlaceholder}
          value={searchTerm || ''}
          onChange={(e) => onSearchChange?.(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape' && searchTerm) { e.preventDefault(); onClearSearch?.(); } }}
          autoComplete="off"
          className="h-12 w-full min-w-0 appearance-none rounded-full border border-transparent bg-gray-100 pl-12 pr-12 text-sm text-gray-900 transition placeholder:text-gray-500 hover:bg-gray-200/70 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/25 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:hover:bg-zinc-700/70 dark:focus:border-blue-400 dark:focus:bg-zinc-900 dark:focus:ring-blue-400/30 [&::-webkit-search-cancel-button]:hidden"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => onClearSearch?.()}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-200 dark:text-zinc-300 dark:hover:bg-zinc-700"
            aria-label="Hapus pencarian"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {showFilterButton && (
        <button
          type="button"
          onClick={() => onFilterToggle?.()}
          aria-pressed={isFilterActive}
          className={`relative ${isFilterActive ? 'btn-tonal' : 'btn-outlined'} h-12 shrink-0 rounded-full px-4`}
          title="Tampilkan/sembunyikan filter"
        >
          <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Filter</span>
          {hasActiveFilters && <span aria-label="Ada filter aktif" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white dark:bg-blue-400 dark:ring-zinc-900" />}
        </button>
      )}

      {hasAnyActive && (
        <button
          type="button"
          onClick={() => { onClearSearch?.(); onClearFilters?.(); }}
          className="btn-text h-12 shrink-0 rounded-full px-3"
          title="Hapus pencarian dan semua filter"
        >
          <X className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      )}
    </div>
  );
};

/** Panel filter: blok tonal datar (bukan kartu bersarang). */
export const FilterPanel = ({ visible = true, children, className = '' }) => {
  if (!visible) return null;
  return <div className={`rounded-2xl bg-gray-50 p-4 dark:bg-zinc-800/50 ${className}`}>{children}</div>;
};

export const FilterPanelGrid = ({ children, cols = 2, className = '' }) => (
  <div className={`grid gap-3 ${cols === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'} ${className}`}>
    {children}
  </div>
);

export const FilterField = ({ label, children, className = '' }) => (
  <div className={className}>
    {label && <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-zinc-300">{label}</label>}
    {children}
  </div>
);

FilterField.Select = ({ value = '', onChange = () => {}, options = [], placeholder = 'Semua', disabled = false, className = '' }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`field-select ${className}`}>
    <option value="">{placeholder}</option>
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
);

export default SearchFilterBar;
