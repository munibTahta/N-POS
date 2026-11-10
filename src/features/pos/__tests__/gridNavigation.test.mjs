import test from 'node:test';
import assert from 'node:assert/strict';
import { groupIntoRows, nextProductIndex } from '../gridNavigation.js';

// Grid 3 kolom: baris 1 = indeks 0..2, baris 2 = 3..5, baris 3 = 6..7 (baris terakhir pendek). top sedikit goyang (<=14px).
const cards = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ index: i, left: (i % 3) * 200, top: Math.floor(i / 3) * 260 + (i % 2) * 5 }));
const rows = groupIntoRows([...cards].reverse());

test('groupIntoRows: mengelompokkan menurut baris meski top goyang dan urutan acak', () => {
  assert.deepEqual(rows.map((r) => r.items.map((i) => i.index)), [[0, 1, 2], [3, 4, 5], [6, 7]]);
});
test('kiri/kanan berhenti di tepi baris', () => {
  assert.equal(nextProductIndex(rows, 'left', 0, 8), 0);
  assert.equal(nextProductIndex(rows, 'right', 2, 8), 2);
  assert.equal(nextProductIndex(rows, 'right', 3, 8), 4);
  assert.equal(nextProductIndex(rows, 'left', 7, 8), 6);
});
test('atas/bawah mempertahankan kolom; baris pendek dijepit; naik dari baris pertama = keluar (-1)', () => {
  assert.equal(nextProductIndex(rows, 'down', 1, 8), 4);
  assert.equal(nextProductIndex(rows, 'down', 5, 8), 7);   // kolom 3 tidak ada di baris terakhir -> jepit
  assert.equal(nextProductIndex(rows, 'up', 4, 8), 1);
  assert.equal(nextProductIndex(rows, 'up', 1, 8), -1);
  assert.equal(nextProductIndex(rows, 'down', 7, 8), 7);   // sudah baris terakhir
});
test('tanpa pilihan: bawah/kanan memilih yang pertama, atas tetap -1; tanpa produk = -1', () => {
  assert.equal(nextProductIndex(rows, 'down', -1, 8), 0);
  assert.equal(nextProductIndex(rows, 'up', -1, 8), -1);
  assert.equal(nextProductIndex(rows, 'down', 3, 0), -1);
  assert.equal(nextProductIndex([], 'down', 2, 8), 2);
});
