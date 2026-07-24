/**
 * ReceiptFormatter - Single source of truth for all receipt formatting
 * 
 * Consolidates all receipt formatting logic that was previously scattered across:
 * - ThermalReceiptService.js
 * - printHelper.js
 * - printService.cjs
 * 
 * Supports: Thermal 58/80/100mm, text-based formatting, safe wrapping/truncation
 */

export class ReceiptFormatter {
  constructor(options = {}) {
    // Support both thermal and regular printer paper sizes
    this.PAPER_WIDTHS = {
      // Thermal printer sizes (ESC/POS)
      '58mm': 32,
      '80mm': 48,
      '100mm': 60,
      
      // Regular printer sizes
      'A4': 80,      // 210mm width, typically 80 chars at 10 CPI
      'A5': 50,      // 148mm width, smaller format
      'Letter': 80,  // 8.5 inches width
      'Legal': 80    // 8.5 inches width (similar layout)
    };
    const storageWidth = localStorage.getItem('printerPaperWidth');
    this.paperWidth = options.paperWidth || storageWidth || '58mm';
    this.charWidth = this.PAPER_WIDTHS[this.paperWidth] || 32;
    
    void 0 && ('[ReceiptFormatter] Init:', {
      optionWidth: options.paperWidth || 'undefined',
      storageWidth: storageWidth || 'undefined',
      finalWidth: this.paperWidth,
      charWidth: this.charWidth
    });
  }

  _getCharWidth(paperWidth = this.paperWidth) {
    const width = paperWidth || this.paperWidth;
    if (!this.PAPER_WIDTHS[width]) {
      throw new Error(`Invalid paper width: ${width}`);
    }
    return this.PAPER_WIDTHS[width];
  }

  setPaperWidth(width) {
    if (!this.PAPER_WIDTHS[width]) {
      throw new Error(`Invalid paper width: ${width}`);
    }
    this.paperWidth = width;
    this.charWidth = this.PAPER_WIDTHS[width];
    localStorage.setItem('printerPaperWidth', width);
  }

  formatCurrency(num) {
    // Use simple Rp formatting to avoid encoding issues with thermal printers
    return `Rp ${Math.round(num || 0).toLocaleString('id-ID')}`;
  }

  centerText(text, width = this.charWidth) {
    if (!text) return '\n';
    const str = String(text).substring(0, width);
    const padding = Math.max(0, Math.floor((width - str.length) / 2));
    return `${' '.repeat(padding)}${str}\n`;
  }

  leftRight(left, right, width = this.charWidth) {
    const l = String(left || '').substring(0, Math.floor(width * 0.6));
    const r = String(right || '').substring(0, Math.floor(width * 0.4));
    const spaces = Math.max(1, width - l.length - r.length);
    return `${l}${' '.repeat(spaces)}${r}\n`;
  }

  divider(width = this.charWidth) {
    return `${'-'.repeat(width)}\n`;
  }

