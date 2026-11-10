import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

for (const [path, name] of [['/pelanggan', 'Pelanggan'], ['/supplier', 'Supplier'], ['/kategori', 'Kategori'], ['/satuan', 'Satuan'], ['/produk', 'Produk']]) {
  test(`${name}: aksi sekunder ada di satu menu "Lainnya" yang dapat dioperasikan keyboard`, async ({ page }) => {
    await setupPos(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(path);
    const btn = page.locator('main').getByRole('button', { name: 'Lainnya' });
    await expect(btn).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toHaveCount(0);   // tidak lagi tombol ikon terpisah
    await btn.click();
    const menu = page.getByRole('menu', { name: 'Lainnya' });
    await expect(menu.getByRole('menuitem', { name: 'Export' })).toBeFocused();               // fokus pindah ke item pertama
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', { name: 'Import' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(btn).toBeFocused();                                                          // fokus kembali ke pemicu
  });
}
