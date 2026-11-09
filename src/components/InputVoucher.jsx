import React, { useState } from 'react';
import { CheckCircle, Loader2, X, Tag } from 'lucide-react';
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
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Tag className="w-4 h-4 text-gray-600" />
        <h4 className="text-sm font-medium text-gray-700">Voucher Diskon</h4>
      </div>

      {!appliedVoucher ? (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={kodeVoucher}
            onChange={(e) => setKodeVoucher(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            placeholder="Kode voucher"
            className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            disabled={loading}
          />
          <button
            onClick={handleValidateVoucher}
            disabled={loading || !kodeVoucher.trim()}
            className="btn-primary shrink-0 px-3 sm:px-4"
            title={loading ? 'Sedang memvalidasi...' : 'Validasi voucher'}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            <span className="hidden sm:inline text-sm font-medium">
              {loading ? 'Validasi...' : 'Validasi'}
            </span>
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-start gap-2 min-w-0">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-medium text-sm text-green-800 dark:text-green-300 truncate">{appliedVoucher.nama_voucher}</div>
              <div className="text-xs text-green-600 dark:text-green-400">
                {appliedVoucher.kode_voucher} &bull; -{formatCurrency(appliedVoucher.diskon)}
              </div>
            </div>
          </div>
          <button
            onClick={handleRemove}
            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors shrink-0"
            title="Hapus voucher"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <span className="font-medium">!</span> {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <CheckCircle className="w-3.5 h-3.5" /> {success}
        </p>
      )}
    </div>
  );
};

export default InputVoucher;