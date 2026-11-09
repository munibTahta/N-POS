import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

test('tidak ada dropdown riwayat pencarian saat fokus/mengetik', async ({ page }) => {
  await setupPos(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/pos');
  const input = page.getByPlaceholder(/Cari produk atau scan/);
  await input.click();
  await input.pressSequentially('pro', { delay: 150 });
  await expect(page.locator('[data-search-suggestion]')).toHaveCount(0);
  await expect(page.getByText('Riwayat', { exact: true })).toHaveCount(0);
});

test('debounce: mengetik cepat hanya mengirim satu request pencarian', async ({ page }) => {
  const log = [];
  await setupPos(page, log);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/pos');
  const input = page.getByPlaceholder(/Cari produk atau scan/);
  await page.waitForTimeout(1500);
  const before = log.length;
  await input.click();
  await input.pressSequentially('contoh', { delay: 120 }); // lebih lambat dari scanner, lebih cepat dari 300 ms
  await page.waitForTimeout(900);
  const searches = log.slice(before).filter((u) => /[?&]search=/.test(u) && !/search=null/.test(u));
  expect(searches.length).toBe(1);
  expect(searches[0]).toContain('search=contoh');
});

test('input cepat ala scanner + Enter dibersihkan dan tidak memicu pencarian parsial', async ({ page }) => {
  const log = [];
  await setupPos(page, log);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/pos');
  const input = page.getByPlaceholder(/Cari produk atau scan/);
  await page.waitForTimeout(1500);
  const before = log.length;
  await input.click();
  await input.pressSequentially('8991234567890', { delay: 0 });
  await input.press('Enter');
  await page.waitForTimeout(800);
  await expect(input).toHaveValue('');
  const partial = log.slice(before).filter((u) => /search=8(9|99|991)?(&|$)/.test(u));
  expect(partial.length).toBe(0);
});
