import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Import providers and components
import { AppProviders } from './components/AppProviders';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import DetailedSyncStatus from './components/DetailedSyncStatus';
import AppInitializer from './components/AppInitializer';
import LazyFallback from './components/LazyFallback';

// Import optimization utilities
import { initializeBundleOptimization } from './utils/bundleOptimizer';
import { setupMemoryManagement } from './utils/memoryManager';
import { initializeErrorRecovery } from './utils/errorRecovery';
import { preloadAllPages } from './utils/offlineModuleLoader';

// Create lazy loader with better error handling
// In Electron dev, use direct lazy loading without the complex offline fallback
const createLazyPage = (importFn, pageName) => {
  return lazy(() =>
    importFn()
      .catch(error => {
        console.error(`Failed to load ${pageName}:`, error);
        return {
          default: () => <LazyFallback error={error} isOffline={!navigator.onLine} />
        };
      })
  );
};

// Lazy load pages with bundle optimization dan error handling
const LoginPage = createLazyPage(() => import('./pages/LoginPage'), 'LoginPage');
const RegisterPage = createLazyPage(() => import('./pages/RegisterPage'), 'RegisterPage');
const MenuPage = createLazyPage(() => import('./pages/MenuPage'), 'MenuPage');
const ProductsPage = createLazyPage(() => import('./pages/ProductsPage'), 'ProductsPage');
const AddProductPage = createLazyPage(() => import('./pages/AddProductPage'), 'AddProductPage');
const UsersPage = createLazyPage(() => import('./pages/UsersPage'), 'UsersPage');
const AddBranchPage = createLazyPage(() => import('./pages/AddBranchPage'), 'AddBranchPage');
const BranchesPage = createLazyPage(() => import('./pages/BranchesPage'), 'BranchesPage');
const CategoriesPage = createLazyPage(() => import('./pages/CategoriesPage'), 'CategoriesPage');
const EditProductPage = createLazyPage(() => import('./pages/EditProductPage'), 'EditProductPage');
const CategoryFormPage = createLazyPage(() => import('./pages/CategoryFormPage'), 'CategoryFormPage');
const SupplierFormPage = createLazyPage(() => import('./pages/SupplierFormPage'), 'SupplierFormPage');
const UserFormPage = createLazyPage(() => import('./pages/UserFormPage'), 'UserFormPage');
const PosPage = createLazyPage(() => import('./pages/PosPage'), 'PosPage');
const StockPage = createLazyPage(() => import('./pages/StockPage'), 'StockPage');
const StockViewKasirPage = createLazyPage(() => import('./pages/StockViewKasirPage'), 'StockViewKasirPage');
const StockTransferPage = createLazyPage(() => import('./pages/StockTransferPage'), 'StockTransferPage');
const StockGudangPage = createLazyPage(() => import('./pages/StockGudangPage'), 'StockGudangPage');
const SalesListPage = createLazyPage(() => import('./pages/SalesListPage'), 'SalesListPage');
const StockDistributionPage = createLazyPage(() => import('./pages/StockDistributionPage'), 'StockDistributionPage');
const PurchasePage = createLazyPage(() => import('./pages/PurchasePage'), 'PurchasePage');
const PurchaseCreatePage = createLazyPage(() => import('./pages/PurchaseCreatePage'), 'PurchaseCreatePage');
const PurchaseHistoryPage = createLazyPage(() => import('./pages/PurchaseHistoryPage'), 'PurchaseHistoryPage');
const StockHistoryPage = createLazyPage(() => import('./pages/StockHistoryPage'), 'StockHistoryPage');
const ReportsPage = createLazyPage(() => import('./pages/ReportsPage'), 'ReportsPage');
const UnitsPage = createLazyPage(() => import('./pages/UnitsPage'), 'UnitsPage');
const UnitFormPage = createLazyPage(() => import('./pages/UnitFormPage'), 'UnitFormPage');
const SettingsPage = createLazyPage(() => import('./pages/SettingsPage'), 'SettingsPage');
const SuppliersPage = createLazyPage(() => import('./pages/SuppliersPage'), 'SuppliersPage');
const CustomersPage = createLazyPage(() => import('./pages/CustomersPage'), 'CustomersPage');
const PaymentMethodsPage = createLazyPage(() => import('./pages/PaymentMethodsPage'), 'PaymentMethodsPage');
const VouchersPage = createLazyPage(() => import('./pages/VouchersPage'), 'VouchersPage');
const TaxSettingsPage = createLazyPage(() => import('./pages/TaxSettingsPage'), 'TaxSettingsPage');
const PaymentsPage = createLazyPage(() => import('./pages/PaymentsPage'), 'PaymentsPage');
const ReturnPage = createLazyPage(() => import('./pages/ReturnPage'), 'ReturnPage');
const ReturnCreatePage = createLazyPage(() => import('./pages/ReturnCreatePage'), 'ReturnCreatePage');
const CustomerDetailPage = createLazyPage(() => import('./pages/CustomerDetailPage'), 'CustomerDetailPage');
const AdminReconciliationPage = createLazyPage(() => import('./pages/AdminReconciliationPage'), 'AdminReconciliationPage');
const LoyaltyTiersPage = createLazyPage(() => import('./pages/LoyaltyTiersPage'), 'LoyaltyTiersPage');
const DiscountPage = createLazyPage(() => import('./pages/DiscountPage'), 'DiscountPage');
const AuditTrailPage = createLazyPage(() => import('./pages/AuditTrailPage'), 'AuditTrailPage');
const LogAktivitasPage = createLazyPage(() => import('./pages/LogAktivitasPage'), 'LogAktivitasPage');
const ApiTestingPage = createLazyPage(() => import('./pages/ApiTestingPage'), 'ApiTestingPage');
const RoleManagementPage = createLazyPage(() => import('./pages/RoleManagementPage'), 'RoleManagementPage');
const MenuManagementPage = createLazyPage(() => import('./pages/MenuManagementPage'), 'MenuManagementPage');
const AddMenuPage = createLazyPage(() => import('./pages/AddMenuPage'), 'AddMenuPage');
const EditMenuPage = createLazyPage(() => import('./pages/EditMenuPage'), 'EditMenuPage');
const DatabaseSetupPage = createLazyPage(() => import('./pages/DatabaseSetupPage'), 'DatabaseSetupPage');
const OfflineDataManagementPage = createLazyPage(() => import('./pages/OfflineDataManagementPage'), 'OfflineDataManagementPage');
const FinancialReportsPage = createLazyPage(() => import('./pages/FinancialReportsPage'), 'FinancialReportsPage');
const AccountsPage = createLazyPage(() => import('./pages/AccountsPage'), 'AccountsPage');
const FinancialAccountsPage = createLazyPage(() => import('./pages/FinancialAccountsPage'), 'FinancialAccountsPage');
const FinancialTransactionsPage = createLazyPage(() => import('./pages/FinancialTransactionsPage'), 'FinancialTransactionsPage');

