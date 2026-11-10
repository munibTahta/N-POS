const test = require('node:test');
const assert = require('node:assert/strict');
const { validateColumns, validateWhereClause, ALLOWED_TABLES } = require('../lib/dbValidation.cjs');
const { escapeHtml, buildThermalHtml } = require('../lib/thermalHtml.cjs');
const { isValidQzTrayCertificate, isValidQzTrayPrivateKey } = require('../lib/qzCert.cjs');
const { normalizeOfflineSalePayload } = require('../lib/offlineSale.cjs');
const { lookupPortForPrinter } = require('../lib/printerPort.cjs');

test('validateColumns: kolom di daftar putih lolos, kolom asing/injeksi ditolak', () => {
  assert.doesNotThrow(() => validateColumns('products', ['id_produk', 'nama_produk']));
  assert.throws(() => validateColumns('products', ['nama_produk; DROP TABLE products']), /not allowed/);
  assert.throws(() => validateColumns('tabel_tak_dikenal', ['id']), /not allowed/);
  assert.ok(ALLOWED_TABLES.includes('sales') && ALLOWED_TABLES.includes('products'));
});
test('validateWhereClause: kondisi sederhana lolos; pemisah perintah/komentar/karakter aneh ditolak', () => {
  assert.doesNotThrow(() => validateWhereClause("id_produk = ? AND status = 'aktif'"));
  for (const bad of ['1=1; DROP TABLE x', '1=1 -- komentar', '1=1 /* x */', 'a=1 OR `b`=2', '', null, 123]) assert.throws(() => validateWhereClause(bad), undefined, String(bad));
});
test('escapeHtml dan buildThermalHtml: isi struk di-escape, lebar kertas dipakai', () => {
  assert.equal(escapeHtml('<b>"A" & \'B\'</b>'), '&lt;b&gt;&quot;A&quot; &amp; &#039;B&#039;&lt;/b&gt;');
  const html = buildThermalHtml('Toko <script>alert(1)</script>', '80mm');
  assert.ok(html.includes('&lt;script&gt;') && !html.includes('<script>'));
  assert.ok(html.includes('width: 80mm'));
});
test('QZ: sertifikat dan kunci privat diperiksa bentuk PEM-nya', () => {
  assert.equal(isValidQzTrayCertificate('-----BEGIN CERTIFICATE-----\nx\n-----END CERTIFICATE-----'), true);
  assert.equal(isValidQzTrayCertificate('bukan sertifikat'), false);
  assert.equal(isValidQzTrayPrivateKey('-----BEGIN PRIVATE KEY-----\nx'), true);
  assert.equal(isValidQzTrayPrivateKey('-----BEGIN RSA PRIVATE KEY-----\nx'), true);
  assert.equal(isValidQzTrayPrivateKey('-----BEGIN CERTIFICATE-----'), false);
  assert.equal(isValidQzTrayPrivateKey(null), false);
});
test('normalizeOfflineSalePayload: hitung subtotal dari jumlah x harga; tolak data tidak valid', () => {
  const r = normalizeOfflineSalePayload({ saleData: { kode_transaksi: 'T1' }, items: [{ id_produk: 1, jumlah: 3, harga_satuan: 1500 }], payments: [{ jumlah_bayar: 5000, id_metode_pembayaran: 1 }] });
  assert.equal(r.items[0].subtotal, 4500);
  assert.equal(r.saleData.total, 4500);
  assert.equal(r.saleData.kembalian, 500);
  assert.equal(r.saleData.status_pembayaran, 'lunas');
  assert.equal(normalizeOfflineSalePayload({ saleData: {}, items: [{ id_produk: 1, jumlah: 1, harga_satuan: 1000 }], payments: [{ jumlah_bayar: 400, id_metode_pembayaran: 1 }] }).saleData.sisa_pembayaran, 600);
  assert.throws(() => normalizeOfflineSalePayload({ saleData: {}, items: [{ id_produk: 1, jumlah: 1, harga_satuan: 1 }], payments: [{ jumlah_bayar: 1 }] }), /id_metode_pembayaran/);
  assert.throws(() => normalizeOfflineSalePayload({ saleData: {}, items: [] }), /required/);
  assert.throws(() => normalizeOfflineSalePayload({ saleData: {}, items: [{ id_produk: 1, jumlah: 0, harga_satuan: 1 }] }), /jumlah/);
  assert.throws(() => normalizeOfflineSalePayload({ saleData: {}, items: [{ jumlah: 1, harga_satuan: 1 }] }), /id_produk/);
  assert.throws(() => normalizeOfflineSalePayload({ saleData: null, items: [{}] }), /Invalid sale data/);
});
test('lookupPortForPrinter: di luar Windows atau tanpa nama = null (tidak menjalankan perintah)', () => {
  if (process.platform !== 'win32') assert.equal(lookupPortForPrinter('Printer'), null);
  assert.equal(lookupPortForPrinter(''), null);
});
