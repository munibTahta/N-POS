import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

test('server produk error: tampil pesan + Coba lagi, lalu pulih', async ({ page }) => {
  let failing = true;
  await setupPos(page, [], { failProducts: () => failing });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/pos');
  const alert = page.getByRole('alert').filter({ hasText: 'gagal dimuat' });
  await expect(alert).toBeVisible({ timeout: 10000 });

  failing = false;
  await alert.getByRole('button', { name: 'Coba lagi' }).click();
  await expect(page.getByText('24 produk')).toBeVisible({ timeout: 10000 });
  await expect(alert).toHaveCount(0);
});

test('mengetik saat pemuatan berjalan tidak meninggalkan skeleton menggantung', async ({ page }) => {
  await setupPos(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/pos');
  const input = page.getByPlaceholder(/Cari produk atau scan/);
  await input.click();
  await input.pressSequentially('contoh', { delay: 80 });
  await expect(page.locator('[data-product-id]').first()).toBeVisible({ timeout: 10000 });
});
