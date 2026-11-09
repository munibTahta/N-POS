import test from 'node:test';
import assert from 'node:assert/strict';
import { isChunkLoadError, reloadOnceForNewVersion } from '../chunkRecovery.js';

const memStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };

test('mengenali galat chunk dari berbagai browser', () => {
  assert.equal(isChunkLoadError(new Error('Failed to fetch dynamically imported module: https://x/assets/PosPage-abc.js')), true);
  assert.equal(isChunkLoadError(new Error('Importing a module script failed.')), true);
  assert.equal(isChunkLoadError({ message: 'error loading dynamically imported module' }), true);
  assert.equal(isChunkLoadError('Loading chunk 12 failed.'), true);
  assert.equal(isChunkLoadError(new Error('Network Error')), false);
  assert.equal(isChunkLoadError(null), false);
});

test('muat ulang dipicu sekali; percobaan kedua dalam 30 dtk ditolak (anti-loop); sesudahnya boleh lagi', () => {
  const storage = memStorage(); let reloads = 0;
  const go = (now) => reloadOnceForNewVersion({ storage, reload: () => { reloads += 1; }, now });
  assert.equal(go(1000), true);
  assert.equal(go(5000), false);
  assert.equal(go(30999), false);
  assert.equal(go(31001), true);
  assert.equal(reloads, 2);
});

test('storage yang melempar error tidak menggagalkan pemulihan', () => {
  let reloads = 0;
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(reloadOnceForNewVersion({ storage: broken, reload: () => { reloads += 1; }, now: 1 }), true);
  assert.equal(reloads, 1);
});
