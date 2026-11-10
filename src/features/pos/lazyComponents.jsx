// Komponen kasir yang dimuat malas (lazy) beserta fallback jika chunk gagal dimuat.
import { lazy } from 'react';
import { logger } from '../../utils/logger';

const ModalFallback = ({ onDone }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-sm">
      <h3 className="text-lg font-semibold mb-4">Receipt</h3>
      <p className="text-gray-600 mb-4">Transaction completed successfully</p>
      <button
        onClick={onDone}
        className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
      >
        Done
      </button>
    </div>
  </div>
);

const SimpleSearchFallback = ({ onClose }) => (
  <div className="p-4 bg-gray-100 rounded-lg border border-gray-300">
    <p className="text-gray-600 mb-4">Customer search temporarily unavailable</p>
    <button onClick={onClose} className="text-blue-500 hover:underline text-sm">Close</button>
  </div>
);

const BarcodeScannerFallback = ({ onClose }) => (
  <div className="p-4 bg-gray-100 rounded-lg border border-gray-300">
    <p className="text-gray-600 mb-4">Camera scanner temporarily unavailable</p>
    <button onClick={onClose} className="text-blue-500 hover:underline text-sm">Close</button>
  </div>
);

const VoucherFallback = ({ onClose }) => (
  <div className="p-4 bg-gray-100 rounded-lg border border-gray-300">
    <p className="text-gray-600 mb-4">Voucher input temporarily unavailable</p>
    <button onClick={onClose} className="text-blue-500 hover:underline text-sm">Close</button>
  </div>
);

// Lazy load heavy components with error handling
export const TransactionSuccessModal = lazy(() => 
  import('../../components/TransactionSuccessModal').catch(err => {
    logger.error('Failed to load TransactionSuccessModal:', err);
    return { default: ModalFallback };
  })
);
export const PencarianPelanggan = lazy(() =>
  import('../../components/PencarianPelanggan').catch(err => {
    logger.error('Failed to load PencarianPelanggan:', err);
    return { default: SimpleSearchFallback };
  })
);
export const CameraBarcodeScanner = lazy(() =>
  import('../../components/CameraBarcodeScanner').catch(err => {
    logger.error('Failed to load CameraBarcodeScanner:', err);
    return { default: BarcodeScannerFallback };
  })
);
export const InputVoucher = lazy(() =>
  import('../../components/InputVoucher').catch(err => {
    logger.error('Failed to load InputVoucher:', err);
    return { default: VoucherFallback };
  })
);
