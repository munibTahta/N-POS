import React, { useState, useEffect, useCallback } from 'react';
import useProductOfflineDB from '../hooks/useProductOfflineDB';
import { useNetworkState } from '../hooks/useNetworkState';

/**
 * Offline Product Search Component
 * - Search ribuan produk offline (SQLite-based)
 * - Auto-sync saat online
 * - Show sync progress
 * - Fast indexed queries (5-50ms)
 * - Limited results (max 100 items) untuk performa
 */
export const OfflineProductSearch = ({ onSelect = () => {}, _autoSync = true }) => {
  const { isSyncing, syncProgress, totalProducts, syncError, searchOfflineProducts } = useProductOfflineDB();
  const { isOnline } = useNetworkState();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cachedCount, setCachedCount] = useState(0);
  const [searchMessage, setSearchMessage] = useState('');

  /**
   * Load berapa produk sudah di-cache
   */
  useEffect(() => {
    setCachedCount(totalProducts);
  }, [totalProducts]);

  /**
   * Search dengan debounce dan validasi query
   */
  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);
    setSearchMessage('');
    
    if (!query.trim()) {
      setResults([]);
      setSearchMessage('');
      return;
    }

    // Validasi panjang query
    const trimmedQuery = query.trim();
    if (!isOnline && trimmedQuery.length < 3) {
      setResults([]);
      setSearchMessage(`⏸️ Type at least 3 characters for offline search (${trimmedQuery.length}/3)`);
      return;
    }

    setLoading(true);
    setSearchMessage('');
    
    try {
      // Text search - use normal limit (max 100 items)
      const searchResults = await searchOfflineProducts(query, false);
      setResults(searchResults);
      
      // Beri feedback jika hasil banyak (sudah di-limit)
      if (searchResults && searchResults.length >= 100) {
        setSearchMessage(`⚠️ Showing 100 results (limited). Refine search for better results.`);
      } else if (searchResults && searchResults.length > 50) {
        setSearchMessage(`📋 Showing ${searchResults.length} results`);
      }
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
      setSearchMessage('❌ Search failed. Try again.');
    } finally {
      setLoading(false);
    }
  }, [searchOfflineProducts, isOnline]);

  /**
   * Debounce search
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  return (
    <div className="space-y-3">
      {/* Sync Status */}
      {isSyncing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">
              ⏳ Syncing products...
            </span>
            <span className="text-xs text-blue-700">
              {syncProgress} / {totalProducts || '?'}
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: totalProducts > 0 ? `${Math.min(100, (syncProgress / totalProducts) * 100)}%` : '0%'
              }}
            />
          </div>
        </div>
      )}

      {/* Cached Status */}
      {cachedCount > 0 && !isSyncing && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2">
            <p className="text-xs text-green-700 flex items-center gap-2">
              <span>✅ {cachedCount.toLocaleString()} products ready offline</span>
              {isOnline ? (
                <span className="ml-1 inline-block" title="Online" aria-label="Online">
                  <span className="w-2 h-2 inline-block rounded-full bg-green-600 align-middle" />
                </span>
              ) : (
                <span className="ml-1 inline-block" title="Offline mode" aria-label="Offline">
                  <span className="w-2 h-2 inline-block rounded-full bg-yellow-500 align-middle" />
                </span>
              )}
            </p>
        </div>
      )}

      {/* Sync Error */}
      {syncError && !isSyncing && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
          <p className="text-xs text-yellow-700">
            ⚠️ {syncError}
          </p>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search products (code, name, SKU) - min 3 chars..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={isSyncing}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
        {loading && (
          <div className="absolute right-3 top-2.5">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Search Message (info/warning) */}
      {searchMessage && (
        <div className={`rounded-lg p-2 text-xs ${
          searchMessage.includes('❌') 
            ? 'bg-red-50 text-red-700 border border-red-200'
            : searchMessage.includes('⚠️')
            ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
            : 'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {searchMessage}
        </div>
      )}

      {/* No Cache Warning */}
      {cachedCount === 0 && !isSyncing && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-700 font-medium">🚫 No offline products cached</p>
          {isOnline ? (
            <p className="text-xs text-red-600 mt-1">Sync will start automatically when you go online</p>
          ) : (
            <p className="text-xs text-red-600 mt-1">Connect to internet to download products for offline use</p>
          )}
        </div>
      )}

      {/* Results */}
      {searchQuery.trim() && (
        <div className="border border-gray-200 rounded-lg max-h-80 overflow-y-auto">
          {results.length === 0 && !loading ? (
            <div className="p-4 text-center text-sm text-gray-500">
              {searchQuery.length < 3 && !isOnline ? (
                <div>
                  <p>Type at least 3 characters</p>
                  <p className="text-xs mt-1">Current: {searchQuery.length}/3</p>
                </div>
              ) : (
                `No products found for "${searchQuery}"`
              )}
            </div>
          ) : (
            <div className="divide-y">
              {results.map((product, idx) => (
                <button
                  key={`${product.id}-${idx}`}
                  onClick={() => onSelect(product)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">
                        {product.nm_produk || product.nama_produk}
                      </p>
                      <p className="text-xs text-gray-500">
                        Code: {product.kd_produk || product.kode_produk} 
                        {product.sku && `• SKU: ${product.sku}`}
                      </p>
                      {(product.deskripsi || product.description) && (
                        <p className="text-xs text-gray-400 mt-1">
                          {(product.deskripsi || product.description).substring(0, 50)}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-2">
                      <p className="font-semibold text-sm text-green-600">
                        {product.harga_jual || product.harga_eceran 
                          ? `Rp ${parseInt(product.harga_jual || product.harga_eceran).toLocaleString('id-ID')}` 
                          : 'N/A'}
                      </p>
                      {product.stok !== undefined && (
                        <p className="text-xs text-gray-500">
                          Stock: {Math.floor(product.stok).toLocaleString('id-ID')}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Info */}
      {!searchQuery.trim() && cachedCount > 0 && (
        <p className="text-xs text-gray-500 text-center">
          Type to search {cachedCount.toLocaleString()} products (min 3 chars)
        </p>
      )}
    </div>
  );
};

export default OfflineProductSearch;
