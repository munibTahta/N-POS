import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSales, getSaleById, getProducts, getPaymentHistory, getSalesReturns, recordPayment, getBranches, getMetodePembayaran, voidSale } from '../services/api';
import { extractArray } from '../utils/apiResponseHelper';
import { useSettings } from '../context/SettingsContext';
import { usePermissions } from '../hooks/usePermissions';
import { useNotifications } from '../hooks/useNotifications';
import { handleError } from '../utils/errorHandler';
import { useMultiDataLoader } from '../hooks/useDataLoader';
import { withErrorBoundary } from '../components/withErrorBoundary';
import PaymentAmountInput from '../components/PaymentAmountInput';
import TransactionSuccessModal from '../components/TransactionSuccessModal';
import Pagination from '../components/Pagination';
import { SearchFilterBar, FilterPanel } from '../components/SearchFilterBar';
import useSearchAndFilter from '../hooks/useSearchAndFilter';
import { usePagination } from '../hooks/usePagination';
import { exportToExcel } from '../utils/exportHelper';
import ResponsiveTable from '../components/common/ResponsiveTable';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import ActionButton from '../components/ActionButton';
import HeaderActionButton from '../components/HeaderActionButton';
import { Printer, CheckCircle, XCircle, RotateCcw, Download } from 'lucide-react';

