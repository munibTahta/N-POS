import React, { useEffect, useState } from 'react';
import { getPaymentHistory } from '../services/api';

const PaymentHistoryModal = ({ saleId, onClose }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!saleId) return;
    const fetchPayments = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getPaymentHistory(saleId);
        const data = res.data?.data || res.data || [];
        setPayments(Array.isArray(data) ? data : (data.detail || []));
      } catch (err) {
        console.error('Failed to load payment history', err);
        setError('Gagal memuat riwayat pembayaran.');
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, [saleId]);

  if (!saleId) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Riwayat Pembayaran - Transaksi #{saleId}</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">✕</button>
        </div>

        {loading && <p>Memuat...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && (
          <div className="space-y-3 max-h-72 overflow-auto">
            {payments.length === 0 && <p className="text-sm text-gray-600">Belum ada pembayaran tercatat.</p>}
            {payments.map((p, idx) => (
              <div key={p.id_detail || p.id_metode || idx} className="border rounded p-3">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">{p.nama_metode || p.MetodePembayaran?.nama_metode || 'Metode'}</p>
                    <p className="text-sm text-gray-600">Ref: {p.nomor_referensi || '-'}</p>
                    <p className="text-sm text-gray-600">Status: {p.status_pembayaran || p.status || '-'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">Rp {Number(p.jumlah || p.jumlah_bayar || 0).toLocaleString('id-ID')}</p>
                    <p className="text-xs text-gray-500">{p.diproses_pada || p.createdAt || ''}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 text-right">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Tutup</button>
        </div>
      </div>
    </div>
  );
};

export default PaymentHistoryModal;
