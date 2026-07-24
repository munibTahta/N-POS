/**
 * ProfessionalPrinterManager - Advanced Printer Management Service
 *
 * Professional-grade printer communication for POS systems:
 * - Native Windows Print Spooler integration
 * - Raw ESC/POS commands for thermal printers
 * - Advanced print queue management
 * - Automatic error recovery and retry logic
 * - Multi-printer type support (thermal, inkjet, laser)
 * - Real-time queue monitoring
 */

import PQueue from 'p-queue';
import { ReceiptFormatter } from './ReceiptFormatter';
import { detectPaperWidth } from '../utils/printerUtils';

class ProfessionalPrinterManager {
  constructor() {
    this.printQueue = new PQueue({
      concurrency: 1, // Sequential printing
      timeout: 120000, // 120 second timeout per job
      throwOnTimeout: true
    });
    this.defaultPrinter = null;
    this.printerList = [];
    this.formatter = new ReceiptFormatter();
    this._initializeFromStorage();
    this._setupDebugListener();
    this._setupQueueEventHandlers();
  }

  /**
   * Initialize printer settings from localStorage
   */
  _initializeFromStorage() {
    this.defaultPrinter = localStorage.getItem('defaultPrinterName') || null;
  }

  /**
   * Setup debug listener for main process print debugging
   */
  _setupDebugListener() {
    if (window.electronAPI?.onPrintDebug) {
      window.electronAPI.onPrintDebug((message) => {
      });
    }
  }

  /**
   * Setup queue event handlers for monitoring
   */
  _setupQueueEventHandlers() {
    this.printQueue.on('active', () => {
    });

    this.printQueue.on('idle', () => {
    });

    this.printQueue.on('error', (error) => {
      console.error('[PrinterManager] Queue error:', error);
    });
  }

  /**
   * Get list of available system printers with enhanced capabilities
   */
  async getPrinters() {
    try {
      if (!window.electronAPI?.getPrinters) {
        throw new Error('Electron API tidak tersedia');
      }

      // Get Windows printers via Electron
      const electronPrinters = await window.electronAPI.getPrinters();

      // Enhance with capabilities detection
      this.printerList = electronPrinters.map(printer => ({
        ...printer,
        capabilities: this._detectCapabilities(printer.name),
        type: this._detectPrinterType(printer.name),
        status: 'ready' // Assume ready unless proven otherwise
      }));
      return this.printerList;
    } catch (error) {
      console.error('[PrinterManager] Error getting printers:', error);
      throw new Error(`Gagal memuat daftar printer: ${error.message}`);
    }
  }

  /**
   * Detect printer capabilities based on name and known patterns
   */
  _detectCapabilities(printerName) {
    const name = String(printerName || '').toLowerCase();
    return {
      thermal: name.includes('thermal') || name.includes('58mm') || name.includes('80mm') || 
               name.includes('receipt') || /\b58\b/.test(name) || /\b80\b/.test(name) ||
               name.includes('pos-') || name.startsWith('pos ') ||
               name.includes('tm-t') || name.includes('escpos') || name.includes('esc/pos'),
      escpos: name.includes('epson') || name.includes('star') || name.includes('bixolon') || 
              name.includes('citizen') || name.includes('escpos') || name.includes('esc/pos'),
      usb: name.includes('usb') || !name.includes('network') || !name.includes('lan'),
      network: name.includes('network') || name.includes('lan') || name.includes('tcp'),
      highDpi: name.includes('laser') || name.includes('inkjet') || name.includes('color'),
      duplex: name.includes('duplex') || name.includes('double'),
      color: name.includes('color') || name.includes('rgb')
    };
  }

