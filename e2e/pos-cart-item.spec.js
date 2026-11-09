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

// Regresi: sorotan baris keranjang harus mengikuti baris yang DIKLIK (dulu klik di mana pun di kartu keranjang selalu
// menyorot baris pertama), dan tetap pada produknya saat baris lain dihapus.
test('klik tombol + pada baris kedua menyorot baris kedua, bukan pertama', async ({ page }) => {
  await setupPos(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/pos');
  for (const id of [2, 3, 4]) { // jeda > 100 ms: kunci anti klik ganda keranjang
    await page.locator(`[data-product-id="${id}"]`).click();
    await page.waitForTimeout(200);
  }
  const items = page.locator('[data-cart-item]');
  await expect(items).toHaveCount(3);

  const isHighlighted = (i) => items.nth(i).locator(':scope > div').first().evaluate((el) => el.className.includes('bg-blue-50'));
  await items.nth(1).getByRole('button', { name: '+' }).click();
  await page.waitForTimeout(250);
  expect(await isHighlighted(1)).toBe(true);
  expect(await isHighlighted(0)).toBe(false);
  expect(await isHighlighted(2)).toBe(false);

  // hapus baris pertama: sorotan tetap pada produk yang sama (sekarang di posisi 0)
  const nameBefore = await items.nth(1).locator('h4').innerText();
  await items.nth(0).getByRole('button', { name: 'Hapus' }).click();
  await page.waitForTimeout(250);
  await expect(items).toHaveCount(2);
  expect(await items.nth(0).locator('h4').innerText()).toBe(nameBefore);
  expect(await isHighlighted(0)).toBe(true);
});
