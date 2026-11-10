import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFocusIndex as f } from '../hooks/useCartFocusSync.js';

test('hapus baris sebelum yang disorot: sorotan mengikuti produknya', () => {
  assert.equal(f([10, 20, 30], 2, [20, 30]), 1);
  assert.equal(f([10, 20, 30], 1, [20, 30]), 0);
});

test('hapus baris yang disorot: pindah ke tetangga terdekat, dibatasi panjang keranjang', () => {
  assert.equal(f([10, 20, 30], 1, [10, 30]), 1);
  assert.equal(f([10, 20, 30], 2, [10, 20]), 1);
});

test('tambah baris tidak menggeser sorotan; tanpa sorotan tetap -1; keranjang kosong -1', () => {
  assert.equal(f([10, 20], 1, [10, 20, 30]), 1);
  assert.equal(f([10, 20], 0, [5, 10, 20]), 1);
  assert.equal(f([10, 20], -1, [10]), -1);
  assert.equal(f([10], 0, []), -1);
});
