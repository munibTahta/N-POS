/**
 * TransactionSuccessModal - Direct print with saved printer
 *
 * Displays successful transaction with receipt preview and print option
 * Uses UniversalPrintModal for consistent UI and shortcuts
 */

import React, { useState, useCallback } from 'react';
import UniversalPrintModal, { PRINT_TYPES } from './UniversalPrintModal';
import { Printer } from 'lucide-react';
import usePrinter from '../hooks/usePrinter';
import { useNotifications } from '../hooks/useNotifications';
import { useSettings } from '../context/SettingsContext';

// Komponen untuk menampilkan konten struk, dipisahkan agar bisa di-ref
const ReceiptContent = React.forwardRef(({ saleData, storeInfo }, ref) => {
  const formatCurrency = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  const display = React.useMemo(() => {
    const d = saleData?.tanggal ? new Date(saleData.tanggal) : new Date();
    return {
      date: d.toLocaleDateString('id-ID'),
      time: d.toLocaleTimeString('id-ID')
    };
  }, [saleData]);

  return (
    <div ref={ref} className="bg-white p-4 font-mono text-xs text-black w-[300px]">
      <div className="text-center">
        <h2 className="font-bold text-sm">{storeInfo?.nama_cabang || 'Nama Toko'}</h2>
        <p>{storeInfo?.alamat || 'Alamat Toko'}</p>
        <p>{storeInfo?.no_telp || ''}</p>
        {storeInfo?.struk_header && <p className="mt-2">{storeInfo.struk_header}</p>}
      </div>
      <div className="border-t border-dashed border-black my-2"></div>
      <div className="flex justify-between">
        <span>No: {saleData?.no_struk || saleData?.kode_transaksi}</span>
        <span>{display.date}</span>
      </div>
      <div className="flex justify-between">
        <span>Kasir: {saleData?.kasir || saleData?.User?.nama || 'Unknown'}</span>
        <span>{display.time}</span>
      </div>
      <div className="border-t border-dashed border-black my-2"></div>
      <div>
        {(saleData?.items || []).map((item, index) => (
          <div key={index}>
            <p>{item?.nama_produk || `Produk (ID: ${item?.id_produk})`}</p>
            <div className="flex justify-between">
              <span>{(item?.jumlah || item?.qty || 0)} x {formatCurrency(item?.harga_jual || 0)}</span>
              <span>{formatCurrency(item?.subtotal || 0)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-dashed border-black my-2"></div>
      <div className="space-y-1">
        {/* Pembayaran - Support untuk detail_pembayaran array dengan nested metodePembayaran */}
        {(() => {
          let paymentMethods = [];
          
          if (Array.isArray(saleData.detail_pembayaran) && saleData.detail_pembayaran.length > 0) {
            // New structure: detail_pembayaran with nested metodePembayaran
            paymentMethods = saleData.detail_pembayaran.map(payment => ({
              nama_metode: payment.metodePembayaran?.nama_metode || 'Tunai',
              jumlah: payment.jumlah_bayar || 0
            }));
          } else if (Array.isArray(saleData.metode_pembayaran) && saleData.metode_pembayaran.length > 0) {
            // Fallback: old structure
            paymentMethods = saleData.metode_pembayaran.map(method => ({
              nama_metode: method.nama_metode || method.nama || 'Pembayaran',
              jumlah: method.jumlah || method.jumlah_bayar || 0
            }));
          } else {
            // Single payment fallback
            const methodName = saleData.MetodePembayaran?.nama_metode ||
                              (typeof saleData.metode_pembayaran === 'string' ? saleData.metode_pembayaran :
                               saleData.metode_pembayaran?.nama_metode || 'Tunai');
            paymentMethods = [{
              nama_metode: methodName,
              jumlah: saleData.bayar || saleData.total || 0
            }];
          }

          // Group payment methods by name to avoid duplicates
          const methodCounts = paymentMethods.reduce((acc, payment) => {
            const methodName = payment.nama_metode;
            if (!acc[methodName]) {
              acc[methodName] = { count: 0, totalAmount: 0 };
            }
            acc[methodName].count += 1;
            acc[methodName].totalAmount += payment.jumlah;
            return acc;
          }, {});

          // Display grouped payment methods
          return Object.entries(methodCounts).map(([methodName, data]) => (
            <div key={methodName} className="text-sm">
              <span>Metode: {data.count > 1 ? `${methodName} (${data.count}x)` : methodName}</span>
            </div>
          ));
        })()}

        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span>{formatCurrency(saleData?.total)}</span>
        </div>
        <div className="flex justify-between">
          <span>Bayar</span>
          <span>{formatCurrency(saleData?.bayar)}</span>
        </div>
        {saleData?.status_pembayaran === 'pending' || saleData?.sisa_pembayaran > 0 ? (
          <div className="flex justify-between text-orange-600">
            <span>Sisa Pembayaran</span>
            <span>{formatCurrency(saleData?.sisa_pembayaran || (saleData?.total - saleData?.bayar))}</span>
          </div>
        ) : (
          <div className="flex justify-between">
            <span>Kembali</span>
            <span>{formatCurrency(saleData?.kembali || saleData?.kembalian)}</span>
          </div>
        )}
      </div>
      <div className="border-t border-dashed border-black my-2"></div>
      <div className="text-center mt-2">
        <p>{storeInfo?.struk_footer || 'Terima Kasih!'}</p>
      </div>
    </div>
  );
});

ReceiptContent.displayName = 'ReceiptContent';

const TransactionSuccessModal = ({ transactionData, storeInfo, onDone }) => {
  const [showPrintModal, setShowPrintModal] = useState(false);
  const { printReceipt, defaultPrinter } = usePrinter();
  const { success, error: showError } = useNotifications();
  const { storeInfo: savedStoreInfo } = useSettings();
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrintClick = useCallback(async () => {
    // Jika ada default printer, langsung print tanpa modal
    if (defaultPrinter) {
      try {
        setIsPrinting(true);
        await printReceipt(transactionData, savedStoreInfo || storeInfo, defaultPrinter);

        success('Struk berhasil dicetak!');
        setTimeout(() => onDone(), 500);
      } catch (err) {
        console.error('[TransactionSuccessModal] Print error:', err);
        showError('Gagal cetak struk: ' + (err.message || err));
        setIsPrinting(false);
      }
    } else {
      // Jika tidak ada default printer, tampilkan modal untuk memilih printer
      setShowPrintModal(true);
    }
  }, [defaultPrinter, transactionData, savedStoreInfo, storeInfo, printReceipt, success, onDone, showError]);

  const handlePrintModalClose = () => {
    setShowPrintModal(false);
    // Close the success modal after printing
    setTimeout(() => onDone(), 500);
  };

  // Handle ESC key to close modal and Enter key to print
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isPrinting) {
        onDone();
      } else if (e.key === 'Enter' && !isPrinting) {
        handlePrintClick();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDone, handlePrintClick, isPrinting]);

  if (!transactionData) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-40">
        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md text-center max-h-[90vh] overflow-y-auto">
          {/* Pratinjau Struk */}
          <div className="flex justify-center mb-6 bg-gray-50 p-4 rounded-lg max-h-[40vh] overflow-y-auto">
            <ReceiptContent saleData={transactionData} storeInfo={storeInfo} />
          </div>

          {/* Tombol Aksi */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handlePrintClick}
              disabled={isPrinting}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPrinting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Sedang Cetak...
                </>
              ) : (
                <>
                  <Printer className="w-5 h-5" />
                  Cetak Struk
                </>
              )}
            </button>

            <button
              onClick={onDone}
              disabled={isPrinting}
              className="w-full text-gray-600 py-2 hover:bg-gray-100 rounded-lg transition-colors text-sm disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Selesaikan Tanpa Cetak
            </button>

            {/* Keyboard Shortcuts Info */}
            <div className="text-xs text-gray-500 text-center mt-2">
              <span className="bg-gray-100 px-2 py-1 rounded mr-2">Enter</span> Cetak Struk
              <span className="bg-gray-100 px-2 py-1 rounded ml-4 mr-2">Esc</span> Selesai Tanpa Cetak
            </div>
          </div>
        </div>
      </div>

      {/* Universal Print Modal */}
      <UniversalPrintModal
        isOpen={showPrintModal}
        onClose={handlePrintModalClose}
        printType={PRINT_TYPES.RECEIPT}
        data={transactionData}
        storeInfo={storeInfo}
      />
    </>
  );
};

export default TransactionSuccessModal;
