import JsBarcode from 'jsbarcode';

/**
 * Generate barcode SVG element for a product code
 * @param {string} kodeProduk - The product code to encode
 * @param {string} format - Barcode format (CODE128, EAN13, etc.) - default: CODE128
 * @returns {string} - SVG string of the barcode
 */
export function generateBarcodeSvg(kodeProduk, format = 'CODE128') {
  if (!kodeProduk) return null;
  
  try {
    // Create a temporary SVG element
    const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    
    // Generate barcode
    JsBarcode(svgElement, kodeProduk, {
      format: format,
      width: 2,
      height: 60,
      displayValue: true,
      fontSize: 14,
      margin: 10,
    });
    
    // Return as string
    return svgElement.outerHTML;
  } catch (error) {
    console.error('Error generating barcode:', error);
    return null;
  }
}

/**
 * Generate barcode as data URL (for img src)
 * @param {string} kodeProduk - The product code to encode
 * @param {string} format - Barcode format
 * @returns {Promise<string>} - Data URL of barcode image
 */
export function generateBarcodeDataUrl(kodeProduk, format = 'CODE128') {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      
      JsBarcode(canvas, kodeProduk, {
        format: format,
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 14,
        margin: 10,
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl);
    } catch (error) {
      console.error('Error generating barcode data URL:', error);
      reject(error);
    }
  });
}

/**
 * Generate barcode SVG HTML string for printing
 * @param {Object} product - Product object with id_produk, kode_produk, nama_produk, harga_jual
 * @param {number} width - Label width in mm (default 80)
 * @param {number} height - Label height in mm (default 60)
 * @returns {string} - HTML string for a printable barcode label
 */
export function generateBarcodeLabel(product, width = 80, height = 60) {
  if (!product || !product.kode_produk) return '';
  
  try {
    const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    
    JsBarcode(svgElement, product.kode_produk, {
      format: 'CODE128',
      width: 2,
      height: 50,
      displayValue: true,
      fontSize: 12,
      margin: 5,
    });
    
    const barcodeSvg = svgElement.outerHTML;
    
    // Format price for display
    const priceDisplay = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(product.harga_jual || 0);
    
    const html = `
      <div style="
        width: ${width}mm;
        height: ${height}mm;
        border: 1px solid #ccc;
        padding: 4mm;
        box-sizing: border-box;
        page-break-inside: avoid;
        font-family: Arial, sans-serif;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        text-align: center;
      ">
        <div style="font-size: 10px; font-weight: bold; margin-bottom: 2mm; max-height: 12mm; overflow: hidden;">
          ${escapeHtml(product.nama_produk || '')}
        </div>
        <div style="width: 100%; display: flex; justify-content: center; margin: 1mm 0;">
          ${barcodeSvg}
        </div>
        <div style="font-size: 9px; margin-top: 1mm;">
          ${escapeHtml(product.kode_produk)}
        </div>
        <div style="font-size: 8px; font-weight: bold; margin-top: 1mm;">
          ${priceDisplay}
        </div>
      </div>
    `;
    
    return html;
  } catch (error) {
    console.error('Error generating barcode label:', error);
    return '';
  }
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
