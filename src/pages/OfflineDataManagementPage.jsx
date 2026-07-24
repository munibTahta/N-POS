import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { RefreshCw, Trash2, Download, Database, Search, Package, Folder, Ruler, Users, CreditCard, CheckCircle, Clock, XCircle, HelpCircle, Info, Eye, EyeOff } from 'lucide-react';
import offlineDataSync from '../services/offlineDataSync';
import DataTable from '../components/DataTable';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts/index.jsx';
import HeaderActionButton from '../components/HeaderActionButton';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';

const OfflineDataManagementPage = () => {
  const { user } = useAuth();
  const { success, error: showError } = useNotifications();
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Konfirmasi',
    onConfirm: null,
    variant: 'danger'
  });
  const [syncQueue, setSyncQueue] = useState([]);
  const [offlineStats, setOfflineStats] = useState(null);
  const [sqliteStats, setSqliteStats] = useState(null);
  const [offlineProducts, setOfflineProducts] = useState([]);
  const [offlineStocks, setOfflineStocks] = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const offlineStockWithProductName = useMemo(() => {
    const productNameById = offlineProducts.reduce((acc, product) => {
      if (product?.id_produk) acc[product.id_produk] = product.nama_produk || 'Unknown';
      return acc;
    }, {});
    return offlineStocks.map((stock) => ({
      ...stock,
      nama_produk: stock.nama_produk || productNameById[stock.id_produk] || 'Unknown Produk'
    }));
  }, [offlineProducts, offlineStocks]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filter, setFilter] = useState('all');
  const [activeOfflineTab, setActiveOfflineTab] = useState('products');
  const lastLoadRef = useRef(0);

  const loadSQLiteStats = useCallback(async () => {
    try {
      const stats = {};

      // Get product stats from product_offline.db (SQLite)
      let productStats = null;
      if (window.electronAPI?.productDB_getStats) {
        try {
          productStats = await window.electronAPI.productDB_getStats();
          stats.products = productStats?.productCount || 0;
          stats.productsByStatus = productStats?.byStatus || [];
        } catch (err) {
        console.error('❌ Error calling productDB_getStats:', err);
        stats.products = 0;
        stats.productsByStatus = [];
      }
    } else {
      console.warn('⚠️ productDB_getStats not available');
    }

      // Get transaction stats from product_offline.db
      if (window.electronAPI?.productDB_getTransactionStats) {
        try {
          const txStats = await window.electronAPI.productDB_getTransactionStats();
          stats.pendingTransactions = txStats?.pending || 0;
          stats.syncedTransactions = txStats?.synced || 0;
          stats.failedTransactions = txStats?.failed || 0;
        } catch (e) {
          console.error('❌ Error calling productDB_getTransactionStats:', e);
          stats.pendingTransactions = 0;
          stats.syncedTransactions = 0;
          stats.failedTransactions = 0;
        }
      } else {
        console.warn('⚠️ productDB_getTransactionStats not available');
      }

      // Get master data counts from offline.db using Promise.all for parallelization
      if (window.electronAPI?.dbSelect) {
        // Parallelize all db-select queries at once
        const results = await Promise.allSettled([
          window.electronAPI.dbSelect({ table: 'categories' }),
          window.electronAPI.dbSelect({ table: 'units' }),
          window.electronAPI.dbSelect({ table: 'customers' }),
          window.electronAPI.dbSelect({ table: 'metode_pembayaran' })
        ]);

        // Process results
        const [categoriesResult, unitsResult, customersResult, paymentResult] = results;

        // Categories
        if (categoriesResult.status === 'fulfilled') {
          stats.categories = categoriesResult.value?.length || 0;
        } else {
          stats.categories = 0;
          console.warn('⚠️ Categories table not available:', categoriesResult.reason?.message);
        }

        // Units
        if (unitsResult.status === 'fulfilled') {
          stats.units = unitsResult.value?.length || 0;
        } else {
          stats.units = 0;
          console.warn('⚠️ Units table not available:', unitsResult.reason?.message);
        }

        // Customers
        if (customersResult.status === 'fulfilled') {
          stats.customers = customersResult.value?.length || 0;
        } else {
          stats.customers = 0;
          console.warn('⚠️ Customers table not available:', customersResult.reason?.message);
        }

        // Payment methods
        if (paymentResult.status === 'fulfilled') {
          stats.paymentMethods = paymentResult.value?.length || 0;
        } else {
          stats.paymentMethods = 0;
          console.warn('⚠️ Payment methods table not available:', paymentResult.reason?.message);
        }
      } else {
        console.error('❌ dbSelect not available in electronAPI');
      }

      setSqliteStats(stats);
      void 0 && ('✅ Final SQLite Stats:', {
        products: stats.products,
        categories: stats.categories,
        units: stats.units,
        customers: stats.customers,
        paymentMethods: stats.paymentMethods,
        pendingTransactions: stats.pendingTransactions,
        syncedTransactions: stats.syncedTransactions,
        failedTransactions: stats.failedTransactions
      });
    } catch (err) {
      console.warn('Error loading SQLite stats:', err.message);
      setSqliteStats({
        products: 0,
        categories: 0,
        units: 0,
        customers: 0,
        paymentMethods: 0,
        pendingTransactions: 0,
        syncedTransactions: 0,
        failedTransactions: 0
      });
    }
  }, []);

  const loadOfflineProducts = useCallback(async () => {
    if (!window.electronAPI?.productDB_searchProducts) {
      console.warn('⚠️ productDB_searchProducts IPC tidak tersedia');
      setOfflineProducts([]);
      return;
    }

    try {
      setProductLoading(true);
      const searchResult = await window.electronAPI.productDB_searchProducts('', { limit: 200, offset: 0 });
      setOfflineProducts(searchResult?.data || []);
    } catch (err) {
      console.error('❌ Gagal memuat produk offline:', err);
      setOfflineProducts([]);
    } finally {
      setProductLoading(false);
    }
  }, []);

  const loadOfflineStocks = useCallback(async () => {
    if (!user?.id_cabang) {
      setOfflineStocks([]);
      return;
    }

    if (!window.electronAPI?.productDB_getStocksByCabang) {
      console.warn('⚠️ productDB_getStocksByCabang IPC tidak tersedia');
      setOfflineStocks([]);
      return;
    }

    try {
      setStockLoading(true);
      const stocks = await window.electronAPI.productDB_getStocksByCabang(user.id_cabang);
      setOfflineStocks(Array.isArray(stocks) ? stocks : []);
    } catch (err) {
      console.error('❌ Gagal memuat stok offline:', err);
      setOfflineStocks([]);
    } finally {
      setStockLoading(false);
    }
  }, [user?.id_cabang]);

  const loadOfflineData = useCallback(async () => {
    // Update last load time
    lastLoadRef.current = Date.now();

    try {
      if (!window.electronAPI?.dbSelect) {
        showError('IPC tidak tersedia');
        setLoading(false);
        return;
      }

      const queue = await window.electronAPI.dbSelect({
        table: 'sync_queue'
      });

      setSyncQueue(queue || []);

      const [sales, purchases, products, saleItems, paymentDetails] = await Promise.all([
        window.electronAPI.dbSelect({ table: 'sales' }),
        window.electronAPI.dbSelect({ table: 'purchases' }),
        window.electronAPI.dbSelect({ table: 'products' }),
        window.electronAPI.dbSelect({ table: 'sale_items' }),
        window.electronAPI.dbSelect({ table: 'payment_details' })
      ]);

      // Also read memory cache / product_offline stats from offlineDataSync if available
      let cacheStats = {};
      try {
        if (offlineDataSync && typeof offlineDataSync.getDatabaseStats === 'function') {
          cacheStats = await offlineDataSync.getDatabaseStats();
        }
      } catch (e) {
        console.warn('Failed to read offlineDataSync stats:', e.message);
      }

      setOfflineStats({
        totalSales: sales?.length || 0,
        totalPurchases: purchases?.length || 0,
        totalProducts: products?.length || 0,
        cachedProducts: cacheStats?.totalProducts || 0,
        unsyncedSales: queue?.filter(q => q.table_name === 'sales').length || 0,
        unsyncedPurchases: queue?.filter(q => q.table_name === 'purchases').length || 0,
        unsyncedProducts: queue?.filter(q => q.table_name === 'products').length || 0,
        totalSaleItems: saleItems?.length || 0,
        totalPaymentDetails: paymentDetails?.length || 0,
        failedCount: queue?.filter(q => q.status === 'failed').length || 0,
        pendingCount: queue?.filter(q => q.status === 'pending').length || 0
      });

      // Load SQLite stats, product and stock data in parallel
      await Promise.all([loadSQLiteStats(), loadOfflineProducts(), loadOfflineStocks()]);

    } catch (err) {
      console.error('Error loading offline data:', err);
      showError(`Gagal memuat data offline: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [loadSQLiteStats, loadOfflineProducts, loadOfflineStocks, showError]);

  useEffect(() => {
    loadOfflineData();
  }, [loadOfflineData]);

  const deleteQueueItem = (id) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Queue Sinkronisasi',
      message: 'Apakah Anda yakin ingin menghapus item ini dari queue sinkronisasi?',
      confirmText: 'Ya, Hapus',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await window.electronAPI.dbDelete({
            table: 'sync_queue',
            whereClause: 'id = ?',
            whereValues: [id]
          });
          success('Item berhasil dihapus');
          await loadOfflineData();
        } catch (err) {
          showError(`Gagal menghapus item: ${err.message}`);
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const retryFailedItems = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Retry Semua Item Gagal',
      message: 'Apakah Anda yakin ingin mencoba mengirim ulang semua item yang gagal? Pastikan perangkat Anda online!',
      confirmText: 'Ya, Retry',
      variant: 'warning',
      onConfirm: async () => {
        try {
          const failed = syncQueue.filter(q => q.status === 'failed');
          if (failed.length === 0) {
            success('Tidak ada item yang gagal');
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            return;
          }
          for (const item of failed) {
            await window.electronAPI.dbUpdate({
              table: 'sync_queue',
              data: { status: 'pending', retry_count: 0 },
              whereClause: 'id = ?',
              whereValues: [item.id]
            });
          }
          success(`${failed.length} item berhasil direset untuk dicoba lagi`);
          await loadOfflineData();
          if (window.electronAPI?.triggerSync) {
            window.electronAPI.triggerSync();
          }
        } catch (err) {
          showError(`Gagal retry items: ${err.message}`);
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const clearCompleted = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Queue Tersinkronisasi',
      message: 'Apakah Anda yakin ingin menghapus semua item yang sudah berhasil tersinkronisasi?',
      confirmText: 'Ya, Hapus',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const completed = syncQueue.filter(q => q.status === 'completed');
          if (completed.length === 0) {
            success('Tidak ada item yang sudah tersinkronisasi');
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            return;
          }
          for (const item of completed) {
            await window.electronAPI.dbDelete({
              table: 'sync_queue',
              whereClause: 'id = ?',
              whereValues: [item.id]
            });
          }
          success(`${completed.length} item completed berhasil dihapus`);
          await loadOfflineData();
        } catch (err) {
          showError(`Gagal menghapus completed items: ${err.message}`);
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const exportOfflineData = async () => {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        syncQueue: syncQueue,
        stats: offlineStats
      };
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `offline-backup-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      success('Data offline berhasil di-export');
    } catch (err) {
      showError(`Gagal export data: ${err.message}`);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'completed') return 'bg-green-100 text-green-800';
    if (status === 'pending') return 'bg-yellow-100 text-yellow-800';
    if (status === 'failed') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status) => {
    if (status === 'completed') return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (status === 'pending') return <Clock className="w-4 h-4 text-yellow-600" />;
    if (status === 'failed') return <XCircle className="w-4 h-4 text-red-600" />;
    return <HelpCircle className="w-4 h-4 text-gray-600" />;
  };

  const syncQueueTableCounts = useMemo(() => {
    return syncQueue.reduce((counts, item) => {
      const tableName = String(item.table_name || item.table || '').trim().toLowerCase() || 'unknown';
      counts[tableName] = (counts[tableName] || 0) + 1;
      return counts;
    }, {});
  }, [syncQueue]);

  const queueFilterLabel = (tableName) => {
    if (tableName === 'sales') return 'Penjualan';
    if (tableName === 'purchases') return 'Pembelian';
    if (tableName === 'products') return 'Produk';
    if (tableName === 'customers') return 'Pelanggan';
    return tableName.replace(/_/g, ' ').replace(/(^|\s)\S/g, (t) => t.toUpperCase());
  };

  const filteredQueue = syncQueue.filter(item => {
    if (filter === 'all') return true;
    const tableName = String(item.table_name || item.table || '').trim().toLowerCase();
    return tableName === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data offline...</p>
        </div>
      </div>
    );
  }

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Manajemen Data Offline"
          subtitle="Kelola queue sinkronisasi dan statistik data offline"
          actions={
            <>
              <HeaderActionButton
                icon={RefreshCw}
                label="Refresh"
                onClick={loadOfflineData}
                variant="blue"
              />
              <HeaderActionButton
                icon={RefreshCw}
                label={`Retry Failed (${offlineStats?.failedCount || 0})`}
                onClick={retryFailedItems}
                variant="amber"
                disabled={!offlineStats?.failedCount}
              />
              <HeaderActionButton
                icon={Trash2}
                label="Hapus Completed"
                onClick={clearCompleted}
                variant="red"
              />
              <HeaderActionButton
                icon={Download}
                label="Export"
                onClick={exportOfflineData}
                variant="purple"
              />
            </>
          }
        />

        <div className="space-y-6">

        {/* Database Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-50 border border-gray-200 rounded p-4 text-sm">
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Database className="w-4 h-4" />
              offline.db
            </h3>
            <p className="text-gray-600 text-xs">Menyimpan: Sales, Purchases, Customers, Categories, Units, Sync Queue</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm">
            <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
              <Search className="w-4 h-4" />
              product_offline.db
            </h3>
            <p className="text-blue-600 text-xs">Menyimpan: Product Index (teroptimasi untuk search 5-50ms), Offline Transactions</p>
          </div>
        </div>

        {/* SQLite Data - Master Data Stats */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Data Master Offline (offline.db)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded shadow p-4 border-l-4 border-blue-500">
              <p className="text-gray-600 text-sm">Kategori</p>
              <p className="text-3xl font-bold text-blue-600">{sqliteStats?.categories || 0}</p>
              <p className="text-gray-500 text-xs mt-1 flex items-center">
                <Folder className="w-3 h-3 mr-1" />
                Master kategori produk
              </p>
            </div>
            <div className="bg-white rounded shadow p-4 border-l-4 border-green-500">
              <p className="text-gray-600 text-sm">Satuan</p>
              <p className="text-3xl font-bold text-green-600">{sqliteStats?.units || 0}</p>
              <p className="text-gray-500 text-xs mt-1 flex items-center">
                <Ruler className="w-3 h-3 mr-1" />
                Satuan produk
              </p>
            </div>
            <div className="bg-white rounded shadow p-4 border-l-4 border-purple-500">
              <p className="text-gray-600 text-sm">Pelanggan</p>
              <p className="text-3xl font-bold text-purple-600">{sqliteStats?.customers || 0}</p>
              <p className="text-gray-500 text-xs mt-1 flex items-center">
                <Users className="w-3 h-3 mr-1" />
                Data pelanggan
              </p>
            </div>
            <div className="bg-white rounded shadow p-4 border-l-4 border-orange-500">
              <p className="text-gray-600 text-sm">Metode Bayar</p>
              <p className="text-3xl font-bold text-orange-600">{sqliteStats?.paymentMethods || 0}</p>
              <p className="text-gray-500 text-xs mt-1 flex items-center">
                <CreditCard className="w-3 h-3 mr-1" />
                Metode pembayaran
              </p>
            </div>
          </div>
        </div>

        {/* SQLite Data - Product Stats */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Search className="w-5 h-5" />
            Data Produk (product_offline.db)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded shadow p-4 border-l-4 border-indigo-500">
              <p className="text-gray-600 text-sm">Total Produk</p>
              <p className="text-3xl font-bold text-indigo-600">{sqliteStats?.products || 0}</p>
              <p className="text-gray-500 text-xs mt-1 flex items-center">
                <Package className="w-3 h-3 mr-1" />
                Produk tersimpan offline
              </p>
            </div>
            <div className="bg-white rounded shadow p-4 border-l-4 border-yellow-500">
              <p className="text-gray-600 text-sm">Transaksi Pending</p>
              <p className="text-3xl font-bold text-yellow-600">{sqliteStats?.pendingTransactions || 0}</p>
              <p className="text-gray-500 text-xs mt-1 flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                Menunggu sync ke server
              </p>
            </div>
            <div className="bg-white rounded shadow p-4 border-l-4 border-green-500">
              <p className="text-gray-600 text-sm">Transaksi Synced</p>
              <p className="text-3xl font-bold text-green-600">{sqliteStats?.syncedTransactions || 0}</p>
              <p className="text-gray-500 text-xs mt-1 flex items-center">
                <CheckCircle className="w-3 h-3 mr-1" />
                Sudah tersync ke server
              </p>
            </div>
          </div>
        </div>

        {/* Offline Produk / Stok Tabs */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Data Produk & Stok Offline
          </h2>

          <div className="mb-4 border-b border-gray-200">
            <nav className="-mb-px flex gap-6">
              <button
                type="button"
                onClick={() => setActiveOfflineTab('products')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeOfflineTab === 'products' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                Produk ({offlineProducts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveOfflineTab('stocks')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeOfflineTab === 'stocks' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                Stok {user?.id_cabang ? `Cabang ${user.id_cabang}` : 'Cabang'} ({offlineStockWithProductName.length})
              </button>
            </nav>
          </div>

          <DataTable
            loading={activeOfflineTab === 'products' ? productLoading : stockLoading}
            data={activeOfflineTab === 'products' ? offlineProducts : offlineStockWithProductName}
            columns={activeOfflineTab === 'products' ? [
              { key: 'id_produk', header: 'ID Produk', width: '15%' },
              { key: 'kode_produk', header: 'Kode', width: '15%' },
              { key: 'nama_produk', header: 'Nama Produk', width: '40%' },
              { key: 'stok', header: 'Stok', width: '10%', render: (item) => Number(item.stok || 0).toLocaleString() },
              { key: 'status', header: 'Status', width: '10%' }
            ] : [
              { key: 'id_produk', header: 'ID Produk', width: '12%' },
              { key: 'nama_produk', header: 'Nama Produk', width: '30%' },
              { key: 'id_cabang', header: 'ID Cabang', width: '12%' },
              { key: 'stok', header: 'Stok', width: '12%', render: (item) => Number(item.stok || 0).toLocaleString() },
              { key: 'lokasi_rak', header: 'Lokasi Rak', width: '18%' },
              { key: 'updated_at', header: 'Terakhir Diupdate', width: '20%' }
            ]}
            searchPlaceholder={activeOfflineTab === 'products' ? 'Cari produk...' : 'Cari stok...'}
            searchKeys={activeOfflineTab === 'products' ? ['kode_produk', 'nama_produk', 'status'] : ['id_produk', 'nama_produk', 'lokasi_rak']}
            emptyMessage={activeOfflineTab === 'products' ? 'Tidak ada produk offline' : (user?.id_cabang ? 'Tidak ada data stok offline untuk cabang ini' : 'Cabang tidak tersedia')}
          />
        </div>

        {/* Transaction Stats Detail */}
        {(sqliteStats?.failedTransactions || 0) > 0 && (
          <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded">
            <p className="text-red-800 font-semibold flex items-center">
              <XCircle className="w-4 h-4 mr-2" />
              Transaksi Gagal: {sqliteStats?.failedTransactions || 0}
            </p>
            <p className="text-red-600 text-sm mt-1">Ada transaksi yang gagal disync. Periksa koneksi internet dan coba retry.</p>
          </div>
        )}

        {/* Original Stats */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data Transaksi (offline.db)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded shadow p-4">
              <p className="text-gray-600 text-sm">Penjualan</p>
              <p className="text-2xl font-bold text-gray-900">{offlineStats?.totalSales || 0}</p>
              <p className="text-red-600 text-xs mt-1">{offlineStats?.unsyncedSales || 0} unsync</p>
            </div>
            <div className="bg-white rounded shadow p-4">
              <p className="text-gray-600 text-sm">Pembelian</p>
              <p className="text-2xl font-bold text-gray-900">{offlineStats?.totalPurchases || 0}</p>
              <p className="text-red-600 text-xs mt-1">{offlineStats?.unsyncedPurchases || 0} unsync</p>
            </div>
            <div className="bg-white rounded shadow p-4">
              <p className="text-gray-600 text-sm">Produk</p>
              <p className="text-2xl font-bold text-gray-900">{offlineStats?.totalProducts || 0}</p>
              <p className="text-red-600 text-xs mt-1">{offlineStats?.unsyncedProducts || 0} unsync</p>
              <p className="text-gray-500 text-xs mt-1">product_offline.db: {offlineStats?.cachedProducts || 0} cached</p>
            </div>
            <div className="bg-white rounded shadow p-4">
              <p className="text-gray-600 text-sm">Queue</p>
              <p className="text-yellow-600 font-bold">{offlineStats?.pendingCount || 0} Pending</p>
              <p className="text-red-600 font-bold">{offlineStats?.failedCount || 0} Failed</p>
            </div>
          </div>
        </div>

        {/* Queue Table */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Queue Sinkronisasi
          </h2>
          
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Semua ({syncQueue.length})
            </button>
            {Object.entries(syncQueueTableCounts).map(([tableName, count]) => (
              <button
                key={tableName}
                onClick={() => setFilter(tableName)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${filter === tableName ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {queueFilterLabel(tableName)} ({count})
              </button>
            ))}
          </div>

          <DataTable
            columns={[
              { key: 'id', header: 'ID', width: '10%' },
              { key: 'table_name', header: 'Tabel', width: '15%', render: (item) => {
              const tableName = item.table_name || item.table || 'unknown';
              return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">{tableName}</span>;
            } },
              { key: 'operation', header: 'Operasi', width: '15%', render: (item) => <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">{item.operation}</span> },
              { key: 'status', header: 'Status', width: '15%', render: (item) => <span className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 w-fit ${getStatusColor(item.status)}`}>{getStatusIcon(item.status)} {item.status}</span> },
              { key: 'retry_count', header: 'Retry', width: '10%', render: (item) => `${item.retry_count}/3` }
            ]}
            actions={[
              {
                label: 'Lihat',
                icon: Eye,
                onClick: (row) => {
                  setSelectedItem(row);
                  setShowDetails(!showDetails || selectedItem?.id !== row.id);
                },
                variant: 'blue'
              },
              {
                label: 'Hapus',
                icon: Trash2,
                onClick: (row) => deleteQueueItem(row.id),
                variant: 'red'
              }
            ]}
            data={filteredQueue}
            emptyMessage="Tidak ada item dalam queue sinkronisasi"
          />
        </div>

        {/* Details */}
        {showDetails && selectedItem && (
          <div className="mt-6 bg-white rounded shadow p-4">
            <div className="flex justify-between mb-3">
              <h3 className="font-bold">Detail Item</h3>
              <button onClick={() => setShowDetails(false)} className="text-gray-500">✕</button>
            </div>
            <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-64">{JSON.stringify(selectedItem, null, 2)}</pre>
          </div>
        )}
        </div>

        {/* Reusable Confirm Dialog */}
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
          variant={confirmDialog.variant}
        />
      </PageContainer>
    </PageLayout>
  );
};

export default OfflineDataManagementPage;
