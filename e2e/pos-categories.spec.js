import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

// Chip kategori kasir mengikuti katalog cabang: hanya kategori yang dipakai produk cabang itu (dengan jumlahnya),
// bukan semua kategori master (GET /kategori mengembalikan 30 kategori di mock ini).
test('chip kategori hanya memuat kategori katalog cabang, dengan jumlah produk', async ({ page }) => {
  const calls = [];
  await setupPos(page, [], {
    onApi: (route, req) => {
      const url = req.url();
      if (/\/kategori\/katalog/.test(url)) {
        calls.push(url);
        route.fulfill({ json: { success: true, data: [{ id_kategori: 3, nama_kategori: 'KAT3', jumlah_produk: 7 }, { id_kategori: 9, nama_kategori: 'KAT9', jumlah_produk: 2 }], meta: { total_produk: 9 } } });
        return true;
      }
      return false;
    },
  });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/pos');
  const tabs = page.getByRole('tab');
  await expect(tabs.filter({ hasText: 'KAT3' })).toBeVisible({ timeout: 15000 });
  await expect(tabs.filter({ hasText: 'KAT9' })).toBeVisible();
  await expect(tabs.filter({ hasText: 'KAT4' })).toHaveCount(0);      // ada di master, tidak dipakai produk cabang
  await expect(tabs.filter({ hasText: 'Semua' })).toContainText('9'); // total produk katalog
  await expect(tabs.filter({ hasText: 'KAT3' })).toContainText('7');
  expect(calls.length).toBeGreaterThan(0);
});

test('server kategori gagal dan tanpa cache: jatuh ke seluruh kategori master (chip tidak hilang)', async ({ page }) => {
  await setupPos(page, [], {
    onApi: (route, req) => {
      if (/\/kategori\/katalog/.test(req.url())) { route.fulfill({ status: 500, json: { success: false, message: 'boom' } }); return true; }
      return false;
    },
  });
  await page.goto('/pos');
  await expect(page.getByRole('tab').filter({ hasText: 'KAT4' })).toBeVisible({ timeout: 20000 });
});
