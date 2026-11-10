import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

test('pratinjau struk setelah bayar: kertas putih di tema gelap, rata kiri, nomor transaksi dan metode utuh', async ({ page }) => {
  await setupPos(page, [], {
    onApi: (route, req) => {
      if (req.method() !== 'POST') return null;
      const url = req.url();
      let body = {};
      try { body = req.postDataJSON() || {}; } catch (_e) { /* bukan JSON */ }
      if (/\/penjualan\/\d+\/bayar/.test(url)) return route.fulfill({ status: 201, json: { success: true, data: { id_pembayaran: 7 } } });
      if (/\/penjualan$/.test(url.split('?')[0])) return route.fulfill({ status: 201, json: { success: true, data: { id_penjualan: 99, kode_transaksi: 'POS-1794229927918-150', total: 10500, items: body.items || [] } } });
      return null;
    },
  });
  await page.addInitScript(() => { localStorage.setItem('theme', 'dark'); localStorage.setItem('printerPaperWidth', '58mm'); });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/pos');
  await expect(page.locator('[data-product-id="2"]')).toBeVisible({ timeout: 20000 });
  await page.locator('[data-product-id="2"]').click();
  await page.getByRole('button', { name: /Isi Total/ }).first().click();
  await page.getByTitle(/Selesaikan transaksi/).first().click();

  const preview = page.locator('[data-receipt-preview]');
  await expect(preview).toBeVisible({ timeout: 20000 });
  expect(await preview.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
  expect(await preview.evaluate((el) => getComputedStyle(el).textAlign)).toBe('left');
  const text = await preview.innerText();
  expect(text).toMatch(/No: POS-\d+/);
  expect(text).toMatch(/Metode\s+\S+/);
  expect(text.split('\n').every((l) => l.length <= 32)).toBe(true);     // 58mm = 32 karakter
});
