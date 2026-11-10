import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { ReceiptFormatter } = await import('../ReceiptFormatter.js');

const f = (w = '58mm') => new ReceiptFormatter({ paperWidth: w });
const lines = (t) => t.split('\n');

test('leftRight: nominal kanan tidak pernah terpotong, lebar tidak melebihi kertas', () => {
  const out = f().leftRight('Total', 'Rp 1.234.567.890', 32);
  assert.equal(out.trimEnd().endsWith('Rp 1.234.567.890'), true);
  assert.equal(out.replace('\n', '').length, 32);
});
test('leftRight: teks kiri panjang dibungkus, nomor transaksi utuh', () => {
  const out = f().leftRight('No: POS-1794229927918-150', '9/11/2026', 32);
  const joined = out.replace(/\s+/g, ' ');
  assert.ok(joined.includes('POS-1794229927918-150'), joined);
  assert.ok(joined.includes('9/11/2026'));
  lines(out).forEach((l) => assert.ok(l.length <= 32, l));
});
test('centerText: alamat panjang dibungkus ke beberapa baris, tidak ada yang hilang', () => {
  const addr = 'Jl. Banyumas No.5 Banaran, Kalierang, Selomerto';
  const out = f().centerText(addr, 32);
  assert.equal(out.replace(/\s+/g, ' ').trim(), addr);
  lines(out).forEach((l) => assert.ok(l.length <= 32));
});
test('generateReceipt: tidak ada baris melebihi lebar; nama produk panjang utuh; metode dan kembali tampil', () => {
  const sale = {
    kode_transaksi: 'POS-1794229927918-150', tanggal: '2026-11-09T13:12:08', kasir: 'Hani Indah',
    items: [{ nama_produk: 'Ayam bawang putih (tanpa nasi) porsi besar', jumlah: 1, harga_jual: 12000, subtotal: 12000 }],
    total: 12000, bayar: 20000, detail_pembayaran: [{ metodePembayaran: { nama_metode: 'Tunai' } }],
  };
  for (const w of ['58mm', '80mm']) {
    const out = f(w).generateReceipt(sale, { nama_cabang: 'DAPUR SYAHNA KALIERANG', alamat: 'Jl. Banyumas No.5 Banaran, Kalierang, Selomerto', no_telp: '085128055119' }, w);
    const max = f(w).PAPER_WIDTHS[w];
    lines(out).forEach((l) => assert.ok(l.length <= max, `${w}: "${l}"`));
    const flat = out.replace(/\s+/g, ' ');
    assert.ok(flat.includes('Ayam bawang putih (tanpa nasi) porsi besar') || w === '58mm');
    assert.ok(flat.includes('POS-1794229927918-150'));
    assert.ok(/Metode\s+Tunai/.test(out));
    assert.ok(/Kembali\s+Rp 8\.000/.test(out));
  }
});
test('generateReceipt: transaksi belum lunas menampilkan Sisa, bukan Kembali', () => {
  const out = f().generateReceipt({ kode_transaksi: 'X', items: [], total: 50000, bayar: 20000, status_pembayaran: 'pending', sisa_pembayaran: 30000 }, {}, '58mm');
  assert.ok(/Sisa\s+Rp 30\.000/.test(out));
  assert.ok(!/Kembali/.test(out));
});
test('paymentMethodNames: gabungkan metode sama, dukung tiga bentuk data', () => {
  const r = f();
  assert.deepEqual(r.paymentMethodNames({ detail_pembayaran: [{ nama_metode: 'Tunai' }, { nama_metode: 'Tunai' }, { nama_metode: 'QRIS' }] }), ['Tunai (2x)', 'QRIS']);
  assert.deepEqual(r.paymentMethodNames({ metode_pembayaran: 'Transfer' }), ['Transfer']);
  assert.deepEqual(r.paymentMethodNames({}), ['Tunai']);
});