const SalesListPage = () => {
  const { user, canVoidSales } = usePermissions();
  const { success: showSuccess, error: showError, warning, info: _info } = useNotifications();
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [returns, setReturns] = useState([]);
  const [error, setError] = useState('');
  const { storeInfo } = useSettings();
  const [branches, setBranches] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedSaleForPrint, setSelectedSaleForPrint] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSaleForComplete, setSelectedSaleForComplete] = useState(null);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [additionalPayment, setAdditionalPayment] = useState(0);
  const [selectedSaleForVoid, setSelectedSaleForVoid] = useState(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [createReversal, setCreateReversal] = useState(false);

  // UI State for new design patterns
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('all');

  const navigate = useNavigate();

  // Use multi-data loader hook to fetch all data in parallel
  const {
    data: multiData,
    loading,
    errors: _loadErrors,
    refetch: refetchAll
  } = useMultiDataLoader(
    {
      sales: async () => extractArray(await getSales({ include: 'detail_pembayaran' })),
      products: async () => extractArray(await getProducts({ limit: 1000 })),
      returns: async () => extractArray(await getSalesReturns()),
      branches: async () => extractArray(await getBranches()),
      paymentMethods: async () => extractArray(await getMetodePembayaran())
    },
    {
      context: 'SalesListPage:loadData',
      onError: (err) => {
        setError('Gagal memload riwayat penjualan.');
        handleError(err, 'SalesListPage:loadData', 'Gagal memload riwayat penjualan.');
      }
    }
  );

  // Update state when multi-data loads
  useEffect(() => {
    if (multiData.products) setProducts(multiData.products);
    if (multiData.returns) setReturns(multiData.returns);
    if (multiData.branches) setBranches(multiData.branches);
    if (multiData.paymentMethods) setPaymentMethods(multiData.paymentMethods);

    // Filter sales based on user role
    if (multiData.sales) {
      let filteredSales = multiData.sales;
      if (user?.role === 'kasir' && user?.id_cabang) {
        filteredSales = multiData.sales.filter(sale => sale.id_cabang === user.id_cabang);
      }
      setSales(filteredSales);
    }
  }, [multiData, user?.role, user?.id_cabang]);

  const getRemainingPayment = useCallback((sale) => {
    const totalPaid = Array.isArray(sale.detail_pembayaran) 
      ? sale.detail_pembayaran.reduce((sum, payment) => sum + Number(payment.jumlah_bayar || 0), 0)
      : Number(sale.bayar || 0);
    
    const totalAmount = Number(sale.total || 0);
    return Math.max(0, totalAmount - totalPaid);
  }, []);

  const getPaymentStatus = useCallback((sale) => {
    const remaining = getRemainingPayment(sale);
    return remaining <= 0 ? 'lunas' : 'pending';
  }, [getRemainingPayment]);

  const getPaymentMethodLabel = useCallback((sale) => {
    const rawMethods = Array.isArray(sale.detail_pembayaran) && sale.detail_pembayaran.length > 0
      ? sale.detail_pembayaran.map(p => p.metodePembayaran?.nama_metode || p.metode_pembayaran || 'Tunai')
      : [sale.MetodePembayaran?.nama_metode || sale.metode_pembayaran?.nama_metode || sale.metode_pembayaran || 'Tunai'];

    const methodCounts = rawMethods.reduce((acc, method) => {
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(methodCounts)
      .map(([method, count]) => (count > 1 ? `${method} (${count}x)` : method))
      .join(', ');
  }, []);

  // Apply search and filter logic
  const { filteredItems: filteredSales } = useSearchAndFilter(sales, {
    searchTerm: searchQuery,
    searchKeys: ['kode_transaksi', 'user.nama_lengkap', 'User.nama_lengkap', 'Cabang.nama_cabang', 'MetodePembayaran.nama_metode', 'metode_pembayaran'],
    filters: {
      status: filterStatus === 'all' ? '' : filterStatus,
      branch: filterBranch === 'all' ? '' : filterBranch,
      paymentMethod: filterPaymentMethod === 'all' ? '' : filterPaymentMethod,
    },
    filterFns: {
      status: (sale, key, value) => {
        if (!value) return true;
        return getPaymentStatus(sale) === value;
      },
      branch: (sale, key, value) => {
        if (!value) return true;
        return sale.Cabang?.nama_cabang === value;
      },
      paymentMethod: (sale, key, value) => {
        if (!value) return true;
        return Array.isArray(sale.detail_pembayaran) &&
               sale.detail_pembayaran.some(p => p.metodePembayaran?.nama_metode === value);
      },
    },
    debounceDelay: 300,
  });

  // Listen for soft-refresh events and refetch data
  useEffect(() => {
    const handleSoftRefresh = (event) => {
      if (event.detail?.context === 'sales' || event.detail?.context === 'all') {
        refetchAll();
      }
    };

    window.addEventListener('softRefresh', handleSoftRefresh);
    return () => window.removeEventListener('softRefresh', handleSoftRefresh);
  }, [refetchAll]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F9: Navigate to POS page
      if (e.key === 'F9') {
        e.preventDefault();
        e.stopPropagation();
        navigate('/pos');
        showSuccess('Navigasi ke halaman POS');
        return;
      }

      // F10: Navigate to Purchase Management page
      if (e.key === 'F10') {
        e.preventDefault();
        e.stopPropagation();
        navigate('/pembelian');
        showSuccess('Navigasi ke halaman Pembelian');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [navigate, showSuccess]);

  // Apply pagination
  const { currentData: paginatedSales, currentPage, totalPages, setPage, itemsPerPage } = usePagination({
    data: filteredSales,
    itemsPerPage: 20,
  });

  const totalKekurangan = useMemo(() => {
    return filteredSales.reduce((sum, sale) => sum + getRemainingPayment(sale), 0);
  }, [filteredSales, getRemainingPayment]);

  const totalGross = useMemo(() => {
    return filteredSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  }, [filteredSales]);

  const handleExportSalesList = () => {
    try {
      const rows = filteredSales.map(sale => {
        const remaining = getRemainingPayment(sale);
        const status = remaining > 0 ? 'Pending' : 'Lunas';
        const rawMethods = Array.isArray(sale.detail_pembayaran) && sale.detail_pembayaran.length > 0
          ? sale.detail_pembayaran.map(p => p.metodePembayaran?.nama_metode || 'Tunai')
          : (sale.MetodePembayaran?.nama_metode ? [sale.MetodePembayaran.nama_metode] : [typeof sale.metode_pembayaran === 'string' ? sale.metode_pembayaran : (sale.metode_pembayaran?.nama_metode || 'Tunai')]);

        // Group and format methods like "Tunai (2x)"
        const methodCounts = rawMethods.reduce((acc, m) => {
          acc[m] = (acc[m] || 0) + 1;
          return acc;
        }, {});
        const methods = Object.entries(methodCounts).map(([method, count]) => count > 1 ? `${method} (${count}x)` : method).join(', ');

        return {
          Tanggal: sale.tanggal ? new Date(sale.tanggal).toLocaleString('id-ID') : '',
          NoStruk: sale.kode_transaksi || sale.id_penjualan || '',
          Kasir: sale.user?.nama_lengkap || sale.User?.nama_lengkap || '',
          Cabang: sale.Cabang?.nama_cabang || '',
          MetodePembayaran: methods,
          Status: status,
          Kekurangan: getRemainingPayment(sale),
          Items: (sale.items || sale.detail || []).length || 0,
          Total: Number(sale.total || 0),
          Bayar: Array.isArray(sale.detail_pembayaran) ? sale.detail_pembayaran.reduce((sum, p) => sum + Number(p.jumlah_bayar || 0), 0) : Number(sale.bayar || 0),
          Kembali: Number(sale.kembali || sale.kembalian || 0),
        };
      });
      exportToExcel(rows, `Riwayat_Penjualan_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (_err) {
      showError('Gagal export daftar penjualan');
      showError('Gagal mengekspor riwayat penjualan. Cek console untuk detail.');
    }
  };

  const handleVoidSale = async () => {
    if (!selectedSaleForVoid || !voidReason.trim()) {
      warning('Mohon pilih transaksi dan isi alasan void.');
      return;
    }

    try {
      await voidSale(selectedSaleForVoid.id_penjualan, {
        reason: voidReason.trim(),
        create_reversal: createReversal
      });

      // Refresh sales data
      const salesResponse = await getSales({ include: 'detail_pembayaran' });
      const salesData = extractArray(salesResponse);
      setSales(salesData);

      // Close modal and reset state
      setIsVoidModalOpen(false);
      setSelectedSaleForVoid(null);
      setVoidReason('');
      setCreateReversal(false);

      showSuccess('Transaksi berhasil di-void');
    } catch (err) {
      showError('Gagal membatalkan penjualan');
      showError('Gagal melakukan void transaksi. ' + (err.response?.data?.message || err.message));
    }
  };

  // --- Logika Cetak ---
  // handlePrintDirect tidak diperlukan lagi karena TransactionSuccessModal menangani sendiri

  // Helper function to check if a sale has returns
  const hasReturns = (saleId) => {
    return returns.some(retur => retur.id_penjualan === saleId);
  };

  // Helper function to get return count for a sale
  const getReturnCount = (saleId) => {
    return returns.filter(retur => retur.id_penjualan === saleId).length;
  };

  // OPTIMIZATION: Fetch payment details on-demand (when user clicks cetak/selesaikan)
  // This prevents N+1 API calls on page load
  const enrichSaleWithPaymentDetails = useCallback(async (sale) => {
    // If already has detail_pembayaran, return as-is
    if (sale.detail_pembayaran && Array.isArray(sale.detail_pembayaran) && sale.detail_pembayaran.length > 0) {
      return sale;
    }
    
    try {
      const paymentResponse = await getPaymentHistory(sale.id_penjualan);
      const paymentData = extractArray(paymentResponse);
      
      // Transform payment history to match expected detail_pembayaran structure
      const detail_pembayaran = paymentData.map(payment => ({
        id_detail_pembayaran: payment.id_detail_pembayaran || payment.id,
        id_metode_pembayaran: payment.id_metode_pembayaran,
        jumlah_bayar: payment.jumlah_bayar,
        metodePembayaran: {
          nama_metode: payment.MetodePembayaran?.nama_metode || payment.metode_pembayaran || 'Tunai'
        }
      }));
      
      return {
        ...sale,
        detail_pembayaran: detail_pembayaran.length > 0 ? detail_pembayaran : null
      };
    } catch (paymentErr) {
      console.warn(`Failed to fetch payment details for sale ${sale.id_penjualan}:`, paymentErr);
      return sale; // Return sale without payment details
    }
  }, []);


  // --- RENDER KOMPONEN ---

  if (loading) return <div className="text-center mt-10">Loading...</div>;
  if (error) return <div className="text-center mt-10 text-red-500">{error}</div>;

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Riwayat Penjualan"
          description="Kelola dan pantau semua transaksi penjualan yang telah dilakukan."
          actions={
            <HeaderActionButton
              icon={Download}
              label="Export"
              variant="emerald"
              onClick={handleExportSalesList}
              hideLabel={true}
            />
          }
        />

        <div className="space-y-6">
          {/* Status Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">Total Transaksi</p>
              <p className="text-2xl font-bold text-gray-900">{filteredSales.length.toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">Total Penjualan</p>
              <p className="text-2xl font-bold text-green-600">Rp {Number(totalGross).toLocaleString('id-ID')}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">Total Kekurangan</p>
              <p className="text-2xl font-bold text-red-600">Rp {Number(totalKekurangan).toLocaleString('id-ID')}</p>
            </div>
          </div>

          {/* Search & Filter Section */}
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="p-6">
              <SearchFilterBar
                searchTerm={searchQuery}
                onSearchChange={setSearchQuery}
                onClearSearch={() => setSearchQuery('')}
                onFilterToggle={() => setShowFilters(prev => !prev)}
                isFilterActive={showFilters}
                hasActiveFilters={filterStatus !== 'all' || filterBranch !== 'all' || filterPaymentMethod !== 'all'}
                onClearFilters={() => {
                  setFilterStatus('all');
                  setFilterBranch('all');
                  setFilterPaymentMethod('all');
                  setSearchQuery('');
                }}
                searchPlaceholder="Cari kode transaksi..."
                className="mb-3"
              />

              <FilterPanel visible={showFilters} className="mb-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Status Pembayaran</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Semua Status</option>
                      <option value="lunas">Lunas</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Cabang</label>
                    <select
                      value={filterBranch}
                      onChange={(e) => setFilterBranch(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Semua Cabang</option>
                      {branches.map((branch, index) => (
                        <option key={`${branch.id_cabang ?? branch.nama_cabang}-${index}`} value={branch.nama_cabang}>
                          {branch.nama_cabang}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Metode Pembayaran</label>
                    <select
                      value={filterPaymentMethod}
                      onChange={(e) => setFilterPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Semua Metode</option>
                      {paymentMethods.map((method, index) => (
                        <option key={`${method.id_metode_pembayaran ?? method.nama_metode}-${index}`} value={method.nama_metode}>
                          {method.nama_metode}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </FilterPanel>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kode Transaksi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tanggal
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cabang
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Metode Pembayaran
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kurang
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Retur
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Void
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedSales.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-8 text-center text-sm text-gray-500">
                        <div className="space-y-2">
                          <p className="text-base font-semibold text-gray-900">Tidak ada data penjualan</p>
                          <p className="text-sm text-gray-500">Coba cek pengaturan filter atau lakukan refresh untuk memuat ulang data.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedSales.map((sale) => (
                      <tr key={sale.id_penjualan} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {sale.kode_transaksi}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(sale.tanggal).toLocaleDateString('id-ID')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {sale.Cabang?.nama_cabang || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {getPaymentMethodLabel(sale) || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          Rp {Number(sale.total || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          Rp {Number(getRemainingPayment(sale) || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getPaymentStatus(sale) === 'pending' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Lunas
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {hasReturns(sale.id_penjualan) ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                              {getReturnCount(sale.id_penjualan)} Retur
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {sale.voided_at ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                              Void
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <ActionButton
                              icon={Printer}
                              variant="primary"
                              title="Cetak struk transaksi"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const saleResponse = await getSaleById(sale.id_penjualan);
                                  const enrichedSale = await enrichSaleWithPaymentDetails(saleResponse.data.data);
                                  
                                  const productMap = products.reduce((map, prod) => {
                                    map[prod.id_produk] = prod.nama_produk;
                                    return map;
                                  }, {});
                                  
                                  const enrichedItems = (saleResponse.data.data?.items || []).map((item) => ({
                                    ...item,
                                    nama_produk: item.nama_produk || productMap[item.id_produk] || `Produk (ID: ${item.id_produk})`,
                                  }));
                                  
                                  const detail_pembayaran = enrichedSale?.detail_pembayaran || null;

                                  const saleData = {
                                    ...saleResponse.data.data,
                                    items: enrichedItems,
                                    detail_pembayaran: detail_pembayaran && detail_pembayaran.length > 0 ? detail_pembayaran : null,
                                    kasir: saleResponse.data.data.User?.nama_lengkap || saleResponse.data.data.User?.nama || 'Unknown',
                                    no_struk: saleResponse.data.data.kode_transaksi,
                                    bayar: (detail_pembayaran || []).reduce((sum, p) => sum + Number(p.jumlah_bayar || 0), 0),
                                    kembali: Math.max(0, (detail_pembayaran || []).reduce((sum, p) => sum + Number(p.jumlah_bayar || 0), 0) - Number(saleResponse.data.data.total || 0)),
                                    sisa_pembayaran: Math.max(0, Number(saleResponse.data.data.total || 0) - (detail_pembayaran || []).reduce((sum, p) => sum + Number(p.jumlah_bayar || 0), 0)),
                                  };

                                  setSelectedSaleForPrint(saleData);
                                  setIsModalOpen(true);
                                } catch (_err) {
                                  showError('Gagal mengambil detail transaksi untuk dicetak');
                                }
                              }}
                            />
                            {(sale.status_pembayaran === 'pending' || sale.status_pembayaran === 'menunggu' || getPaymentStatus(sale) === 'pending') && (
                              <ActionButton
                                icon={CheckCircle}
                                variant="success"
                                title="Selesaikan pembayaran pending"
                                size="sm"
                                onClick={() => {
                                  setSelectedSaleForComplete(sale);
                                  setIsCompleteModalOpen(true);
                                }}
                              />
                            )}
                            {canVoidSales() && !sale.voided_at && (
                              <ActionButton
                                icon={XCircle}
                                variant="danger"
                                title="Void transaksi ini"
                                size="sm"
                                onClick={() => {
                                  setSelectedSaleForVoid(sale);
                                  setIsVoidModalOpen(true);
                                }}
                              />
                            )}
                            {hasReturns(sale.id_penjualan) && (
                              <ActionButton
                                icon={RotateCcw}
                                variant="orange"
                                title="Lihat detail retur penjualan"
                                size="sm"
                                onClick={() => navigate(`/return?id=${sale.id_penjualan}`)}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
                itemsPerPage={itemsPerPage}
                totalItems={filteredSales.length}
                showInfo={true}
              />
            </div>
          </div>
        </div>

        {/* Modal untuk Pratinjau Cetak */}
        {isModalOpen && (
          <TransactionSuccessModal
            transactionData={selectedSaleForPrint}
            storeInfo={storeInfo}
            printerSettings={user}
            onDone={() => {
              setIsModalOpen(false);
              setSelectedSaleForPrint(null); // Bersihkan data saat modal ditutup
            }}
          />
        )}

        {/* Modal untuk Complete Payment */}
        {isCompleteModalOpen && selectedSaleForComplete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Selesaikan Pembayaran Pending</h3>
              <p className="mb-4">Transaksi: {selectedSaleForComplete.kode_transaksi}</p>
              <p className="mb-4">Total: Rp {Number(selectedSaleForComplete.total).toLocaleString('id-ID')}</p>
              <p className="mb-4">Sisa: Rp {getRemainingPayment(selectedSaleForComplete).toLocaleString('id-ID')}</p>
              <PaymentAmountInput
                amount={additionalPayment}
                onChange={setAdditionalPayment}
                total={getRemainingPayment(selectedSaleForComplete)}
                placeholder="Masukkan jumlah pembayaran tambahan"
                maxAmount={getRemainingPayment(selectedSaleForComplete)}
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    setIsCompleteModalOpen(false);
                    setSelectedSaleForComplete(null);
                    setAdditionalPayment(0);
                  }}
                  title="Batalkan proses penyelesaian pembayaran"
                  className="flex-1 bg-gray-500 text-white py-2 rounded"
                >
                  Batal
                </button>
                <button
                  onClick={async () => {
                    if (additionalPayment <= 0) {
                      warning('Masukkan jumlah pembayaran yang valid.');
                      return;
                    }
                    
                    const remainingBeforePayment = getRemainingPayment(selectedSaleForComplete);
                    if (additionalPayment > remainingBeforePayment) {
                      warning('Jumlah pembayaran melebihi sisa yang harus dibayar.');
                      return;
                    }
                    
                    try {
                      // Tentukan status pembayaran berdasarkan apakah akan lunas setelah pembayaran ini
                      const willBeFullyPaid = additionalPayment >= remainingBeforePayment;
                      
                      await recordPayment(selectedSaleForComplete.id_penjualan, {
                        id_metode_pembayaran: 1, // Assume tunai
                        jumlah_bayar: additionalPayment,
                        nomor_referensi: '',
                        status_pembayaran: willBeFullyPaid ? 'lunas' : 'pending'
                      });
                      
                      showSuccess(willBeFullyPaid ? 'Pembayaran berhasil diselesaikan.' : 'Pembayaran berhasil dicatat, masih ada sisa pembayaran.');
                      // Refresh data (soft reload if handler available)
                      try {
                        const { safeReload } = await import('../utils/appRefresh');
                        safeReload('sales:after-complete-payment');
                      } catch (_e) {
                        window.location.reload();
                      }
                    } catch (_error) {
                      showError('Gagal menyelesaikan pembayaran');
                      showError('Gagal menyelesaikan pembayaran.');
                    }
                    setIsCompleteModalOpen(false);
                    setSelectedSaleForComplete(null);
                    setAdditionalPayment(0);
                  }}
                  title="Selesaikan pembayaran pending"
                  className="flex-1 bg-blue-500 text-white py-2 rounded"
                >
                  Selesaikan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal untuk Void Sale */}
        {isVoidModalOpen && selectedSaleForVoid && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Void Transaksi</h3>
              <p className="mb-4">Transaksi: {selectedSaleForVoid.kode_transaksi}</p>
              <p className="mb-4">Total: Rp {Number(selectedSaleForVoid.total).toLocaleString('id-ID')}</p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Alasan Void</label>
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Masukkan alasan void transaksi..."
                />
              </div>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={createReversal}
                    onChange={(e) => setCreateReversal(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Buat reversal untuk stok</span>
                </label>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    setIsVoidModalOpen(false);
                    setSelectedSaleForVoid(null);
                    setVoidReason('');
                    setCreateReversal(false);
                  }}
                  className="flex-1 bg-gray-500 text-white py-2 rounded"
                >
                  Batal
                </button>
                <button
                  onClick={handleVoidSale}
                  className="flex-1 bg-red-500 text-white py-2 rounded"
                >
                  Void Transaksi
                </button>
              </div>
            </div>
          </div>
        )}
      {isModalOpen && (
        <TransactionSuccessModal
          transactionData={selectedSaleForPrint}
          storeInfo={storeInfo}
          printerSettings={user}
          onDone={() => {
            setIsModalOpen(false);
            setSelectedSaleForPrint(null); // Bersihkan data saat modal ditutup
          }}
        />
      )}

      {/* Modal untuk Complete Payment */}
      {isCompleteModalOpen && selectedSaleForComplete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Selesaikan Pembayaran Pending</h3>
            <p className="mb-4">Transaksi: {selectedSaleForComplete.kode_transaksi}</p>
            <p className="mb-4">Total: Rp {Number(selectedSaleForComplete.total).toLocaleString('id-ID')}</p>
            <p className="mb-4">Sisa: Rp {getRemainingPayment(selectedSaleForComplete).toLocaleString('id-ID')}</p>
            <PaymentAmountInput
              amount={additionalPayment}
              onChange={setAdditionalPayment}
              total={getRemainingPayment(selectedSaleForComplete)}
              placeholder="Masukkan jumlah pembayaran tambahan"
              maxAmount={getRemainingPayment(selectedSaleForComplete)}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  setIsCompleteModalOpen(false);
                  setSelectedSaleForComplete(null);
                  setAdditionalPayment(0);
                }}
                className="flex-1 bg-gray-500 text-white py-2 rounded"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  if (additionalPayment <= 0) {
                    warning('Masukkan jumlah pembayaran yang valid.');
                    return;
                  }
                  
                  const remainingBeforePayment = getRemainingPayment(selectedSaleForComplete);
                  if (additionalPayment > remainingBeforePayment) {
                    warning('Jumlah pembayaran melebihi sisa yang harus dibayar.');
                    return;
                  }
                  
                  try {
                    // Tentukan status pembayaran berdasarkan apakah akan lunas setelah pembayaran ini
                    const willBeFullyPaid = additionalPayment >= remainingBeforePayment;
                    
                    await recordPayment(selectedSaleForComplete.id_penjualan, {
                      id_metode_pembayaran: 1, // Assume tunai
                      jumlah_bayar: additionalPayment,
                      nomor_referensi: '',
                      status_pembayaran: willBeFullyPaid ? 'lunas' : 'pending'
                    });
                    
                    showSuccess(willBeFullyPaid ? 'Pembayaran berhasil diselesaikan.' : 'Pembayaran berhasil dicatat, masih ada sisa pembayaran.');
                    // Refresh data (soft reload if handler available)
                    try {
                      const { safeReload } = await import('../utils/appRefresh');
                      safeReload('sales:after-complete-payment');
                    } catch (_e) {
                      window.location.reload();
                    }
                  } catch (_error) {
                    showError('Gagal menyelesaikan pembayaran');
                    showError('Gagal menyelesaikan pembayaran.');
                  }
                  setIsCompleteModalOpen(false);
                  setSelectedSaleForComplete(null);
                  setAdditionalPayment(0);
                }}
                className="flex-1 bg-blue-500 text-white py-2 rounded"
              >
                Selesaikan
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Modal untuk Void Sale */}
        {isVoidModalOpen && selectedSaleForVoid && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Void Transaksi</h3>
              <p className="mb-4">Transaksi: {selectedSaleForVoid.kode_transaksi}</p>
              <p className="mb-4">Total: Rp {Number(selectedSaleForVoid.total).toLocaleString('id-ID')}</p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Alasan Void</label>
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Masukkan alasan void transaksi..."
                />
              </div>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={createReversal}
                    onChange={(e) => setCreateReversal(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Buat reversal untuk stok</span>
                </label>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    setIsVoidModalOpen(false);
                    setSelectedSaleForVoid(null);
                    setVoidReason('');
                    setCreateReversal(false);
                  }}
                  title="Batalkan proses void"
                  className="flex-1 bg-gray-500 text-white py-2 rounded"
                >
                  Batal
                </button>
                <button
                  onClick={handleVoidSale}
                  title="Void transaksi ini"
                  className="flex-1 bg-red-500 text-white py-2 rounded"
                >
                  Void Transaksi
                </button>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </PageLayout>
  );
};

const SalesListPageWithErrorBoundary = withErrorBoundary(SalesListPage, 'SalesListPage');

export default SalesListPageWithErrorBoundary;