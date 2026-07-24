import React from 'react';
import { formatCurrency } from '../utils/formatHelper';

/**
 * OfflineWarningDialog - Warning sebelum melakukan transaksi offline
 */
const OfflineWarningDialog = ({ 
  isOpen, 
  onConfirm, 
  onCancel,
  totalAmount = 0,
  itemCount = 0
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="bg-amber-50 px-6 py-4 rounded-t-lg border-b-2 border-amber-200">
          <div className="flex items-center gap-3">
            <div className="text-3xl">📡</div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Mode Offline</h2>
              <p className="text-sm text-amber-700">Transaksi akan disimpan lokal</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Warning Message */}
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
            <p className="text-sm text-amber-800">
              <strong>⚠️ Perhatian:</strong> Koneksi internet terputus. Transaksi ini akan disimpan di database lokal dan otomatis disinkronkan ke server saat koneksi kembali.
            </p>
          </div>

          {/* Info */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Jumlah Produk:</span>
              <span className="font-semibold">{itemCount} item</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Belanja:</span>
              <span className="font-semibold">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* Important Notes */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium text-blue-900">ℹ️ Informasi Penting:</p>
            <ul className="text-xs text-blue-800 space-y-1 ml-4">
              <li>✓ Transaksi akan tersimpan dengan aman di database lokal</li>
              <li>✓ Struk akan dicetak seperti biasa</li>
              <li>✓ Sinkronisasi akan terjadi otomatis saat online</li>
              <li>✓ Jangan tutup aplikasi sampai transaksi selesai</li>
            </ul>
          </div>

          {/* Status Info */}
          <div className="text-xs text-gray-500 text-center p-2 bg-gray-50 rounded">
            Periksa status sinkronisasi di bagian Status Aplikasi
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex gap-3 border-t">
          <button
            onClick={onCancel}
            className="flex-1 py-2 px-4 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-medium transition-colors"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span>✓</span> Lanjutkan Offline
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfflineWarningDialog;
