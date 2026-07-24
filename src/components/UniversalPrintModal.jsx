/**
 * UniversalPrintModal - Consolidated print modal for all print types
 * 
 * Replaces: PrintModal, TestPrintModal, PurchasePrintModal, BarcodePrintModal
 * 
 * Supports:
 * - Receipt (sales/purchase)
 * - Test print
 * - Barcode labels
 * - Custom HTML content
 */

import React, { useState, useEffect, useCallback } from 'react';
import usePrinter from '../hooks/usePrinter';
import { useNotifications } from '../hooks/useNotifications';
import { ReceiptFormatter } from '../services/ReceiptFormatter';
import { detectPaperWidth } from '../utils/printerUtils';
import { Printer } from 'lucide-react';

const PRINT_TYPES = {
  RECEIPT: 'receipt',          // Sales receipt
  PURCHASE_RECEIPT: 'purchase',// Purchase receipt
  TEST_PRINT: 'test',          // Test print
  BARCODE_LABELS: 'barcode',   // Barcode labels
  CUSTOM_HTML: 'custom'        // Custom HTML
};

const UniversalPrintModal = ({
  isOpen,
  onClose,
  printType = PRINT_TYPES.RECEIPT,
  data,
  storeInfo = {},
  options = {},
  autoCloseDuration = 500 // Close automatically after printing
}) => {
  const { error, success } = useNotifications();
  const {
    defaultPrinter,
    printState,
    isPrinting,
    isSuccess,
    queueStatus,
    printReceipt,
    printTestReceipt,
    printPurchaseReceipt,
    printBarcodeLabels,
    printHTML,
    clearState
  } = usePrinter();

  // State management
  const [preview, setPreview] = useState('');

  // Use default printer directly, no selection needed
  const selectedPrinter = defaultPrinter;

  /**
   * Handle print action
   */
  const handlePrint = useCallback(async () => {
    try {
      if (!selectedPrinter) {
        error('Printer tidak dikonfigurasi');
        return;
      }

      clearState();

      switch (printType) {
        case PRINT_TYPES.RECEIPT:
          await printReceipt(data, storeInfo, selectedPrinter);
          break;
        case PRINT_TYPES.PURCHASE_RECEIPT:
          await printPurchaseReceipt(data, storeInfo, selectedPrinter);
          break;
        case PRINT_TYPES.TEST_PRINT:
          await printTestReceipt(selectedPrinter, storeInfo);
          break;
        case PRINT_TYPES.BARCODE_LABELS:
          await printBarcodeLabels(data, options, selectedPrinter);
          break;
        case PRINT_TYPES.CUSTOM_HTML:
          await printHTML(data?.content, selectedPrinter);
          break;
        default:
          throw new Error('Tipe cetak tidak dikenali');
      }

      if (isSuccess) {
        success(printState.message || 'Berhasil dicetak');
      }
    } catch (_error) {
      error(printState.error || 'Gagal mencetak');
    }
  }, [selectedPrinter, printType, data, storeInfo, options, error, clearState, printReceipt, printPurchaseReceipt, printTestReceipt, printBarcodeLabels, printHTML, isSuccess, success, printState]);

  // Add keyboard shortcuts for print modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !isPrinting && selectedPrinter) {
        e.preventDefault();
        handlePrint();
      } else if (e.key === 'Escape' && !isPrinting) {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPrinting, selectedPrinter, handlePrint, onClose]);

  // Auto-close when print succeeds
  useEffect(() => {
    if (isSuccess && isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDuration);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, isOpen, onClose, autoCloseDuration]);
  useEffect(() => {
    let previewContent = '';

    switch (printType) {
      case PRINT_TYPES.RECEIPT:
        if (data?.items) {
          const paperWidth = detectPaperWidth(selectedPrinter);
          const formatter = new ReceiptFormatter({ paperWidth });
          previewContent = formatter.generateReceipt(data, storeInfo);
        }
        break;
      case PRINT_TYPES.PURCHASE_RECEIPT:
        if (data?.items) {
          const paperWidth = detectPaperWidth(selectedPrinter);
          const formatter = new ReceiptFormatter({ paperWidth });
          previewContent = formatter.generatePurchaseReceipt(data, storeInfo);
        }
        break;
      case PRINT_TYPES.TEST_PRINT:
        previewContent = `
TEST CETAK PRINTER
────────────────────────────
Toko: ${storeInfo.nama_cabang || 'N-POS'}
Tanggal: ${new Date().toLocaleDateString('id-ID')}
────────────────────────────
✓ Jika teks terbaca dengan jelas
✓ Perataan teks benar
✓ Lebar kertas sesuai
────────────────────────────
Cetak Berhasil!
        `.trim();
        break;
      case PRINT_TYPES.BARCODE_LABELS:
        if (Array.isArray(data)) {
          previewContent = `
BARCODE LABELS
────────────────────────────
${data.slice(0, 5).map((p, i) => `${i + 1}. ${p.nama_produk}`).join('\n')}
${data.length > 5 ? `... dan ${data.length - 5} produk lainnya` : ''}
────────────────────────────
Total: ${data.length} label
          `.trim();
        }
        break;
      case PRINT_TYPES.CUSTOM_HTML:
        previewContent = data?.content || 'No content';
        break;
      default:
        previewContent = 'No preview available';
    }

    setPreview(previewContent);
  }, [printType, data, storeInfo, selectedPrinter]);

  if (!isOpen) return null;

  const getTitle = () => {
    switch (printType) {
      case PRINT_TYPES.RECEIPT:
        return 'Cetak Struk';
      case PRINT_TYPES.PURCHASE_RECEIPT:
        return 'Cetak Struk Pembelian';
      case PRINT_TYPES.TEST_PRINT:
        return 'Test Cetak';
      case PRINT_TYPES.BARCODE_LABELS:
        return 'Cetak Barcode';
      default:
        return 'Cetak';
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 dark:border-zinc-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center rounded-t-lg">
          <h2 className="text-lg font-bold">{getTitle()}</h2>
          <button
            onClick={onClose}
            disabled={isPrinting}
            className="text-2xl font-bold hover:bg-blue-700 rounded p-1 disabled:opacity-50 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Preview Area */}
        <div className="flex flex-col items-center p-4 bg-gray-50">
          {/* Receipt Preview */}
          {preview && (
            <div className="bg-white border-2 border-gray-300 rounded p-3 font-mono text-xs whitespace-pre-wrap max-h-[40vh] overflow-y-auto w-full" style={{ width: '300px', minWidth: '280px' }}>
              {preview}
            </div>
          )}

          {/* Loading state */}
          {!preview && (
            <div className="text-gray-500 text-sm py-8">
              Mempersiapkan preview...
            </div>
          )}
        </div>

        {/* Status Messages */}
        {printState.error && (
          <div className="mx-4 mb-4 bg-red-50 border border-red-200 p-3 rounded text-red-700 text-sm">
            {printState.error}
          </div>
        )}

        {printState.message && (
          <div className="mx-4 mb-4 bg-blue-50 border border-blue-200 p-3 rounded text-blue-700 text-sm">
            {printState.message}
          </div>
        )}

        {/* Queue Status */}
        {queueStatus && (queueStatus.pending > 0 || queueStatus.size > 0) && (
          <div className="mx-4 mb-4 bg-yellow-50 border border-yellow-200 p-3 rounded text-yellow-700 text-sm">
            🖨️ Antrian cetak: {queueStatus.pending} sedang diproses, {queueStatus.size} dalam antrian
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 p-4 border-t border-gray-200 bg-white rounded-b-lg">
          <button
            onClick={handlePrint}
            disabled={isPrinting || !selectedPrinter}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isPrinting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Sedang Cetak...
              </>
            ) : (
              <>
                <Printer className="w-4 h-4" />
                Cetak
              </>
            )}
          </button>

          <button
            onClick={onClose}
            disabled={isPrinting}
            className="w-full text-gray-600 py-2 hover:bg-gray-100 rounded-lg transition-colors text-sm disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Selesaikan Tanpa Cetak
          </button>

          {/* Keyboard Shortcuts Info */}
          <div className="text-xs text-gray-500 text-center mt-1">
            <span className="bg-gray-100 px-2 py-1 rounded mr-2">Enter</span> Cetak
            <span className="bg-gray-100 px-2 py-1 rounded ml-2">Esc</span> Tutup
          </div>
        </div>
      </div>
    </div>
  );
};

export { UniversalPrintModal, PRINT_TYPES };
export default UniversalPrintModal;
