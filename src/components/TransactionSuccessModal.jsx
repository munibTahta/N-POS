/**
 * TransactionSuccessModal - Direct print with saved printer
 *
 * Displays successful transaction with receipt preview and print option
 * Uses UniversalPrintModal for consistent UI and shortcuts
 */

import React, { useState, useCallback } from 'react';
import { ReceiptFormatter } from '../services/ReceiptFormatter';
import { resolvePaperWidth } from '../utils/printerUtils';
import UniversalPrintModal, { PRINT_TYPES } from './UniversalPrintModal';
import { Printer } from 'lucide-react';
import usePrinter from '../hooks/usePrinter';
import { useNotifications } from '../hooks/useNotifications';
import { useSettings } from '../context/SettingsContext';

// Pratinjau = persis teks yang dikirim ke printer (ReceiptFormatter), jadi apa yang terlihat di layar sama dengan hasil cetak.
// Kertas selalu putih bertinta hitam walau tema gelap (warna lewat style inline agar tidak ikut dibalik oleh tema).
const ReceiptPaper = ({ saleData, storeInfo, printer }) => {
  const text = React.useMemo(() => {
    try {
      const paperWidth = resolvePaperWidth(printer);
      return new ReceiptFormatter({ paperWidth }).generateReceipt(saleData || {}, storeInfo || {}, paperWidth).replace(/\n+$/, '');
    } catch (_e) {
      return 'Pratinjau struk tidak tersedia';
    }
  }, [saleData, storeInfo, printer]);
  return (
    <pre
      aria-label="Pratinjau struk" data-receipt-preview
      className="m-0 overflow-x-auto rounded-sm px-3 py-4 text-left font-mono text-xs leading-snug shadow-md"
      style={{ backgroundColor: '#ffffff', color: '#111111', width: 'fit-content', maxWidth: '100%' }}
    >{text}</pre>
  );
};

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
      if (showPrintModal) return;                       // modal cetak di atasnya menangani Enter/Esc sendiri
      if (e.key === 'Escape' && !isPrinting) {
        onDone();
      } else if (e.key === 'Enter' && !isPrinting) {
        if (e.target instanceof HTMLElement && e.target.closest('button, a, input, textarea, select')) return; // jangan menimpa aksi elemen yang fokus
        e.preventDefault();
        handlePrintClick();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDone, handlePrintClick, isPrinting, showPrintModal]);

  if (!transactionData) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-40">
        <div role="dialog" aria-modal="true" aria-label="Transaksi berhasil" className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-xl w-full max-w-md text-center max-h-[90vh] overflow-y-auto">
          {/* Pratinjau Struk */}
          <div className="mb-6 flex max-h-[55vh] justify-center overflow-y-auto rounded-lg bg-gray-100 p-4 dark:bg-zinc-800">
            <ReceiptPaper saleData={transactionData} storeInfo={savedStoreInfo || storeInfo} printer={defaultPrinter} />
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
