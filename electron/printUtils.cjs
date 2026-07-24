/**
 * Print Utilities Module
 * Provides printer detection and utility functions without PosPrinter dependency
 */

const { BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('os');

// Printer types for routing
const PRINTER_TYPES = {
  THERMAL: 'thermal',
  PDF: 'pdf',
  REGULAR: 'regular',
  HTML: 'html'
};

// Detect printer type based on printer name
const detectPrinterType = (printerName) => {
  if (!printerName) return PRINTER_TYPES.REGULAR;

  const name = String(printerName).toLowerCase();

  // Detect PDF/virtual printers
  if (name.includes('pdf') || name.includes('print to pdf') || name.includes('generic') || name === 'portprompt:') {
    return PRINTER_TYPES.PDF;
  }

  // Known thermal printers that work with raw ESC/POS
  const knownThermalKeywords = [
    'thermal', 'receipt',
    'epson tm', 'star', 'tsc',
    'zebra', 'zpl', 'esc/pos',
    '58mm', '80mm', '80x80'
  ];

  const isThermalByKeyword = knownThermalKeywords.some(keyword => name.includes(keyword));

  // Some printers don't support raw ESC/POS but are still thermal
  // They'll fall back to plain text in thermalPrintService
  const thermalPrinters = [
    'iware', 'pos-58c', 'yw58',
    'blueprint', 'eco58d', 'eco-58'
  ];

  const isThermalPrinter = thermalPrinters.some(printer => name.includes(printer));

  if (isThermalByKeyword || isThermalPrinter) {
    return PRINTER_TYPES.THERMAL;
  }

  // Also check for POS in name (but exclude IWARE and L series)
  if ((name.includes('pos') && !name.includes('l2')) && !isThermalByKeyword) {
    return PRINTER_TYPES.THERMAL;
  }

  // Default to regular printer (includes EPSON L210, inkjet, etc.)
  return PRINTER_TYPES.REGULAR;
};

// Ensure output directories exist
const ensureOutputDirs = () => {
  const tempDir = path.join(os.tmpdir(), 'n-pos-print');
  const outputDir = path.join(os.homedir(), 'Documents', 'N-POS', 'Prints');

  [tempDir, outputDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  return { temp: tempDir, output: outputDir };
};

// Print HTML content using Electron's print dialog
const printHTML = async (printerName, htmlContent, broadcastDebugFn) => {
  try {
    if (!printerName || !htmlContent) {
      throw new Error('printerName and htmlContent are required');
    }

    if (broadcastDebugFn) {
      broadcastDebugFn('printHTML invoked', { printerName, contentLength: htmlContent.length });
    }

    return new Promise((resolve, reject) => {
      const printWin = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          preload: null
        }
      });

      const html = typeof htmlContent === 'string' ? htmlContent : JSON.stringify(htmlContent);
      printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      printWin.webContents.on('did-finish-load', () => {
        if (broadcastDebugFn) {
          broadcastDebugFn('Print window loaded, initiating print');
        }

        const printOptions = {
          silent: true,
          printBackground: true,
          deviceName: printerName,
          margins: {
            marginType: 'none'
          }
        };

        printWin.webContents.print(printOptions, (success, failureReason) => {
          printWin.destroy();

          if (success) {
            if (broadcastDebugFn) {
              broadcastDebugFn('✅ HTML print successful', { printerName });
            }
            resolve({ success: true, method: 'html-print' });
          } else {
            const reason = failureReason || 'Unknown error';
            if (broadcastDebugFn) {
              broadcastDebugFn('❌ HTML print failed', { printerName, reason });
            }
            reject(new Error(`HTML print failed: ${reason}`));
          }
        });
      });

      printWin.webContents.on('crashed', () => {
        printWin.destroy();
        reject(new Error('Print window crashed'));
      });

      setTimeout(() => {
        if (!printWin.isDestroyed()) {
          printWin.destroy();
          reject(new Error('HTML print timeout'));
        }
      }, 30000);
    });
  } catch (error) {
    if (broadcastDebugFn) {
      broadcastDebugFn('❌ printHTML error', error.message);
    }
    throw error;
  }
};

module.exports = {
  PRINTER_TYPES,
  detectPrinterType,
  ensureOutputDirs,
  printHTML
};
