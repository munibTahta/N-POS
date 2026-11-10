import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

test.describe('halaman pengaturan bertab', () => {
  test('tab dapat dipilih dengan klik dan panah, panel lain tersembunyi, tab tersimpan di URL', async ({ page }) => {
    await setupPos(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/pengaturan');
    const tablist = page.getByRole('tablist', { name: 'Bagian pengaturan' });
    await expect(tablist).toBeVisible({ timeout: 20000 });
    await expect(tablist.getByRole('tab', { selected: true })).toHaveText(/Toko & Struk/);
    await expect(page.getByLabel('Nama Toko')).toBeVisible();

    await tablist.getByRole('tab', { name: /Kasir/ }).click();
    await expect(page).toHaveURL(/tab=kasir/);
    const sw = page.getByRole('switch', { name: /Izinkan Jual Saat Stok Kurang/ });
    await expect(sw).toBeVisible();
    await expect(page.getByLabel('Nama Toko')).toBeHidden();
    await sw.focus(); await page.keyboard.press('Space');
    await expect(sw).toBeChecked();
    await expect(page.getByRole('status').filter({ hasText: 'belum disimpan' })).toBeVisible();

    await tablist.getByRole('tab', { name: /Kasir/ }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(tablist.getByRole('tab', { selected: true })).toHaveText(/Pajak & Loyalitas|Data & Sistem/);
  });

  test('membuka langsung lewat ?tab=', async ({ page }) => {
    await setupPos(page);
    await page.goto('/pengaturan?tab=printer');
    await expect(page.getByRole('tab', { name: /Printer/, selected: true })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Printer Kasir Default')).toBeVisible();
  });
});
