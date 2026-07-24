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
        className={`w-full px-3 py-2 text-left text-sm border rounded flex items-center justify-between gap-2 transition
          ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white hover:border-gray-400'}
          ${value ? 'border-gray-300' : 'border-gray-300'}
          focus:outline-none focus:ring-2 focus:ring-blue-500
        `}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-500'}>
          {selectedLabel}
        </span>
        <div className="flex items-center gap-1">
          {value && !disabled && (
            <X
              className="w-4 h-4 text-gray-400 hover:text-gray-600"
              onClick={handleClear}
            />
          )}
          <ChevronDown
            className={`w-4 h-4 text-gray-500 transition ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-300 rounded shadow-lg">
          {/* Search Input */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition
                    ${value === option.value ? 'bg-blue-100 text-blue-900 font-semibold' : 'text-gray-900'}
                  `}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                Tidak ada kategori yang sesuai
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
