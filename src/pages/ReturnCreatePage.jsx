import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createSalesReturn, getSaleById, adjustStock, getStockReport, createLogAktivitas } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { extractData } from '../utils/apiResponseHelper';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';

const BackIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const SaveIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <path d="M17 21v-8H7v8" />
    <path d="M7 3v5h8" />
  </svg>
);

const LoadingIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a10 10 0 0 0-10 10" />
  </svg>
);

const ReturnCreatePage = () => {
  const [idPenjualan, setIdPenjualan] = useState('');
  const [saleData, setSaleData] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [alasan, setAlasan] = useState('');
  const [metodePengembalian, setMetodePengembalian] = useState('tunai');
  const [loading, setLoading] = useState(false);
  const [loadingSale, setLoadingSale] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    if (id) setIdPenjualan(id);
  }, [location.search]);

  useEffect(() => {
    const loadSaleData = async () => {
      if (!idPenjualan) return;

      setLoadingSale(true);
      setError('');
      try {
        const response = await getSaleById(idPenjualan);
        const data = extractData(response);
        setSaleData(data);

        let items = [];
        if (data?.items && Array.isArray(data.items)) items = data.items;
        else if (data?.detail_penjualan && Array.isArray(data.detail_penjualan)) items = data.detail_penjualan;
        else if (data?.penjualan_detail && Array.isArray(data.penjualan_detail)) items = data.penjualan_detail;
        else if (Array.isArray(data)) items = data;

        const initialReturnItems = items.map((item) => ({
          id_penjualan_detail: item.id_penjualan_detail || item.id_detail || item.id,
          id_produk: item.id_produk || item.id_product || item.product?.id_produk || item.product?.id,
          nama_produk: item.nama_produk || item.product?.nama_produk || `Produk (ID: ${item.id_produk || item.id_product || 'unknown'})`,
          jumlah_terjual: item.jumlah || item.qty || item.jumlah_terjual || 0,
          harga_jual: item.harga_jual || item.price || 0,
          jumlah_retur: 0,
          selected: false,
        }));

        setReturnItems(initialReturnItems);
      } catch (err) {
        console.error('Error loading sale data:', err);
        const errorMessage = err.response?.data?.message || 'Gagal memuat data penjualan';
        setError(errorMessage);
        setSaleData(null);
        setReturnItems([]);
      } finally {
        setLoadingSale(false);
      }
    };

    loadSaleData();
  }, [idPenjualan]);

  const handleItemSelection = (index, selected) => {
    const updatedItems = [...returnItems];
    updatedItems[index].selected = selected;
    if (!selected) updatedItems[index].jumlah_retur = 0;
    setReturnItems(updatedItems);
  };

  const handleQuantityChange = (index, quantity) => {
    const updatedItems = [...returnItems];
    const maxQuantity = updatedItems[index].jumlah_terjual;
    const validQuantity = Math.min(Math.max(0, parseInt(quantity, 10) || 0), maxQuantity);
    updatedItems[index].jumlah_retur = validQuantity;
    setReturnItems(updatedItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!idPenjualan) return setError('Masukkan ID penjualan');
    if (!saleData || typeof saleData !== 'object') return setError('Detail penjualan tidak ditemukan. Pastikan ID penjualan benar.');
    if (!returnItems || returnItems.length === 0) return setError('Tidak ada item yang dapat diretur dari penjualan ini.');

    const selectedItems = returnItems.filter((item) => item.selected && item.jumlah_retur > 0);
    if (selectedItems.length === 0) return setError('Pilih minimal satu item untuk diretur');
    if (!alasan.trim()) return setError('Masukkan alasan retur');

    for (const item of selectedItems) {
      if (item.jumlah_retur > item.jumlah_terjual) {
        return setError(`Jumlah retur ${item.nama_produk} tidak boleh melebihi jumlah terjual (${item.jumlah_terjual})`);
      }
    }

    const items = selectedItems.map((item) => ({
      id_produk: item.id_produk,
      jumlah: Number(item.jumlah_retur),
    }));

    setLoading(true);
    try {
      const payload = {
        id_penjualan: parseInt(idPenjualan, 10),
        items,
        alasan: alasan.trim(),
        metode_pengembalian: metodePengembalian,
      };
      const res = await createSalesReturn(payload);
      const returnIds = res.data?.data?.map((item) => item.id_retur).join(', ') || 'n/a';
      setSuccess(`Retur berhasil dibuat. ID: ${returnIds}`);

      try {
        await createLogAktivitas({
          aktivitas: `Retur penjualan ID ${idPenjualan}: ${selectedItems.length} item(s) - Total nilai: Rp${selectedItems.reduce((total, item) => total + (item.jumlah_retur * item.harga_jual), 0).toLocaleString('id-ID')}`,
        });
      } catch (auditError) {
        console.warn('Failed to log return audit:', auditError);
      }

      try {
        const stockReportRes = await getStockReport();
        const stockReportData = stockReportRes.data.data || [];

        const stockAdjustments = selectedItems.map((item) => {
          const productStock = stockReportData.find((p) => p.id_produk === item.id_produk);
          const currentStock = productStock?.detail_lokasi?.cabang?.find((c) => c.id_cabang === saleData.id_cabang)?.stok || 0;
          const newStock = currentStock + item.jumlah_retur;

          return {
            id_cabang: saleData.id_cabang,
            id_produk: item.id_produk,
            stok_baru: newStock,
            keterangan: `Retur penjualan - ID: ${returnIds} - ${alasan.trim()}`,
          };
        });

        await Promise.all(stockAdjustments.map((adjustment) => adjustStock(adjustment)));
      } catch (stockErr) {
        console.error('Failed to adjust stock after return:', stockErr);
        setError('Retur berhasil dibuat, namun gagal menyesuaikan stok secara otomatis. Silakan lakukan penyesuaian stok manual.');
      }

      setReturnItems(returnItems.map((item) => ({ ...item, selected: false, jumlah_retur: 0 })));
      setAlasan('');
      setMetodePengembalian('tunai');
    } catch (err) {
      console.error('Retur error', err);
      const errorMessage = err.response?.data?.message || 'Gagal membuat retur';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const selectedReturnValue = returnItems
    .filter((item) => item.selected)
    .reduce((sum, item) => sum + item.jumlah_retur * item.harga_jual, 0);

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Buat Retur Penjualan Baru"
          subtitle="Halaman ini khusus untuk membuat retur penjualan dengan mengisi ID penjualan dan pilih item yang ingin dikembalikan."
          actions={
            <Link to="/return" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              <BackIcon className="w-4 h-4" />
              <span>Kembali ke Daftar Retur</span>
            </Link>
          }
        />

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {success && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">ID Penjualan</label>
                <input
                  type="text"
                  value={idPenjualan}
                  onChange={(e) => setIdPenjualan(e.target.value)}
                  placeholder="Masukkan ID penjualan"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {saleData && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Informasi Penjualan</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="text-sm text-gray-700"><span className="font-medium">Kode Transaksi:</span> {saleData.kode_transaksi}</div>
                    <div className="text-sm text-gray-700"><span className="font-medium">Tanggal:</span> {saleData.tanggal ? new Date(saleData.tanggal).toLocaleString('id-ID') : '-'}</div>
                    <div className="text-sm text-gray-700"><span className="font-medium">Total:</span> Rp {Number(saleData.total || 0).toLocaleString('id-ID')}</div>
                    <div className="text-sm text-gray-700"><span className="font-medium">Kasir:</span> {saleData.User?.nama_lengkap || saleData.User?.nama || user?.nama_lengkap || user?.nama || 'Unknown'}</div>
                  </div>
                </div>
              )}

              {loadingSale ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">Memuat data penjualan...</div>
              ) : returnItems.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Pilih Item untuk Diretur</h3>
                  <div className="space-y-3 max-h-[28rem] overflow-y-auto">
                    {returnItems.map((item, index) => (
                      <div key={item.id_penjualan_detail} className="rounded-2xl border border-gray-200 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={(e) => handleItemSelection(index, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <p className="font-medium text-gray-900">{item.nama_produk}</p>
                            <p className="text-sm text-gray-600">Terjual: {item.jumlah_terjual} x Rp {Number(item.harga_jual).toLocaleString('id-ID')}</p>
                          </div>
                        </div>
                        {item.selected && (
                          <div className="mt-3 flex items-center gap-2 sm:mt-0">
                            <label className="text-sm font-medium text-gray-700">Jumlah Retur</label>
                            <input
                              type="number"
                              min="0"
                              max={item.jumlah_terjual}
                              value={item.jumlah_retur}
                              onChange={(e) => handleQuantityChange(index, e.target.value)}
                              className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1 text-center text-sm text-slate-900"
                            />
                            <span className="text-sm text-gray-500">(Max: {item.jumlah_terjual})</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {selectedReturnValue > 0 && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                      Total Nilai Retur: <span className="font-semibold">Rp {selectedReturnValue.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                </div>
              ) : idPenjualan ? (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">Tidak ada item yang dapat diretur dari penjualan ini.</div>
              ) : null}

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Alasan Retur</label>
                  <select
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Pilih alasan...</option>
                    <option value="Barang rusak">Barang rusak</option>
                    <option value="Barang tidak sesuai pesanan">Barang tidak sesuai pesanan</option>
                    <option value="Kelebihan pesanan">Kelebihan pesanan</option>
                    <option value="Kadaluarsa">Kadaluarsa</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Metode Pengembalian</label>
                  <select
                    value={metodePengembalian}
                    onChange={(e) => setMetodePengembalian(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="tunai">Tunai</option>
                    <option value="voucher">Voucher</option>
                    <option value="tukar">Tukar Barang</option>
                  </select>
                </div>
              </div>

              {alasan === 'Lainnya' && (
                <div>
                  <textarea
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                    placeholder="Jelaskan alasan retur..."
                    rows="4"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="text-right">
                <button
                  type="submit"
                  disabled={loading || loadingSale}
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {loading ? (
                    <>
                      <LoadingIcon className="w-4 h-4 mr-2 animate-spin" />
                      Membuat Retur...
                    </>
                  ) : (
                    <>
                      <SaveIcon className="w-4 h-4 mr-2" />
                      Buat Retur
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </PageContainer>
    </PageLayout>
  );
};

export default ReturnCreatePage;
