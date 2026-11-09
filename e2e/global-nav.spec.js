import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

const ready = async (page, path) => {
  await page.goto(path);
  await expect(page.locator('[data-command-trigger]')).toBeVisible({ timeout: 20000 }); // Layout terpasang = pendengar keyboard aktif
  await page.waitForTimeout(300);
};

// Navigasi & pintasan global: palet perintah (Ctrl+K), "g lalu huruf", dan "?" (bantuan) di semua halaman.
test.describe('navigasi global', () => {
  test.beforeEach(async ({ page }) => {
    await setupPos(page);
    await page.setViewportSize({ width: 1366, height: 768 });
  });

  test('Ctrl+K membuka palet; mengetik menyaring; Enter membuka halaman', async ({ page }) => {
    await ready(page, '/penjualan');
    await expect(page.getByRole('heading', { name: 'Riwayat Penjualan' })).toBeVisible({ timeout: 15000 });
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: 'Pencarian cepat' });
    await expect(dialog).toBeVisible();
    const box = page.getByRole('combobox', { name: 'Cari halaman atau aksi' });
    await expect(box).toBeFocused();
    await box.fill('stok');
    await expect(dialog.getByRole('option')).toHaveCount(1);
    await expect(dialog.getByRole('option').first()).toContainText('Stok');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/stok$/);
    await expect(dialog).toHaveCount(0);
  });

  test('panah dan Enter memilih; tidak ada hasil menampilkan pesan; Esc menutup', async ({ page }) => {
    await ready(page, '/penjualan');
    await page.keyboard.press('Control+k');
    const box = page.getByRole('combobox', { name: 'Cari halaman atau aksi' });
    await box.fill('zzzzzz');
    await expect(page.getByText('Tidak ada hasil')).toBeVisible();
    await box.fill('');
    await page.keyboard.press('ArrowDown');
    const palette = page.getByRole('dialog', { name: 'Pencarian cepat' }); // (select halaman juga punya <option>)
    await expect(palette.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(palette.getByRole('option').nth(0)).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Pencarian cepat' })).toHaveCount(0);
  });

  test('aksi "Ganti tema" di palet mengubah tema', async ({ page }) => {
    await ready(page, '/penjualan');
    await page.keyboard.press('Control+k');
    await page.getByRole('combobox', { name: 'Cari halaman atau aksi' }).fill('tema');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
  });

  test('g lalu j pindah ke Riwayat; tidak aktif saat mengetik di kolom isian', async ({ page }) => {
    await ready(page, '/stok');
    await expect(page).toHaveURL(/\/stok$/);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('g');
    await page.keyboard.press('j');
    await expect(page).toHaveURL(/\/penjualan$/);

    // sedang mengetik: "g" lalu "s" tidak boleh menavigasi
    const input = page.getByPlaceholder(/Cari kode transaksi/);
    await input.fill('');
    await input.click();
    await page.keyboard.type('gs');
    await expect(page).toHaveURL(/\/penjualan$/);
    await expect(input).toHaveValue('gs');
  });

  test('? membuka bantuan global (bukan di halaman kasir); trigger header membuka palet', async ({ page }) => {
    await ready(page, '/penjualan');
    await expect(page.getByRole('heading', { name: 'Riwayat Penjualan' })).toBeVisible({ timeout: 15000 });
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'Pintasan keyboard' })).toBeVisible();
    await expect(page.getByText('Navigasi (semua halaman)')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('[data-command-trigger]').click();
    await expect(page.getByRole('dialog', { name: 'Pencarian cepat' })).toBeVisible();
  });

  test('pintasan satu-tombol tidak aktif saat dialog terbuka', async ({ page }) => {
    await ready(page, '/stok');
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: 'Pencarian cepat' })).toBeVisible();
    await page.keyboard.press('Tab');
    await page.keyboard.press('g');
    await page.keyboard.press('j');
    await expect(page).toHaveURL(/\/stok$/);
  });
});

