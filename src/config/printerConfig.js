/**
 * Printer Configuration
 * Centralized configuration for all printer-related settings
 */

export const PRINTER_CONFIG = {
  // Printer types
  TYPES: {
    THERMAL: 'thermal',      // ESC/POS thermal printer
    STANDARD: 'standard',    // Regular office/inkjet printer
    NETWORK: 'network',      // Network-connected printer
    BARCODE: 'barcode'       // Label/barcode printer
  },

  // Paper sizes (width in mm, chars at 12pt monospace)
  PAPER_SIZES: {
    '58mm': {
      width: 58,
      pixels: 225,
      chars: 32,
      label: '58mm (Thermal)',
      ideal_for: ['thermal', 'barcode']
    },
    '80mm': {
      width: 80,
      pixels: 300,
      chars: 48,
      label: '80mm (Thermal)',
      ideal_for: ['thermal']
    },
    '100mm': {
      width: 100,
      pixels: 375,
      chars: 60,
      label: '100mm (Wide)',
      ideal_for: ['thermal']
    },
    'A4': {
      width: 210,
      pixels: 794,
      chars: 120,
      label: 'A4 (Standard)',
      ideal_for: ['standard', 'network']
    },
    'A5': {
      width: 148,
      pixels: 560,
      chars: 85,
      label: 'A5 (Half A4)',
      ideal_for: ['standard', 'network']
    }
  },

  // Default settings
  DEFAULTS: {
    printer_type: 'thermal',
    paper_size: '58mm',
    orientation: 'portrait',
    margin_left: 5,
    margin_right: 5,
    margin_top: 5,
    margin_bottom: 5,
    scale: 100,
    darkness: 100,              // 50-150 (thermal only)
    auto_cut: true,            // Auto cut paper (thermal)
    network_timeout: 30000,    // 30 seconds
    copies: 1,
    auto_print: false           // Auto print without dialog
  },

  // Paper size by printer type recommendations
  RECOMMENDED_SIZES: {
    'thermal': ['58mm', '80mm', '100mm'],
    'standard': ['A4', 'A5'],
    'network': ['A4', 'A5'],
    'barcode': ['58mm', '80mm']
  },

  // Darkness levels (thermal printers)
  DARKNESS_LEVELS: {
    VERY_LIGHT: 50,
    LIGHT: 75,
    NORMAL: 100,
    DARK: 125,
    VERY_DARK: 150
  },

  // Scale levels (percentage)
  SCALE_LEVELS: {
    VERY_SMALL: 50,
    SMALL: 75,
    NORMAL: 100,
    LARGE: 125,
    VERY_LARGE: 150
  },

  // LocalStorage keys
  STORAGE_KEYS: {
    PRINTER_NAME: 'defaultPrinterName',
    PRINTER_TYPE: 'printerType',
    PAPER_SIZE: 'printerPaperSize',
    ORIENTATION: 'printerOrientation',
    MARGIN_LEFT: 'printerMarginLeft',
    MARGIN_RIGHT: 'printerMarginRight',
    MARGIN_TOP: 'printerMarginTop',
    MARGIN_BOTTOM: 'printerMarginBottom',
    SCALE: 'printerScale',
    DARKNESS: 'printerDarkness',
    AUTO_CUT: 'printerAutoCut',
    NETWORK_TIMEOUT: 'printerNetworkTimeout',
    COPIES: 'printerCopies',
    AUTO_PRINT: 'printerAutoPrint'
  },

  // IPC channels
  IPC: {
    GET_PRINTERS: 'get-printers',
    PRINT_THERMAL: 'print-thermal',
    PRINT_HTML: 'print-html',
    PRINT_RECEIPT_ELECTRON: 'print-receipt-electron',
    PRINT_RAW: 'print-raw'
  },

  // Error messages
  MESSAGES: {
    PRINTER_NOT_CONFIGURED: 'Printer tidak dikonfigurasi',
    PRINTER_NOT_FOUND: 'Printer tidak ditemukan',
    NO_PRINTERS_AVAILABLE: 'Tidak ada printer yang tersedia',
    PRINT_FAILED: 'Gagal mencetak',
    INVALID_DATA: 'Data tidak valid',
    INVALID_PAPER_SIZE: 'Ukuran kertas tidak didukung',
    ELECTRON_API_NOT_AVAILABLE: 'Electron API tidak tersedia'
  },

  // Feature flags
  FEATURES: {
    ENABLE_AUTO_CUT: true,           // Support auto-cut for thermal
    ENABLE_DARKNESS_CONTROL: true,   // Support darkness adjustment
    ENABLE_TEST_PRINT: true,         // Enable test print feature
    ENABLE_MULTIPLE_COPIES: true,    // Support printing multiple copies
    ENABLE_NETWORK_PRINTER: true,    // Support network printers
    ENABLE_BARCODE_PRINT: true       // Support barcode printing
  }
};

/**
 * Get paper size config
 */
export const getPaperSizeConfig = (size) => {
  return PRINTER_CONFIG.PAPER_SIZES[size] || PRINTER_CONFIG.PAPER_SIZES['58mm'];
};

/**
 * Get recommended paper sizes for printer type
 */
export const getRecommendedPaperSizes = (printerType) => {
  const recommended = PRINTER_CONFIG.RECOMMENDED_SIZES[printerType] || [];
  return recommended.map(size => PRINTER_CONFIG.PAPER_SIZES[size]).filter(Boolean);
};

/**
 * Validate printer settings
 */
export const validatePrinterSettings = (settings) => {
  const errors = [];

  if (!settings.printer_name) {
    errors.push('Nama printer diperlukan');
  }

  if (!PRINTER_CONFIG.TYPES[settings.printer_type?.toUpperCase()]) {
    errors.push(`Tipe printer tidak didukung: ${settings.printer_type}`);
  }

  if (!PRINTER_CONFIG.PAPER_SIZES[settings.paper_size]) {
    errors.push(`Ukuran kertas tidak didukung: ${settings.paper_size}`);
  }

  if (settings.scale && (settings.scale < 50 || settings.scale > 150)) {
    errors.push('Skala harus antara 50-150%');
  }

  if (settings.darkness && (settings.darkness < 50 || settings.darkness > 150)) {
    errors.push('Tingkat kegelapan harus antara 50-150');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Get default settings
 */
export const getDefaultSettings = (printerType = 'thermal') => {
  return {
    ...PRINTER_CONFIG.DEFAULTS,
    printer_type: printerType,
    paper_size: PRINTER_CONFIG.RECOMMENDED_SIZES[printerType]?.[0] || '58mm'
  };
};

export default PRINTER_CONFIG;
