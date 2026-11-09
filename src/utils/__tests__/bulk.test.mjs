import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleId, togglePage, pageSelectionState, rangeIds, pruneSelection, runBulk, summarizeBulk, failureDetails } from '../bulk.js';

test('toggleId: tambah, lepas, tanpa duplikat, mempertahankan urutan', () => {
  assert.deepEqual(toggleId([1, 2], 3), [1, 2, 3]);
  assert.deepEqual(toggleId([1, 2, 3], 2), [1, 3]);
  assert.deepEqual(toggleId([1], 1, true), [1]);
  assert.deepEqual(toggleId([1], 2, false), [1]);
});

test('togglePage tidak mengganggu pilihan halaman lain; pageSelectionState', () => {
  assert.deepEqual(togglePage([9], [1, 2], true), [9, 1, 2]);
  assert.deepEqual(togglePage([9, 1, 2], [1, 2], false), [9]);
  assert.equal(pageSelectionState([1, 2, 9], [1, 2]), 'all');
  assert.equal(pageSelectionState([1], [1, 2]), 'some');
  assert.equal(pageSelectionState([9], [1, 2]), 'none');
  assert.equal(pageSelectionState([1], []), 'none');
});

test('rangeIds: shift+klik dua arah, tanpa jangkar, id tak dikenal', () => {
  const ids = [10, 20, 30, 40, 50];
  assert.deepEqual(rangeIds(ids, 20, 40), [20, 30, 40]);
  assert.deepEqual(rangeIds(ids, 40, 20), [20, 30, 40]);
  assert.deepEqual(rangeIds(ids, undefined, 30), [30]);
  assert.deepEqual(rangeIds(ids, 20, 99), []);
});

test('pruneSelection mengembalikan referensi sama bila tak ada yang dibuang', () => {
  const sel = [1, 2];
  assert.equal(pruneSelection(sel, [1, 2, 3]), sel);
  assert.deepEqual(pruneSelection([1, 2, 3], [2, 3]), [2, 3]);
});

test('runBulk: kegagalan satu item tidak menghentikan lainnya; progres; konkurensi dibatasi', async () => {
  let running = 0, peak = 0;
  const progress = [];
  const r = await runBulk([1, 2, 3, 4, 5, 6], async (n) => {
    running += 1; peak = Math.max(peak, running);
    await new Promise((res) => setTimeout(res, 5));
    running -= 1;
    if (n % 3 === 0) throw new Error(`gagal ${n}`);
    return n * 2;
  }, { concurrency: 2, onProgress: (p) => progress.push(p.done) });
  assert.deepEqual(r.ok.map((x) => x.result).sort((a, b) => a - b), [2, 4, 8, 10]);
  assert.deepEqual(r.failed.map((x) => x.item).sort(), [3, 6]);
  assert.equal(peak <= 2, true);
  assert.deepEqual(progress, [1, 2, 3, 4, 5, 6]);
  assert.equal(r.cancelled, false);
});

test('runBulk: kosong aman; pembatalan menghentikan item baru', async () => {
  assert.deepEqual(await runBulk([], async () => 1), { ok: [], failed: [], cancelled: false });
  const ctl = new AbortController();
  const r = await runBulk([1, 2, 3, 4, 5, 6], async (n) => { if (n === 2) ctl.abort(); await new Promise((res) => setTimeout(res, 3)); return n; }, { concurrency: 1, signal: ctl.signal });
  assert.equal(r.cancelled, true);
  assert.ok(r.ok.length < 6);
});

test('summarizeBulk dan failureDetails', () => {
  assert.equal(summarizeBulk({ ok: [1, 2], failed: [], cancelled: false }, { verb: 'dihapus', noun: 'pelanggan' }), '2 pelanggan berhasil dihapus.');
  assert.equal(summarizeBulk({ ok: [1], failed: [1, 2], cancelled: false }, { verb: 'dihapus', noun: 'produk' }), '1 produk berhasil dihapus, 2 gagal.');
  assert.equal(summarizeBulk({ ok: [], failed: [1, 2], cancelled: false }, { verb: 'dihapus', noun: 'produk' }), 'Semua 2 produk gagal dihapus.');
  assert.match(summarizeBulk({ ok: [1], failed: [], cancelled: true }), /Dibatalkan/);
  const f = Array.from({ length: 5 }, (_, i) => ({ item: { n: i }, error: { response: { data: { message: `x${i}` } } } }));
  const d = failureDetails(f, (i) => `#${i.n}`);
  assert.equal(d.length, 4); assert.equal(d[0], '#0: x0'); assert.match(d[3], /2 lainnya/);
});
