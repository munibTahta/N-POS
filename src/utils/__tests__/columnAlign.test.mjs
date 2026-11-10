import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveColumnAlign as a } from '../columnAlign.js';

test('judul kolom uang/angka -> kanan', () => {
  for (const h of ['Total', 'Harga Jual', 'Harga Beli', 'Subtotal', 'Jumlah', 'Qty', 'Saldo', 'Debit', 'Kredit', 'Kurang', 'Total Debit', 'Nilai Stok', 'Stok', 'Pendapatan', 'Diskon (%)', 'Pajak', 'Biaya', 'Kembalian']) {
    assert.equal(a({ header: h }), 'right', h);
  }
});

test('teks, status, tanggal, kode, nama -> kiri', () => {
  for (const h of ['Kode Transaksi', 'Nama Produk', 'Tanggal', 'Cabang', 'Status Pembayaran', 'Metode Pembayaran', 'Kategori', 'Keterangan', 'Aksi', 'Barcode', 'Merek', 'Satuan']) {
    assert.equal(a({ header: h }), 'left', h);
  }
});

test('"Pembayaran" bukan "bayar"; "Status Stok" tetap teks tetapi "Jumlah Stok" angka', () => {
  assert.equal(a({ header: 'Pembayaran' }), 'left');
  assert.equal(a({ header: 'Jumlah Stok' }), 'right');
  assert.equal(a({ header: 'Status Stok' }), 'left');
});

test('align/numeric/type eksplisit menang atas tebakan', () => {
  assert.equal(a({ header: 'Total', align: 'left' }), 'left');
  assert.equal(a({ header: 'Retur', numeric: true }), 'right');
  assert.equal(a({ header: 'Nilai', type: 'currency' }), 'right');
  assert.equal(a({ header: 'Nama', align: 'center' }), 'center');
});

test('tanpa judul: pakai nama kunci; input kosong aman', () => {
  assert.equal(a({ key: 'total_debit' }), 'right');
  assert.equal(a({ key: 'nama_produk' }), 'left');
  assert.equal(a(), 'left');
});
