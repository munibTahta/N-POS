import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

// Regresi: produk harus tetap tampil saat ukuran jendela diubah (desktop -> tablet -> mobile) dan saat dimuat langsung di tablet.
test.beforeEach(async ({ page }) => { await setupPos(page); });


test('produk tetap tampil setelah resize desktop -> tablet -> mobile -> desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/pos');
  await expect(page.getByText(/Produk contoh 1/).first()).toBeVisible({ timeout: 15000 });
  for (const [w, h] of [[820, 1180], [390, 844], [1366, 768]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(500);
    await expect(page.getByText(/Produk contoh 1/).first(), `produk hilang di ${w}px`).toBeVisible();
  }
});

test('produk tampil saat dimuat langsung di tablet (sentuh)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await setupPos(page);
  await page.goto('/pos');
  await expect(page.getByText(/Produk contoh 1/).first()).toBeVisible({ timeout: 15000 });
  await ctx.close();
});
