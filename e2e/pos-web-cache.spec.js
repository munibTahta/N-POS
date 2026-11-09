import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

// Mode web: snapshot katalog di IndexedDB menjaga produk tetap tampil/bisa dicari saat API tidak terjangkau.
test('produk tetap tampil dan bisa dicari dari snapshot IndexedDB saat API putus', async ({ page }) => {
  await setupPos(page);
  await page.goto('/pos');
  await expect(page.getByText('Produk contoh 1', { exact: true }).first()).toBeVisible({ timeout: 15000 });

  // tunggu snapshot tersimpan
  await expect.poll(() => page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open('npos-web-cache', 1);
    req.onerror = () => resolve(0);
    req.onupgradeneeded = () => { req.transaction.abort(); resolve(0); };
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) return resolve(0);
      const r = db.transaction('kv').objectStore('kv').getAllKeys();
      r.onsuccess = () => resolve(r.result.filter((k) => String(k).startsWith('products:')).length);
      r.onerror = () => resolve(0);
    };
  })), { timeout: 15000 }).toBeGreaterThan(0);

  // putuskan semua panggilan API (dokumen/aset tetap lolos)
  await page.route(/^(?!http:\/\/localhost:5199).*/, (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/(src|node_modules|@|assets)/.test(url)) return route.continue();
    if (route.request().resourceType() === 'document' || /fonts\.g/.test(url)) return route.continue();
    return route.abort('failed');
  });
  await page.reload();
  await expect(page.getByText('Produk contoh 1', { exact: true }).first()).toBeVisible({ timeout: 20000 });

  const search = page.getByPlaceholder(/cari/i).first();
  await search.fill('contoh 7');
  await expect(page.getByText('Produk contoh 7', { exact: true }).first()).toBeVisible({ timeout: 10000 });
});
