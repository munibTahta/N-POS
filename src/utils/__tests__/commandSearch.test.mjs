import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, scoreCommand, filterCommands } from '../commandSearch.js';
import { resolveGoTarget, GO_SHORTCUTS } from '../../hooks/globalNav.js';

const items = [
  { id: 'pos', label: 'Kasir (POS)', keywords: ['pos', 'jual', 'transaksi'] },
  { id: 'penjualan', label: 'Riwayat Penjualan', keywords: ['sales', 'transaksi'] },
  { id: 'laporan', label: 'Laporan', keywords: ['report'] },
  { id: 'laporan-keuangan', label: 'Laporan Keuangan', keywords: [] },
  { id: 'stok', label: 'Stok Barang', keywords: ['inventory', 'gudang'] },
  { id: 'tema', label: 'Ganti tema', keywords: ['gelap', 'terang', 'dark'] },
];

test('normalize: huruf kecil, tanpa aksen, spasi dirapikan', () => {
  assert.equal(normalize('  Pelanggán   BARU '), 'pelanggan baru');
  assert.equal(normalize(null), '');
});

test('kueri kosong: semua item, yang baru dipakai di depan', () => {
  assert.deepEqual(filterCommands(items, '').map((i) => i.id), items.map((i) => i.id));
  assert.deepEqual(filterCommands(items, '', ['stok', 'laporan']).slice(0, 3).map((i) => i.id), ['stok', 'laporan', 'pos']);
});

test('urutan skor: persis > awalan > kata > mengandung > kata kunci', () => {
  assert.equal(filterCommands(items, 'laporan')[0].id, 'laporan');              // persis menang atas "Laporan Keuangan"
  assert.deepEqual(filterCommands(items, 'lap').map((i) => i.id).slice(0, 2), ['laporan', 'laporan-keuangan']);
  assert.equal(filterCommands(items, 'keuangan')[0].id, 'laporan-keuangan');    // awal kata
  assert.ok(filterCommands(items, 'gelap').some((i) => i.id === 'tema'));       // lewat kata kunci
});

test('semua kata harus cocok; tidak cocok = kosong', () => {
  assert.deepEqual(filterCommands(items, 'laporan keuangan').map((i) => i.id), ['laporan-keuangan']);
  assert.deepEqual(filterCommands(items, 'zzzz'), []);
  assert.equal(scoreCommand('riwayat zzz', items[1]), 0);
});

test('fuzzy: urutan huruf cocok untuk kueri >= 3 huruf', () => {
  assert.ok(scoreCommand('lpr', items[2]) > 0);
  assert.equal(scoreCommand('lp', items[2]), 0);
});

test('navigasi g+huruf: tabel, hak akses, tak dikenal', () => {
  assert.equal(resolveGoTarget('p'), '/pos');
  assert.equal(resolveGoTarget('J'), '/penjualan');
  assert.equal(resolveGoTarget('x'), null);
  assert.equal(resolveGoTarget('l', (p) => p !== '/laporan'), null);
  assert.equal(new Set(GO_SHORTCUTS.map((g) => g.key)).size, GO_SHORTCUTS.length); // tidak ada huruf ganda
});
