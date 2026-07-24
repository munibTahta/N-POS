import React, { useState, useEffect } from 'react';
import offlineDataSync from '../services/offlineDataSync';
import { toast } from 'react-toastify';
import { Printer } from 'lucide-react';

/**
 * Offline Receipt Printer
 * - Automatic print for offline transactions
 * - Reprint capability for previous transactions
 * - Receipt history stored locally
 */
const OfflineReceiptPrinter = ({ 
  isOpen, 
  onClose, 
  receiptData, 
  isPrinting = false, 
  onPrint,
  isOffline = false 
}) => {
  const [printHistory, setPrintHistory] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load print history when component mounts or goes online
  useEffect(() => {
    if (isOpen && isOffline) {
      loadPrintHistory();
    }
  }, [isOpen, isOffline]);

  /**
   * Load receipt history from offline storage
   */
  const loadPrintHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const history = await offlineDataSync.getPrintableTransactions(50);
      setPrintHistory(history);
    } catch (error) {
      console.error('Error loading print history:', error);
      toast.error('Gagal memuat riwayat struk');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  /**
   * Handle print action
   */
  const handlePrint = async () => {
    try {
      if (isPrinting) return;
      
      const toPrint = selectedReceipt || receiptData;
      if (!toPrint) {
        toast.error('Tidak ada data struk untuk dicetak');
        return;
      }

      // Store print job
      await offlineDataSync.storePrintJob(toPrint);
      
      // Trigger print
      if (onPrint) {
        onPrint(toPrint);
      } else {
        window.print();
      }

      toast.success('Struk berhasil dicetak');
      
      // Close after delay
      setTimeout(() => onClose?.(), 1000);
    } catch (error) {
      console.error('Error printing receipt:', error);
      toast.error('Gagal mencetak struk');
    }
  };

  /**
   * Format receipt for display
   */
  const formatReceipt = (receipt) => {
    if (!receipt) return null;

    const formatCurrency = (num) => 
      new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        minimumFractionDigits: 0 
      }).format(num || 0);

    const date = new Date(receipt.timestamp).toLocaleDateString('id-ID');
    const time = new Date(receipt.timestamp).toLocaleTimeString('id-ID');

    return (
      <div className="font-mono text-sm space-y-1">
        <div className="text-center font-bold text-base mb-2">STRUK PENJUALAN</div>
        <div className="border-t border-dashed py-1">
          <div className="flex justify-between">
            <span>No: {receipt.no_struk || receipt.id}</span>
            <span>{date}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Jam: {time}</span>
          </div>
        </div>

        <div className="border-t border-dashed py-1">
          <div className="text-xs font-semibold mb-1">ITEM</div>
          {receipt.items?.map((item, idx) => (
            <div key={idx} className="text-xs">
              <div className="flex justify-between">
                <span className="flex-1">{item.nama_produk}</span>
                <span>{item.qty}x</span>
              </div>
              <div className="flex justify-between text-right">
                <span className="flex-1"></span>
                <span>{formatCurrency(item.subtotal)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed py-1">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatCurrency(receipt.subtotal)}</span>
          </div>
          {receipt.diskon > 0 && (
            <div className="flex justify-between">
              <span>Diskon:</span>
              <span>-{formatCurrency(receipt.diskon)}</span>
            </div>
          )}
          {receipt.pajak > 0 && (
            <div className="flex justify-between">
              <span>Pajak:</span>
              <span>{formatCurrency(receipt.pajak)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base mt-1">
            <span>Total:</span>
            <span>{formatCurrency(receipt.total)}</span>
          </div>
        </div>

        <div className="border-t border-dashed py-1">
          <div className="flex justify-between text-xs">
            <span>Metode:</span>
            <span>{receipt.metode_pembayaran || 'Cash'}</span>
          </div>
          {receipt.metode_pembayaran !== 'Cash' && (
            <div className="flex justify-between text-xs">
              <span>Ref: {receipt.reference_number}</span>
            </div>
          )}
        </div>

        <div className="border-t border-dashed py-1 text-center text-xs">
          <p>Terima kasih telah berbelanja</p>
          <p className="text-xs">Offline - {new Date().toLocaleDateString('id-ID')}</p>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-96 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 flex justify-between items-center">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span>🖨️</span> Cetak Struk {isOffline && '(OFFLINE)'}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-700 p-1 rounded"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4">
          {isOffline && printHistory.length > 0 && !selectedReceipt && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm mb-3">📋 Riwayat Struk (Cetak Ulang)</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {printHistory.map((receipt) => (
                  <button
                    key={receipt.id}
                    onClick={() => setSelectedReceipt(receipt)}
                    className="w-full text-left p-2 border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-400 transition text-sm"
                  >
                    <div className="flex justify-between">
                      <span className="font-semibold">{receipt.no_struk || receipt.id}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(receipt.timestamp).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">
                      Total: Rp {(receipt.total || 0).toLocaleString('id-ID')}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedReceipt && (
            <div className="border border-gray-300 rounded p-4 bg-gray-50 font-mono text-sm">
              {formatReceipt(selectedReceipt)}
            </div>
          )}

          {!selectedReceipt && receiptData && (
            <div className="border border-gray-300 rounded p-4 bg-gray-50">
              {formatReceipt(receiptData)}
            </div>
          )}

          {!selectedReceipt && !receiptData && isLoadingHistory && (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-2"></div>
              <p className="text-gray-500">Memuat riwayat struk...</p>
            </div>
          )}

          {isOffline && printHistory.length === 0 && !receiptData && (
            <div className="text-center py-8 text-gray-500">
              <p>📭 Belum ada riwayat struk</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-100 p-4 flex justify-end gap-3 border-t">
          {selectedReceipt && (
            <button
              onClick={() => setSelectedReceipt(null)}
              className="px-4 py-2 text-gray-700 bg-gray-300 rounded hover:bg-gray-400 transition"
            >
              ← Kembali
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-300 rounded hover:bg-gray-400 transition"
          >
            Batal
          </button>
          <button
            onClick={handlePrint}
            disabled={isPrinting || (!receiptData && !selectedReceipt)}
            className={`px-4 py-2 text-white rounded transition flex items-center gap-2 ${
              isPrinting || (!receiptData && !selectedReceipt)
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isPrinting && <span className="animate-spin">⟳</span>}
            <Printer className="w-4 h-4 inline" />
            <span className="ml-1">Cetak</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfflineReceiptPrinter;
