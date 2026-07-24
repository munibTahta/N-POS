import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getStockHistory } from '../services/api';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import DataTable from '../components/DataTable';
import { SearchFilterBar, FilterPanel, FilterPanelGrid, FilterField } from '../components/SearchFilterBar';
import { ArrowLeft, TrendingUp, TrendingDown, Package } from 'lucide-react';

const StockHistoryPage = () => {
  const { id_cabang, id_produk } = useParams();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [produkInfo, setProdukInfo] = useState(null);
  const [cabangInfo, setCabangInfo] = useState(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await getStockHistory(id_cabang, id_produk);
        const historyData = response.data.data || [];
        setHistory(historyData);
        
        // Extract product and branch info from first record if available
        if (historyData.length > 0) {
          const firstRecord = historyData[0];
          if (firstRecord.Produk) {
            setProdukInfo(firstRecord.Produk);
          }
          if (firstRecord.Cabang) {
            setCabangInfo(firstRecord.Cabang);
          }
        }
        setError('');
      } catch {
        setError('Gagal memuat riwayat stok.');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [id_cabang, id_produk]);

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const formatTime = (dateString) => {
    try {
      return new Date(dateString).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  // Filter logic
  const filteredHistory = useMemo(() => {
    return history.filter(log => {
      // Type filter
      if (filterType !== 'all' && log.tipe !== filterType) {
        return false;
      }

      // Date range filter
      if (filterDateFrom || filterDateTo) {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        if (filterDateFrom && logDate < filterDateFrom) return false;
        if (filterDateTo && logDate > filterDateTo) return false;
      }

      // Search filter (keterangan)
      if (searchTerm && !log.keterangan?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [history, filterType, filterDateFrom, filterDateTo, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const totalIn = filteredHistory.reduce((sum, log) => sum + (log.jumlah_ubah > 0 ? log.jumlah_ubah : 0), 0);
    const totalOut = filteredHistory.reduce((sum, log) => sum + (log.jumlah_ubah < 0 ? Math.abs(log.jumlah_ubah) : 0), 0);
    return { totalIn, totalOut, net: totalIn - totalOut };
  }, [filteredHistory]);

  const typeOptions = [
    { value: 'all', label: 'Semua Tipe' },
    { value: 'pembelian', label: 'Pembelian' },
    { value: 'penjualan', label: 'Penjualan' },
    { value: 'penyesuaian', label: 'Penyesuaian' },
    { value: 'transfer_keluar', label: 'Transfer Keluar' },
    { value: 'transfer_masuk', label: 'Transfer Masuk' }
  ];

  const getTypeBadge = (tipe) => {
    const badges = {
      pembelian: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Pembelian' },
      penjualan: { bg: 'bg-green-100', text: 'text-green-800', label: 'Penjualan' },
      penyesuaian: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Penyesuaian' },
      transfer_keluar: { bg: 'bg-red-100', text: 'text-red-800', label: 'Transfer Keluar' },
      transfer_masuk: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Transfer Masuk' }
    };
    const badge = badges[tipe] || { bg: 'bg-gray-100', text: 'text-gray-800', label: tipe };
    return badge;
  };

  if (loading) return <div className="text-center mt-10">Loading...</div>;

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Riwayat Stok"
          subtitle={`Produk: ${produkInfo?.nama_produk || `ID: ${id_produk}`} (${produkInfo?.kode_produk || 'N/A'}) • Cabang: ${cabangInfo?.nama_cabang || `ID: ${id_cabang}`}`}
          actions={
            <button
              onClick={() => navigate('/stok')}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white text-xs sm:text-sm font-semibold px-3 py-2 hover:bg-slate-800 transition"
              title="Kembali ke Manajemen Stok"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Kembali</span>
            </button>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">Total Masuk</p>
                <p className="text-2xl font-bold text-green-600">{stats.totalIn}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">Total Keluar</p>
                <p className="text-2xl font-bold text-red-600">{stats.totalOut}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-500 opacity-50" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">Perubahan Bersih</p>
                <p className={`text-2xl font-bold ${stats.net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {stats.net >= 0 ? '+' : ''}{stats.net}
                </p>
              </div>
              <Package className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <SearchFilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onClearSearch={() => setSearchTerm('')}
            onFilterToggle={() => setShowFilters(prev => !prev)}
            isFilterActive={showFilters}
            hasActiveFilters={Boolean(filterType !== 'all' || filterDateFrom || filterDateTo)}
            onClearFilters={() => {
              setFilterType('all');
              setFilterDateFrom('');
              setFilterDateTo('');
            }}
            searchPlaceholder="Cari keterangan..."
            className="mb-4"
          />

          <FilterPanel visible={showFilters} className="space-y-4">
            <FilterPanelGrid cols={3}>
              <FilterField label="Tipe Transaksi">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {typeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Dari Tanggal">
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FilterField>

              <FilterField label="Sampai Tanggal">
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FilterField>
            </FilterPanelGrid>
          </FilterPanel>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Data Table */}
        <DataTable
          data={filteredHistory}
          loading={loading}
          showPagination={true}
          itemsPerPage={20}
          emptyMessage="Tidak ada riwayat stok"
          customSearchBar={<div></div>}
          columns={[
            {
              key: 'created_at',
              header: 'Tanggal & Waktu',
              render: (item) => (
                <div>
                  <div className="font-medium text-sm">{formatDate(item.created_at)}</div>
                  <div className="text-xs text-gray-600">{formatTime(item.created_at)}</div>
                </div>
              )
            },
            {
              key: 'tipe',
              header: 'Tipe',
              render: (item) => {
                const badge = getTypeBadge(item.tipe);
                return (
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                );
              }
            },
            {
              key: 'jumlah_ubah',
              header: 'Jumlah Ubah',
              render: (item) => (
                <div className="text-center">
                  <span className={`font-bold text-sm ${item.jumlah_ubah > 0 ? 'text-green-600' : item.jumlah_ubah < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {item.jumlah_ubah > 0 ? '+' : ''}{item.jumlah_ubah}
                  </span>
                </div>
              )
            },
            {
              key: 'stok_sebelum',
              header: 'Stok Sebelum',
              render: (item) => <div className="text-center text-sm font-medium">{item.stok_sebelum}</div>
            },
            {
              key: 'stok_sesudah',
              header: 'Stok Sesudah',
              render: (item) => <div className="text-center text-sm font-medium">{item.stok_sesudah}</div>
            },
            {
              key: 'keterangan',
              header: 'Keterangan',
              render: (item) => <div className="text-sm text-gray-700">{item.keterangan || '-'}</div>
            }
          ]}
          className="bg-white rounded-lg shadow-sm border border-gray-200"
        />
      </PageContainer>
    </PageLayout>
  );
};

export default StockHistoryPage;
