/**
 * Fast search strategy untuk jutanya produk
 * Cache aggressive + request dedup
 */

import { searchProducts as apiSearch } from '../services/api';
import { 
  MAX_SEARCH_RESULTS, 
  MIN_QUERY_LENGTH, 
  SEARCH_CACHE_TTL,
  validateSearchQuery,
  getSearchLimit
} from '../config/searchConfig';

// In-memory cache untuk search results
const queryCache = new Map();
const pendingRequests = new Map();

class SearchStrategy {
  constructor() {
    this.stats = {
      apiHits: 0,
      cacheHits: 0,
      dbHits: 0,
      memoryHits: 0,
      totalTime: 0
    };
  }

  /**
   * Main search - langsung ke source data dengan aggressive cache
   */
  async search(query, { isOnline, isBarcode = false, electronSearch, memoryProducts = [] }) {
    const startTime = performance.now();

    if (!query || query.trim().length === 0) {
      return [];
    }

    const cleanQuery = query.trim().toLowerCase();
    
    // Validate query
    const validation = validateSearchQuery(cleanQuery, isOnline);
    if (!validation.valid) {
      return [];
    }

    const cacheKey = `${cleanQuery}:${isBarcode}`;
    const searchLimit = getSearchLimit(isBarcode ? 'barcode' : (isOnline ? 'online' : 'offline'), cleanQuery);

    // 1️⃣ CHECK MEMORY CACHE FIRST (instant, no await)
    if (queryCache.has(cacheKey)) {
      const cached = queryCache.get(cacheKey);
      if (Date.now() - cached.time < SEARCH_CACHE_TTL) {
        this.stats.cacheHits++;
        return cached.results;
      } else {
        queryCache.delete(cacheKey);
      }
    }

    // 2️⃣ CHECK PENDING REQUEST (deduplicate)
    if (pendingRequests.has(cacheKey)) {
      try {
        return await pendingRequests.get(cacheKey);
      } catch (err) {
        console.warn(`Pending request failed: ${err.message}`);
      }
    }

    // 3️⃣ CREATE NEW REQUEST & STORE PENDING
    const searchPromise = this._executeSearch(cleanQuery, { isOnline, isBarcode, electronSearch, memoryProducts, startTime, searchLimit });
    pendingRequests.set(cacheKey, searchPromise);

    try {
      const results = await searchPromise;
      
      // Cache the results
      queryCache.set(cacheKey, {
        results,
        time: Date.now()
      });
      
      return results;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Execute actual search
   */
  async _executeSearch(cleanQuery, { isOnline, isBarcode, electronSearch, memoryProducts, _startTime, searchLimit = MAX_SEARCH_RESULTS }) {
    // 1️⃣ ONLINE - langsung ke API
    if (isOnline) {
      try {
        const apiResults = await apiSearch(cleanQuery, searchLimit);
        const arr = Array.isArray(apiResults) ? apiResults : apiResults?.data || [];
        
        if (arr && arr.length > 0) {
          this.stats.apiHits++;
          const limited = arr.slice(0, searchLimit);
          return limited.map(p => this._normalizeProduct(p));
        }
      } catch (err) {
        console.warn(`API search failed: ${err.message}`);
      }
    }

    // 2️⃣ OFFLINE - langsung ke SQLite DB (prioritas sebelum memory cache)
    if (electronSearch) {
      try {
        const dbResults = await electronSearch({
          query: cleanQuery,
          isBarcode,
          limit: searchLimit
        });

        if (dbResults && Array.isArray(dbResults) && dbResults.length > 0) {
          this.stats.dbHits++;
          return dbResults.map(p => this._normalizeProduct(p));
        }
      } catch (err) {
        console.warn(`DB search failed: ${err.message}`);
      }
    }

    // 3️⃣ MEMORY - fallback filter
    if (memoryProducts && Array.isArray(memoryProducts) && memoryProducts.length > 0) {
      const allResults = this._searchMemory(cleanQuery, memoryProducts, isBarcode);
      
      if (allResults.length > 0) {
        this.stats.memoryHits++;
        return allResults.slice(0, searchLimit);
      }
    }

    return [];
  }

  /**
   * Search memory array (fallback method)
   * Handles multiple field variations from different APIs
   */
  _searchMemory(query, products, isBarcode) {
    const lowerQuery = query.toLowerCase().trim();
    const matched = [];
    
    if (!products || products.length === 0) {
      console.warn(`⚠️ Products array empty`);
      return matched;
    }
    for (let i = 0; i < products.length && matched.length < 50; i++) {
      const p = products[i];
      if (!p) continue;
      
      try {
        if (isBarcode) {
          const barcode = String(p.barcode || p.kode_produk || '').toLowerCase().trim();
          if (barcode === lowerQuery) {
            matched.push(p);
          }
        } else {
          const name = String(p.nama_produk || p.name || '').toLowerCase().trim();
          const sku = String(p.kode_produk || p.sku || '').toLowerCase().trim();
          const barcode = String(p.barcode || '').toLowerCase().trim();
          const desc = String(p.deskripsi || p.description || '').toLowerCase().trim();
          
          // Simple substring match - match jika ada di field manapun
          const hasMatch = name.includes(lowerQuery) ||
                          sku.includes(lowerQuery) ||
                          barcode.includes(lowerQuery) ||
                          desc.includes(lowerQuery);
          
          if (hasMatch) {
            matched.push(p);
          }
        }
      } catch (_err) {
        continue;
      }
    }
    
    return matched;
  }

  /**
   * Normalize product object from different API responses
   * Creates consistent field names
   */
  _normalizeProduct(product) {
    return {
      // Standard fields with fallbacks
      id: product.id || product.id_produk || product.product_id,
      id_produk: product.id_produk || product.id || product.product_id,
      name: product.name || product.nama_produk || product.product_name || '',
      nama_produk: product.nama_produk || product.name || product.product_name || '',
      sku: product.sku || product.kode_produk || product.code || '',
      kode_produk: product.kode_produk || product.sku || product.code || '',
      barcode: product.barcode || product.kode_barcode || '',
      kode_barcode: product.kode_barcode || product.barcode || '',
      
      // Price fields - try all possible names
      price: parseFloat(product.price || product.harga || product.harga_jual || 0),
      harga: parseFloat(product.harga || product.price || product.harga_jual || 0),
      harga_jual: parseFloat(product.harga_jual || product.harga_eceran || product.harga || product.price || 0),
      harga_eceran: parseFloat(product.harga_eceran || product.harga_jual || 0),
      harga_grosir: parseFloat(product.harga_grosir || product.wholesale_price || 0),
      harga_beli: parseFloat(product.harga_beli || product.cost || 0),
      min_qty_grosir: parseInt(product.min_qty_grosir || product.min_qty || 0),
      
      // Stock fields
      stock: parseInt(product.stock || product.stok || 0),
      stok: parseInt(product.stok || product.stock || 0),
      
      // Other fields that might be needed
      status: product.status,
      id_kategori: product.id_kategori,
      id_satuan: product.id_satuan,
      id_supplier: product.id_supplier,
      deskripsi: product.deskripsi,
      created_at: product.created_at,
      updated_at: product.updated_at,
      
      // Keep original for reference
      _original: product
    };
  }

  /**
   * Get search stats
   */
  getStats() {
    return {
      ...this.stats,
      totalRequests: this.requestCount,
      avgTime: this.stats.totalTime / this.requestCount
    };
  }

  /**
   * Clear stats
   */
  clearStats() {
    this.stats = {
      apiHits: 0,
      cacheHits: 0,
      fallbackHits: 0,
      totalTime: 0
    };
    this.requestCount = 0;
  }
}

export const searchStrategy = new SearchStrategy();
export default searchStrategy;
