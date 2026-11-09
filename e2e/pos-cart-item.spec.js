import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

// Regresi: item keranjang yang fokus (setelah +/-) harus tetap terang di tema terang, bukan blok abu tua.
test('item keranjang fokus tetap berlatar terang', async ({ page }) => {
  await setupPos(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/pos');
  await page.locator('[data-product-id="2"]').click();
  const item = page.locator('[data-cart-item]').first();
  await expect(item).toBeVisible();
  await item.getByRole('button', { name: '+' }).click();
  await page.waitForTimeout(300);
  const lum = await item.locator(':scope > div').first().evaluate((el) => {
    const [r, g, b] = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g).map(Number);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  });
  expect(lum).toBeGreaterThan(200);
});
