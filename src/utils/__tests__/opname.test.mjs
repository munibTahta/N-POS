import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCount, summarizeCounts, groupBySupplier } from '../opname.js';

test('parseCount: kosong=null, angka bulat>=0, selain itu NaN', () => {
  assert.equal(parseCount(''), null); assert.equal(parseCount('  '), null); assert.equal(parseCount(undefined), null);
  assert.equal(parseCount('0'), 0); assert.equal(parseCount(' 12 '), 12);
  for (const bad of ['-1', '1.5', '1,5', 'abc', '1e3', '9999999999']) assert.ok(Number.isNaN(parseCount(bad)), bad);
});
test('summarizeCounts: hanya baris terisi dikirim; menghitung berubah, tidak valid, dan nilai selisih', () => {
  const rows = [{ id_produk: 1, stok: 9999, harga_beli: 100 }, { id_produk: 2, stok: 5, harga_beli: 1000 }, { id_produk: 3, stok: 2, harga_beli: 10 }, { id_produk: 4, stok: 1, harga_beli: 1 }];
  const r = summarizeCounts(rows, { 1: '40', 2: '5', 3: 'x' });
  assert.deepEqual(r.items, [{ id_produk: 1, stok_fisik: 40 }, { id_produk: 2, stok_fisik: 5 }]);
  assert.equal(r.dihitung, 2); assert.equal(r.berubah, 1); assert.equal(r.tidakValid, 1); assert.equal(r.nilai, -995900);
});
test('groupBySupplier: per pemasok, jumlah bisa diubah, nol/kosong dilewati, urut nilai terbesar', () => {
  const s = [
    { id_produk: 1, nama_produk: 'A', id_supplier: 7, nama_supplier: 'PT A', harga_beli: 1000, saran: 10 },
    { id_produk: 2, nama_produk: 'B', id_supplier: 7, nama_supplier: 'PT A', harga_beli: 500, saran: 4 },
    { id_produk: 3, nama_produk: 'C', id_supplier: null, nama_supplier: null, harga_beli: 100, saran: 100 },
    { id_produk: 4, nama_produk: 'D', id_supplier: 7, nama_supplier: 'PT A', harga_beli: 1, saran: 9 },
  ];
  const g = groupBySupplier(s, [1, 2, 3, 4], { 2: 6, 4: 0 });
  assert.equal(g.length, 2);
  assert.deepEqual(g.map((x) => [x.nama_supplier, x.total, x.items.length]), [['PT A', 13000, 2], ['Tanpa pemasok', 10000, 1]]);
});
