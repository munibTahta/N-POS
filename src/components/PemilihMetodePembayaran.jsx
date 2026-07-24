import React, { useState, useEffect } from 'react';
import { getMetodePembayaran } from '../services/api';
import { formatCurrency } from '../utils/formatHelper';
import PaymentAmountInput from './PaymentAmountInput';

// Icon mapping untuk metode pembayaran
const paymentIcons = {
  'tunai': '💵',
  'kartu kredit': '💳',
  'transfer': '🏦',
  'e-wallet': '📱',
  'gopay': '🟢',
  'ovo': '🟣',
  'dana': '🔵',
  'link aja': '🟠',
  'bca': '🏢',
  'mandiri': '🏢',
  'bni': '🏢',
  'bri': '🏢',
};

const getPaymentIcon = (metodeName) => {
  const name = metodeName.toLowerCase();
  for (const [key, icon] of Object.entries(paymentIcons)) {
    if (name.includes(key)) return icon;
  }
  return '💰'; // Default icon
};

const PemilihMetodePembayaran = ({
  total,
  selectedPayments = [],
  onAddPayment,
  onRemovePayment,
  onUpdatePayment,
  showCompact = false // Untuk layout yang lebih ringkas
}) => {
  const [metodePembayaran, setMetodePembayaran] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMetodePembayaran = async () => {
      try {
        const response = await getMetodePembayaran();
        const raw = response.data?.data || response.data || [];
        // Normalize shape according to API_DOCUMENTATION.md
        const normalized = raw.map(m => {
          const id = m.id || m.id_metode || m.id_metode_pembayaran || null;
          const idMetode = m.id_metode || m.id || m.id_metode_pembayaran || null;
          const konfigurasi = m.konfigurasi || m.config || {};
          const biayaNominal = Number(m.biaya_tambahan_nominal ?? m.biaya_tambahan ?? konfigurasi.biaya_admin ?? 0) || 0;
          const biayaPersen = Number(m.biaya_tambahan_persen ?? 0) || 0;

          return {
            ...m,
            id,
            id_metode: idMetode,
            nama_metode: m.nama_metode || m.name || '',
            tipe_metode: m.tipe_metode || m.tipe || '',
            aktif: m.aktif ?? m.active ?? true,
            is_default: !!m.is_default,
            konfigurasi,
            biaya_tambahan_nominal: biayaNominal,
            biaya_tambahan_persen: biayaPersen
          };
        });
        setMetodePembayaran(normalized);
      } catch (err) {
        setError('Gagal memuat metode pembayaran');
        console.error('Error fetching payment methods:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetodePembayaran();
  }, []);

  const handleAddPayment = (metode) => {
    const newPayment = {
      uniqueId: `payment-${metode.id_metode || metode.id}-${Date.now()}`,
      id_metode: metode.id_metode || metode.id,
      nama_metode: metode.nama_metode,
      jumlah: 0,
      nomor_referensi: ''
    };
    onAddPayment(newPayment);
  };

  const handleUpdatePayment = (index, field, value) => {
    onUpdatePayment(index, field, value);
  };

  const handleRemovePayment = (index) => {
    onRemovePayment(index);
  };

  const totalPaid = selectedPayments.reduce((sum, payment) => sum + Number(payment.jumlah || 0), 0);
  const remaining = total - totalPaid;

  if (loading) {
    return <div className="text-center py-2 text-sm">Memuat metode pembayaran...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center py-2 text-sm">{error}</div>;
  }

  // Mode compact - hanya icon buttons
  if (showCompact) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {metodePembayaran.map((metode) => (
            <button
              key={metode.id}
              onClick={() => handleAddPayment(metode)}
              className="text-2xl p-2 hover:bg-gray-100 rounded-lg transition-colors tooltip relative group"
              disabled={remaining <= 0}
              title={metode.nama_metode}
            >
              {getPaymentIcon(metode.nama_metode)}
              <span className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                {metode.nama_metode}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Mode normal - detail
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Pilih Metode Pembayaran</h3>

      {/* Daftar Metode Pembayaran Tersedia - Icon + Teks */}
      <div className="grid grid-cols-2 gap-2">
        {metodePembayaran.map((metode) => (
          <button
            key={metode.id}
            onClick={() => handleAddPayment(metode)}
            className="p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-all flex items-center gap-2"
            disabled={remaining <= 0}
          >
            <span className="text-2xl">{getPaymentIcon(metode.nama_metode)}</span>
            <div className="text-left">
              <div className="font-medium text-sm">{metode.nama_metode}</div>
              {metode.biaya_tambahan_nominal > 0 && (
                <div className="text-xs text-gray-500">
                  +{formatCurrency(metode.biaya_tambahan_nominal)}
                </div>
              )}
              {metode.biaya_tambahan_persen > 0 && (
                <div className="text-xs text-gray-500">+{metode.biaya_tambahan_persen}%</div>
              )}
              {metode.konfigurasi?.biaya_admin > 0 && metode.biaya_tambahan_nominal === 0 && (
                <div className="text-xs text-gray-500">
                  +{formatCurrency(metode.konfigurasi.biaya_admin)}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Pembayaran yang Dipilih */}
      {selectedPayments.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Metode Pembayaran yang Dipilih:</h4>
          {selectedPayments.map((payment, index) => (
            <div key={payment.uniqueId} className="border rounded-lg p-3 bg-blue-50">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getPaymentIcon(payment.nama_metode)}</span>
                  <span className="font-medium text-sm">{payment.nama_metode}</span>
                </div>
                <button
                  onClick={() => handleRemovePayment(index)}
                  className="text-red-500 hover:text-red-700 font-bold"
                  title="Hapus metode pembayaran ini"
                >
                  ✕
                </button>
              </div>

              {/* Payment Amount Input dengan Rp dan quick buttons */}
              <div className="mb-2">
                <PaymentAmountInput
                  amount={payment.jumlah}
                  onChange={(amount) => handleUpdatePayment(index, 'jumlah', amount)}
                  total={remaining}
                  placeholder="Jumlah pembayaran"
                  showChange={false}
                  maxAmount={remaining}
                />
              </div>

              {/* Reference Number - Opsional */}
              <div>
                <input
                  type="text"
                  value={payment.nomor_referensi || ''}
                  onChange={(e) => handleUpdatePayment(index, 'nomor_referensi', e.target.value)}
                  className="w-full p-2 border rounded text-sm"
                  placeholder="No. referensi (opsional)"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ringkasan Pembayaran - Lebih Ringkas */}
      {selectedPayments.length > 0 && (
        <div className="border-t pt-2 space-y-1 text-sm">
          <div className="flex justify-between font-semibold">
            <span>Tagihan:</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between text-green-600 font-semibold">
            <span>Dibayar:</span>
            <span>{formatCurrency(totalPaid)}</span>
          </div>
          <div className={`flex justify-between font-bold ${remaining >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
            <span>{remaining >= 0 ? 'Sisa:' : 'Kurang:'}</span>
            <span>{formatCurrency(Math.abs(remaining))}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PemilihMetodePembayaran;