import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, X } from 'lucide-react';

/**
 * SearchableSelect Component
 * Dropdown dengan kemampuan pencarian/filter
 *
 * Props:
 * - options: Array of { label, value } objects
 * - value: Selected value
 * - onChange: Callback when value changes
 * - placeholder: Placeholder text
 * - name: Field name
 * - disabled: Disable the select
 * - searchPlaceholder: Search input placeholder
 */
const SearchableSelect = React.memo(({
  options = [],
  value = '',
  onChange,
  placeholder = 'Pilih...',
  name = '',
  disabled = false,
  searchPlaceholder = 'Cari...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Memoize filtered options to prevent unnecessary recalculations
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  // Memoize selected label
  const selectedLabel = useMemo(() =>
    options.find(opt => opt.value === value)?.label || placeholder,
    [options, value, placeholder]
  );

  // Handle click outside - memoized
  const handleClickOutside = useCallback((event) => {
    if (containerRef.current && !containerRef.current.contains(event.target)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Memoized handlers
  const handleSelect = useCallback((selectedValue) => {
    onChange({ target: { name, value: selectedValue } });
    setIsOpen(false);
    setSearchTerm('');
  }, [onChange, name]);

  const handleClear = useCallback((e) => {
    e.stopPropagation();
    onChange({ target: { name, value: '' } });
    setSearchTerm('');
  }, [onChange, name]);

  const toggleDropdown = useCallback(() => {
    setIsOpen(!isOpen);
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={toggleDropdown}
        disabled={disabled}
        className={`w-full px-4 py-2.5 text-left text-sm border rounded-xl flex items-center justify-between gap-2 transition-all duration-200
          ${disabled 
            ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed border-slate-250 dark:border-zinc-700' 
            : 'bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-500 text-slate-800 dark:text-zinc-100'
          }
          focus:outline-none focus:ring-2 focus:ring-blue-500
        `}
      >
        <span className={value ? 'text-slate-800 dark:text-zinc-100 font-medium' : 'text-slate-400 dark:text-zinc-500'}>
          {selectedLabel}
        </span>
        <div className="flex items-center gap-1">
          {value && !disabled && (
            <X
              className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-350"
              onClick={handleClear}
            />
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 dark:text-zinc-500 transition ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
          {/* Search Input */}
          <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 p-2">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition hover:bg-slate-50 dark:hover:bg-zinc-800/80
                    ${value === option.value 
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold' 
                      : 'text-slate-700 dark:text-zinc-300'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-slate-400 dark:text-zinc-500 text-center">
                Tidak ada data yang sesuai
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

SearchableSelect.displayName = 'SearchableSelect';

export default SearchableSelect;
