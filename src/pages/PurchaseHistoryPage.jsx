import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPurchases, getPurchaseById, getSuppliers, getBranches, getProducts } from '../services/api';
import { formatCurrency } from '../utils/formatHelper';
import { useSettings } from '../context/SettingsContext';
import { exportToExcel } from '../utils/exportHelper';
import { UniversalPrintModal, PRINT_TYPES } from '../components/UniversalPrintModal';
import ResponsiveTable from '../components/common/ResponsiveTable';
import { SearchFilterBar, FilterPanel } from '../components/SearchFilterBar';
import useSearchAndFilter from '../hooks/useSearchAndFilter';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import ActionButton from '../components/ActionButton';
import DropdownActionMenu from '../components/common/DropdownActionMenu';
import HeaderActionButton from '../components/HeaderActionButton';
import { FileText, ArrowLeft, Eye, Printer, X, Download } from 'lucide-react';

const PurchaseHistoryPage = () => {
  const { storeInfo } = useSettings();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [suppliersMap, setSuppliersMap] = useState({});
  const [branchesMap, setBranchesMap] = useState({});
  const [productsMap, setProductsMap] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [purchaseDataForPrint, setPurchaseDataForPrint] = useState(null);
  
  useEffect(() => {
    const fetch = async () => {
      try {
        let data = [];

        // Try API first
        try {
          const res = await getPurchases();
          data = res.data?.data || res.data || [];
        } catch (_apiError) {
          // Fallback to local database if available
          if (window.electronAPI?.dbSelect) {
            try {
              const localPurchases = await window.electronAPI.dbSelect({
                table: 'purchases',
                whereClause: '1=1',
                orderBy: 'tanggal DESC'
              });

              // Enrich purchase data with items
              for (const purchase of localPurchases) {
                const items = await window.electronAPI.dbSelect({
                  table: 'purchase_items',
                  whereClause: 'id_pembelian = ?',
                  whereValues: [purchase.id_pembelian]
                });
                purchase.items = items;
              }

              data = localPurchases;
            } catch (_dbError) {
              if (import.meta.env.DEV) void 0 && ('Failed to load purchases from local db');
            }
          }
        }

        const normalized = data.map(p => ({ ...p, tanggal: p.tanggal || p.created_at || p.createdAt }));
        setPurchases(normalized.reverse());
      } catch (err) {
        console.error('Failed to load purchases', err);
        setError('Gagal memuat daftar pembelian.');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  // fetch masters to resolve names when only IDs are present
  useEffect(() => {
    const fetchMasters = async () => {
      try {
        let suppliersData = [];
        let branchesData = [];
        let productsData = [];

        // Try API first for all master data
        try {
          const [supRes, brRes, prodRes] = await Promise.all([
            getSuppliers(),
            getBranches(),
            getProducts({ limit: 1000 })
          ]); // Limit products for dropdown performance
          suppliersData = supRes.data?.data || supRes.data || [];
          branchesData = brRes.data?.data || brRes.data || [];
          productsData = prodRes.data?.data || prodRes.data || [];
        } catch (_apiError) {
          // Fallback to local database for all master data
          try {
            if (window.electronAPI?.dbSelect) {
              const localProducts = await window.electronAPI.dbSelect({
                table: 'products',
                whereClause: '1=1',
                whereValues: []
              });
              if (Array.isArray(localProducts)) productsData = localProducts;

              const localSuppliers = await window.electronAPI.dbSelect({
                table: 'supplier',
                whereClause: '1=1',
                whereValues: []
              });
              if (Array.isArray(localSuppliers)) suppliersData = localSuppliers;

              // branches likely not available locally
              branchesData = [];
            }
          } catch (_localError) {
            if (import.meta.env.DEV) void 0 && ('Failed to load masters from local db');
          }
        }

        const sMap = {};
        suppliersData.forEach(s => { if (s?.id_supplier) sMap[s.id_supplier] = s.nama_supplier; });
        const bMap = {};
        branchesData.forEach(b => { if (b?.id_cabang) bMap[b.id_cabang] = b.nama_cabang; });
        const pMap = {};
        productsData.forEach(p => { if (p?.id_produk) pMap[p.id_produk] = p.nama_produk; });
        setSuppliersMap(sMap);
        setBranchesMap(bMap);
        setProductsMap(pMap);
      } catch (err) {
        console.error('Failed to load masters for purchase history', err);
      }
    };
    fetchMasters();
  }, []);

  // Helper function untuk mendapatkan nama supplier dari berbagai format API response
  const getSupplierName = (purchase) => {
    if (!purchase) return '-';
    return purchase.Supplier?.nama_supplier 
      || purchase.supplier?.nama_supplier 
      || purchase.supplier 
      || purchase.nama_supplier 
      || purchase.supplier_name 
      || (purchase.id_supplier && suppliersMap[purchase.id_supplier])
      || (purchase.id_supplier && suppliersMap[String(purchase.id_supplier)])
      || '-';
  };

  // Helper function untuk mendapatkan nama tujuan/cabang dari berbagai format API response
  const getDestinationName = (purchase) => {
    if (!purchase) return '-';
    return purchase.Cabang?.nama_cabang 
      || purchase.cabang?.nama_cabang 
      || purchase.cabang 
      || purchase.tujuan 
      || purchase.destination 
      || purchase.nama_cabang 
      || (purchase.id_cabang && branchesMap[purchase.id_cabang])
      || (purchase.id_cabang && branchesMap[String(purchase.id_cabang)])
      || '-';
  };

  const getProductName = (item) => {
    if (!item) return '-';
    const name = item.nama_produk || item.Produk?.nama_produk || item.product_name || item.product?.nama_produk || item.nama || '-';
    if (name && String(name).trim() !== '') return String(name).trim();
    const id = item.id_produk || item.id_product || item.product_id || item.id;
    if (id) {
      if (productsMap[id]) return String(productsMap[id]).trim();
      if (productsMap[String(id)]) return String(productsMap[String(id)]).trim();
      if (productsMap[Number(id)]) return String(productsMap[Number(id)]).trim();
    }
    return '-';
  };

  const closeDetail = () => setSelectedPurchase(null);

  const handlePrint = (purchase) => {
    setPurchaseDataForPrint(purchase);
    setShowPrintModal(true);
  };

  // Open detail modal (fetch detail by id)
  const openDetail = async (id) => {
    try {
      const res = await getPurchaseById(id);
      const data = res.data?.data || res.data || null;
      setSelectedPurchase(data);
    } catch (err) {
      console.error('Failed to fetch purchase detail', err);
      setError('Gagal memuat detail pembelian.');
    }
  };

  const applyDateFilter = (items) => {
    if (!filterStart && !filterEnd) return items;
    const start = filterStart ? new Date(filterStart) : null;
    const end = filterEnd ? new Date(filterEnd) : null;
    return items.filter(p => {
      const d = new Date(p.tanggal || p.created_at || p.createdAt);
      if (isNaN(d)) return false;
      if (start && d < start) return false;
      if (end) {
        // include whole day
        const endOfDay = new Date(end);
        endOfDay.setHours(23,59,59,999);
        if (d > endOfDay) return false;
      }
      return true;
    });
  };

  const { filteredItems: searchedPurchases } = useSearchAndFilter(purchases, {
    searchTerm: searchQuery,
    searchKeys: [
      'kode_pembelian',
      'no_struk',
      'supplier.nama_supplier',
      'supplier_name',
      'nama_supplier',
      'cabang.nama_cabang',
      'tujuan',
      'destination',
    ],
    debounceDelay: 300,
  });

  const filteredPurchases = applyDateFilter(searchedPurchases);

  const exportCSV = async () => {
    const filtered = filteredPurchases;
    
    // Prepare data untuk export
    const exportData = filtered.map(p => ({
      'No. Pembelian': p.kode_pembelian || p.no_struk || p.id || '',
      'Tanggal': new Date(p.tanggal || p.created_at || p.createdAt).toLocaleDateString('id-ID'),
      'Supplier': getSupplierName(p),
      'Tujuan': getDestinationName(p),
      'Total': p.total || p.grand_total || p.total_belanja || 0,
      'Status': p.masuk_gudang ? 'Masuk Gudang' : 'Kirim Cabang'
    }));
    
    if (exportData.length === 0) {
      alert('Tidak ada data untuk diexport.');
      return;
    }
    
    try {
      await exportToExcel(exportData, `pembelian_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
      console.error('Export error:', err);
      alert('Gagal mengekspor data ke Excel. Cek console untuk detail.');
    }
  };

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Riwayat Pembelian"
          subtitle="Lihat, filter, dan cetak riwayat pembelian dengan cepat."
          actions={
            <div className="flex gap-2">
              <HeaderActionButton
                icon={Download}
                label="Excel"
                variant="emerald"
                onClick={exportCSV}
                hideLabel={true}
              />
              <HeaderActionButton
                icon={ArrowLeft}
                label="Kembali"
                variant="gray"
                to="/pembelian"
                isLink
                hideLabel={true}
              />
            </div>
          }
        />

        {error && <div className="text-red-600 mb-4">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Total Pembelian</p>
            <p className="text-2xl font-bold text-gray-900">{purchases.length.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Hasil Filter</p>
            <p className="text-2xl font-bold text-blue-600">{filteredPurchases.length.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Periode</p>
            <p className="text-base text-gray-900">
              {filterStart || filterEnd ? `${filterStart || 'Awal'} — ${filterEnd || 'Akhir'}` : 'Semua waktu'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="p-6">
            <SearchFilterBar
              searchTerm={searchQuery}
              onSearchChange={setSearchQuery}
              onClearSearch={() => setSearchQuery('')}
              onFilterToggle={() => setShowFilters((prev) => !prev)}
              isFilterActive={showFilters}
              hasActiveFilters={Boolean(searchQuery || filterStart || filterEnd)}
              onClearFilters={() => {
                setSearchQuery('');
                setFilterStart('');
                setFilterEnd('');
              }}
              searchPlaceholder="Cari nomor, supplier, atau tujuan..."
              className="mb-4"
            />

            <FilterPanel visible={showFilters} className="mb-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Dari</label>
                  <input
                    type="date"
                    value={filterStart}
                    onChange={(e) => setFilterStart(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Sampai</label>
                  <input
                    type="date"
                    value={filterEnd}
                    onChange={(e) => setFilterEnd(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </FilterPanel>

            <ResponsiveTable>
              <table className="min-w-full divide-y divide-gray-200 bg-white">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">No. Pembelian</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">Tanggal</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">Supplier</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">Tujuan</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">Memuat...</td>
                    </tr>
                  ) : filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">Tidak ada data pembelian.</td>
                    </tr>
                  ) : (
                    filteredPurchases.map((p) => (
                      <tr key={p.id_pembelian || p.id || p.kode_pembelian || p.no_struk} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{p.kode_pembelian || p.no_struk || p.id}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{new Date(p.tanggal || p.created_at || p.createdAt).toLocaleString('id-ID')}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 text-right">Rp {formatCurrency(p.total || p.grand_total || 0)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{getSupplierName(p)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{getDestinationName(p)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                          <DropdownActionMenu
                            item={p}
                            actions={[
                              {
                                icon: Eye,
                                title: 'Lihat Detail',
                                onClick: (item) => openDetail(item.id_pembelian || item.id),
                                variant: 'gray'
                              },
                              {
                                icon: Printer,
                                title: 'Cetak Struk',
                                onClick: (item) => handlePrint(item),
                                variant: 'success'
                              }
                            ]}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ResponsiveTable>
          </div>
        </div>

        {selectedPurchase && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-2xl shadow-xl overflow-hidden">
              {/* Modal Header */}
              <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Detail Pembelian</h3>
                </div>
                <div className="flex gap-2">
                  <ActionButton
                    icon={Printer}
                    variant="primary"
                    title="Cetak struk pembelian"
                    onClick={() => handlePrint(selectedPurchase)}
                  />
                  <ActionButton
                    icon={X}
                    variant="gray"
                    title="Tutup modal"
                    onClick={closeDetail}
                  />
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">No. Pembelian</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedPurchase.kode_pembelian || selectedPurchase.id}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tanggal</p>
                    <p className="text-sm font-semibold text-gray-900">{new Date(selectedPurchase.tanggal || selectedPurchase.created_at || selectedPurchase.createdAt).toLocaleDateString('id-ID')}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Supplier</p>
                    <p className="text-sm font-semibold text-gray-900">{getSupplierName(selectedPurchase)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tujuan</p>
                    <p className="text-sm font-semibold text-gray-900">{getDestinationName(selectedPurchase)}</p>
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full border-collapse mb-6">
                  <thead>
                    <tr className="border-b border-gray-300 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 w-10">No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Produk</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 w-20">Jumlah</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 w-24">Harga</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 w-28">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedPurchase.items || []).length > 0 ? (
                      selectedPurchase.items.map((it, idx) => {
                        const qty = Number(it.jumlah || it.qty || 0);
                        const price = Number(it.harga_beli || it.harga || it.harga_jual || 0);
                        return (
                          <tr key={idx} className="border-b border-gray-200">
                            <td className="px-4 py-3 text-sm text-gray-900">{idx + 1}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{getProductName(it)}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">{qty}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">Rp {formatCurrency(price)}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">Rp {formatCurrency(qty * price)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">Tidak ada item pembelian</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Summary */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between mb-3">
                    <p className="text-sm text-gray-600">Jumlah item:</p>
                    <p className="text-sm font-semibold text-gray-900">{(selectedPurchase.items || []).length}</p>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-4">
                    <p className="text-sm font-semibold text-gray-900">Total Pembelian:</p>
                    <p className="text-lg font-bold text-gray-900">Rp {formatCurrency(selectedPurchase.total || selectedPurchase.grand_total || 0)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showPrintModal && (
          <UniversalPrintModal
            isOpen={showPrintModal}
            onClose={() => {
              setShowPrintModal(false);
              setPurchaseDataForPrint(null);
            }}
            printType={PRINT_TYPES.PURCHASE_RECEIPT}
            data={purchaseDataForPrint}
            storeInfo={storeInfo}
          />
        )}
      </PageContainer>
    </PageLayout>
  );
};

export default PurchaseHistoryPage;
