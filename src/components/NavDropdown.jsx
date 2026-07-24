import React, { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';

const NavDropdown = ({ label, items = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input when dropdown opens
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Filter items based on search query
  const normalizedQuery = searchQuery.toLowerCase();
  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(normalizedQuery)
  );
  const isGrouped = items.some(item => item.group && item.groupLabel);

  const groupedItems = isGrouped
    ? Object.values(filteredItems.reduce((groups, item) => {
        if (!groups[item.group]) {
          groups[item.group] = { groupLabel: item.groupLabel, items: [] };
        }
        groups[item.group].items.push(item);
        return groups;
      }, {}))
    : [];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchQuery('');
        }}
        className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-1 ${
          isOpen
            ? 'text-blue-600 bg-blue-50 border border-blue-200'
            : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
        }`}
      >
        {label}
        <span
          className={`transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          ▼
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          {/* Search Input */}
          {items.length > 5 && (
            <div className="px-3 py-2 border-b border-gray-100 relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Cari menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-8 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Menu Items with Scroll */}
          <div className="max-h-48 overflow-y-auto">
            {isGrouped ? (
              groupedItems.length > 0 ? (
                groupedItems.map(group => (
                  <div key={group.groupLabel} className="py-2">
                    <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {group.groupLabel.replace(/^[^\s]+\s/, '')}
                    </div>
                    {group.items.map((item) => (
                      <NavLink
                        key={item.id || item.path}
                        to={item.path}
                        className={({ isActive }) =>
                          `block px-4 py-2 text-sm transition-colors duration-150 ${
                            isActive
                              ? 'text-blue-600 bg-blue-50 border-l-2 border-blue-600'
                              : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                          }`
                        }
                        onClick={() => {
                          setIsOpen(false);
                          setSearchQuery('');
                        }}
                      >
                        <span className="inline-flex items-center gap-2">
                          {item.icon && <span className="inline-flex items-center justify-center">{item.icon}</span>}
                          {item.name}
                        </span>
                      </NavLink>
                    ))}
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                  {searchQuery ? 'Menu tidak ditemukan' : 'Tidak ada menu'}
                </div>
              )
            ) : (
              filteredItems && filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <NavLink
                    key={item.id || item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `block px-4 py-2 text-sm transition-colors duration-150 ${
                        isActive
                          ? 'text-blue-600 bg-blue-50 border-l-2 border-blue-600'
                          : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                      }`
                    }
                    onClick={() => {
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      {item.icon && <span className="inline-flex items-center justify-center">{item.icon}</span>}
                      {item.name}
                    </span>
                  </NavLink>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                  {searchQuery ? 'Menu tidak ditemukan' : 'Tidak ada menu'}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NavDropdown;
