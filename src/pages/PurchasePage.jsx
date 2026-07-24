import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPurchases, getPurchaseById, getSuppliers, getBranches, getProducts } from '../services/api';
import { formatCurrency } from '../utils/formatHelper';
import { UniversalPrintModal, PRINT_TYPES } from '../components/UniversalPrintModal';
import DataTable from '../components/DataTable';
import { useSettings } from '../context/SettingsContext';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import ResponsiveTable from '../components/common/ResponsiveTable';
import HeaderActionButton from '../components/HeaderActionButton';
import { Eye, Printer, Plus, History } from 'lucide-react';

const PurchasePage = () => {
  const { storeInfo } = useSettings();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [suppliersMap, setSuppliersMap] = useState({});
  const [branchesMap, setBranchesMap] = useState({});
  const [productsMap, setProductsMap] = useState({});
  
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [purchaseForPrint, setPurchaseForPrint] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F9') {
        e.preventDefault();
        e.stopPropagation();
        navigate('/pos');
        return;
      }

      if (e.key === 'F10') {
        e.preventDefault();
        e.stopPropagation();
        navigate('/pembelian');
        return;
      }

      if (e.key === 'F11') {
        e.preventDefault();
        e.stopPropagation();
        navigate('/penjualan');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [navigate]);

  // Helper function untuk mendapatkan nama supplier dari berbagai format API response
  const getSupplierName = (purchase) => {
    if (!purchase) return '-';
    const name = purchase.Supplier?.nama_supplier 
      || purchase.supplier?.nama_supplier 
      || purchase.supplier 
      || purchase.nama_supplier 
      || purchase.supplier_name 
      || (purchase.id_supplier && suppliersMap[purchase.id_supplier])
      || (purchase.id_supplier && suppliersMap[String(purchase.id_supplier)])
      || '-';
    return String(name || '-').trim();
  };

  // Helper function untuk mendapatkan nama tujuan/cabang dari berbagai format API response
  const getDestinationName = (purchase) => {
    if (!purchase) return '-';
    const name = purchase.Cabang?.nama_cabang 
      || purchase.cabang?.nama_cabang 
      || purchase.cabang 
      || purchase.tujuan 
      || purchase.destination 
      || purchase.nama_cabang 
      || (purchase.id_cabang && branchesMap[purchase.id_cabang])
      || (purchase.id_cabang && branchesMap[String(purchase.id_cabang)])
      || '-';
    return String(name || '-').trim();
  };

  // Helper to resolve product name from an item
  const getProductName = (item) => {
    if (!item) return '-';
    const name = item.nama_produk || item.Produk?.nama_produk || item.product_name || item.product?.nama_produk || item.nama || '-';
    if (name && String(name).trim() !== '') return String(name).trim();
    // fallback to productsMap using id_produk or id_product
    const id = item.id_produk || item.id_product || item.product_id || item.id;
    if (id) {
      if (productsMap[id]) return String(productsMap[id]).trim();
      if (productsMap[String(id)]) return String(productsMap[String(id)]).trim();
      if (productsMap[Number(id)]) return String(productsMap[Number(id)]).trim();
    }
    return '-';
  };

  // Fetch purchases on mount
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

        if (import.meta.env.DEV) void 0 && ('Purchases API response:', data);
        if (data.length > 0 && import.meta.env.DEV) void 0 && ('First purchase structure:', data[0]);

        const normalized = data.map(p => ({ ...p, tanggal: p.tanggal || p.created_at || p.createdAt }));
        setPurchases(normalized.reverse());
      } catch (err) {
        console.error('Failed to load purchases', err);
        setError('Gagal memuat data pembelian.');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  // Load supplier & branch master data to resolve names when purchase objects only contain IDs
  useEffect(() => {
    const fetchMasters = async () => {
      try {
        let suppliersData = [];
        let branchesData = [];
        let productsData = [];

        // Try API first for all master data
        try {
          const [supRes, brRes, prodRes] = await Promise.all([getSuppliers(), getBranches(), getProducts({ limit: 1000 })]); // Limit products for dropdown performance
          suppliersData = supRes.data?.data || supRes.data || [];
          branchesData = brRes.data?.data || brRes.data || [];
          productsData = prodRes.data?.data || prodRes.data || [];
        } catch (_apiError) {
          // Fallback to local database for products and suppliers
          if (window.electronAPI?.dbSelect) {
            try {
              const localProducts = await window.electronAPI.dbSelect({
                table: 'products',
                whereClause: '1=1',
                whereValues: []
              });
              if (localProducts && Array.isArray(localProducts)) {
                productsData = localProducts;
              }

              const localSuppliers = await window.electronAPI.dbSelect({
                table: 'supplier',
                whereClause: '1=1',
                whereValues: []
              });
              if (localSuppliers && Array.isArray(localSuppliers)) {
                suppliersData = localSuppliers;
              }
            } catch (_localError) {
              if (import.meta.env.DEV) {
              }
            }
          }

          // For branches, use empty arrays since we don't store them locally
          branchesData = [];
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
        console.error('Failed to load suppliers/branches/products', err);
      }
    };
    fetchMasters();
  }, []);

  // Note: analytics will be computed from the filtered list below so cards respect active filters

  // Open detail modal
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

  const closeDetail = () => setSelectedPurchase(null);

  const handlePrint = (purchase) => {
    const resolvedPurchase = {
      ...purchase,
      Supplier: { nama_supplier: getSupplierName(purchase) },
      Cabang: { nama_cabang: getDestinationName(purchase) }
    };
    setPurchaseForPrint(resolvedPurchase);
    setShowPrintModal(true);
  };

  // Summary metrics computed from purchases list (DataTable handles filtering internally)
  const totalPurchases = purchases.length;
  const totalAmount = purchases.reduce((sum, p) => sum + Number(p.total || p.grand_total || 0), 0);
  const avgAmount = totalPurchases > 0 ? Math.round(totalAmount / totalPurchases) : 0;
  const uniqueSuppliers = new Set(purchases.map(p => getSupplierName(p).trim())).size;
  
  const now = new Date();
  const purchasesLast7Days = purchases.filter(p => {
    const d = new Date(p.tanggal || p.created_at || p.createdAt);
    if (isNaN(d)) return false;
    const diff = (now - d) / (1000 * 60 * 60 * 24);
    return diff <= 7 && diff >= 0;
  }).length;
  
  const purchasesLast30Days = purchases.filter(p => {
    const d = new Date(p.tanggal || p.created_at || p.createdAt);
    if (isNaN(d)) return false;
    const diff = (now - d) / (1000 * 60 * 60 * 24);
    return diff <= 30 && diff >= 0;
  }).length;

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Manajemen Pembelian"
          subtitle="Dashboard analisa pembelian dan manajemen transaksi"
          actions={
            <div className="flex gap-2">
              <HeaderActionButton
                icon={Plus}
                label="Tambah"
                variant="blue"
                to="/pembelian/tambah"
                isLink
                hideLabel={true}
              />
              <HeaderActionButton
                icon={History}
                label="Riwayat"
                variant="emerald"
                to="/pembelian/history"
                isLink
                hideLabel={true}
              />
            </div>
          }
        />

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="p-4 bg-white rounded-lg shadow">
          <div className="text-xs text-gray-500 uppercase font-semibold">Total Pembelian</div>
          <div className="text-3xl font-bold mt-2">{totalPurchases}</div>
        </div>
        <div className="p-4 bg-white rounded-lg shadow">
          <div className="text-xs text-gray-500 uppercase font-semibold">Total Pengeluaran</div>
          <div className="text-2xl font-bold mt-2">Rp {Number(totalAmount).toLocaleString('id-ID')}</div>
        </div>
        <div className="p-4 bg-white rounded-lg shadow">
          <div className="text-xs text-gray-500 uppercase font-semibold">Rata-rata / Transaksi</div>
          <div className="text-2xl font-bold mt-2">Rp {Number(avgAmount).toLocaleString('id-ID')}</div>
        </div>
        <div className="p-4 bg-white rounded-lg shadow">
          <div className="text-xs text-gray-500 uppercase font-semibold">Supplier (7 hari)</div>
          <div className="text-2xl font-bold mt-2">{purchasesLast7Days}</div>
        </div>
        <div className="p-4 bg-white rounded-lg shadow">
          <div className="text-xs text-gray-500 uppercase font-semibold">Supplier (30 hari)</div>
          <div className="text-2xl font-bold mt-2">{purchasesLast30Days} / {uniqueSuppliers}</div>
        </div>
      </div>

      {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Data Table */}
        <DataTable
          data={purchases}
          loading={loading}
          error={error}
          searchKeys={['kode_pembelian', 'nama_supplier', 'supplier', 'tujuan', 'nama_cabang', 'supplier_name']}
          columns={[
            {
              key: 'kode_pembelian',
              header: 'Kode Pembelian',
              render: (purchase) => purchase.kode_pembelian || purchase.id
            },
            {
              key: 'tanggal',
              header: 'Tanggal',
              render: (purchase) => new Date(purchase.tanggal || purchase.created_at || purchase.createdAt).toLocaleDateString('id-ID')
            },
            {
              key: 'supplier',
              header: 'Supplier',
              render: (purchase) => getSupplierName(purchase)
            },
            {
              key: 'tujuan',
              header: 'Tujuan',
              render: (purchase) => getDestinationName(purchase)
            },
            {
              key: 'total',
              header: 'Total',
              render: (purchase) => `Rp ${Number(purchase.total || purchase.grand_total || 0).toLocaleString('id-ID')}`
            }
          ]}
          actions={[
            {
              icon: Eye,
              title: 'Lihat Detail',
              onClick: (purchase) => openDetail(purchase.id_pembelian || purchase.id),
              variant: 'primary',
              size: 'sm'
            },
            {
              icon: Printer,
              title: 'Cetak',
              onClick: (purchase) => handlePrint(purchase),
              variant: 'success',
              size: 'sm'
            }
          ]}
          filters={[
            {
              key: 'tanggal',
              label: 'Tanggal',
              type: 'date',
              placeholder: 'Pilih tanggal...'
            },
            {
              key: 'supplier',
              label: 'Supplier',
              type: 'text',
              placeholder: 'Nama supplier...'
            },
            {
              key: 'tujuan',
              label: 'Tujuan',
              type: 'text',
              placeholder: 'Tujuan pengiriman...'
            }
          ]}
          searchPlaceholder="Cari pembelian berdasarkan kode..."
          emptyMessage="Tidak ada data pembelian"
          loadingMessage="Memuat data..."
          itemsPerPage={20}
          alwaysShowPagination={true}
        />

        {/* Detail Modal */}
        {selectedPurchase && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-2xl shadow-xl overflow-hidden">
              {/* Modal Header */}
              <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Detail Pembelian</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePrint(selectedPurchase)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition"
                  >
                    Cetak
                  </button>
                  <button
                    onClick={closeDetail}
                    className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-md text-sm font-medium transition"
                  >
                    Tutup
                  </button>
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

        {/* Print Modal */}
        {showPrintModal && (
          <UniversalPrintModal
            isOpen={showPrintModal}
            onClose={() => {
              setShowPrintModal(false);
              setPurchaseForPrint(null);
            }}
            printType={PRINT_TYPES.PURCHASE_RECEIPT}
            data={purchaseForPrint}
            storeInfo={storeInfo}
          />
        )}
      </PageContainer>
    </PageLayout>
  );
};

export default PurchasePage;