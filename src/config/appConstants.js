/**
 * Application Constants and Configuration
 * Centralized place for all hardcoded magic numbers
 * 
 * To use: import { SYNC_TIMEOUT, RETRY_ATTEMPTS, ... } from '../../config/appConstants';
 */

// ===== TIMEOUT CONSTANTS (milliseconds) =====
export const TIMEOUTS = {
  // API & Fetch operations
  API_TIMEOUT: 30000,                    // 30 seconds for API calls
  API_SLOW_TIMEOUT: 60000,               // 60 seconds for slow operations
  
  // Sync operations
  SYNC_TIMEOUT: 10 * 60 * 1000,          // 10 minutes for full sync
  SYNC_DEBOUNCE: 5000,                   // 5 seconds debounce for sync triggers
  
  // Circuit breaker
  CIRCUIT_BREAKER_RESET: 60000,          // 60 seconds before retry after failure
  HEALTH_CHECK: 5000,                    // 5 seconds health check interval
  
  // Module loading
  MODULE_LOAD_TIMEOUT: 15000,            // 15 seconds for offline module load
  
  // User interactions
  TOAST_DURATION: 3000,                  // 3 seconds for toast notifications
  DEBOUNCE_SEARCH: 300,                  // 300ms debounce for search input
  DEBOUNCE_FILTER: 300,                  // 300ms debounce for filter changes
  
  // Request queue
  REQUEST_QUEUE_TIMEOUT: 5000,           // 5 seconds for queued request to start processing
};

// ===== RETRY CONFIGURATION =====
export const RETRY = {
  // Push/Pull sync attempts
  SYNC_PUSH_ATTEMPTS: 3,                 // 3 retry attempts for push
  SYNC_PULL_ATTEMPTS: 3,                 // 3 retry attempts for pull
  
  // Circuit breaker thresholds
  API_CIRCUIT_BREAKER: 5,                // 5 consecutive API failures triggers circuit breaker
  DB_CIRCUIT_BREAKER: 3,                 // 3 consecutive DB failures triggers circuit breaker
};

// ===== BATCH SIZES =====
export const BATCH_SIZES = {
  // Product operations
  PRODUCT_BATCH: 500,                    // Process 500 products at a time
  PRODUCT_EXPORT_BATCH: 1000,            // Export 1000 products max
  
  // Stock operations
  STOCK_BATCH: 500,                      // Process 500 stock items at a time
  
  // Transaction processing
  TRANSACTION_BATCH: 100,                // Process 100 transactions per batch
  
  // Payment processing
  PAYMENT_BATCH: 50,                     // Process 50 payments per batch
};

// ===== PAGINATION DEFAULTS =====
export const PAGINATION = {
  PRODUCTS_PER_PAGE: 50,                 // Default products per page
  SALES_PER_PAGE: 50,                    // Default sales transactions per page
  PURCHASES_PER_PAGE: 50,                // Default purchases per page
  CUSTOMERS_PER_PAGE: 50,                // Default customers per page
  REPORTS_PER_PAGE: 100,                 // Report data per page (larger)
};

// ===== LIMITS & CONSTRAINTS =====
export const LIMITS = {
  // Data limits
  MAX_SEARCH_RESULTS: 100,               // Max results from any search
  MAX_RESULTS_EXPORT: 10000,             // Max rows for export
  MAX_BATCH_SIZE: 50000,                 // Max products to handle in single batch
  
  // Size limits
  MAX_FILE_SIZE: 100 * 1024 * 1024,      // 100MB max file size
  MAX_CONTENT_SIZE: 102400,              // 100KB max content per request
  MAX_IMAGE_SIZE: 5 * 1024 * 1024,       // 5MB max image size
  
  // Logging
  MAX_LOGS_STORED: 100,                  // Max log entries to keep in localStorage
  MAX_ERROR_LOGS: 50,                    // Max error entries
  
  // Request limits
  MAX_CONCURRENT_REQUESTS: 6,            // Max concurrent API requests
  MAX_OFFLINE_QUEUE_SIZE: 500,           // Max pending items in offline queue
};

// ===== QUERY CONSTRAINTS =====
export const SEARCH = {
  MIN_QUERY_LENGTH: 3,                   // Minimum characters for full search
  MAX_SHORT_QUERY_RESULTS: 20,           // Results for short queries (<3 chars)
  CACHE_TTL: 3000,                       // 3 seconds cache TTL
};

// ===== PRINTER CONFIGURATION =====
export const PRINTER = {
  RETRY_ATTEMPTS: 3,                     // Retry print 3 times
  RETRY_DELAY: 1000,                     // 1 second between retries
  PRINT_TIMEOUT: 30000,                  // 30 seconds max print time
  RECEIPT_WIDTH: 80,                     // Receipt width in mm
  BARCODE_TTL: 300000,                   // Barcode cache 5 minutes
};

// ===== OFFLINE & CACHE =====
export const OFFLINE = {
  CACHE_TTL: 3600000,                    // 1 hour cache for offline data
  SYNC_INTERVAL: 10000,                  // 10 seconds sync check interval
  QUEUE_CHECK_INTERVAL: 5000,            // 5 seconds queue processing check
};

// ===== ERROR THRESHOLDS =====
export const ERROR_THRESHOLDS = {
  CONSOLE_WARN_ITEMS: 100,               // Warn if processing > 100 items
  SLOW_OPERATION: 5000,                  // Operation > 5 seconds is slow
  VERY_SLOW_OPERATION: 30000,            // Operation > 30 seconds is very slow
};

// ===== NETWORK CONDITIONS =====
export const NETWORK = {
  SLOW_CONNECTION_TIMEOUT: 120000,       // 2 minutes for slow connections
  VERY_SLOW_CONNECTION_TIMEOUT: 180000,  // 3 minutes for very slow connections
};

// ===== DATABASE =====
export const DATABASE = {
  // Transaction isolation
  TRANSACTION_TIMEOUT: 30000,            // 30 seconds max transaction time
  
  // Cleanup
  OLD_LOGS_CLEANUP_DAYS: 7,              // Clean logs older than 7 days
  OLD_SYNC_RECORDS_DAYS: 30,             // Clean old sync records after 30 days
};

// Helper to get timeout with network condition
export const getTimeout = (condition = 'normal') => {
  switch (condition) {
    case 'slow':
      return NETWORK.SLOW_CONNECTION_TIMEOUT;
    case 'very-slow':
      return NETWORK.VERY_SLOW_CONNECTION_TIMEOUT;
    default:
      return TIMEOUTS.API_TIMEOUT;
  }
};

export default {
  TIMEOUTS,
  RETRY,
  BATCH_SIZES,
  PAGINATION,
  LIMITS,
  SEARCH,
  PRINTER,
  OFFLINE,
  ERROR_THRESHOLDS,
  NETWORK,
  DATABASE,
  getTimeout
};
