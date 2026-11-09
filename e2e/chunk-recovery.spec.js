import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

// Tab lama setelah penerapan versi baru: chunk halaman tidak ada lagi (server mengembalikan HTML). Aplikasi harus pulih
// (muat ulang sekali) dan, bila tetap gagal, menampilkan pesan yang jelas dengan tombol "Muat ulang" (bukan jalan buntu).
test('chunk halaman gagal dimuat: muat ulang otomatis sekali, lalu pesan dengan tombol Muat ulang', async ({ page }) => {
  await setupPos(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/penjualan');
  await expect(page.locator('[data-command-trigger]')).toBeVisible({ timeout: 20000 });

  // sejak sekarang modul halaman Stok "hilang" (dijawab HTML seperti fallback nginx)
  await page.route(/\/src\/pages\/StockPage\.jsx/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html></html>' }));
  let loads = 0;
  page.on('load', () => { loads += 1; });

  await page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: 'Stok' }).click();
  const alert = page.getByRole('alert').filter({ hasText: 'Versi baru aplikasi tersedia' });
  await expect(alert).toBeVisible({ timeout: 20000 });
  await expect(alert.getByRole('button', { name: 'Muat ulang' })).toBeVisible();
  expect(loads).toBeLessThanOrEqual(1); // satu muat ulang otomatis, tidak berulang (pengaman anti-loop)
  await page.waitForTimeout(1500);
  expect(loads).toBeLessThanOrEqual(1);
});

test('galat jaringan biasa (bukan chunk) tidak memicu muat ulang otomatis', async ({ page }) => {
  await setupPos(page);
  await page.goto('/penjualan');
  await expect(page.locator('[data-command-trigger]')).toBeVisible({ timeout: 20000 });
  let loads = 0;
  page.on('load', () => { loads += 1; });
  await page.waitForTimeout(1500);
  expect(loads).toBe(0);
});
