import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

// Regresi: daftar produk tidak boleh "berkedip" (kosong/skeleton terlihat di layar) saat memuat ulang karena ganti
// kategori atau mengetik; skeleton hanya untuk muat pertama. Diukur per frame (requestAnimationFrame), bukan per mutasi DOM.
test('tile produk tidak hilang dari layar saat ganti kategori dan mengetik', async ({ page }) => {
  await setupPos(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(() => {
    window.__bad = [];
    window.__armed = false;
    const tick = () => {
      if (window.__armed) {
        const tiles = document.querySelectorAll('[data-product-id]').length;
        const skel = document.querySelectorAll('.animate-pulse').length;
        const empty = document.body.innerText.includes('Tidak ada produk');
        if (tiles === 0 || skel > 0 || empty) window.__bad.push({ tiles, skel, empty, t: Math.round(performance.now()) });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto('/pos');
  await expect(page.locator('[data-product-id="2"]')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.__armed = true; });

  const chips = page.getByRole('tab');
  await chips.nth(0).click();
  await page.waitForTimeout(700);
  await chips.nth(3).click();
  await page.waitForTimeout(700);
  await chips.nth(0).click();
  await page.waitForTimeout(700);
  const input = page.getByPlaceholder(/Cari produk atau scan/);
  await input.click();
  await input.pressSequentially('contoh 1', { delay: 400 });
  await page.waitForTimeout(1000);

  const bad = await page.evaluate(() => window.__bad);
  console.log('BAD', JSON.stringify(bad));
  expect(bad.length, `frame kosong/skeleton terdeteksi: ${JSON.stringify(bad)}`).toBe(0);
});