  /**
   * Detect printer type for optimal printing method selection
   */
  _detectPrinterType(printerName) {
    const name = String(printerName || '').toLowerCase();

    // PDF printer
    if (name.includes('pdf') || name.includes('print to pdf')) return 'pdf';
    
    // THERMAL PRINTER - Common patterns
    if (
      // Generic thermal keywords
      name.includes('thermal') || 
      name.includes('receipt') ||
      
      // Paper width patterns (with and without 'mm')
      name.includes('58mm') || name.includes('58 mm') || 
      name.includes('80mm') || name.includes('80 mm') ||
      /\b58\b/.test(name) || /\b80\b/.test(name) || // Matches '58' or '80' as standalone numbers
      
      // Common thermal printer brands & models
      name.includes('pos-') || name.startsWith('pos ') || // POS printers
      name.includes('tm-t') || name.includes('tm t') || // Epson TM-T series (thermal)
      name.includes('star') || // Star Micronics (thermal by default)
      name.includes('bixolon') || // Bixolon (thermal)
      name.includes('citizen') || // Citizen
      name.includes('escpos') || name.includes('esc/pos') // ESC/POS protocol = thermal
    ) return 'thermal';
    
    // Laser printer
    if (name.includes('laser')) return 'laser';
    
    // Inkjet printer
    if (name.includes('inkjet') || name.includes('color')) return 'inkjet';
    
    // Dot matrix printer
    if (name.includes('dot') || name.includes('matrix')) return 'dotmatrix';

    return 'regular';
  }

  /**
   * Get printer paper width override or detect from printer name
   */
  _getPaperWidth(printerName = '') {
    const overrideWidth = localStorage.getItem('printerPaperWidth');
    if (overrideWidth && typeof overrideWidth === 'string' && overrideWidth.trim()) {
      return overrideWidth.trim();
    }
    const detectedWidth = detectPaperWidth(printerName);
    return detectedWidth;
  }

  /**
   * Set default printer
   */
  setDefaultPrinter(printerName) {
    if (!printerName) throw new Error('Nama printer diperlukan');
    this.defaultPrinter = printerName;
    localStorage.setItem('defaultPrinterName', printerName);
  }

  /**
   * Get current default printer
   */
  getDefaultPrinter() {
    return this.defaultPrinter;
  }

