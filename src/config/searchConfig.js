/**
 * Search Configuration
 * Define search limits and behavior untuk offline search
 * 
 * Didesain untuk handle jutaan produk tanpa performa issue
 */

/**
 * Maximum results returned from any search
 * Hard limit untuk prevent memory issues & UI performance
 */
export const MAX_SEARCH_RESULTS = 100;

/**
 * Minimum query length untuk offline search
 * Query < 3 chars bisa return jutaan hasil
 */
export const MIN_QUERY_LENGTH = 3;

/**
 * Maximum results untuk short queries (< 3 chars)
 * Untuk limit yang lebih strict pada query pendek
 */
export const MAX_SHORT_QUERY_RESULTS = 20;

/**
 * Cache TTL dalam milliseconds
 */
export const SEARCH_CACHE_TTL = 3000; // 3 seconds

/**
 * Result limits untuk berbagai context
 */
export const SEARCH_LIMITS = {
  // Offline search (SQLite)
  OFFLINE: {
    MAX: 100,
    MIN_QUERY_LENGTH: 3,
    SHORT_QUERY_MAX: 20
  },
  
  // Online search (API)
  ONLINE: {
    MAX: 100,
    MIN_QUERY_LENGTH: 1
  },
  
  // Memory cache search
  MEMORY: {
    MAX: 100,
    MIN_QUERY_LENGTH: 1
  },
  
  // Barcode search (special case)
  BARCODE: {
    MAX: 10,
    MIN_QUERY_LENGTH: 1
  }
};

/**
 * Get effective search limit based on context
 * @param {string} context - 'offline' | 'online' | 'memory' | 'barcode'
 * @param {string} query - search query
 * @returns {number} max results allowed
 */
export function getSearchLimit(context = 'offline', query = '') {
  const cfg = SEARCH_LIMITS[context.toUpperCase()] || SEARCH_LIMITS.OFFLINE;
  
  if (query && query.length < cfg.MIN_QUERY_LENGTH && cfg.SHORT_QUERY_MAX) {
    return cfg.SHORT_QUERY_MAX;
  }
  
  return cfg.MAX;
}

/**
 * Validate if query meets minimum requirements
 * @param {string} query - search query
 * @param {boolean} isOnline - is user online
 * @returns {Object} { valid, message }
 */
export function validateSearchQuery(query, isOnline = true) {
  if (!query || query.trim().length === 0) {
    return { valid: false, message: 'Search query cannot be empty' };
  }
  
  const trimmed = query.trim();
  const cfg = SEARCH_LIMITS[isOnline ? 'ONLINE' : 'OFFLINE'];
  
  if (trimmed.length < cfg.MIN_QUERY_LENGTH) {
    return {
      valid: false,
      message: `Query too short (${trimmed.length}/${cfg.MIN_QUERY_LENGTH} chars) for ${isOnline ? 'online' : 'offline'} search`
    };
  }
  
  return { valid: true, message: '' };
}

export default {
  MAX_SEARCH_RESULTS,
  MIN_QUERY_LENGTH,
  MAX_SHORT_QUERY_RESULTS,
  SEARCH_CACHE_TTL,
  SEARCH_LIMITS,
  getSearchLimit,
  validateSearchQuery
};
