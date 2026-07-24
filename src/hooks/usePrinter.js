/**
 * usePrinter - Professional Printer Hook
 *
 * Advanced hook for all printer operations with queue management:
 * - Print receipts (sales, purchases, test)
 * - Print barcodes and custom content
 * - Manage printer settings and capabilities
 * - Handle print state, errors, and queue monitoring
 * - Emergency stop and health checks
 */

import { useState, useCallback, useEffect } from 'react';
// Lazy import to avoid loading during preload
let professionalPrinterManager = null;

const getPrinterManager = async () => {
  if (!professionalPrinterManager) {
    const { default: manager } = await import('../services/PrinterManager');
    professionalPrinterManager = manager;
  }
  return professionalPrinterManager;
};

const PRINT_STATES = {
  IDLE: 'idle',
  PRINTING: 'printing',
  SUCCESS: 'success',
  ERROR: 'error'
};

export const usePrinter = () => {
  const [printers, setPrinters] = useState([]);
  const [defaultPrinter, setDefaultPrinter] = useState(null);
  const [printState, setPrintState] = useState({
    state: PRINT_STATES.IDLE,
    message: null,
    error: null,
    progress: 0,
    queueStatus: { pending: 0, size: 0, isPaused: false }
  });

  // Initialize printer settings on mount
  useEffect(() => {
    getPrinterManager().then(manager => {
      setDefaultPrinter(manager.getDefaultPrinter());
    });
  }, []);

  // Update queue status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      getPrinterManager().then(manager => {
        setPrintState(prev => ({
          ...prev,
          queueStatus: manager.getQueueStatus()
        }));
      });
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  /**
   * Fetch available printers with enhanced capabilities
   */
  const refreshPrinters = useCallback(async () => {
    try {
      const manager = await getPrinterManager();
      setPrintState(prev => ({
        ...prev,
        state: PRINT_STATES.PRINTING,
        message: 'Memuat daftar printer...',
        queueStatus: manager.getQueueStatus()
      }));

      const list = await manager.getPrinters();
      setPrinters(list);
      setPrintState(prev => ({
        ...prev,
        state: PRINT_STATES.SUCCESS,
        queueStatus: manager.getQueueStatus()
      }));

      return list;
    } catch (error) {
      const manager = await getPrinterManager();
      const errorMsg = error.message || 'Gagal memuat daftar printer';
      setPrintState(prev => ({
        ...prev,
        state: PRINT_STATES.ERROR,
        error: errorMsg,
        queueStatus: manager.getQueueStatus()
      }));
      throw error;
    }
  }, []);

  /**
   * Set default printer
   */
  const setDefaultPrinterFunc = useCallback(async (printerName) => {
    try {
      const manager = await getPrinterManager();
      manager.setDefaultPrinter(printerName);
      setDefaultPrinter(printerName);
      setPrintState(prev => ({
        ...prev,
        state: PRINT_STATES.SUCCESS,
        message: `Printer ${printerName} dipilih sebagai default`,
        queueStatus: manager.getQueueStatus()
      }));
    } catch (error) {
      const manager = await getPrinterManager();
      const errorMsg = error.message || 'Gagal memilih printer';
      setPrintState(prev => ({
        ...prev,
        state: PRINT_STATES.ERROR,
        error: errorMsg,
        queueStatus: manager.getQueueStatus()
      }));
      throw error;
    }
  }, []);

  /**
   * Print receipt (sales transaction) with queue management
   */
  const printReceipt = useCallback(async (saleData, storeInfo = {}, printerName = null) => {
    const manager = await getPrinterManager();
    setPrintState(prev => ({
      ...prev,
      state: PRINT_STATES.PRINTING,
      message: 'Menambahkan struk ke antrian cetak...',
      error: null,
      progress: 0,
      queueStatus: manager.getQueueStatus()
    }));

    try {
      if (!saleData) {
        throw new Error('Data penjualan diperlukan');
      }

      const result = await manager.printReceipt(saleData, storeInfo, printerName);

      setPrintState(prev => ({
        ...prev,
        state: PRINT_STATES.SUCCESS,
        message: 'Struk berhasil dicetak',
        error: null,
        progress: 100,
        queueStatus: manager.getQueueStatus()
      }));

      return result;
    } catch (error) {
      const manager = await getPrinterManager();
      const errorMsg = error.message || 'Gagal mencetak struk';
      setPrintState(prev => ({
        ...prev,
        state: PRINT_STATES.ERROR,
        message: null,
        error: errorMsg,
        progress: 0,
        queueStatus: manager.getQueueStatus()
      }));
      throw error;
    }
  }, []);

  /**
   * Print test receipt
   */
  const printTestReceipt = useCallback(async (printerName = null, storeInfo = {}) => {
    const manager = await getPrinterManager();
    setPrintState(prev => ({
      ...prev,
      state: PRINT_STATES.PRINTING,
      message: 'Menambahkan test cetak ke antrian...',
      error: null,
      progress: 0,
      queueStatus: manager.getQueueStatus()
    }));

    try {
      if (!window.electronAPI) {
        throw new Error('Electron API tidak tersedia');
      }

      const result = await manager.printTestReceipt(printerName, storeInfo);

      setPrintState(prev => ({
        ...prev,
        state: PRINT_STATES.SUCCESS,
        message: 'Test struk berhasil dicetak',
        error: null,
        progress: 100,
        queueStatus: manager.getQueueStatus()
      }));

      return result;
    } catch (error) {
      const manager = await getPrinterManager();
      const errorMsg = error.message || 'Gagal test cetak';
      setPrintState(prev => ({
        ...prev,
        state: PRINT_STATES.ERROR,
        message: null,
        error: errorMsg,
        progress: 0,
        queueStatus: manager.getQueueStatus()
      }));
      throw error;
    }
  }, []);

  /**
   * Print purchase receipt
   */
  const printPurchaseReceipt = useCallback(async (purchaseData, storeInfo = {}, printerName = null) => {
    const manager = await getPrinterManager();
    setPrintState(prev => ({
      ...prev,
      state: PRINT_STATES.PRINTING,
      message: 'Menambahkan struk pembelian ke antrian...',
      error: null,
      progress: 0,
      queueStatus: manager.getQueueStatus()
    }));

    try {
      if (!purchaseData) {
        throw new Error('Data pembelian diperlukan');
      }

      const result = await manager.printPurchaseReceipt(purchaseData, storeInfo, printerName);

      setPrintState(prev => ({
        ...prev,
        state: PRINT_STATES.SUCCESS,
        message: 'Struk pembelian berhasil dicetak',
        error: null,
        progress: 100,
        queueStatus: manager.getQueueStatus()
      }));

      return result;
    } catch (error) {
      const manager = await getPrinterManager();
      const errorMsg = error.message || 'Gagal cetak struk pembelian';
      setPrintState(prev => ({
        ...prev,
        state: PRINT_STATES.ERROR,
        message: null,
        error: errorMsg,
        progress: 0,
        queueStatus: manager.getQueueStatus()
      }));
      throw error;
    }
  }, []);

  /**
   * Print barcode labels
   */
  const printBarcodeLabels = useCallback(async (products, options = {}, printerName = null) => {
    const manager = await getPrinterManager();
    setPrintState(prev => ({
      ...prev,
      state: PRINT_STATES.PRINTING,
      message: 'Menambahkan barcode ke antrian cetak...',
      error: null,
      progress: 0,
      queueStatus: manager.getQueueStatus()
    }));

    try {
      if (!Array.isArray(products) || products.length === 0) {
        throw new Error('Data produk diperlukan');
      }

      const result = await manager.printBarcodeLabels(products, options, printerName);

      setPrintState(prev => ({
        ...prev,
        state: PRINT_STATES.SUCCESS,
        message: `${products.length} barcode berhasil dicetak`,
        error: null,
        progress: 100,
        queueStatus: manager.getQueueStatus()
      }));

      return result;
    } catch (error) {
      const manager = await getPrinterManager();
      const errorMsg = error.message || 'Gagal cetak barcode';
      setPrintState(prev => ({
        ...prev,
        state: PRINT_STATES.ERROR,
        message: null,
        error: errorMsg,
        progress: 0,
        queueStatus: manager.getQueueStatus()
      }));
      throw error;
    }
  }, []);

  /**
   * Print generic HTML content
   */
  const printHTML = useCallback(async (htmlContent, printerName = null) => {
    const manager = await getPrinterManager();
    setPrintState(prev => ({
      ...prev,
      state: PRINT_STATES.PRINTING,
      message: 'Menambahkan konten ke antrian cetak...',
      error: null,
      progress: 0,
      queueStatus: manager.getQueueStatus()
    }));

    try {
      if (!htmlContent) {
        throw new Error('Konten HTML diperlukan');
      }

      const result = await manager.printHTML(htmlContent, printerName);

      setPrintState(prev => ({
        ...prev,
        state: PRINT_STATES.SUCCESS,
        message: 'Konten berhasil dicetak',
        error: null,
        progress: 100,
        queueStatus: manager.getQueueStatus()
      }));

      return result;
    } catch (error) {
      const manager = await getPrinterManager();
      const errorMsg = error.message || 'Gagal mencetak konten';
      setPrintState(prev => ({
        ...prev,
        state: PRINT_STATES.ERROR,
        message: null,
        error: errorMsg,
        progress: 0,
        queueStatus: manager.getQueueStatus()
      }));
      throw error;
    }
  }, []);

  /**
   * Emergency stop all print jobs
   */
  const stopPrinting = useCallback(async () => {
    try {
      const manager = await getPrinterManager();
      await manager.stopQueue();
      setPrintState(prev => ({
        ...prev,
        state: PRINT_STATES.IDLE,
        message: 'Semua antrian cetak dihentikan',
        error: null,
        progress: 0,
        queueStatus: { pending: 0, size: 0, isPaused: false }
      }));
    } catch (error) {
      const manager = await getPrinterManager();
      setPrintState(prev => ({
        ...prev,
        state: PRINT_STATES.ERROR,
        error: `Gagal menghentikan cetak: ${error.message}`,
        queueStatus: manager.getQueueStatus()
      }));
    }
  }, []);

  /**
   * Pause print queue
   */
  const pauseQueue = useCallback(async () => {
    const manager = await getPrinterManager();
    manager.pauseQueue();
    setPrintState(prev => ({
      ...prev,
      queueStatus: manager.getQueueStatus()
    }));
  }, []);

  /**
   * Resume print queue
   */
  const resumeQueue = useCallback(async () => {
    const manager = await getPrinterManager();
    manager.resumeQueue();
    setPrintState(prev => ({
      ...prev,
      queueStatus: manager.getQueueStatus()
    }));
  }, []);

  /**
   * Health check for printer
   */
  const healthCheck = useCallback(async (printerName = null) => {
    try {
      const manager = await getPrinterManager();
      const result = await manager.healthCheck(printerName);
      return result;
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }, []);

  /**
   * Clear print state/message
   */
  const clearState = useCallback(async () => {
    const manager = await getPrinterManager();
    setPrintState({
      state: PRINT_STATES.IDLE,
      message: null,
      error: null,
      progress: 0,
      queueStatus: manager.getQueueStatus()
    });
  }, []);

  return {
    // State
    printers,
    defaultPrinter,
    printState,
    isPrinting: printState.state === PRINT_STATES.PRINTING,
    isSuccess: printState.state === PRINT_STATES.SUCCESS,
    isError: printState.state === PRINT_STATES.ERROR,
    queueStatus: printState.queueStatus,

    // Actions
    refreshPrinters,
    setDefaultPrinter: setDefaultPrinterFunc,
    printReceipt,
    printTestReceipt,
    printPurchaseReceipt,
    printBarcodeLabels,
    printHTML,
    stopPrinting,
    pauseQueue,
    resumeQueue,
    healthCheck,
    clearState
  };
};

export default usePrinter;
