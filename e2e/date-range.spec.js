import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n, h = 10) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 15, 0, 0); return d; };

test.describe('filter rentang tanggal cepat dan tanggal relatif', () => {
  test('Laporan Keuangan: bawaan bulan ini, chip mengubah parameter permintaan', async ({ page }) => {
    const urls = [];
    await setupPos(page, [], { onApi: (route, req) => { urls.push(req.url()); return false; } });
    await page.goto('/laporan-keuangan');
    const group = page.getByRole('group', { name: 'Periode laporan' });
    await expect(group).toBeVisible({ timeout: 15000 });
    await expect(group.getByRole('button', { name: 'Bulan ini', pressed: true })).toBeVisible();

    const now = new Date();
    await group.getByRole('button', { name: 'Hari ini' }).click();
    await expect(group.getByRole('button', { name: 'Hari ini', pressed: true })).toBeVisible();
    await expect(group.getByLabel('Dari')).toHaveValue(iso(now));
    await expect(group.getByLabel('Sampai')).toHaveValue(iso(now));
    await expect.poll(() => urls.some((u) => u.includes(`tanggal_dari=${iso(now)}`))).toBe(true);

    await group.getByRole('button', { name: 'Semua' }).click();
    await expect(group.getByLabel('Dari')).toHaveValue('');
    await expect(group.getByLabel('Sampai')).toHaveValue('');
  });

  test('tanggal awal setelah akhir otomatis ditukar', async ({ page }) => {
    await setupPos(page);
    await page.goto('/laporan-keuangan');
    const group = page.getByRole('group', { name: 'Periode laporan' });
    await group.getByRole('button', { name: 'Semua' }).click();
    await group.getByLabel('Sampai').fill('2026-03-10');
    await group.getByLabel('Dari').fill('2026-03-20'); // melewati batas akhir -> ditukar
    await expect(group.getByLabel('Dari')).toHaveValue('2026-03-10');
    await expect(group.getByLabel('Sampai')).toHaveValue('2026-03-20');
  });

  test('Riwayat Penjualan: chip cepat menyaring daftar dan tanggal tampil relatif', async ({ page }) => {
    const sale = (id, d) => ({ id_penjualan: id, kode_transaksi: `TRX-${id}`, tanggal: d.toISOString(), total: 10000 * id, status_pembayaran: 'lunas', id_cabang: 1, Cabang: { nama_cabang: 'Pusat' } });
    const sales = [sale(1, daysAgo(0, 8)), sale(2, daysAgo(1)), sale(3, daysAgo(3)), sale(4, daysAgo(60))];
    await setupPos(page, [], {
      onApi: (route, req) => {
        if (/\/penjualan(\?|$)/.test(req.url()) && req.method() === 'GET') {
          route.fulfill({ json: { success: true, data: sales, pagination: { total: sales.length } } });
          return true;
        }
        return false;
      },
    });
    await page.goto('/penjualan');
    await expect(page.getByText('TRX-1', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('TRX-4', { exact: true })).toBeVisible();

    const group = page.getByRole('group', { name: 'Periode' });
    await group.getByRole('button', { name: 'Kemarin' }).click();
    await expect(page.getByText('TRX-2', { exact: true })).toBeVisible();
    await expect(page.getByText('TRX-1', { exact: true })).toHaveCount(0);
    await expect(page.getByText('TRX-4', { exact: true })).toHaveCount(0);
    await expect(page.locator('time', { hasText: 'Kemarin' }).first()).toBeVisible();

    await group.getByRole('button', { name: '7 hari terakhir' }).click();
    await expect(page.getByText('TRX-3', { exact: true })).toBeVisible();
    await expect(page.locator('time', { hasText: '3 hari lalu' }).first()).toBeVisible();
    await expect(page.getByText('TRX-4', { exact: true })).toHaveCount(0);

    await group.getByRole('button', { name: 'Semua' }).click();
    await expect(page.getByText('TRX-4', { exact: true })).toBeVisible();
  });
});
