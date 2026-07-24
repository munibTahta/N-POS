/**
 * Offline-Capable Module Loader
 * Caches all pages in memory during app initialization
 * Falls back ke cache saat offline atau fetch error
 * 
 * For Electron desktop app - tidak perlu lazy loading karena bundling lokal
 * Better approach: Pre-load semua modules dan cache in memory
 */

const moduleCache = new Map();
let isCaching = false;
const MODULE_LOAD_TIMEOUT = 30000; // 30 second timeout (dev server can be slow)

/**
 * Pre-load dan cache semua page modules
 * Harus dipanggil saat app startup, sebelum routes dirender
 * IMPORTANT: In development mode, this is fire-and-forget to avoid blocking app
 */
export const preloadAllPages = async () => {
  if (isCaching || moduleCache.size > 0) return;
  
  isCaching = true;
  
  const pageModules = [
    { name: 'LoginPage', path: () => import('../pages/LoginPage') },
    { name: 'RegisterPage', path: () => import('../pages/RegisterPage') },
    { name: 'MenuPage', path: () => import('../pages/MenuPage') },
    { name: 'ProductsPage', path: () => import('../pages/ProductsPage') },
    { name: 'AddProductPage', path: () => import('../pages/AddProductPage') },
    { name: 'UsersPage', path: () => import('../pages/UsersPage') },
    { name: 'AddBranchPage', path: () => import('../pages/AddBranchPage') },
    { name: 'BranchesPage', path: () => import('../pages/BranchesPage') },
    { name: 'CategoriesPage', path: () => import('../pages/CategoriesPage') },
    { name: 'EditProductPage', path: () => import('../pages/EditProductPage') },
    { name: 'CategoryFormPage', path: () => import('../pages/CategoryFormPage') },
    { name: 'SupplierFormPage', path: () => import('../pages/SupplierFormPage') },
    { name: 'UserFormPage', path: () => import('../pages/UserFormPage') },
    { name: 'PosPage', path: () => import('../pages/PosPage') },
    { name: 'StockPage', path: () => import('../pages/StockPage') },
    { name: 'StockViewKasirPage', path: () => import('../pages/StockViewKasirPage') },
    { name: 'StockTransferPage', path: () => import('../pages/StockTransferPage') },
    { name: 'StockGudangPage', path: () => import('../pages/StockGudangPage') },
    { name: 'SalesListPage', path: () => import('../pages/SalesListPage') },
    { name: 'StockDistributionPage', path: () => import('../pages/StockDistributionPage') },
    { name: 'PurchasePage', path: () => import('../pages/PurchasePage') },
    { name: 'PurchaseCreatePage', path: () => import('../pages/PurchaseCreatePage') },
    { name: 'PurchaseHistoryPage', path: () => import('../pages/PurchaseHistoryPage') },
    { name: 'StockHistoryPage', path: () => import('../pages/StockHistoryPage') },
    { name: 'ReportsPage', path: () => import('../pages/ReportsPage') },
    { name: 'UnitsPage', path: () => import('../pages/UnitsPage') },
    { name: 'UnitFormPage', path: () => import('../pages/UnitFormPage') },
    { name: 'SettingsPage', path: () => import('../pages/SettingsPage') },
    { name: 'SuppliersPage', path: () => import('../pages/SuppliersPage') },
    { name: 'CustomersPage', path: () => import('../pages/CustomersPage') },
    { name: 'PaymentMethodsPage', path: () => import('../pages/PaymentMethodsPage') },
    { name: 'VouchersPage', path: () => import('../pages/VouchersPage') },
    { name: 'TaxSettingsPage', path: () => import('../pages/TaxSettingsPage') },
    { name: 'PaymentsPage', path: () => import('../pages/PaymentsPage') },
    { name: 'ReturnPage', path: () => import('../pages/ReturnPage') },
    { name: 'CustomerDetailPage', path: () => import('../pages/CustomerDetailPage') },
    { name: 'AdminReconciliationPage', path: () => import('../pages/AdminReconciliationPage') },
    { name: 'LoyaltyTiersPage', path: () => import('../pages/LoyaltyTiersPage') },
    { name: 'DiscountPage', path: () => import('../pages/DiscountPage') },
    { name: 'AuditTrailPage', path: () => import('../pages/AuditTrailPage') },
    { name: 'ApiTestingPage', path: () => import('../pages/ApiTestingPage') },
    { name: 'RoleManagementPage', path: () => import('../pages/RoleManagementPage') },
    { name: 'MenuManagementPage', path: () => import('../pages/MenuManagementPage') },
    { name: 'DatabaseSetupPage', path: () => import('../pages/DatabaseSetupPage') },
    { name: 'OfflineDataManagementPage', path: () => import('../pages/OfflineDataManagementPage') }
  ];
  // Helper: Load with timeout
  const loadWithTimeout = (mod, timeout = MODULE_LOAD_TIMEOUT) => {
    return Promise.race([
      mod.path(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout loading ${mod.name}`)), timeout)
      )
    ]);
  };
  
  // Load all in parallel - faster startup
  // Use allSettled so one failure doesn't block others
  const results = await Promise.allSettled(
    pageModules.map(async (mod) => {
      try {
        const module = await loadWithTimeout(mod);
        moduleCache.set(mod.name, module);
        if (import.meta.env.DEV) {
        }
        return { name: mod.name, success: true };
      } catch (error) {
        // Don't throw - just log and continue
        // Development may not have all modules ready yet
        if (import.meta.env.DEV) {
          console.warn(`⚠️ Failed to cache ${mod.name}:`, error.message);
        }
        return { name: mod.name, success: false, error };
      }
    })
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
  const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value?.success)).length;
  
  if (import.meta.env.DEV) {
  }
  
  isCaching = false;
};

/**
 * Get cached module atau attempt fresh load with retries
 * Fallback ke cache jika fetch fails (offline)
 * In development, retries with backoff
 */
export const getModuleWithOfflineFallback = async (importFn, moduleName) => {
  // Try cache first
  const cached = moduleCache.get(moduleName);
  if (cached) {
    return cached;
  }

  // Attempt fresh load with retry logic for development
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const module = await Promise.race([
        importFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Module load timeout')), 15000)
        )
      ]);
      
      // Cache untuk future offline access
      moduleCache.set(moduleName, module);
      return module;
    } catch (error) {
      lastError = error;
      
      // Check cache as fallback between retries
      const fallback = moduleCache.get(moduleName);
      if (fallback) {
        return fallback;
      }
      
      // If not last attempt, wait before retrying
      if (attempt < maxRetries - 1) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff
        console.warn(`⚠️ Attempt ${attempt + 1} to load ${moduleName} failed, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries exhausted
  console.error(`❌ Failed to load ${moduleName} after ${maxRetries} attempts:`, lastError?.message);
  
  // Last resort: Try one more time synchronously if module is partially loaded
  const lastChance = moduleCache.get(moduleName);
  if (lastChance) {
    return lastChance;
  }

  // If absolutely no cache, throw descriptive error
  throw new Error(`Cannot load ${moduleName} - failed after ${maxRetries} retries and no cached version available`);
};

/**
 * Get module dari cache synchronously (instant access)
 * Returns null jika tidak di-cache
 */
export const getCachedModule = (moduleName) => {
  return moduleCache.get(moduleName) || null;
};

/**
 * Clear cache (jika diperlukan)
 */
export const clearModuleCache = () => {
  moduleCache.clear();
};

/**
 * Get cache stats
 */
export const getModuleCacheStats = () => {
  return {
    cachedModules: moduleCache.size,
    modules: Array.from(moduleCache.keys()),
    isPreloading: isCaching
  };
};
