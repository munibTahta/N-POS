/**
 * Printer utility helpers for thermal and receipt printing.
 */

const normalizePrinterName = (printerName = '') => String(printerName || '').toLowerCase().trim();

export const PRINTER_TYPES = {
  THERMAL: 'thermal',
  PDF: 'pdf',
  REGULAR: 'regular',
  BARCODE: 'barcode'
};

export const DEFAULT_THERMAL_PAPER_WIDTH = '58mm';

export const detectPrinterType = (printerName = '') => {
  const name = normalizePrinterName(printerName);

  if (!name) return PRINTER_TYPES.REGULAR;

  if (name.includes('pdf') || name.includes('print to pdf') || name.includes('generic') || name === 'portprompt:') {
    return PRINTER_TYPES.PDF;
  }

  const thermalKeywords = [
    'thermal',
    'receipt',
    'epson tm',
    'star',
    'tsc',
    'zebra',
    'zpl',
    'esc/pos',
    '58mm',
    '80mm',
    '80x80'
  ];

  if (thermalKeywords.some(keyword => name.includes(keyword))) {
    return PRINTER_TYPES.THERMAL;
  }

  if (name.includes('pos') && !name.includes('l2')) {
    return PRINTER_TYPES.THERMAL;
  }

  return PRINTER_TYPES.REGULAR;
};

export const detectPaperWidth = (printerName = '') => {
  const name = normalizePrinterName(printerName);
  
  // Thermal printer detection (prioritize explicit keywords)
  if (name.includes('100mm')) return '100mm';
  if (name.includes('80mm') || name.includes('80x80') || name.includes('star') || name.includes('seagull')) return '80mm';
  if (name.includes('58mm') || name.includes('pos-58') || name.includes('yw58') || name.includes('blueprint') || /\b58\b/.test(name)) return '58mm';
  
  // Regular printer detection
  const printerType = detectPrinterType(name);
  if (printerType !== PRINTER_TYPES.THERMAL) {
    // For regular printers, default to A4 which is most common
    if (name.includes('letter')) return 'Letter';
    if (name.includes('legal')) return 'Legal';
    if (name.includes('a5')) return 'A5';
    if (name.includes('a4') || name.includes('a-4')) return 'A4';
    // Default for regular printers
    return 'A4';
  }

  return DEFAULT_THERMAL_PAPER_WIDTH;
};

export default {
  PRINTER_TYPES,
  detectPrinterType,
  detectPaperWidth,
  DEFAULT_THERMAL_PAPER_WIDTH
};
