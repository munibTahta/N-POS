// Pemformat teks struk (fungsi murni): lebar karakter/kertas per printer, pembungkusan baris, kolom, dan item cetak.
// Dipisah dari main.cjs agar bisa diuji tanpa Electron (lihat electron/__tests__/receiptFormat.test.cjs).
const printUtils = require('./printUtils.cjs');

function getPrinterCharWidth(printerName) {
  const name = String(printerName || '').toLowerCase();

  if (name.includes('100mm')) return 60;
  if (name.includes('80mm') || name.includes('80x80') || name.includes('star') || name.includes('seagull')) return 48;
  if (name.includes('58mm') || name.includes('pos-58') || name.includes('yw58') || name.includes('blueprint') || /\b58\b/.test(name)) return 32;

  const printerType = printUtils.detectPrinterType(printerName);
  return printerType === printUtils.PRINTER_TYPES.THERMAL ? 32 : 80;
}

function getPrinterPaperWidth(printerName) {
  const name = String(printerName || '').toLowerCase();

  if (name.includes('100mm')) return '100mm';
  if (name.includes('80mm') || name.includes('80x80') || name.includes('star') || name.includes('seagull')) return '80mm';
  if (name.includes('58mm') || name.includes('pos-58') || name.includes('yw58') || name.includes('blueprint') || /\b58\b/.test(name)) return '58mm';

  return printUtils.detectPrinterType(printerName) === printUtils.PRINTER_TYPES.THERMAL ? '58mm' : '80mm';
}

function wrapTextToWidth(text, maxWidth) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized.split('\n').flatMap(line => {
    const words = line.trim().split(/\s+/);
    const lines = [];
    let current = '';

    for (const word of words) {
      if (!word) continue;

      if (!current) {
        if (word.length <= maxWidth) {
          current = word;
        } else {
          for (let pos = 0; pos < word.length; pos += maxWidth) {
            const chunk = word.slice(pos, pos + maxWidth);
            if (chunk.length === maxWidth) {
              lines.push(chunk);
            } else {
              current = chunk;
            }
          }
        }
        continue;
      }

      if (current.length + 1 + word.length <= maxWidth) {
        current += ' ' + word;
      } else {
        lines.push(current);
        if (word.length <= maxWidth) {
          current = word;
        } else {
          for (let pos = 0; pos < word.length; pos += maxWidth) {
            const chunk = word.slice(pos, pos + maxWidth);
            if (chunk.length === maxWidth) {
              lines.push(chunk);
            } else {
              current = chunk;
            }
          }
        }
      }
    }

    if (current) {
      lines.push(current);
    }

    return lines.length > 0 ? lines : [''];
  });
}

function formatColumns(columns, maxWidth) {
  const sanitized = columns.map(c => ({
    text: String((c && c.text) || ''),
    align: String((c && c.align) || 'left')
  }));

  if (sanitized.length === 0) {
    return '';
  }

  if (sanitized.length === 1) {
    return wrapTextToWidth(sanitized[0].text, maxWidth).join('\n');
  }

  const leftText = sanitized.slice(0, -1).map(c => c.text).join(' ');
  const rightText = sanitized[sanitized.length - 1].text;

  const leftLines = wrapTextToWidth(leftText, maxWidth);
  const rightLines = wrapTextToWidth(rightText, maxWidth);
  const lines = [];

  if (leftLines.length > 0) {
    const firstLeft = leftLines[0];
    const firstRight = rightLines[0] || '';
    if (firstLeft.length + firstRight.length + 1 <= maxWidth) {
      const spaces = maxWidth - firstLeft.length - firstRight.length;
      lines.push(firstLeft + ' '.repeat(spaces) + firstRight);
    } else {
      lines.push(firstLeft);
      if (firstRight) {
        lines.push(firstRight);
      }
    }
    if (leftLines.length > 1) {
      lines.push(...leftLines.slice(1));
    }
    if (rightLines.length > 1) {
      lines.push(...rightLines.slice(1));
    }
  } else {
    lines.push(...rightLines);
  }

  return lines.join('\n');
}

function formatPrintItem(item, maxWidth) {
  if (!item || typeof item !== 'object') {
    return '';
  }

  if (item.type === 'line') {
    return '-'.repeat(maxWidth);
  }

  const value = item.value !== undefined && item.value !== null ? String(item.value) : '';

  if (item.type === 'text') {
    if (item.columns && Array.isArray(item.columns) && item.columns.length > 0) {
      return formatColumns(item.columns, maxWidth);
    }
    return wrapTextToWidth(value, maxWidth).join('\n');
  }

  return wrapTextToWidth(value, maxWidth).join('\n');
}

module.exports = { getPrinterCharWidth, getPrinterPaperWidth, wrapTextToWidth, formatColumns, formatPrintItem };
