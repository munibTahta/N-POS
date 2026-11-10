import test from 'node:test';
import assert from 'node:assert/strict';
import { currentFiles, pruneList } from '../../../scripts/prune-dist.mjs';

test('currentFiles: file, css, dan assets dari manifest', () => {
  const keep = currentFiles({ a: { file: 'assets/a-1.js', css: ['assets/a-1.css'], assets: ['assets/img-1.png'] }, b: { file: 'assets/b-2.js' } });
  assert.deepEqual([...keep].sort(), ['assets/a-1.css', 'assets/a-1.js', 'assets/b-2.js', 'assets/img-1.png']);
});

test('pruneList: hanya berkas non-manifest yang cukup tua', () => {
  const keep = new Set(['assets/baru.js']);
  const day = 86400000, now = 100 * day;
  const age = { 'baru.js': 0, 'lama-tua.js': 30 * day, 'lama-muda.js': 3 * day };
  const files = Object.keys(age);
  assert.deepEqual(pruneList(files, keep, now, 14, (f) => now - age[f]), ['lama-tua.js']);
  assert.deepEqual(pruneList(files, keep, now, 0, (f) => now - age[f]).sort(), ['lama-muda.js', 'lama-tua.js']); // installer: semua non-manifest
  assert.ok(!pruneList(files, keep, now, 0, (f) => now - age[f]).includes('baru.js'));
});
