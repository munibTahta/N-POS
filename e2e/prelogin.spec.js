import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

// Halaman login tidak boleh menembakkan permintaan sinkronisasi ke endpoint terlindungi (pasti 401 sebelum login);
// setelah login (token ada) sinkronisasi latar berjalan.
test('sebelum login: tanpa permintaan sinkronisasi data; sesudah login: ada', async ({ page, browser }) => {
  const seen = [];
  const watch = (p) => p.on('request', (r) => { if (['xhr', 'fetch'].includes(r.resourceType())) seen.push(r.url().replace(/^https?:\/\/[^/]+/, '').split('?')[0]); });

  // tanpa token
  const anon = await browser.newPage();
  watch(anon);
  await anon.route(/^(?!http:\/\/localhost:5199).*/, (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/(src|node_modules|@|assets)/.test(url)) return route.continue();
    if (route.request().resourceType() === 'document' || /fonts\.g/.test(url)) return route.continue();
    return route.fulfill({ json: { success: true, data: [] } });
  });
  await anon.goto('/login');
  await anon.waitForTimeout(3500);
  const protectedCalls = seen.filter((u) => /\/api\/(pelanggan|penjualan|pembelian|supplier)$/.test(u));
  expect(protectedCalls).toEqual([]);
  await anon.close();

  // dengan token
  seen.length = 0;
  await setupPos(page);
  watch(page);
  await page.goto('/pos');
  await expect(page.locator('[data-product-id="2"]')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(2500);
  expect(seen.some((u) => /\/api\/(pelanggan|supplier|kategori)$/.test(u))).toBe(true);
});
