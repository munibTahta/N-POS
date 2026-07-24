import React, { useEffect, useState, useCallback } from 'react';
import { getPaymentPendingList, verifyPayment, getSaleById, getPaymentHistory } from '../services/api';
import { extractArray, extractData } from '../utils/apiResponseHelper';
import { formatCurrency } from '../utils/formatHelper';
import ResponsiveTable from '../components/common/ResponsiveTable';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts/index.jsx';
import { SearchFilterBar } from '../components/SearchFilterBar';
import useSearchAndFilter from '../hooks/useSearchAndFilter';
import { useNotifications } from '../hooks/useNotifications';

// SVG Icons
const ViewIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const CheckIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CloseIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a10 10 0 0 1 0 20" />
  </svg>
);

const PaymentsPage = () => {
  const { success: showSuccess, error: showError } = useNotifications();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState([]);
  const [saleDetails, setSaleDetails] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaymentPendingList();
      const items = extractArray(res);
      
      // Fetch sale details for each pending payment to get cashier and branch info
      const itemsWithSaleData = await Promise.all(
        items.map(async (item) => {
          try {
            if (item.id_penjualan) {
              const saleRes = await getSaleById(item.id_penjualan);
              const saleData = extractData(saleRes);
              return {
                ...item,
                penjualan: saleData
              };
            }
            return item;
          } catch (err) {
            console.warn(`Failed to fetch sale data for payment ${item.id_detail || item.id}`, err);
            return item;
          }
        })
      );
      
      setList(itemsWithSaleData);
    } catch (err) {
      console.error('Failed to fetch pending payments', err);
      showError('Gagal memuat daftar pembayaran pending.');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  // Search and filter
  const { filteredItems: filteredList } = useSearchAndFilter(list, {
    searchTerm: searchQuery,
    searchKeys: ['penjualan.kode_transaksi', 'kode_transaksi', 'penjualan.pelanggan.nama_pelanggan', 'nomor_referensi'],
    debounceDelay: 300,
  });

  const handleVerify = async (id_detail) => {
    setProcessingId(id_detail);
    try {
      await verifyPayment(id_detail, { 
        verifikasi_status: 'approved', 
        catatan_verifikasi: 'Diverifikasi oleh admin',
        status_pembayaran: 'approved' // Also update payment status
      });
      showSuccess('Pembayaran berhasil diverifikasi');
      fetchPending();
    } catch (err) {
      console.error('Verify error', err);
      showError('Gagal memverifikasi pembayaran.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewDetails = async (payment) => {
    try {
      setSelectedPayment(payment);
      
      // Fetch sale details and payment history
      const [saleResponse, paymentHistoryResponse] = await Promise.all([
        getSaleById(payment.penjualan?.id_penjualan || payment.id_penjualan),
        getPaymentHistory(payment.penjualan?.id_penjualan || payment.id_penjualan)
      ]);
      
      const saleData = extractData(saleResponse);
      const paymentData = extractArray(paymentHistoryResponse);
      
      setSaleDetails(saleData);
      setPaymentDetails(paymentData);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Error fetching details:', err);
      showError('Gagal memuat detail pembayaran.');
    }
  };

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Pembayaran - Pending Verifikasi"
          subtitle="Verifikasi pembayaran yang masih menunggu persetujuan dari administrator."
        />

        <div className="space-y-6">
          {/* Stats Card */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">Total Menunggu Verifikasi</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{list.length}</p>
          </div>

          {/* Search and Filter Section */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="p-6 space-y-4">
              <SearchFilterBar
                searchTerm={searchQuery}
                onSearchChange={setSearchQuery}
                onClearSearch={() => setSearchQuery('')}
                searchPlaceholder="Cari kode transaksi, nama pelanggan, atau referensi..."
              />

              {/* Payment List */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="inline-block">
                      <LoadingSpinner />
                    </div>
                    <p className="mt-3 text-slate-600">Memuat data pembayaran...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 border-t border-slate-200 pt-4">
                  {filteredList.length === 0 ? (
                    <p className="text-center text-sm text-slate-500 py-10">
                      {searchQuery ? 'Tidak ada pembayaran ditemukan dengan pencarian Anda.' : 'Tidak ada pembayaran pending.'}
                    </p>
                  ) : (
                    filteredList.map(item => (
                      <div
                        key={item.id_detail || item.id}
                        className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition"
                      >
                        <div className="flex justify-between items-start gap-4">
                          {/* Left Content */}
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              <h3 className="font-semibold text-slate-900 text-lg">
                                {item.penjualan?.kode_transaksi || item.kode_transaksi || 'Transaksi'}
                              </h3>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                Menunggu
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div className="text-slate-600">
                                <span className="font-medium">Tanggal:</span> {(() => {
                                  const paymentDate = item.tanggal_pembayaran || item.created_at || item.tanggal || item.createdAt || item.updated_at;
                                  const saleDate = item.penjualan?.tanggal;
                                  const finalDate = paymentDate || saleDate;
                                  return finalDate ? new Date(finalDate).toLocaleDateString('id-ID') : 'N/A';
                                })()}
                              </div>
                              <div className="text-slate-600">
                                <span className="font-medium">Metode:</span> {item.metodePembayaran?.nama_metode || item.nama_metode || 'N/A'}
                              </div>
                              <div className="text-slate-600">
                                <span className="font-medium">Pelanggan:</span> {item.penjualan?.pelanggan?.nama_pelanggan || item.penjualan?.pelanggan?.nama || '-'}
                              </div>
                              <div className="text-slate-600">
                                <span className="font-medium">Referensi:</span> {item.nomor_referensi || item.referensi || '-'}
                              </div>
                            </div>
                          </div>

                          {/* Right Content - Amount & Actions */}
                          <div className="flex flex-col items-end gap-3">
                            <div className="text-right">
                              <p className="text-sm text-slate-600">Nominal</p>
                              <p className="text-2xl font-bold text-slate-900">
                                {formatCurrency(item.jumlah_bayar || item.jumlah || 0)}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleViewDetails(item)}
                                className="inline-flex items-center justify-center rounded-md bg-blue-100 text-blue-700 p-2 hover:bg-blue-200 transition"
                                title="Lihat Detail"
                              >
                                <ViewIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleVerify(item.id_detail)}
                                disabled={processingId === item.id_detail}
                                className="inline-flex items-center justify-center rounded-md bg-emerald-100 text-emerald-700 p-2 hover:bg-emerald-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Verifikasi Pembayaran"
                              >
                                {processingId === item.id_detail ? (
                                  <LoadingSpinner />
                                ) : (
                                  <CheckIcon className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </PageContainer>

      {/* Payment Detail Modal */}
      {showDetailModal && selectedPayment && saleDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-900">
                Detail Pembayaran - {selectedPayment.penjualan?.kode_transaksi || selectedPayment.kode_transaksi}
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-4 space-y-6">
              {/* Sale Summary */}
              <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                <h4 className="font-semibold text-slate-900">Ringkasan Transaksi</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Total Tagihan:</span>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(saleDetails.total || 0)}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Total Dibayar:</span>
                    <p className="text-lg font-semibold text-slate-900">{formatCurrency(saleDetails.bayar || 0)}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Sisa Pembayaran:</span>
                    <p className="text-lg font-semibold text-red-600">{formatCurrency(Math.max(0, (saleDetails.total || 0) - (saleDetails.bayar || 0)))}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Status:</span>
                    <p className="text-lg font-semibold text-slate-900">
                      {Math.max(0, (saleDetails.total || 0) - (saleDetails.bayar || 0)) > 0 ? 'Belum Lunas' : 'Lunas'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Item Pembelian</h4>
                <ResponsiveTable>
                  <table className="w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">No</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Produk</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Qty</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Harga</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(saleDetails.items || []).map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-sm text-slate-900">{idx + 1}</td>
                          <td className="px-4 py-2 text-sm text-slate-900">{item.nama_produk || item.Produk?.nama_produk || `Produk ${item.id_produk}`}</td>
                          <td className="px-4 py-2 text-right text-sm text-slate-900">{item.jumlah}</td>
                          <td className="px-4 py-2 text-right text-sm text-slate-900">{formatCurrency(item.harga_jual)}</td>
                          <td className="px-4 py-2 text-right text-sm text-slate-900">{formatCurrency(item.jumlah * item.harga_jual)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ResponsiveTable>
              </div>

              {/* Payment History */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Riwayat Pembayaran</h4>
                <ResponsiveTable>
                  <table className="w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Tanggal</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Metode</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Jumlah</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Referensi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {paymentDetails.length > 0 ? paymentDetails.map((payment, idx) => {
                        const paymentDate = payment.tanggal_pembayaran || payment.created_at || payment.tanggal || payment.createdAt || payment.updated_at;
                        const saleDate = saleDetails?.tanggal;
                        const finalDate = paymentDate || saleDate;
                        const formattedDate = finalDate ? new Date(finalDate).toLocaleDateString('id-ID') : 'Tanggal tidak tersedia';
                        
                        const status = payment.status_pembayaran || payment.status;
                        const statusText = status === 'selesai' ? 'approved' : status;
                        
                        return (
                          <tr key={idx} className={`hover:bg-slate-50 ${payment.id_detail === selectedPayment.id_detail ? 'bg-amber-50' : ''}`}>
                            <td className="px-4 py-2 text-sm text-slate-900">{formattedDate}</td>
                            <td className="px-4 py-2 text-sm text-slate-900">{payment.metodePembayaran?.nama_metode || payment.metode?.nama_metode || 'Unknown'}</td>
                            <td className="px-4 py-2 text-right text-sm font-semibold text-slate-900">{formatCurrency(payment.jumlah_bayar)}</td>
                            <td className="px-4 py-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                statusText === 'approved' || statusText === 'selesai' ? 'bg-emerald-100 text-emerald-800' :
                                statusText === 'pending' ? 'bg-amber-100 text-amber-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {statusText === 'selesai' ? 'Selesai' : (statusText || 'Unknown')}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-sm text-slate-900">{payment.nomor_referensi || payment.referensi || '-'}</td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan="5" className="px-4 py-4 text-center text-sm text-slate-500">
                            Tidak ada data pembayaran
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </ResponsiveTable>
              </div>

              {/* Pending Payment Info */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                <h4 className="font-semibold text-amber-900">Pembayaran Menunggu Verifikasi</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-amber-800 font-medium">Tanggal:</span>
                    <p className="mt-1 text-slate-900">{(() => {
                      const paymentDate = selectedPayment.tanggal_pembayaran || selectedPayment.created_at || selectedPayment.tanggal || selectedPayment.createdAt || selectedPayment.updated_at;
                      const saleDate = selectedPayment.penjualan?.tanggal;
                      const finalDate = paymentDate || saleDate;
                      return finalDate ? new Date(finalDate).toLocaleString('id-ID') : 'N/A';
                    })()}</p>
                  </div>
                  <div>
                    <span className="text-amber-800 font-medium">Metode:</span>
                    <p className="mt-1 text-slate-900">{selectedPayment.metodePembayaran?.nama_metode || selectedPayment.nama_metode || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-amber-800 font-medium">Nominal:</span>
                    <p className="mt-1 font-bold text-slate-900">{formatCurrency(selectedPayment.jumlah_bayar || selectedPayment.jumlah || 0)}</p>
                  </div>
                </div>
                {selectedPayment.nomor_referensi && (
                  <div>
                    <span className="text-amber-800 font-medium">Referensi:</span>
                    <p className="mt-1 text-slate-900">{selectedPayment.nomor_referensi}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-end gap-2">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  handleVerify(selectedPayment.id_detail);
                  setShowDetailModal(false);
                }}
                disabled={processingId === selectedPayment.id_detail}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {processingId === selectedPayment.id_detail ? (
                  <>
                    <LoadingSpinner />
                    Memproses...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-4 h-4" />
                    Verifikasi Pembayaran
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default PaymentsPage;