  /**
   * Professional print receipt with queue management and error recovery
   */
  async printReceipt(saleData, storeInfo = {}, printerName = null) {
    const printer = printerName || this.defaultPrinter;
    if (!printer) throw new Error('Printer tidak dikonfigurasi');

    const maxRetries = 3;
    let attempt = 0;
    let lastError = null;

    // Detect printer type to route to correct printing method
    const printerType = this._detectPrinterType(printer);
    while (attempt < maxRetries) {
      attempt += 1;

      try {
        return await this.printQueue.add(async () => {
          // Route to appropriate print method based on printer type
          if (printerType === 'thermal' || printerType === 'dotmatrix') {
            return await this._printThermal(saleData, storeInfo, printer);
          } else {
            // For regular, inkjet, laser, pdf printers - use Windows Print Driver
            return await this._printRegular(saleData, storeInfo, printer, printerType);
          }
        });
      } catch (error) {
        lastError = error;
        console.error('[PrinterManager] Print job failed on attempt', attempt, error);

        if (attempt < maxRetries) {
          const delayMs = 1000 * Math.pow(2, attempt - 1);
          console.warn(`[PrinterManager] Retrying print job (${attempt + 1}/${maxRetries}) in ${delayMs}ms`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        throw new Error(`Gagal cetak struk setelah ${attempt} percobaan: ${error.message}`);
      }
    }

    throw new Error(`Gagal cetak struk setelah ${maxRetries} percobaan: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Print using the QZ Tray thermal printing path.
   */
  async _printThermal(saleData, _storeInfo, printerName) {
    try {
      const paperWidth = this._getPaperWidth(printerName);
      if (!window.electronAPI?.printThermal) {
        throw new Error('Electron thermal print API tidak tersedia');
      }

      const receiptData = this.formatter.formatReceipt(saleData, _storeInfo, {
        paperWidth: paperWidth
      });
      await window.electronAPI.printThermal({
        printerName,
        content: receiptData.content,
        paperWidth: receiptData.paperWidth
      });
      return { success: true, method: 'qz-tray-thermal' };
    } catch (error) {
      console.error('[PrinterManager] IPC thermal print error:', error);
      throw new Error(`Gagal cetak thermal: ${error.message}`);
    }
  }

  /**
   * Print using Windows Print Driver for regular printers (Inkjet, Laser, etc)
   */
  async _printRegular(saleData, storeInfo, printerName, printerType) {
    try {
      const paperWidth = this._getPaperWidth(printerName);
      if (!window.electronAPI?.printRegular) {
        throw new Error('Electron regular print API tidak tersedia');
      }

      // Use the new HTML generation for better regular printer formatting
      const receiptData = this.formatter.formatReceiptFull(saleData, storeInfo, {
        paperWidth: paperWidth
      });
      await window.electronAPI.printRegular({
        printerName,
        htmlContent: receiptData.htmlContent,
        plainText: receiptData.content,
        printerType
      });
      return { success: true, method: 'windows-print-driver', type: printerType };
    } catch (error) {
      console.error('[PrinterManager] Windows Print Driver error:', error);
      throw new Error(`Gagal cetak via Windows Print Driver: ${error.message}`);
    }
  }

  /**
   * Detect paper width from printer name or return default
   */
  _detectPaperWidth(printerName = '') {
    return detectPaperWidth(printerName);
  }

  /**
   * Print test receipt
   */
  async printTestReceipt(printerName = null, storeInfo = {}) {
    const printer = printerName || this.defaultPrinter;
    if (!printer) throw new Error('Printer tidak dikonfigurasi');

    const testData = {
      no_struk: 'TEST-001',
      kode_transaksi: 'TEST-' + new Date().getFullYear() + '-001',
      kasir: 'TEST USER',
      tanggal: new Date(),
      items: [
        {
          nama_produk: 'Test Product A - Long Name untuk testing wrapping',
          jumlah: 2,
          harga_jual: 50000,
          subtotal: 100000
        },
        {
          nama_produk: 'Test Product B',
          jumlah: 1,
          harga_jual: 75000,
          subtotal: 75000
        }
      ],
      subtotal: 175000,
      diskon: 0,
      pajak: 17500,
      total: 192500,
      bayar: 192500,
      metode_bayar: 'TUNAI'
    };

    const defaultStoreInfo = {
      nama_cabang: storeInfo.nama_cabang || 'TEST TOKO',
      alamat: storeInfo.alamat || 'Jl. Test No. 123',
      no_telp: storeInfo.no_telp || '021-TEST',
      struk_footer: storeInfo.struk_footer || 'Terima Kasih Telah Berbelanja!'
    };

    return await this.printReceipt(testData, defaultStoreInfo, printer);
  }

  /**
   * Print purchase receipt
   */
  async printPurchaseReceipt(purchaseData, storeInfo = {}, printerName = null) {
    if (!purchaseData) throw new Error('Data pembelian diperlukan');

    const printer = printerName || this.defaultPrinter;
    if (!printer) throw new Error('Printer tidak dikonfigurasi');

    const paperWidth = this._getPaperWidth(printer);

    return this.printQueue.add(async () => {
      try {
        const receiptContent = this.formatter.generatePurchaseReceipt(purchaseData, storeInfo, paperWidth);
        const content = this._stripHtml(receiptContent);

        await this._printText(printer, content, paperWidth);
        return { success: true, method: 'qz-tray-purchase' };
      } catch (error) {
        console.error('[PrinterManager] Print purchase receipt error:', error);
        throw new Error(`Gagal cetak struk pembelian: ${error.message}`);
      }
    });
  }

  /**
   * Print barcode labels
   */
  async printBarcodeLabels(products, options = {}, printerName = null) {
    if (!Array.isArray(products) || products.length === 0) {
      throw new Error('Data produk diperlukan');
    }

    const printer = printerName || this.defaultPrinter;
    if (!printer) throw new Error('Printer tidak dikonfigurasi');

    const paperWidth = this._getPaperWidth(printer);

    return this.printQueue.add(async () => {
      try {
        const barcodeContent = this._generateBarcodeContent(products, options);
        await this._printText(printer, barcodeContent, paperWidth);

        return { success: true, method: 'qz-tray-barcode', count: products.length };
      } catch (error) {
        console.error('[PrinterManager] Print barcode error:', error);
        throw new Error(`Gagal cetak barcode: ${error.message}`);
      }
    });
  }

  /**
   * Generate barcode content HTML
   */
  _generateBarcodeContent(products, _options) {
    let content = `BARCODE LABELS\n`;
    content += `Total: ${products.length} produk\n\n`;

    products.forEach((product, index) => {
      const barcode = product.kode_produk || product.kode_barcode || String(product.id || index);
      const name = product.nama_produk || 'Product';
      const price = product.harga_jual || product.harga_satuan || 0;

      content += `${index + 1}. ${name}\n`;
      content += `   Code: ${barcode}\n`;
      content += `   Price: Rp ${price.toLocaleString('id-ID')}\n\n`;
    });

    return content;
  }

  /**
   * Print generic HTML content
   */
  async printHTML(htmlContent, printerName = null) {
    if (!htmlContent) throw new Error('Konten HTML diperlukan');

    const printer = printerName || this.defaultPrinter;
    if (!printer) throw new Error('Printer tidak dikonfigurasi');

    const paperWidth = this._getPaperWidth(printer);

    return this.printQueue.add(async () => {
      try {
        const content = this._stripHtml(htmlContent);
        await this._printText(printer, content, paperWidth);

        return { success: true, method: 'qz-tray-html' };
      } catch (error) {
        console.error('[PrinterManager] Print HTML error:', error);
        throw new Error(`Gagal mencetak konten: ${error.message}`);
      }
    });
  }

  /**
   * Convert plain text to HTML for printing
   */
  _convertToHTML(plainText) {
    const escapedText = String(plainText || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      line-height: 1.2;
      margin: 0;
      padding: 10px;
      width: 80mm;
    }
    pre {
      margin: 0;
      padding: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    @media print {
      body { margin: 0; padding: 0; }
    }
  </style>
</head>
<body>
  <pre>${escapedText}</pre>
</body>
</html>`;
  }

  _stripHtml(htmlContent) {
    return String(htmlContent || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async _printText(printerName, content, paperWidth = null) {
    if (!window.electronAPI?.printThermal) {
      throw new Error('Electron thermal print API tidak tersedia');
    }
    const finalPaperWidth = paperWidth || this._getPaperWidth(printerName);
    const trimmed = String(content || '').trim();
    if (!trimmed) {
      throw new Error('Konten cetak kosong');
    }

    return await window.electronAPI.printThermal({
      printerName,
      content: trimmed,
      paperWidth: finalPaperWidth
    });
  }

  /**
   * Get queue status for monitoring
   */
  getQueueStatus() {
    return {
      pending: this.printQueue.pending,
      size: this.printQueue.size,
      isPaused: this.printQueue.isPaused,
      timeout: this.printQueue.timeout
    };
  }

  /**
   * Pause print queue
   */
  pauseQueue() {
    this.printQueue.pause();
  }

  /**
   * Resume print queue
   */
  resumeQueue() {
    this.printQueue.start();
  }

  /**
   * Emergency stop - clear all pending jobs
   */
  async stopQueue() {
    this.printQueue.clear();
    if (this.escposDevice) {
      try {
        this.escposDevice.close();
        this.escposDevice = null;
      } catch (error) {
        console.warn('[PrinterManager] Error closing ESC/POS device:', error);
      }
    }
  }

  /**
   * Get formatter instance for custom formatting
   */
  getFormatter() {
    return this.formatter;
  }

  /**
   * Health check for printer connectivity
   *
   * NOTE: This should never perform a real print.
   * A test print is only for explicit user request.
   */
  async healthCheck(printerName = null) {
    const printer = printerName || this.defaultPrinter;
    if (!printer) return { status: 'no_printer_configured' };

    try {
      if (!window.electronAPI?.getPrinters) {
        return { status: 'healthy', printer };
      }

      const printers = await window.electronAPI.getPrinters();
      const found = Array.isArray(printers) && printers.some(p => String(p.name || p.deviceName || '').trim() === printer);

      return found
        ? { status: 'healthy', printer }
        : { status: 'unhealthy', printer, error: 'Printer tidak ditemukan' };
    } catch (error) {
      return { status: 'unhealthy', printer, error: error.message };
    }
  }
}

// Export singleton instance
export const professionalPrinterManager = new ProfessionalPrinterManager();
export default professionalPrinterManager;
