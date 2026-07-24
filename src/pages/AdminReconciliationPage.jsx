import React, { useState, useEffect } from 'react';
import { recordPayment, getIncompletePayments, getPaymentHistory } from '../services/api';
import { extractData } from '../utils/apiResponseHelper';
import { formatCurrency } from '../utils/formatHelper';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import { SearchFilterBar, FilterPanel } from '../components/SearchFilterBar';
import DropdownActionMenu from '../components/common/DropdownActionMenu';
import { Eye, CheckCircle } from 'lucide-react';

// SVG Icons
const ViewIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const SettleIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CloseIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const AdminReconciliationPage = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState('incomplete'); // 'incomplete' = incomplete payments, 'all' = all failed
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [retryPaymentModal, setRetryPaymentModal] = useState(false);
  const [retryData, setRetryData] = useState({ id_metode_pembayaran: 1, jumlah_bayar: 0, nomor_referensi: '' });
  const [paymentDetailModal, setPaymentDetailModal] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState([]);

  useEffect(() => {
    fetchIncompletePayments();
  }, []);

  const fetchIncompletePayments = async () => {
    try {
      setLoading(true);
      const res = await getIncompletePayments();
      const data = extractData(res);
      
      // Filter sales based on selection
      if (data && data.sales) {
        setSales(data.sales);
      }
    } catch (err) {
      console.error('Fetch incomplete payments error', err);
      setError('Gagal memuat daftar pembayaran tidak lengkap');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredSales = () => {
    let filtered = sales;

    // Filter by type
    if (filter === 'incomplete') {
      filtered = filtered.filter(sale => sale.sisaPembayaran > 0);
    } else if (filter === 'failed') {
      filtered = filtered.filter(sale => sale.hasFailedPayments);
    }

    // Exclude sales with pending payments that haven't been verified
    filtered = filtered.filter(sale => {
      if (!sale.detail_pembayaran || !Array.isArray(sale.detail_pembayaran)) return true;
      return !sale.detail_pembayaran.some(payment => 
        payment.status_pembayaran === 'pending' || 
        payment.verifikasi_status !== 'approved'
      );
    });

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(sale =>
        sale.kode_transaksi?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.User?.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.Cabang?.nama_cabang?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const handleRetryPayment = async () => {
    if (!selectedSale) return;
    try {
      await recordPayment(selectedSale.id_penjualan, retryData);
      setSuccess('Pembayaran berhasil dicatat');
      setRetryPaymentModal(false);
      setSelectedSale(null);
      await fetchIncompletePayments(); // Refresh data
    } catch (err) {
      setError('Gagal mencatat pembayaran: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleViewPaymentDetails = async (sale) => {
    try {
      const res = await getPaymentHistory(sale.id_penjualan);
      const details = extractData(res);
      setPaymentDetails(details || []);
      setSelectedSale(sale);
      setPaymentDetailModal(true);
    } catch (err) {
      setError('Gagal memuat detail pembayaran: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSettlePayment = (sale) => {
    setSelectedSale(sale);
    setRetryData({ id_metode_pembayaran: 1, jumlah_bayar: sale.sisaPembayaran, nomor_referensi: '' });
    setRetryPaymentModal(true);
  };

  if (loading) {
    return (
      <PageLayout>
        <PageContainer>
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="inline-block animate-spin">
                <svg className="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a10 10 0 0 1 0 20" />
                </svg>
              </div>
              <p className="mt-3 text-slate-600">Memuat data...</p>
            </div>
          </div>
        </PageContainer>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Admin Reconciliation"
          subtitle="Kelola pembayaran gagal dan tidak lengkap untuk memastikan rekonsiliasi akurat dan penyelesian pembayaran."
        />

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">Tidak Lengkap</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{sales.filter(s => s.sisaPembayaran > 0).length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">Pembayaran Gagal</p>
              <p className="mt-2 text-2xl font-semibold text-red-600">{sales.filter(s => s.hasFailedPayments).length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">Total Data</p>
              <p className="mt-2 text-2xl font-semibold text-sky-600">{sales.length}</p>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="p-6 space-y-4">
              <SearchFilterBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onClearSearch={() => setSearchTerm('')}
                onFilterToggle={() => setShowFilters((prev) => !prev)}
                isFilterActive={showFilters}
                hasActiveFilters={false}
                searchPlaceholder="Cari kode transaksi, kasir, atau cabang..."
              />

              <FilterPanel visible={showFilters} className="!mt-0">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Filter Pembayaran</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setFilter('incomplete')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                          filter === 'incomplete'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Pembayaran Tidak Lengkap
                      </button>
                      <button
                        onClick={() => setFilter('failed')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                          filter === 'failed'
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Pembayaran Gagal
                      </button>
                      <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                          filter === 'all'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Semua Data
                      </button>
                    </div>
                  </div>
                </div>
              </FilterPanel>

              {/* Sales Table */}
              <div className="overflow-x-auto border-t border-slate-200 pt-4">
                <table className="min-w-full divide-y divide-slate-200 bg-white">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Kode Transaksi</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Kasir</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Cabang</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Dibayar</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Kurang</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {getFilteredSales().length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                          {filter === 'incomplete' 
                            ? 'Tidak ada penjualan dengan pembayaran tidak lengkap' 
                            : 'Tidak ada data penjualan dengan pembayaran gagal'}
                        </td>
                      </tr>
                    ) : (
                      getFilteredSales().map(sale => (
                        <tr 
                          key={sale.id_penjualan} 
                          className={`hover:bg-slate-50 transition ${
                            sale.sisaPembayaran > 0 ? 'bg-red-50' : (sale.hasFailedPayments ? 'bg-amber-50' : '')
                          }`}
                        >
                          <td className="px-4 py-4 whitespace-nowrap font-medium text-slate-900">{sale.kode_transaksi}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-700">{new Date(sale.tanggal).toLocaleString('id-ID')}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-700">{sale.kasir?.nama_lengkap || sale.kasir?.username || 'Unknown'}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-700">{sale.cabang?.nama_cabang || 'Unknown'}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-right font-medium text-slate-900">{formatCurrency(sale.totalOwed)}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-slate-700">{formatCurrency(sale.totalPaid)}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-right font-semibold" style={{ color: sale.sisaPembayaran > 0 ? '#dc2626' : '#10b981' }}>
                            {formatCurrency(Math.max(0, sale.sisaPembayaran))}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <div className="flex gap-1 justify-center flex-wrap">
                              {sale.hasFailedPayments && (
                                <span className="inline-block bg-red-100 text-red-700 px-2 py-1 rounded-md text-xs font-medium">Gagal</span>
                              )}
                              {sale.sisaPembayaran > 0 && (
                                <span className="inline-block bg-amber-100 text-amber-700 px-2 py-1 rounded-md text-xs font-medium">Tidak Lengkap</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <DropdownActionMenu
                              item={sale}
                              actions={[
                                {
                                  icon: Eye,
                                  title: 'Lihat Detail',
                                  variant: 'primary',
                                  onClick: (item) => handleViewPaymentDetails(item)
                                },
                                ...(sale.sisaPembayaran > 0 ? [{
                                  icon: CheckCircle,
                                  title: 'Lunaskan Pembayaran',
                                  variant: 'success',
                                  onClick: (item) => handleSettlePayment(item)
                                }] : [])
                              ]}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Detail Modal */}
        {paymentDetailModal && selectedSale && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Detail Pembayaran</h3>
                  <p className="text-sm text-slate-600 mt-1">{selectedSale.kode_transaksi}</p>
                </div>
                <button
                  onClick={() => setPaymentDetailModal(false)}
                  className="inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 p-2 transition"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">Total Tagihan</p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(selectedSale.totalOwed)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">Total Dibayar</p>
                    <p className="mt-2 text-xl font-semibold text-emerald-600">{formatCurrency(selectedSale.totalPaid)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">Sisa Pembayaran</p>
                    <p className="mt-2 text-xl font-semibold text-red-600">{formatCurrency(Math.max(0, selectedSale.sisaPembayaran))}</p>
                  </div>
                </div>

                {/* Payment Details Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Metode</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Jumlah</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Referensi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {paymentDetails.length > 0 ? (
                        paymentDetails.map((payment, idx) => {
                          const paymentDate = payment.tanggal_pembayaran || payment.created_at || payment.tanggal || payment.createdAt;
                          const formattedDate = paymentDate ? new Date(paymentDate).toLocaleString('id-ID') : 'Tanggal tidak tersedia';
                          const status = payment.status_pembayaran || payment.status;
                          const statusText = status === 'selesai' ? 'approved' : status;

                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-700">{formattedDate}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">{payment.metodePembayaran?.nama_metode || payment.metode?.nama_metode || 'Unknown'}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-900">{formatCurrency(payment.jumlah_bayar)}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm">
                                <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${
                                  statusText === 'approved' || statusText === 'selesai' 
                                    ? 'bg-emerald-100 text-emerald-700' :
                                  statusText === 'pending' 
                                    ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {statusText === 'selesai' ? 'Selesai' : (statusText || 'Unknown')}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-700">{payment.nomor_referensi || payment.referensi || '—'}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="5" className="px-4 py-10 text-center text-sm text-slate-500">
                            Tidak ada data pembayaran
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex gap-3 justify-end">
                <button
                  onClick={() => setPaymentDetailModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition"
                >
                  Tutup
                </button>
                {selectedSale.sisaPembayaran > 0 && (
                  <button
                    onClick={() => {
                      setPaymentDetailModal(false);
                      handleSettlePayment(selectedSale);
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition"
                  >
                    Lunaskan Sekarang
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Retry Payment Modal */}
        {retryPaymentModal && selectedSale && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Catat Pembayaran Tambahan</h3>
                <button
                  onClick={() => setRetryPaymentModal(false)}
                  className="inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 p-2 transition"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Transaction Info */}
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                  <p className="text-sm text-slate-600">Kode Transaksi</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedSale.kode_transaksi}</p>
                  <p className="text-sm text-slate-600 mt-3">Sisa Pembayaran</p>
                  <p className="mt-1 text-xl font-semibold text-red-600">{formatCurrency(selectedSale.sisaPembayaran)}</p>
                </div>

                {/* Form Fields */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Metode Pembayaran</label>
                  <select
                    value={retryData.id_metode_pembayaran}
                    onChange={e => setRetryData({...retryData, id_metode_pembayaran: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1">Tunai</option>
                    <option value="2">Transfer</option>
                    <option value="3">Kartu Kredit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Jumlah Bayar</label>
                  <input
                    type="number"
                    value={retryData.jumlah_bayar}
                    onChange={e => setRetryData({...retryData, jumlah_bayar: Number(e.target.value)})}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nomor Referensi (Opsional)</label>
                  <input
                    type="text"
                    value={retryData.nomor_referensi}
                    onChange={e => setRetryData({...retryData, nomor_referensi: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Transfer ID, CC last 4 digits"
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex gap-3 justify-end">
                <button
                  onClick={() => setRetryPaymentModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleRetryPayment}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
                >
                  Catat Pembayaran
                </button>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </PageLayout>
  );
};

export default AdminReconciliationPage;
