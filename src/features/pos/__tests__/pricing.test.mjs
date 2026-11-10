import test from 'node:test';
import assert from 'node:assert/strict';
import { computeProductPricing as p, grosirWarning } from '../pricing.js';

const produk = { harga_jual: 23000, harga_grosir: 21000, min_qty_grosir: 10 };

test('otomatis: eceran di bawah min qty, grosir mulai min qty', () => {
  assert.deepEqual(p(produk, 1), { price: 23000, priceType: 'eceran', isWholesale: false });
  assert.deepEqual(p(produk, 9), { price: 23000, priceType: 'eceran', isWholesale: false });
  assert.deepEqual(p(produk, 10), { price: 21000, priceType: 'grosir', isWholesale: true });
  assert.deepEqual(p(produk, '25'), { price: 21000, priceType: 'grosir', isWholesale: true });
});

test('min_qty_grosir = 1 (data umum di produksi): grosir sejak qty 1 - perilaku disengaja, bukan galat hitung', () => {
  assert.equal(p({ ...produk, min_qty_grosir: 1 }, 1).priceType, 'grosir');
});

test('tanpa harga grosir atau min qty 0/kosong: selalu eceran', () => {
  assert.equal(p({ harga_jual: 5000 }, 100).priceType, 'eceran');
  assert.equal(p({ ...produk, min_qty_grosir: 0 }, 100).priceType, 'eceran');
  assert.equal(p({ ...produk, min_qty_grosir: null }, 100).priceType, 'eceran');
});

test('harga grosir >= eceran dianggap salah data: tidak dipakai otomatis', () => {
  assert.equal(p({ harga_jual: 10000, harga_grosir: 10000, min_qty_grosir: 1 }, 5).priceType, 'eceran');
  assert.equal(p({ harga_jual: 10000, harga_grosir: 12000, min_qty_grosir: 1 }, 5).price, 10000);
});

test('pilihan manual kasir selalu dihormati', () => {
  assert.deepEqual(p(produk, 1, 'grosir'), { price: 21000, priceType: 'grosir', isWholesale: true });
  assert.deepEqual(p(produk, 50, 'eceran'), { price: 23000, priceType: 'eceran', isWholesale: false });
  assert.equal(p({ harga_jual: 5000 }, 1, 'grosir').price, 5000); // tanpa harga grosir: jatuh ke eceran
});

test('input kosong/aneh tidak melempar error', () => {
  assert.deepEqual(p(undefined, 1), { price: 0, priceType: 'eceran', isWholesale: false });
  assert.doesNotThrow(() => p({ harga_jual: 'abc' }, NaN));
});

test('grosirWarning: min qty 1, grosir >= eceran, dan kasus normal', () => {
  assert.match(grosirWarning({ harga_jual: '23.000', harga_grosir: '21.000', min_qty_grosir: 1 }), /sejak pembelian pertama/);
  assert.match(grosirWarning({ harga_jual: 10000, harga_grosir: 10000, min_qty_grosir: 5 }), /lebih murah/);
  assert.equal(grosirWarning({ harga_jual: 23000, harga_grosir: 21000, min_qty_grosir: 10 }), null);
  assert.equal(grosirWarning({ harga_jual: 23000, harga_grosir: 0, min_qty_grosir: 1 }), null);
});
