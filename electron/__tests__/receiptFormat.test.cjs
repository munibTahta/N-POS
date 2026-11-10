const test = require('node:test');
const assert = require('node:assert/strict');
const { getPrinterCharWidth, getPrinterPaperWidth, wrapTextToWidth, formatColumns, formatPrintItem } = require('../receiptFormat.cjs');

test('lebar karakter & kertas dari nama printer', () => {
  assert.equal(getPrinterCharWidth('EPSON TM-T82 80mm'), 48);
  assert.equal(getPrinterCharWidth('POS-58'), 32);
  assert.equal(getPrinterCharWidth('Generic 100mm'), 60);
  assert.equal(getPrinterPaperWidth('Star TSP100'), '80mm');
  assert.equal(getPrinterPaperWidth('YW58'), '58mm');
});

test('nama printer tidak dikenal tidak melempar error (dulu: printUtils tidak terimpor)', () => {
  assert.doesNotThrow(() => getPrinterCharWidth('Printer Misterius'));
  assert.doesNotThrow(() => getPrinterPaperWidth('Printer Misterius'));
  assert.ok([32, 80].includes(getPrinterCharWidth(undefined)));
});

test('wrapTextToWidth tidak melebihi lebar', () => {
  const lines = wrapTextToWidth('Indomie Goreng Rasa Ayam Bawang Spesial Edisi Terbatas', 20);
  assert.ok(lines.length > 1);
  for (const l of lines) assert.ok(l.length <= 20, l);
});

test('formatColumns: kiri-kanan rata pada lebar penuh', () => {
  const out = formatColumns([{ text: 'Total', align: 'left' }, { text: '25.000', align: 'right' }], 32);
  assert.equal(out.split('\n')[0].length, 32);
  assert.ok(out.startsWith('Total') && out.trimEnd().endsWith('25.000'));
});

test('formatPrintItem: garis, teks, dan masukan tidak valid', () => {
  assert.equal(formatPrintItem({ type: 'line' }, 10), '----------');
  assert.equal(formatPrintItem({ type: 'text', value: 'Halo' }, 32), 'Halo');
  assert.equal(formatPrintItem(null, 32), '');
});