  wrapText(text, width = this.charWidth) {
    if (!text) return [];
    const words = String(text).split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
      if (word.length > width) {
        if (currentLine) lines.push(currentLine);
        for (let i = 0; i < word.length; i += width) {
          lines.push(word.substring(i, i + width));
        }
        currentLine = '';
      } else if ((currentLine + ' ' + word).trim().length > width) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      }
    });

    if (currentLine) lines.push(currentLine);
    return lines;
  }

  truncateText(text, width = this.charWidth, suffix = '...') {
    if (!text) return '';
    const str = String(text);
    if (str.length <= width) return str;
    const maxLength = width - suffix.length;
    return str.substring(0, Math.max(1, maxLength)) + suffix;
  }

  _getKasirName(saleData) {
    if (typeof saleData.kasir === 'string' && saleData.kasir && saleData.kasir !== 'Unknown') {
      return saleData.kasir;
    }
    return saleData.kasir?.nama_user || saleData.kasir?.name || 'Unknown';
  }

  formatReceipt(saleData, storeInfo = {}, options = {}) {
    const paperWidth = options.paperWidth || this.paperWidth;
    void 0 && ('[ReceiptFormatter.formatReceipt] Paper width:', {
      optionWidth: options.paperWidth || 'undefined',
      thisWidth: this.paperWidth,
      finalWidth: paperWidth
    });
    
    const content = this.generateReceipt(saleData, storeInfo, paperWidth);
    return {
      content,
      paperWidth
    };
  }

  generateReceipt(saleData, storeInfo = {}, paperWidth = this.paperWidth) {
    const charWidth = this._getCharWidth(paperWidth);
    let receipt = '';
    
    // Header
    receipt += this.centerText(storeInfo.nama_cabang || 'TOKO', charWidth);
    if (storeInfo.alamat) receipt += this.centerText(storeInfo.alamat, charWidth);
    if (storeInfo.no_telp) receipt += this.centerText(storeInfo.no_telp, charWidth);
    receipt += this.divider(charWidth);

    if (storeInfo.struk_header) {
      receipt += this.centerText(storeInfo.struk_header, charWidth);
      receipt += this.divider(charWidth);
    }

    // Transaction info
    const now = new Date(saleData.tanggal || Date.now());
    const noStruk = saleData.no_struk || saleData.kode_transaksi || '';
    const kasirName = this._getKasirName(saleData);

    receipt += this.leftRight(`No: ${noStruk}`, now.toLocaleDateString('id-ID'), charWidth);
    receipt += this.leftRight(
      `Kasir: ${kasirName}`,
      now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      charWidth
    );
    receipt += this.divider(charWidth);

    // Items
    const items = saleData.items || [];
    items.forEach(item => {
      const productName = this.truncateText(
        item.nama_produk || item.product?.nama_produk || `Produk (ID: ${item.id_produk})`,
        charWidth
      );
      receipt += `${productName}\n`;

      const qty = item.jumlah || item.qty || 0;
      const price = item.harga_jual || item.harga_satuan || 0;
      const subtotal = item.subtotal || (qty * price) || 0;

      receipt += this.leftRight(
        `${qty}x ${this.formatCurrency(price)}`,
        this.formatCurrency(subtotal),
        charWidth
      );
    });

    receipt += this.divider(charWidth);

    // Totals
    if (saleData.subtotal && saleData.subtotal !== saleData.total) {
      receipt += this.leftRight('Subtotal', this.formatCurrency(saleData.subtotal), charWidth);
    }

    if (saleData.diskon && saleData.diskon > 0) {
      receipt += this.leftRight('Diskon', `-${this.formatCurrency(saleData.diskon)}`, charWidth);
    }

    if (saleData.pajak && saleData.pajak > 0) {
      receipt += this.leftRight('Pajak', this.formatCurrency(saleData.pajak), charWidth);
    }

    receipt += this.leftRight('TOTAL', this.formatCurrency(saleData.total), charWidth);
    receipt += this.divider(charWidth);

    // Payment
    receipt += this.leftRight('Bayar', this.formatCurrency(saleData.bayar || saleData.total), charWidth);

    const kembali = (saleData.bayar || saleData.total) - saleData.total;
    if (kembali > 0) {
      receipt += this.leftRight('Kembali', this.formatCurrency(kembali), charWidth);
    }

    // Optional customer info
    if (saleData.pelanggan) {
      receipt += this.divider(charWidth);
      receipt += this.centerText('Pelanggan', charWidth);
      receipt += this.leftRight(`Nama: ${saleData.pelanggan.nama_pelanggan}`, '', charWidth);
      if (saleData.pelanggan.no_telepon) {
        receipt += this.leftRight(`Telp: ${saleData.pelanggan.no_telepon}`, '', charWidth);
      }
    }

    // Optional voucher info
    if (saleData.voucher) {
      receipt += this.divider(charWidth);
      receipt += this.centerText('Voucher', charWidth);
      receipt += this.leftRight(`Kode: ${saleData.voucher.kode}`, '', charWidth);
    }

    receipt += this.divider(charWidth);

    // Footer
    if (storeInfo.struk_footer) {
      receipt += this.centerText(storeInfo.struk_footer, charWidth);
    }

    receipt += this.centerText('Terima Kasih!', charWidth);
    receipt += '\n\n\n';

    return receipt;
  }

  generatePurchaseReceipt(purchaseData, storeInfo = {}, paperWidth = this.paperWidth) {
    const charWidth = this._getCharWidth(paperWidth);
    let receipt = '';

    receipt += this.centerText(storeInfo.nama_cabang || 'TOKO', charWidth);
    if (storeInfo.alamat) receipt += this.centerText(storeInfo.alamat, charWidth);
    if (storeInfo.no_telp) receipt += this.centerText(storeInfo.no_telp, charWidth);
    receipt += this.divider(charWidth);

    if (storeInfo.struk_header) {
      receipt += this.centerText(storeInfo.struk_header, charWidth);
      receipt += this.divider(charWidth);
    }

    const now = new Date(purchaseData.tanggal || Date.now());
    receipt += this.centerText('STRUK PEMBELIAN', charWidth);
    receipt += this.divider(charWidth);

    receipt += this.leftRight(`No: ${purchaseData.kode_pembelian}`, now.toLocaleDateString('id-ID'), charWidth);
    receipt += this.leftRight(`Supplier: ${purchaseData.Supplier?.nama_supplier || 'Unknown'}`, now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), charWidth);
    receipt += this.divider(charWidth);

    const items = purchaseData.items || [];
    items.forEach(item => {
      const productName = this.truncateText(
        item.Produk?.nama_produk || `Produk (ID: ${item.id_produk})`,
        charWidth
      );
      receipt += `${productName}\n`;

      const qty = item.jumlah || 0;
      const price = item.harga_beli || 0;
      const subtotal = qty * price;

      receipt += this.leftRight(
        `${qty}x ${this.formatCurrency(price)}`,
        this.formatCurrency(subtotal),
        charWidth
      );
    });

    receipt += this.divider(charWidth);

    const totalAmount = items.reduce((sum, item) => sum + ((item.jumlah || 0) * (item.harga_beli || 0)), 0);
    receipt += this.leftRight('TOTAL', this.formatCurrency(totalAmount), charWidth);

    if (purchaseData.masuk_gudang) {
      receipt += this.centerText('Status: Masuk Gudang', charWidth);
    }

    receipt += this.divider(charWidth);

    if (storeInfo.struk_footer) {
      receipt += this.centerText(storeInfo.struk_footer, charWidth);
    }

    receipt += this.centerText('Terima Kasih!', charWidth);
    receipt += '\n\n\n';

    return receipt;
  }

  /**
   * Format receipt as structured data for electron-pos-printer
   */
  formatReceiptStructured(saleData, storeInfo = {}, options = {}) {
    const data = [];

    // Header
    data.push({
      type: 'text',
      value: storeInfo.nama_cabang || 'TOKO',
      style: { fontWeight: 'bold', textAlign: 'center' }
    });

    if (storeInfo.alamat) {
      data.push({
        type: 'text',
        value: storeInfo.alamat,
        style: { textAlign: 'center' }
      });
    }

    if (storeInfo.no_telp) {
      data.push({
        type: 'text',
        value: storeInfo.no_telp,
        style: { textAlign: 'center' }
      });
    }

    data.push({ type: 'line' });

    if (storeInfo.struk_header) {
      data.push({
        type: 'text',
        value: storeInfo.struk_header,
        style: { textAlign: 'center' }
      });
      data.push({ type: 'line' });
    }

    // Transaction info
    const now = new Date(saleData.tanggal || Date.now());
    const noStruk = saleData.no_struk || saleData.kode_transaksi || '';
    const kasirName = this._getKasirName(saleData);

    data.push({
      type: 'text',
      columns: [
        { text: `No: ${noStruk}`, align: 'left' },
        { text: now.toLocaleDateString('id-ID'), align: 'right' }
      ]
    });

    data.push({
      type: 'text',
      columns: [
        { text: `Kasir: ${kasirName}`, align: 'left' },
        { text: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), align: 'right' }
      ]
    });

    data.push({ type: 'line' });

    // Items
    const items = saleData.items || [];
    items.forEach(item => {
      const productName = item.nama_produk || item.product?.nama_produk || `Produk (ID: ${item.id_produk})`;
      data.push({
        type: 'text',
        value: productName
      });

      const qty = item.jumlah || item.qty || 0;
      const price = item.harga_jual || item.harga_satuan || 0;
      const subtotal = item.subtotal || (qty * price) || 0;

      data.push({
        type: 'text',
        columns: [
          { text: `${qty}x ${this.formatCurrency(price)}`, align: 'left' },
          { text: this.formatCurrency(subtotal), align: 'right' }
        ]
      });
    });

    data.push({ type: 'line' });

    // Totals
    const total = saleData.total || items.reduce((sum, item) => sum + (item.subtotal || (item.jumlah * item.harga_jual)), 0);
    const bayar = saleData.bayar || total;
    const kembalian = saleData.kembalian || (bayar - total);

    data.push({
      type: 'text',
      columns: [
        { text: 'Total:', align: 'left' },
        { text: this.formatCurrency(total), align: 'right' }
      ],
      style: { fontWeight: 'bold' }
    });

    if (saleData.jumlah_pajak > 0) {
      data.push({
        type: 'text',
        columns: [
          { text: 'Pajak:', align: 'left' },
          { text: this.formatCurrency(saleData.jumlah_pajak), align: 'right' }
        ]
      });
    }

    data.push({
      type: 'text',
      columns: [
        { text: 'Bayar:', align: 'left' },
        { text: this.formatCurrency(bayar), align: 'right' }
      ]
    });

    data.push({
      type: 'text',
      columns: [
        { text: 'Kembalian:', align: 'left' },
        { text: this.formatCurrency(kembalian), align: 'right' }
      ]
    });

    data.push({ type: 'line' });

    // Footer
    if (storeInfo.struk_footer) {
      data.push({
        type: 'text',
        value: storeInfo.struk_footer,
        style: { textAlign: 'center' }
      });
    }

    data.push({
      type: 'text',
      value: 'Terima Kasih!',
      style: { textAlign: 'center', fontWeight: 'bold' }
    });

    return {
      data,
      paperWidth: options.paperWidth || this.paperWidth
    };
  }

  /**
   * Generate HTML receipt for regular printers (A4, Letter)
   * Ensures proper monospace formatting and line breaks
   */
  generateReceiptHTML(saleData, storeInfo = {}, paperWidth = this.paperWidth) {
    const plainText = this.generateReceipt(saleData, storeInfo, paperWidth);
    
    // Escape HTML special characters
    const escaped = plainText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Calculate font-size based on paper width
    // A4/Letter (80 chars) = 10pt, A5 (50 chars) = 12pt 
    let fontSize = '10pt';
    if (paperWidth === 'A5') {
      fontSize = '11pt';
    } else if (paperWidth === 'Legal') {
      fontSize = '9.5pt';
    }
    
    // Generate raw HTML
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${fontSize};
      line-height: 1.15;
      background: white;
      color: black;
    }
    @page {
      margin: 0.4in;
      size: ${paperWidth === 'A5' ? 'A5' : paperWidth === 'Letter' ? 'letter' : 'A4'};
    }
    .receipt {
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow-wrap: break-word;
      font-family: 'Courier New', Courier, monospace;
      font-size: ${fontSize};
    }
    @media print {
      body {
        margin: 0;
        padding: 0.3in;
      }
      .receipt {
        margin: 0;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">${escaped}</div>
</body>
</html>`;
    
    return html;
  }

  /**
   * Format receipt with both plain text and HTML options
   */
  formatReceiptFull(saleData, storeInfo = {}, options = {}) {
    const paperWidth = options.paperWidth || this.paperWidth;
    const content = this.generateReceipt(saleData, storeInfo, paperWidth);
    const htmlContent = this.generateReceiptHTML(saleData, storeInfo, paperWidth);
    
    return {
      content,
      htmlContent,
      paperWidth
    };
  }
}

// Singleton instance for export
export const receiptFormatter = new ReceiptFormatter();
