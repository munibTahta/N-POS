import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

test.setTimeout(90000);
test('galat memuat halaman: judul tetap tampil, pesan jelas, ada tombol Coba lagi', async ({ page }) => {
  await setupPos(page, [], { onApi: (route, req) => { if (/\/stok(\?|$)/.test(req.url().split('#')[0]) ) { route.fulfill({ status: 500, json: { success: false } }); return true; } return false; } });
  await page.goto('/stok');
  await expect(page.getByRole('heading', { name: 'Manajemen Stok' })).toBeVisible({ timeout: 20000 });
  const alert = page.getByRole('alert').filter({ hasText: 'Gagal memuat data stok' });
  await expect(alert).toBeVisible({ timeout: 40000 });
  await expect(alert.getByRole('button', { name: 'Coba lagi' })).toBeVisible();
});

test('memuat: judul halaman tampil selama data dimuat (tanpa teks Loading... polos)', async ({ page }) => {
  await setupPos(page, [], { onApi: (route, req) => { if (/\/pelanggan/.test(req.url())) { setTimeout(() => route.fulfill({ json: { success: true, data: [] } }), 1500); return true; } return false; } });
  await page.goto('/pelanggan');
  await expect(page.getByRole('heading', { name: 'Manajemen Pelanggan' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Loading...', { exact: true })).toHaveCount(0);
});
