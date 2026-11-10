import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

async function openPos(page, settings) {
  if (settings) await page.addInitScript((s) => localStorage.setItem('posSettings', JSON.stringify(s)), settings);
  await setupPos(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/pos');
  await expect(page.locator('[data-product-id="1"]')).toBeVisible({ timeout: 20000 });
}

test.describe('kebijakan stok minus', () => {
  test('default: produk stok 0 tidak bisa ditambahkan ke keranjang', async ({ page }) => {
    await openPos(page);
    await expect(page.locator('[data-product-id="1"]')).toHaveAttribute('aria-disabled', 'true');
    await page.locator('[data-product-id="1"]').click({ force: true });
    await expect(page.locator('[data-cart-item]')).toHaveCount(0);
  });

  test('diizinkan: produk stok 0 masuk keranjang dan jumlah bisa melebihi stok', async ({ page }) => {
    await openPos(page, { allowNegativeStock: true });
    await page.locator('[data-product-id="1"]').click();
    await expect(page.locator('[data-cart-item]')).toHaveCount(1);
    await page.locator('[data-product-id="1"]').click();                 // tambah lagi, tetap tidak diblok
    await expect(page.locator('[data-cart-item]').first()).toContainText('2');
  });
});
