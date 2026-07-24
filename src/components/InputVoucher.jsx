import React, { useState } from 'react';
import { validateVoucher } from '../services/api';
import { formatCurrency } from '../utils/formatHelper';

const InputVoucher = ({
  subtotal,
  onVoucherApplied,
  appliedVoucher = null,
  onRemoveVoucher
}) => {
  const [kodeVoucher, setKodeVoucher] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleValidateVoucher = async () => {
    if (!kodeVoucher.trim()) {
      setError('Masukkan kode voucher');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await validateVoucher(kodeVoucher.trim(), subtotal);
      const voucherData = response.data.data;

      if (voucherData.valid) {
        setSuccess(`Voucher valid! Diskon: ${formatCurrency(voucherData.diskon)}`);
        onVoucherApplied({
          id_voucher: voucherData.id_voucher_diskon,
          kode_voucher: kodeVoucher,
          nama_voucher: voucherData.nama_voucher,
          jenis_diskon: voucherData.jenis_diskon,
          nilai_diskon: voucherData.nilai_diskon,
          diskon_maksimal: voucherData.diskon_maksimal,
          diskon: voucherData.diskon
        });
      } else {
        setError(voucherData.pesan || 'Voucher tidak valid');
      }
    } catch (err) {
      setError('Gagal memvalidasi voucher');
      console.error('Error validating voucher:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setKodeVoucher('');
    setError('');
    setSuccess('');
    onRemoveVoucher();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleValidateVoucher();
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="font-medium">Voucher Diskon</h4>

      {!appliedVoucher ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={kodeVoucher}
            onChange={(e) => setKodeVoucher(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            placeholder="Masukkan kode voucher"
            className="flex-1 p-2 border rounded"
            disabled={loading}
          />
          <button
            onClick={handleValidateVoucher}
            disabled={loading || !kodeVoucher.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? 'Validasi...' : 'Validasi'}
          </button>
        </div>
      ) : (
        <div className="border rounded-lg p-3 bg-green-50 border-green-200">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-green-800">{appliedVoucher.nama_voucher}</div>
              <div className="text-sm text-green-600">
                Kode: {appliedVoucher.kode_voucher} |
                Diskon: {formatCurrency(appliedVoucher.diskon)}
              </div>
            </div>
            <button
              onClick={handleRemove}
              className="text-red-500 hover:text-red-700 text-xl"
              title="Hapus voucher"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {error && <div className="text-red-500 text-sm">{error}</div>}
      {success && <div className="text-green-500 text-sm">{success}</div>}
    </div>
  );
};

export default InputVoucher;