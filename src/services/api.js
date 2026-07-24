// src/services/api.js
import axios from 'axios';
import OfflineQueue from '../utils/OfflineQueue';
import CacheManager from '../utils/CacheManager';
import safeStorage from '../utils/safeStorage';
import { TIMEOUTS } from '../config/appConstants.js';

import { setupRetryInterceptor } from '../utils/RetryManager';

// Ambil base URL dan API Key dari environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

// Buat instance axios dengan konfigurasi default
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUTS.API_TIMEOUT,  // 30 seconds default timeout for all requests
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY // Diperlukan untuk autentikasi API
  }
});

// Simple concurrency limiter to avoid exhausting browser/network resources
const maxConcurrentRequests = 6;
let activeRequests = 0;
const pendingQueue = [];

function runLimited(fn) {
  return new Promise((resolve, reject) => {
    pendingQueue.push({ fn, resolve, reject });
    nextLimited();
  });
}

function nextLimited() {
  if (activeRequests >= maxConcurrentRequests) return;
  const job = pendingQueue.shift();
  if (!job) return;
  activeRequests++;
  job.fn()
    .then((res) => {
      activeRequests--;
      job.resolve(res);
      nextLimited();
    })
    .catch((err) => {
      activeRequests--;
      job.reject(err);
      nextLimited();
    })
    .finally(() => {
      // Ensure activeRequests is always decremented in case of unexpected errors
      // This guards against hanging the request queue
      if (activeRequests > 0 && pendingQueue.length === 0) {
        // This should not happen, but if it does, ensure we can continue
      }
    });
}

function limitedGet(url, config = {}) {
  return runLimited(() => apiClient.get(url, config));
}

/**
 * Helper function to race a promise against a timeout
 * Rejects with TimeoutError if promise doesn't complete within timeout
 * @param {Promise} promise - The promise to race
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} timeoutMessage - Custom timeout error message
 * @returns {Promise}
 */
export function withTimeout(promise, timeoutMs, timeoutMessage = 'Request timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ]);
}

/**
 * Helper to make API calls with custom timeout (override default 30s)
 * @param {Function} apiCall - The API call function
 * @param {number} timeoutMs - Custom timeout in milliseconds
 * @returns {Promise}
 */
export function withCustomTimeout(apiCall, timeoutMs = TIMEOUTS.API_SLOW_TIMEOUT) {
  return withTimeout(apiCall(), timeoutMs, `API request timeout after ${timeoutMs}ms`);
}

// Interceptor untuk menambahkan token otentikasi ke setiap request
apiClient.interceptors.request.use(
  (config) => {
    let token = null;
    try {
      token = safeStorage.getItem('authToken');
    } catch (error) {
      console.warn('Failed to retrieve authToken:', error.message);
    }
    
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Note: X-Session-Id header removed to avoid CORS preflight errors
    // Bearer token is sufficient for server to identify the session
    // according to API documentation v1.5.7 CORS optimization
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor untuk caching dan offline support
apiClient.interceptors.response.use(
  (response) => {
    // Cache GET responses
    if (response.config.method === 'get' && response.status === 200) {
      const url = response.config.url;
      const ttl = CacheManager.getTTL(url);
      CacheManager.set(url, response.data, ttl);
    }

    return response;
  },
  async (error) => {
    const { config, response } = error;

    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      const message = `Request timeout (${TIMEOUTS.API_TIMEOUT}ms): ${config?.url || 'Unknown endpoint'}`;
      console.error(message);
      // Create a new error with more context
      const timeoutError = new Error(message);
      timeoutError.isTimeout = true;
      timeoutError.originalError = error;
      return Promise.reject(timeoutError);
    }

    // central logout dispatch for 401 errors
    if (response?.status === 401) {
      // dispatch an event so consumers can logout from anywhere
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('logout'));
      }
    }

    // Handle offline mode
    if (!navigator.onLine) {
      // GET requests: return cached data if available
      if (config.method === 'get') {
        const cachedData = CacheManager.get(config.url);
        if (cachedData) {
          // Apply client-side filtering for search queries
          let filteredData = cachedData;
          if (config.params && config.params.search && cachedData.data && Array.isArray(cachedData.data)) {
            const searchTerm = config.params.search.toLowerCase();
            filteredData = {
              ...cachedData,
              data: cachedData.data.filter(item => {
                // Search in product name, code, and description
                const nama = (item.nama_produk || '').toLowerCase();
                const kode = (item.kode_produk || '').toLowerCase();
                const deskripsi = (item.deskripsi || '').toLowerCase();
                return nama.includes(searchTerm) || kode.includes(searchTerm) || deskripsi.includes(searchTerm);
              })
            };
          }
          
          return Promise.resolve({
            data: filteredData,
            status: 200,
            statusText: 'OK (cached)',
            config,
            headers: {},
            cached: true
          });
        }

        return Promise.reject({
          ...error,
          message: 'Offline dan data tidak tersedia di cache',
          offline: true
        });
      }

      // POST/PUT/DELETE requests: queue them (except logout - logout should only work online)
      if (['post', 'put', 'delete', 'patch'].includes(config.method)) {
        // Don't queue logout requests - they should only work when online
        if (config.url.includes('/logout')) {
          return Promise.reject({
            ...error,
            message: 'Logout memerlukan koneksi internet',
            offline: true
          });
        }
        let parsedData = null;
        if (config.data) {
          if (typeof config.data === 'string') {
            try {
              parsedData = JSON.parse(config.data);
            } catch (__err) {
              parsedData = config.data;
            }
          } else if (config.data instanceof FormData) {
            parsedData = {};
            for (const [key, value] of config.data.entries()) {
              if (value instanceof File) {
                parsedData[key] = {
                  _isOfflineFile: true,
                  name: value.name,
                  type: value.type,
                  size: value.size
                };
              } else {
                parsedData[key] = value;
              }
            }
          } else {
            parsedData = config.data;
          }
        }

        await OfflineQueue.add(
          config.method,
          config.url,
          parsedData
        );

        // Return success response
        return Promise.resolve({
          data: {
            success: true,
            offline: true,
            message: '✓ Data tersimpan (akan disinkronkan saat online)',
            queued: true
          },
          status: 202,
          statusText: 'Accepted (Queued)',
          config,
          headers: {},
          queued: true
        });
      }
    }

    return Promise.reject(error);
  }
);