function App() {
  useEffect(() => {
    // Initialize performance optimizations
    const cleanupMemory = setupMemoryManagement();
    initializeBundleOptimization();
    initializeErrorRecovery();
    
    // Pre-load all pages for offline availability (background, non-blocking)
    // In development, skip preloading to avoid issues with dev server not being ready
    let preloadTimeout = null;
    
    // eslint-disable-next-line no-undef
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
      preloadAllPages().catch(error => {
        console.warn('⚠️ Module pre-loading had issues:', error);
        // Continue anyway - will fallback to on-demand loading
      });
    } else {
      // In development, do a soft preload after a delay
      preloadTimeout = setTimeout(() => {
        preloadAllPages().catch(() => {
          // Silently fail in dev - not critical
        });
      }, 2000);
    }

    // Cleanup on unmount
    return () => {
      if (preloadTimeout) clearTimeout(preloadTimeout);
      if (cleanupMemory) cleanupMemory();
    };
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppProviders>
          <AppInitializer>
            <div className="app-container">
              <Suspense fallback={
                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Memuat Aplikasi</h2>
                    <p className="text-gray-600">Mohon tunggu sebentar...</p>
                  </div>
                </div>
              }>
              <Routes>

                {/* Login route - accessible without authentication */}
                <Route path="/login" element={<LoginPage />} />

                {/* Protected routes - require authentication */}
                <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                  {/* Redirect for typo: /retur -> /return */}
                  <Route path="retur" element={<Navigate to="/return" replace />} />
                  
                  <Route index element={<MenuPage />} />
                  <Route path="menu" element={<MenuPage />} />
                  <Route path="laporan" element={<ProtectedRoute menuKey="laporan"><ReportsPage /></ProtectedRoute>} />
                  <Route path="laporan-keuangan" element={<ProtectedRoute menuKey={['laporan', 'laporan-keuangan']}><FinancialReportsPage /></ProtectedRoute>} />
                  <Route path="akun-keuangan" element={<ProtectedRoute menuKey={['pengaturan', 'akun-keuangan']}><AccountsPage /></ProtectedRoute>} />
                  <Route path="rekening-keuangan" element={<ProtectedRoute menuKey={['pengaturan', 'rekening-keuangan']}><FinancialAccountsPage /></ProtectedRoute>} />
                  <Route path="transaksi-keuangan" element={<ProtectedRoute menuKey={['laporan', 'laporan-keuangan']}><FinancialTransactionsPage /></ProtectedRoute>} />
                  <Route path="pos" element={<ProtectedRoute menuKey="pos"><PosPage /></ProtectedRoute>} />
                  <Route path="penjualan" element={<ProtectedRoute menuKey="penjualan"><SalesListPage /></ProtectedRoute>} />
                  <Route path="rekonsiliasi" element={<ProtectedRoute menuKey="rekonsiliasi"><AdminReconciliationPage /></ProtectedRoute>} />
                  <Route path="produk" element={<ProtectedRoute menuKey="produk"><ProductsPage /></ProtectedRoute>} />
                  <Route path="produk/tambah" element={<ProtectedRoute menuKey="produk"><AddProductPage /></ProtectedRoute>} />
                  <Route path="produk/edit/:id" element={<ProtectedRoute menuKey="produk"><EditProductPage /></ProtectedRoute>} />
                  <Route path="kategori" element={<ProtectedRoute menuKey="kategori"><CategoriesPage /></ProtectedRoute>} />
                  <Route path="kategori/tambah" element={<ProtectedRoute menuKey="kategori"><CategoryFormPage /></ProtectedRoute>} />
                  <Route path="kategori/edit/:id" element={<ProtectedRoute menuKey="kategori"><CategoryFormPage /></ProtectedRoute>} />
                  <Route path="supplier" element={<ProtectedRoute menuKey="supplier"><SuppliersPage /></ProtectedRoute>} />
                  <Route path="supplier/tambah" element={<ProtectedRoute menuKey="supplier"><SupplierFormPage /></ProtectedRoute>} />
                  <Route path="supplier/edit/:id" element={<ProtectedRoute menuKey="supplier"><SupplierFormPage /></ProtectedRoute>} />
                  <Route path="pelanggan" element={<ProtectedRoute menuKey="pelanggan"><CustomersPage /></ProtectedRoute>} />
                  <Route path="pelanggan/:id" element={<ProtectedRoute menuKey="pelanggan"><CustomerDetailPage /></ProtectedRoute>} />
                  <Route path="stok" element={<ProtectedRoute menuKey="stok"><StockPage /></ProtectedRoute>} />
                  <Route path="stok/kasir" element={<ProtectedRoute menuKey="stok"><StockViewKasirPage /></ProtectedRoute>} />
                  <Route path="stok/gudang" element={<ProtectedRoute menuKey="stok"><StockGudangPage /></ProtectedRoute>} />
                  <Route path="stok/transfer" element={<ProtectedRoute menuKey="stok"><StockTransferPage /></ProtectedRoute>} />
                  <Route path="stok/distribusi" element={<ProtectedRoute menuKey="stok"><StockDistributionPage /></ProtectedRoute>} />
                  <Route path="stok/history/:id_cabang/:id_produk" element={<ProtectedRoute menuKey="stok"><StockHistoryPage /></ProtectedRoute>} />
                  <Route path="pembelian" element={<ProtectedRoute menuKey="pembelian"><PurchasePage /></ProtectedRoute>} />
                  <Route path="pembelian/tambah" element={<ProtectedRoute menuKey="pembelian"><PurchaseCreatePage /></ProtectedRoute>} />
                  <Route path="pembelian/history" element={<ProtectedRoute menuKey="pembelian"><PurchaseHistoryPage /></ProtectedRoute>} />
                  <Route path="pengguna" element={<ProtectedRoute menuKey="pengguna"><UsersPage /></ProtectedRoute>} />
                  <Route path="pengguna/tambah" element={<ProtectedRoute menuKey="pengguna"><UserFormPage /></ProtectedRoute>} />
                  <Route path="pengguna/edit/:id" element={<ProtectedRoute menuKey="pengguna"><UserFormPage /></ProtectedRoute>} />
                  <Route path="users" element={<ProtectedRoute menuKey="pengguna"><UsersPage /></ProtectedRoute>} />
                  <Route path="users/add" element={<ProtectedRoute menuKey="pengguna"><UserFormPage /></ProtectedRoute>} />
                  <Route path="users/edit/:id" element={<ProtectedRoute menuKey="pengguna"><UserFormPage /></ProtectedRoute>} />
                  <Route path="cabang" element={<ProtectedRoute menuKey="cabang"><BranchesPage /></ProtectedRoute>} />
                  <Route path="cabang/tambah" element={<ProtectedRoute menuKey="cabang"><AddBranchPage /></ProtectedRoute>} />
                  <Route path="cabang/edit/:id" element={<ProtectedRoute menuKey="cabang"><AddBranchPage /></ProtectedRoute>} />
                  <Route path="satuan" element={<ProtectedRoute menuKey="unit"><UnitsPage /></ProtectedRoute>} />
                  <Route path="satuan/tambah" element={<ProtectedRoute menuKey="unit"><UnitFormPage /></ProtectedRoute>} />
                  <Route path="satuan/edit/:id" element={<ProtectedRoute menuKey="unit"><UnitFormPage /></ProtectedRoute>} />
                  <Route path="metode-pembayaran" element={<ProtectedRoute menuKey="metode-pembayaran"><PaymentMethodsPage /></ProtectedRoute>} />
                  <Route path="voucher" element={<ProtectedRoute menuKey="voucher"><VouchersPage /></ProtectedRoute>} />
                  <Route path="pengaturan/pajak" element={<ProtectedRoute menuKey="pengaturan"><TaxSettingsPage /></ProtectedRoute>} />
                  <Route path="pajak" element={<ProtectedRoute menuKey="pengaturan"><TaxSettingsPage /></ProtectedRoute>} />
                  <Route path="pengaturan/loyalty" element={<ProtectedRoute menuKey="pengaturan"><LoyaltyTiersPage /></ProtectedRoute>} />
                  <Route path="loyalty-tiers" element={<ProtectedRoute menuKey="pengaturan"><LoyaltyTiersPage /></ProtectedRoute>} />
                  <Route path="pengaturan/diskon" element={<ProtectedRoute menuKey="pengaturan"><DiscountPage /></ProtectedRoute>} />
                  <Route path="diskon" element={<ProtectedRoute menuKey="pengaturan"><DiscountPage /></ProtectedRoute>} />
                  <Route path="pengaturan/role" element={<ProtectedRoute menuKey="pengaturan"><RoleManagementPage /></ProtectedRoute>} />
                  <Route path="roles" element={<ProtectedRoute menuKey="pengaturan"><RoleManagementPage /></ProtectedRoute>} />
                  <Route path="pengaturan/menu" element={<ProtectedRoute menuKey="pengaturan"><MenuManagementPage /></ProtectedRoute>} />
                  <Route path="pengaturan/menu/tambah" element={<ProtectedRoute menuKey="pengaturan"><AddMenuPage /></ProtectedRoute>} />
                  <Route path="pengaturan/menu/edit/:id" element={<ProtectedRoute menuKey="pengaturan"><EditMenuPage /></ProtectedRoute>} />
                  <Route path="menu-management" element={<ProtectedRoute menuKey="pengaturan"><MenuManagementPage /></ProtectedRoute>} />
                  <Route path="menu-management/tambah" element={<ProtectedRoute menuKey="pengaturan"><AddMenuPage /></ProtectedRoute>} />
                  <Route path="menu-management/edit/:id" element={<ProtectedRoute menuKey="pengaturan"><EditMenuPage /></ProtectedRoute>} />
                  <Route path="pengaturan" element={<ProtectedRoute menuKey="pengaturan"><SettingsPage /></ProtectedRoute>} />
                  <Route path="pengaturan/database" element={<ProtectedRoute menuKey="pengaturan"><DatabaseSetupPage /></ProtectedRoute>} />
                  <Route path="pengaturan/offline-data" element={<ProtectedRoute menuKey="offline-data"><OfflineDataManagementPage /></ProtectedRoute>} />
                  <Route path="offline-data" element={<ProtectedRoute menuKey="offline-data"><OfflineDataManagementPage /></ProtectedRoute>} />
                  <Route path="api-testing" element={<ProtectedRoute menuKey="api-testing"><ApiTestingPage /></ProtectedRoute>} />
                  <Route path="audit-trail" element={<ProtectedRoute menuKey="audit-trail"><AuditTrailPage /></ProtectedRoute>} />
                  <Route path="log-aktivitas" element={<ProtectedRoute menuKey="log-aktivitas"><LogAktivitasPage /></ProtectedRoute>} />
                  <Route path="return" element={<ProtectedRoute menuKey="return"><ReturnPage /></ProtectedRoute>} />
                  <Route path="return/create" element={<ProtectedRoute menuKey="return"><ReturnCreatePage /></ProtectedRoute>} />
                  <Route path="pembayaran/pending" element={<ProtectedRoute menuKey="pembayaran"><PaymentsPage /></ProtectedRoute>} />
                </Route>
              </Routes>
              </Suspense>
              <ToastContainer />
              <DetailedSyncStatus />
            </div>
          </AppInitializer>
        </AppProviders>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;