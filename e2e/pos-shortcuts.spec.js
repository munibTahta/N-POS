import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

// Menjaga perilaku pintasan keyboard yang dipindah ke features/pos/hooks/usePosKeyboardShortcuts.js
test.describe('pintasan keyboard kasir (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await setupPos(page);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/pos');
    await expect(page.locator('[data-product-id="2"]')).toBeVisible({ timeout: 15000 });
  });

  test('F1 membuka dan menutup bantuan shortcut', async ({ page }) => {
    const modal = page.getByRole('heading', { name: 'Pintasan keyboard' });
    await expect(modal).toHaveCount(0);
    await page.keyboard.press('F1');
    await expect(modal).toBeVisible();
    await page.keyboard.press('F1');
    await expect(modal).toHaveCount(0);
  });

  test('F2 memfokuskan kolom pencarian dan memilih isinya', async ({ page }) => {
    const input = page.getByPlaceholder(/Cari produk atau scan/);
    await input.fill('abc');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('F2');
    await expect(input).toBeFocused();
    const selected = await input.evaluate((el) => el.selectionStart === 0 && el.selectionEnd === el.value.length);
    expect(selected).toBe(true);
  });

  test('F12 dengan keranjang kosong menampilkan peringatan, bukan modal pembayaran', async ({ page }) => {
    await page.keyboard.press('F12');
    await expect(page.getByText('Keranjang masih kosong')).toBeVisible();
  });

  test('F12 dengan isi keranjang membuka modal pembayaran', async ({ page }) => {
    await page.locator('[data-product-id="2"]').click();
    await page.keyboard.press('F12');
    await expect(page.locator('[data-payment-modal]')).toBeVisible();
  });

  test('Escape menutup modal pembayaran', async ({ page }) => {
    await page.locator('[data-product-id="2"]').click();
    await page.keyboard.press('F12');
    await expect(page.locator('[data-payment-modal]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-payment-modal]')).toHaveCount(0);
  });
  test('"/" memfokuskan pencarian, tetapi tidak saat sedang mengetik', async ({ page }) => {
    const input = page.getByPlaceholder(/Cari produk atau scan/);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('/');
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('');
    await page.keyboard.type('a/b');
    await expect(input).toHaveValue('a/b');
  });

  test('Ctrl+K memfokuskan pencarian bahkan dari kolom lain', async ({ page }) => {
    const input = page.getByPlaceholder(/Cari produk atau scan/);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+k');
    await expect(input).toBeFocused();
  });

  test('"?" membuka bantuan; Esc menutup dan mengembalikan fokus', async ({ page }) => {
    const input = page.getByPlaceholder(/Cari produk atau scan/);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('?');
    const heading = page.getByRole('heading', { name: 'Pintasan keyboard' });
    await expect(heading).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Pintasan keyboard' })).toBeVisible();
    await page.getByLabel('Cari pintasan').fill('diskon');
    await expect(page.getByText('Terapkan diskon')).toBeVisible();
    await expect(page.getByText('Buka cash drawer')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(heading).toHaveCount(0);
    await expect(input).not.toBeFocused();
  });

  test('tombol ikon keyboard di bilah atas membuka bantuan', async ({ page }) => {
    await page.getByRole('button', { name: 'Bantuan pintasan keyboard' }).click();
    await expect(page.getByRole('dialog', { name: 'Pintasan keyboard' })).toBeVisible();
    await page.getByRole('button', { name: 'Tutup bantuan pintasan' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