// Setup retry interceptor for automatic retry with exponential backoff
setupRetryInterceptor(apiClient);

// --- GENERIC CRUD FACTORY ---
// Single source of truth for all CRUD operations
// Reduces code duplication and ensures consistent behavior across all entities

function createCRUDOperations(endpoint, options = {}) {
  const { useRateLimit = false, skipPaginationByDefault = false, bulkEndpoint = 'bulk' } = options;
  const getMethod = useRateLimit ? limitedGet : apiClient.get;
  
  return {
    getAll: (params = {}) => {
      const finalParams = skipPaginationByDefault ? { ...params, skip_pagination: true } : params;
      return getMethod(endpoint, { params: finalParams });
    },
    getById: (id) => apiClient.get(`${endpoint}/${id}`),
    create: (data) => {
      if (data instanceof FormData) {
        return apiClient.post(endpoint, data, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      return apiClient.post(endpoint, data);
    },
    update: (id, data) => {
      if (data instanceof FormData) {
        return apiClient.put(`${endpoint}/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      return apiClient.put(`${endpoint}/${id}`, data);
    },
    delete: (id) => apiClient.delete(`${endpoint}/${id}`),
    bulkImport: (data, params = {}) => apiClient.post(`${endpoint}/${bulkEndpoint}`, data, { params })
  };
}

// --- Autentikasi ---
export const login = (credentials) => {
  return apiClient.post('/auth/login', credentials);
};

export const getMySettings = () => {
  return apiClient.get('/auth/my-settings');
};

// --- User Management (via CRUD factory) ---
const usersCRUD = createCRUDOperations('/users');
export const getUsers = () => usersCRUD.getAll();
export const getUserById = (id) => usersCRUD.getById(id);
export const createUser = (userData) => usersCRUD.create(userData);
export const updateUser = (id, userData) => usersCRUD.update(id, userData);
export const deleteUser = (id) => usersCRUD.delete(id);

// --- Cabang / Branches (via CRUD factory) ---
const branchesCRUD = createCRUDOperations('/cabang', { useRateLimit: true });
export const getBranches = () => branchesCRUD.getAll();
export const getBranchById = (id) => branchesCRUD.getById(id);
export const addBranch = (branchData) => branchesCRUD.create(branchData);
export const updateBranch = (id, branchData) => branchesCRUD.update(id, branchData);
export const deleteBranch = (id) => branchesCRUD.delete(id);

// --- Produk (via CRUD factory with special handling) ---
const productsCRUD = createCRUDOperations('/produk', { useRateLimit: true });

export const getProducts = (params = {}) => {
  return productsCRUD.getAll(params);
};

export const getProductById = (id) => {
  return productsCRUD.getById(id);
};

export const addProduct = (productData) => {
  return productsCRUD.create(productData);
};

export const updateProduct = (id, productData) => {
  return productsCRUD.update(id, productData);
};

export const deleteProduct = (id) => {
  return productsCRUD.delete(id);
};

export const bulkImportProducts = (productsData, options = {}) => {
  return productsCRUD.bulkImport(productsData, options);
};

export const bulkDeleteProducts = (ids) => {
  return apiClient.delete('/produk/bulk', { data: { ids } });
};

// Fast search cache di level API dengan bounded size untuk prevent memory leak
const MAX_SEARCH_CACHE_SIZE = 50; // Limit cache entries
const searchCache = new Map();
let searchCacheTimer = null;

// Fungsi untuk mencari produk dengan aggressive caching dan size limit
export const searchProducts = (query, limit = 100) => {
  if (!query || query.trim().length === 0) {
    return Promise.resolve([]);
  }
  
  const q = query.trim().toLowerCase();
  const cacheKey = `search:${q}:${limit}`;
  
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey);
    // TTL: 2 seconds for search cache
    if (Date.now() - cached.time < 2000) {
      return Promise.resolve(cached.data);
    }
    searchCache.delete(cacheKey);
  }
  
  const promise = apiClient.get('/produk/search', { 
    params: { q, limit: Math.min(limit, 50) } 
  }).then(res => {
    const arr = Array.isArray(res) ? res : res?.data || [];
    
    searchCache.set(cacheKey, { data: arr, time: Date.now() });
    
    // Enforce max cache size limit (LRU eviction)
    if (searchCache.size > MAX_SEARCH_CACHE_SIZE) {
      // Remove oldest entry (first one in insertion order)
      const firstKey = searchCache.keys().next().value;
      searchCache.delete(firstKey);
    }
    
    // Setup periodic cache cleanup for expired entries
    if (searchCacheTimer) clearTimeout(searchCacheTimer);
    searchCacheTimer = setTimeout(() => {
      const now = Date.now();
      for (const [key, value] of searchCache.entries()) {
        // Remove entries older than 5 seconds
        if (now - value.time > 5000) {
          searchCache.delete(key);
        }
      }
    }, 30000);
    
    return arr;
  }).catch(_err => {
    return getProducts({ 
      search: q, 
      limit: Math.min(limit, 50),
      page: 1,
      sortBy: 'nama_produk',
      sortOrder: 'asc'
    }).then(res => {
      const arr = Array.isArray(res) ? res : res?.data?.data || res?.data || [];
      if (!Array.isArray(arr)) return [];
      
      return arr.filter(p => 
        (p.nama_produk || '').toLowerCase().includes(q) ||
        (p.kode_produk || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q)
      ).slice(0, limit);
    }).catch(fallbackErr => {
      console.error('Search failed:', fallbackErr);
      return [];
    });
  });
  
  return promise;
};

// --- Kategori (via CRUD factory) ---
const categoriesCRUD = createCRUDOperations('/kategori', { 
  useRateLimit: true, 
  skipPaginationByDefault: true 
});
export const getCategories = () => categoriesCRUD.getAll();
export const getCategoryById = (id) => categoriesCRUD.getById(id);
export const addCategory = (categoryData) => categoriesCRUD.create(categoryData);
export const updateCategory = (id, categoryData) => categoriesCRUD.update(id, categoryData);
export const deleteCategory = (id) => categoriesCRUD.delete(id);
export const bulkImportCategories = (categoriesData) => categoriesCRUD.bulkImport(categoriesData);

// --- Satuan / Units (via CRUD factory) ---
const unitsCRUD = createCRUDOperations('/satuan', { 
  useRateLimit: true, 
  skipPaginationByDefault: true 
});
export const getUnits = () => unitsCRUD.getAll();
export const getUnitById = (id) => unitsCRUD.getById(id);
export const addUnit = (unitData) => unitsCRUD.create(unitData);
export const updateUnit = (id, unitData) => unitsCRUD.update(id, unitData);
export const deleteUnit = (id) => unitsCRUD.delete(id);
export const bulkImportUnits = (unitsData) => unitsCRUD.bulkImport(unitsData);

// --- Supplier (via CRUD factory) ---
const suppliersCRUD = createCRUDOperations('/supplier', { 
  useRateLimit: true, 
  skipPaginationByDefault: true 
});
export const getSuppliers = () => suppliersCRUD.getAll();
export const getSupplierById = (id) => suppliersCRUD.getById(id);
export const addSupplier = (supplierData) => suppliersCRUD.create(supplierData);
export const updateSupplier = (id, supplierData) => suppliersCRUD.update(id, supplierData);
export const deleteSupplier = (id) => suppliersCRUD.delete(id);
export const bulkImportSuppliers = (suppliersData) => suppliersCRUD.bulkImport(suppliersData);

// --- TRANSAKSI ---
export const createSale = (saleData) => {
  return apiClient.post('/penjualan', saleData);
};

export const getSales = (params = {}) => {
  return limitedGet('/penjualan', { params });
};

export const getSaleById = (id) => {
  return apiClient.get(`/penjualan/${id}`);
};

export const recordPayment = (id_penjualan, paymentData) => {
  return apiClient.post(`/penjualan/${id_penjualan}/bayar`, paymentData);
};

export const createPaymentPending = (id_penjualan, paymentData) => {
  return apiClient.post(`/penjualan/${id_penjualan}/bayar/pending`, paymentData);
};

export const getPaymentHistory = (id_penjualan) => {
  return apiClient.get(`/penjualan/${id_penjualan}/pembayaran`);
};

export const getIncompletePayments = () => {
  return apiClient.get('/penjualan/reconciliation/incomplete');
};

export const createReturnSale = (id_penjualan, returnData) => {
  return apiClient.post(`/penjualan/${id_penjualan}/retur`, returnData);
};

export const voidSale = (id_penjualan, voidData = {}) => {
  return apiClient.post(`/penjualan/${id_penjualan}/void`, voidData);
};

// --- PENJUALAN EXTENDED ---
export const getSalesExtendedSearch = (params = {}) => {
  return apiClient.get('/penjualan-extended/search', { params });
};

export const getSalesExtendedStats = () => {
  return apiClient.get('/penjualan-extended/stats/summary');
};

// --- PEMBAYARAN EXTENDED ---
export const verifyPaymentExtended = (id) => {
  return apiClient.post(`/pembayaran-extended/${id}/verifikasi`);
};

export const getPaymentExtendedStats = () => {
  return apiClient.get('/pembayaran-extended/stats/summary');
};

export const getPaymentReconciliationDaily = () => {
  return apiClient.get('/pembayaran-extended/rekon/daily');
};

export const getPaymentMethodStatsExtended = () => {
  return limitedGet('/pembayaran-extended/metode/stats');
};

export const getPaymentMethods = () => {
  return limitedGet('/metode-pembayaran', {
    params: {
      skip_pagination: true
    }
  });
};

// --- LAPORAN ---
// Laporan penjualan
export const getSalesReport = (params) => {
  return apiClient.get('/laporan/penjualan', { params });
};

// Laporan stok
export const getStockReport = (params = {}) => {
  return apiClient.get('/laporan/stok', { params });
};

// Get stock data (alternative endpoint)
export const getStock = (params = {}) => {
  return limitedGet('/stok', { params });
};

// Laporan pembayaran
export const getPaymentReport = (params) => {
  return apiClient.get('/laporan/pembayaran', { params });
};

// Laporan kartu stok
export const getStockCardReport = (id_produk) => {
  return apiClient.get(`/laporan/kartu-stok/${id_produk}`);
};

// Laporan valuasi inventory
export const getInventoryValuationReport = () => {
  return apiClient.get('/laporan/valuasi-inventory');
};

// Laporan segmentasi pelanggan
export const getCustomerSegmentationReport = () => {
  return apiClient.get('/laporan/segmentasi-pelanggan');
};

// Laporan loyalty
export const getLoyaltyReport = () => {
  return apiClient.get('/laporan/loyalty');
};

// Laporan top seller
export const getTopSellerReport = () => {
  return apiClient.get('/laporan/top-seller');
};

// --- LAPORAN KEUANGAN ---
// Buku besar
export const getGeneralLedgerReport = (params = {}) => {
  return apiClient.get('/laporan/buku-besar', { params });
};

// Arus kas
export const getCashFlowReport = (params = {}) => {
  return apiClient.get('/laporan/arus-kas', { params });
};

// Laporan kas
export const getCashReport = (params = {}) => {
  return apiClient.get('/laporan/kas', { params });
};

// Neraca
export const getBalanceSheetReport = (params = {}) => {
  return apiClient.get('/laporan/neraca', { params });
};

// Jurnal
export const getJournalEntries = (params = {}) => {
  return apiClient.get('/laporan/jurnal', { params });
};

export const getJournalEntryById = (id) => {
  return apiClient.get(`/laporan/jurnal/${id}`);
};

export const createJournalEntry = (journalData) => {
  return apiClient.post('/laporan/jurnal', journalData);
};

export const updateJournalEntry = (id, journalData) => {
  return apiClient.put(`/laporan/jurnal/${id}`, journalData);
};

export const deleteJournalEntry = (id) => {
  return apiClient.delete(`/laporan/jurnal/${id}`);
};

// --- TRANSAKSI KAS ---
export const getCashTransactions = (params = {}) => {
  return apiClient.get('/laporan/transaksi-kas', { params });
};

export const getCashTransactionById = (id) => {
  return apiClient.get(`/laporan/transaksi-kas/${id}`);
};

export const createCashTransaction = (cashTransactionData) => {
  return apiClient.post('/laporan/transaksi-kas', cashTransactionData);
};

export const updateCashTransaction = (id, cashTransactionData) => {
  return apiClient.put(`/laporan/transaksi-kas/${id}`, cashTransactionData);
};

export const deleteCashTransaction = (id) => {
  return apiClient.delete(`/laporan/transaksi-kas/${id}`);
};

// --- AKUN KEUANGAN (untuk CRUD lengkap) ---
const accountsCRUD = createCRUDOperations('/laporan/akun', { 
  useRateLimit: true, 
  skipPaginationByDefault: true 
});
export const getAccounts = () => accountsCRUD.getAll();
export const getAccountById = (id) => accountsCRUD.getById(id);
export const createAccount = (accountData) => accountsCRUD.create(accountData);
export const updateAccount = (id, accountData) => accountsCRUD.update(id, accountData);
export const deleteAccount = (id) => accountsCRUD.delete(id);

// --- REKENING KEUANGAN ---
const financialAccountsCRUD = createCRUDOperations('/laporan/rekening', { 
  useRateLimit: true, 
  skipPaginationByDefault: true 
});
export const getFinancialAccounts = () => financialAccountsCRUD.getAll();
export const getFinancialAccountById = (id) => financialAccountsCRUD.getById(id);
export const createFinancialAccount = (accountData) => financialAccountsCRUD.create(accountData);
export const updateFinancialAccount = (id, accountData) => financialAccountsCRUD.update(id, accountData);
export const deleteFinancialAccount = (id) => financialAccountsCRUD.delete(id);

// --- STOK ---
export const getStockByBranch = (id_cabang) => {
  return apiClient.get(`/stok/cabang/${id_cabang}`);
};

export const getStockHistory = (id_cabang, id_produk) => {
  return apiClient.get(`/stok/riwayat/${id_cabang}/${id_produk}`);
};

export const adjustStock = (adjustmentData) => {
  return apiClient.post('/stok/penyesuaian', adjustmentData);
};

export const transferStock = (transferData) => {
  return apiClient.post('/stok/transfer', transferData);
};

export const distributeStock = (distributionData) => {
  return apiClient.post('/stok/distribusi', distributionData);
};

export const deleteStock = (id_cabang, id_produk) => {
  return apiClient.delete(`/stok/${id_cabang}/${id_produk}`);
};

export const deleteBranchStock = (id_cabang, id_produk) => {
  // Endpoint: DELETE /api/stok-cabang/:id_cabang/:id_produk
  return apiClient.delete(`/stok-cabang/${id_cabang}/${id_produk}`);
};

export const updateStockLocation = (updateData) => {
  // For updating lokasi_rak in stok_cabang table
  return apiClient.post('/stok/update-lokasi', updateData);
};

// --- STOK GUDANG ---
export const getWarehouseStock = () => {
  return apiClient.get('/stok-gudang');
};

export const updateWarehouseStock = (stockData) => {
  const { id_produk, ...updateData } = stockData;
  return apiClient.put(`/stok-gudang/${id_produk}`, updateData);
};

export const updateBranchStock = (id_cabang, id_produk, stockData) => {
  // Endpoint: PUT /api/stok-cabang/:id_cabang/:id_produk
  return apiClient.put(`/stok-cabang/${id_cabang}/${id_produk}`, stockData);
};

// --- PENGATURAN ---
export const getSettings = () => {
  return apiClient.get('/pengaturan');
};

export const getSettingByKey = (key) => {
  return apiClient.get(`/pengaturan/${key}`);
};

export const updateSetting = (key, value) => {
  return apiClient.put(`/pengaturan/${key}`, { value });
};

// Fungsi untuk mendapatkan metode pembayaran
export const getMetodePembayaran = () => {
  return apiClient.get('/metode-pembayaran');
};

// Fungsi untuk mendapatkan satu metode pembayaran by ID
export const getMetodePembayaranById = (id) => {
  return apiClient.get(`/metode-pembayaran/${id}`);
};

// Fungsi untuk menambah metode pembayaran baru
export const addMetodePembayaran = (metodeData) => {
  return apiClient.post('/metode-pembayaran', metodeData);
};

// Fungsi untuk update metode pembayaran
export const updateMetodePembayaran = (id, metodeData) => {
  return apiClient.put(`/metode-pembayaran/${id}`, metodeData);
};

// Fungsi untuk hapus metode pembayaran
export const deleteMetodePembayaran = (id) => {
  return apiClient.delete(`/metode-pembayaran/${id}`);
};

// Fungsi untuk mendapatkan default payment method
export const getDefaultPaymentMethod = () => {
  return apiClient.get('/metode-pembayaran/default');
};

// Fungsi untuk mengatur metode pembayaran sebagai default
export const setDefaultPaymentMethod = (id) => {
  return apiClient.put(`/metode-pembayaran/${id}/set-default`);
};

// --- VOUCHER & DISKON ---

// Fungsi untuk mendapatkan satu voucher by ID
export const getVoucherById = (id) => {
  return apiClient.get(`/voucher/${id}`);
};

// Fungsi untuk validasi voucher
export const validateVoucher = (kode_voucher, total_transaksi) => {
  return apiClient.post('/voucher/validate', { kode_voucher, total_transaksi });
};

// --- PELANGGAN & LOYALTY ---

// Fungsi untuk mendapatkan semua pelanggan
export const getPelanggan = (params = {}) => {
  return limitedGet('/pelanggan', {
    params: {
      skip_pagination: params.skip_pagination !== undefined ? params.skip_pagination : true,
      ...params
    }
  });
};

// Backwards-compatible alias
export const getCustomers = getPelanggan;

// Fungsi untuk mencari pelanggan dengan parameter
export const searchPelanggan = (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  return apiClient.get(`/pelanggan?${queryString}`);
};

// Fungsi untuk mendapatkan satu pelanggan by ID
export const getPelangganById = (id) => {
  return apiClient.get(`/pelanggan/${id}`);
};

// Fungsi untuk menambah pelanggan baru
export const addPelanggan = (pelangganData) => {
  return apiClient.post('/pelanggan', pelangganData);
};

// Fungsi untuk update pelanggan
export const updatePelanggan = (id, pelangganData) => {
  return apiClient.put(`/pelanggan/${id}`, pelangganData);
};

// Fungsi untuk hapus pelanggan
export const deletePelanggan = (id) => {
  return apiClient.delete(`/pelanggan/${id}`);
};

// Fungsi untuk bulk import pelanggan
export const bulkImportPelanggan = (pelangganData) => {
  return apiClient.post('/pelanggan/bulk', pelangganData);
};

export const bulkDeletePelanggan = (ids) => {
  return apiClient.delete('/pelanggan/bulk', { data: { ids } });
};

export const bulkDeleteCustomer = bulkDeletePelanggan;

// Fungsi untuk mendapatkan riwayat loyalty pelanggan (per API spec: GET /api/pelanggan/:id/loyalty)
export const getLoyaltyHistoryByCustomer = (id_pelanggan) => {
  return apiClient.get(`/pelanggan/${id_pelanggan}/loyalty`);
};

// Fungsi untuk mendapatkan riwayat pembelian pelanggan (per API spec: GET /api/pelanggan/:id/riwayat-pembelian)
export const getCustomerPurchaseHistory = (id_pelanggan) => {
  return apiClient.get(`/pelanggan/${id_pelanggan}/riwayat-pembelian`);
};

// Fungsi untuk segmentasi pelanggan
export const getCustomerSegmentation = () => {
  return apiClient.get('/pelanggan/segmentasi/list');
};

// --- PAJAK ---
export const getPajak = () => {
  return apiClient.get('/pajak');
};

export const getPajakById = (id) => {
  return apiClient.get(`/pajak/${id}`);
};

export const addPajak = (pajakData) => {
  return apiClient.post('/pajak', pajakData);
};

export const updatePajak = (id, pajakData) => {
  return apiClient.put(`/pajak/${id}`, pajakData);
};

export const deletePajak = (id) => {
  return apiClient.delete(`/pajak/${id}`);
};

export const calculateTax = (calculationData) => {
  return apiClient.post('/pajak/kalkulasi', calculationData);
};

// --- LOYALTY ---
export const getLoyalty = () => {
  return apiClient.get('/loyalty');
};

export const getLoyaltyByCustomer = (id_pelanggan) => {
  return apiClient.get(`/loyalty/pelanggan/${id_pelanggan}`);
};

// --- PEMBELIAN (PURCHASES) ---
export const getPurchases = () => {
  return apiClient.get('/pembelian');
};

export const createPurchase = (purchaseData) => {
  return apiClient.post('/pembelian', purchaseData);
};

export const getPurchaseById = async (id) => {
  const purchaseResponse = await apiClient.get(`/pembelian/${id}`);
  const purchaseData = purchaseResponse.data;

  // Jika ada items dalam pembelian, enrich dengan data produk
  if (purchaseData.data && purchaseData.data.items && Array.isArray(purchaseData.data.items)) {
    try {
      const productsResponse = await apiClient.get('/produk');
      const productsData = productsResponse.data.data || productsResponse.data || [];

      // Buat map produk untuk lookup cepat
      const productsMap = {};
      productsData.forEach(product => {
        if (product.id_produk) {
          productsMap[product.id_produk] = product;
        }
      });

      // Enrich setiap item dengan data produk
      purchaseData.data.items = purchaseData.data.items.map(item => {
        const productInfo = productsMap[item.id_produk] || productsMap[item.id_product] || productsMap[item.product_id];
        if (productInfo) {
          return {
            ...item,
            nama_produk: productInfo.nama_produk,
            Produk: productInfo // Untuk kompatibilitas
          };
        }
        return item;
      });
    } catch (error) {
      console.warn('Failed to fetch products for purchase enrichment:', error);
      // Lanjutkan tanpa enrichment jika gagal
    }
  }

  return purchaseResponse;
};

export const calculatePurchaseTotal = (items) => {
  return apiClient.post('/pembelian/calculate', { items });
};

// --- PEMBAYARAN (PAYMENTS) ---
export const getPayments = () => {
  return apiClient.get('/pembayaran');
};

export const getPendingPayments = () => {
  return apiClient.get('/pembayaran/pending/list');
};


export const getPaymentMethodStats = () => {
  return apiClient.get('/pembayaran/metode/stats');
};

// --- RETUR PENJUALAN (SALES RETURNS) ---
export const getSalesReturns = () => {
  return apiClient.get('/retur-penjualan');
};

export const createSalesReturn = (returnData) => {
  return apiClient.post('/retur-penjualan', returnData);
};

// --- MUTASI (MUTATIONS) ---
export const getMutations = () => {
  return apiClient.get('/mutasi');
};

export const createMutation = (mutationData) => {
  return apiClient.post('/mutasi', mutationData);
};

// --- ALIASES FOR BACKWARD COMPATIBILITY ---
// Transaction aliases
export const createTransaction = createSale;
export const saveTransaction = createSale;
export const getTransactions = getSales;
export const getSalesHistory = getSales;

// Customer aliases
export const addCustomer = addPelanggan;
export const createCustomer = addPelanggan;
export const updateCustomer = updatePelanggan;
export const deleteCustomer = deletePelanggan;

// --- PENYESUAIAN STOK (STOCK ADJUSTMENTS) ---
export const getStockAdjustments = () => {
  return apiClient.get('/penyesuaian-stok');
};

export const createStockAdjustment = (adjustmentData) => {
  return apiClient.post('/penyesuaian-stok', adjustmentData);
};

// --- SALES MANAGEMENT ---
export const cancelSale = (id_penjualan) => {
  return apiClient.put(`/penjualan/${id_penjualan}/cancel`);
};

export const deleteSale = (id_penjualan) => {
  return apiClient.delete(`/penjualan/${id_penjualan}`);
};

// --- PAYMENT MANAGEMENT ---
export const getPaymentPendingList = () => {
  return apiClient.get('/pembayaran/pending/list');
};

export const verifyPayment = (id_detail, verificationData) => {
  return apiClient.put(`/pembayaran/${id_detail}/verify`, verificationData);
};

// --- AUDIT TRAIL ---
export const getAuditTrail = (params = {}) => {
  return apiClient.get('/audit-trail', { params });
};

export const getAuditTrailById = (id) => {
  return apiClient.get(`/audit-trail/${id}`);
};

export const createAuditLog = (auditData) => {
  // Backend currently exposes audit log creation through log-aktivitas.
  return apiClient.post('/log-aktivitas', auditData);
};

export const deleteAuditLog = (id) => {
  return apiClient.delete(`/audit-trail/${id}`);
};

// --- LOG AKTIVITAS ---
export const getLogAktivitas = (params = {}) => {
  return apiClient.get('/log-aktivitas', { params });
};

export const getLogAktivitasById = (id) => {
  return apiClient.get(`/log-aktivitas/${id}`);
};

export const createLogAktivitas = (logData) => {
  return apiClient.post('/log-aktivitas', logData);
};

export const deleteLogAktivitas = (id) => {
  return apiClient.delete(`/log-aktivitas/${id}`);
};

// --- LOYALTY TIERS ---
export const getLoyaltyTiers = () => {
  return apiClient.get('/loyalty-tiers');
};

export const addLoyaltyTier = (tierData) => {
  return apiClient.post('/loyalty-tiers', tierData);
};

export const updateLoyaltyTier = (id, tierData) => {
  return apiClient.put(`/loyalty-tiers/${id}`, tierData);
};

export const deleteLoyaltyTier = (id) => {
  return apiClient.delete(`/loyalty-tiers/${id}`);
};

// --- DISKON (DISCOUNTS) ---
export const getDiscounts = (params = {}) => {
  return apiClient.get('/diskon', { params });
};

export const addDiscount = (discountData) => {
  return apiClient.post('/diskon', discountData);
};

export const updateDiscount = (id, discountData) => {
  return apiClient.put(`/diskon/${id}`, discountData);
};

export const deleteDiscount = (id) => {
  return apiClient.delete(`/diskon/${id}`);
};

// --- VERIFIKASI PEMBAYARAN ---
export const verifyPaymentAdmin = (id_pembayaran, verificationData) => {
  return apiClient.post(`/pembayaran/${id_pembayaran}/verifikasi`, verificationData);
};

// --- PAJAK (TAX) ---
export const getTaxes = (params = {}) => {
  return apiClient.get('/pajak', { params });
};

export const addTax = (taxData) => {
  return apiClient.post('/pajak', taxData);
};

export const updateTax = (id, taxData) => {
  return apiClient.put(`/pajak/${id}`, taxData);
};

export const deleteTax = (id) => {
  return apiClient.delete(`/pajak/${id}`);
};

// --- VOUCHER ---
export const getVouchers = (params = {}) => {
  return apiClient.get('/voucher', { params });
};

export const addVoucher = (voucherData) => {
  return apiClient.post('/voucher', voucherData);
};

export const updateVoucher = (id, voucherData) => {
  return apiClient.put(`/voucher/${id}`, voucherData);
};

export const deleteVoucher = (id) => {
  return apiClient.delete(`/voucher/${id}`);
};

// --- HEALTH CHECK ---
export const healthCheck = () => {
  return apiClient.get('/health');
};

// --- ROLE MANAGEMENT ---
export const getRoles = () => {
  return apiClient.get('/roles');
};

export const getRoleById = (id) => {
  return apiClient.get(`/roles/${id}`);
};

export const createRole = (roleData) => {
  return apiClient.post('/roles', roleData);
};

export const updateRole = (id, roleData) => {
  return apiClient.put(`/roles/${id}`, roleData);
};

export const deleteRole = (id) => {
  return apiClient.delete(`/roles/${id}`);
};

export const updateRolePermissions = (id, roleData) => {
  return apiClient.put(`/roles/${id}`, roleData);
};

export const getPermissions = () => {
  return apiClient.get('/permissions');
};

// Menu Management API
export const getMenus = (params = {}) => {
  return apiClient.get('/menus/user', { params });
};

export const getAllMenus = (params = {}) => {
  return apiClient.get('/menus', { params });
};


export const getMenu = (id) => {
  return apiClient.get(`/menus/${id}`);
};

export const createMenu = (menuData) => {
  return apiClient.post('/menus', menuData);
};

export const updateMenu = (id, menuData) => {
  return apiClient.put(`/menus/${id}`, menuData);
};

export const deleteMenu = (id) => {
  return apiClient.delete(`/menus/${id}`);
};

export const getMenuPermissionsForRole = (roleId) => {
  return apiClient.get(`/menus/role/${roleId}/permissions`);
};

export const updateMenuPermissionsForRole = (roleId, menuPermissions) => {
  return apiClient.put(`/menus/role/${roleId}/permissions`, { menuPermissions });
};

export const resetDatabase = (confirmReset) => {
  return apiClient.post('/util/reset-database', { confirmReset });
};