test.describe('menu pengguna di header', () => {
  test.beforeEach(async ({ page }) => {
    await setupPos(page);
    await page.setViewportSize({ width: 1366, height: 768 });
  });

  test('berisi identitas (nama, peran), Pengaturan, tema, bantuan, Keluar; tidak ada sambutan ganda', async ({ page }) => {
    await ready(page, '/');
    await expect(page.getByText('Selamat datang')).toHaveCount(0);
    await expect(page.getByText('Halo,')).toHaveCount(0);
    const trigger = page.getByRole('button', { name: /Menu pengguna: / });
    await expect(trigger).toContainText('admin');
    await trigger.click();
    const menu = page.getByRole('menu', { name: 'Menu pengguna' });
    await expect(menu).toBeVisible();
    for (const name of ['Pengaturan', 'Tema gelap', 'Pintasan keyboard', 'Keluar']) {
      await expect(menu.getByRole('menuitem', { name: new RegExp(name) })).toBeVisible();
    }
    // tidak ada tombol Pengaturan/tema terpisah di bilah navigasi utama
    await expect(page.locator('nav').getByRole('link', { name: 'Pengaturan', exact: true })).toHaveCount(0);
  });

  test('keyboard: panah memindah item, Esc menutup dan mengembalikan fokus ke pemicu', async ({ page }) => {
    await ready(page, '/');
    const trigger = page.getByRole('button', { name: /Menu pengguna: / });
    await trigger.click();
    const items = page.getByRole('menuitem');
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu', { name: 'Menu pengguna' })).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('Pengaturan dari menu pengguna membuka halaman pengaturan; tema berganti', async ({ page }) => {
    await ready(page, '/');
    await page.getByRole('button', { name: /Menu pengguna: / }).click();
    await page.getByRole('menuitem', { name: /Tema gelap/ }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
    await page.getByRole('button', { name: /Menu pengguna: / }).click();
    await page.getByRole('menuitem', { name: /Pengaturan/ }).click();
    await expect(page).toHaveURL(/\/pengaturan$/);
  });
});

test.describe('bilah navigasi ringkas', () => {
  test.beforeEach(async ({ page }) => {
    await setupPos(page);
    await page.setViewportSize({ width: 1366, height: 768 });
  });

  test('tautan langsung ke halaman utama; tanpa "Dashboard", "Menu" dropdown, atau chip "Web Mode"', async ({ page }) => {
    await ready(page, '/');
    const nav = page.getByRole('navigation', { name: 'Navigasi utama' });
    await expect(nav.getByRole('link', { name: 'POS' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Riwayat' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Menu$/ })).toHaveCount(0);
    await expect(page.getByText('Web Mode')).toHaveCount(0);
    // tautan aktif ditandai
    await nav.getByRole('link', { name: 'Riwayat' }).click();
    await expect(page).toHaveURL(/\/penjualan$/);
    await expect(nav.getByRole('link', { name: 'Riwayat' })).toHaveClass(/bg-blue-50/);
  });

  test('logo/nama toko membawa ke Beranda (Menu Utama), yang tidak punya pencarian ganda', async ({ page }) => {
    await ready(page, '/penjualan');
    await page.locator('nav a[href="/"]').first().click();
    await expect(page).toHaveURL(/localhost:5199\/$/);
    await expect(page.getByRole('heading', { name: 'Menu Utama' })).toBeVisible();
    await expect(page.getByRole('searchbox')).toHaveCount(0);
    await expect(page.locator('[data-command-trigger]')).toBeVisible(); // pencarian cepat tersedia di header
  });
});

test.describe('subjudul header informatif', () => {
  test('bilah navigasi: di bawah nama toko tampil hari ini + ringkasan penjualan hari ini dari server', async ({ page }) => {
    const calls = [];
    await setupPos(page, [], {
      cabang: { id_cabang: 1, nama_cabang: 'Cabang Uji', tipe_katalog: 'global' },
      onApi: (route, req) => {
        if (/\/penjualan\/ringkasan/.test(req.url())) {
          calls.push(req.url());
          route.fulfill({ json: { success: true, data: { jumlah_transaksi: 19, total_penjualan: 541000, belum_lunas: 2, diperbarui: new Date().toISOString() } } });
          return true;
        }
        return false;
      },
    });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/penjualan'); // bukan Menu Utama: info ada di bilah navigasi semua halaman
    const meta = page.locator('[data-brand-meta]');
    await expect(meta).toContainText('19 transaksi', { timeout: 15000 });
    await expect(meta).toContainText('Rp 541.000');
    await expect(meta).toContainText('2 belum lunas');
    const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()];
    await expect(meta).toContainText(hari);
    const u = new URL(calls[0]);
    expect(new Date(u.searchParams.get('start_date')).getHours()).toBe(0);  // rentang hari LOKAL
    expect(calls.length).toBe(1);                                            // satu permintaan, tidak berganda per halaman
  });

  test('Riwayat Penjualan: periode, cakupan, dan waktu pembaruan (bukan teks promosi)', async ({ page }) => {
    await setupPos(page);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/penjualan');
    const sub = page.locator('h1', { hasText: 'Riwayat Penjualan' }).locator('xpath=following-sibling::div');
    await expect(sub).toContainText('Hari ini (', { timeout: 15000 });
    await expect(sub).toContainText(/Diperbarui \d{2}\.\d{2}/);
    await page.getByRole('group', { name: 'Periode' }).getByRole('button', { name: '7 hari terakhir' }).click();
    await expect(sub).toContainText('7 hari terakhir (');
  });

  test('tanpa ringkasan (server gagal) baris info tetap menampilkan hari', async ({ page }) => {
    await setupPos(page, [], { onApi: (route, req) => { if (/\/penjualan\/ringkasan/.test(req.url())) { route.fulfill({ status: 500, json: { success: false } }); return true; } return false; } });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');
    const meta = page.locator('[data-brand-meta]');
    await expect(meta).toContainText(['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()], { timeout: 15000 });
    await expect(meta).not.toContainText('transaksi');
  });
});
