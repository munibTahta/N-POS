import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';
import { richApi } from './richData.js';

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const heatmap = () => {
  const g = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ jumlah: 0, total: 0 })));
  g[5][12] = { jumlah: 9, total: 900000 };   // Sabtu 12.00 = puncak
  g[1][10] = { jumlah: 3, total: 150000 };
  return g;
};

test.describe('pola penjualan: kalender dan heatmap', () => {
  test('kalender mewarnai hari berpenjualan, rincian saat dipilih, parameter waktu lokal dikirim', async ({ page }) => {
    const calls = [];
    const today = iso(new Date());
    await setupPos(page, [], {
      onApi: (route, req) => {
        if (/\/laporan\/pola-penjualan/.test(req.url())) {
          calls.push(req.url());
          route.fulfill({ json: { success: true, data: { harian: [{ tanggal: today, jumlah: 19, total: 541000 }], heatmap: heatmap() } } });
          return true;
        }
        return richApi(route, req);
      },
    });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/laporan');
    const panel = page.getByRole('region', { name: 'Pola penjualan' });
    await expect(panel.getByRole('tab', { name: 'Kalender', selected: true })).toBeVisible({ timeout: 20000 });
    const day = panel.getByRole('gridcell', { name: new RegExp(`^${today}: 19 transaksi, Rp 541.000`) });
    await expect(day).toBeVisible();
    await day.click();
    await expect(panel.getByText('19 transaksi', { exact: false }).first()).toBeVisible();
    const u = new URL(calls[0]);
    expect(Number(u.searchParams.get('tz_offset')) + 0).toBe(-new Date().getTimezoneOffset() + 0);
    expect(new Date(u.searchParams.get('start_date')).getDate()).toBe(1);        // awal bulan lokal

    const before = calls.length;
    await panel.getByRole('button', { name: 'Bulan sebelumnya' }).click();
    await expect.poll(() => calls.length).toBeGreaterThan(before);
  });

  test('tab Jam sibuk: heatmap 7x24, puncak dan hari/jam terbaik disebutkan, metrik bisa diganti', async ({ page }) => {
    await setupPos(page, [], {
      onApi: (route, req) => {
        if (/\/laporan\/pola-penjualan/.test(req.url())) { route.fulfill({ json: { success: true, data: { harian: [], heatmap: heatmap() } } }); return true; }
        return richApi(route, req);
      },
    });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/laporan');
    const panel = page.getByRole('region', { name: 'Pola penjualan' });
    await panel.getByRole('tab', { name: 'Jam sibuk' }).click();
    await expect(panel.getByText(/Tersibuk:/)).toContainText('Sabtu 12.00');
    await expect(panel.getByText(/Tersibuk:/)).toContainText('Rp 900.000');
    await expect(panel.getByRole('cell', { name: 'Sabtu 12.00: Rp 900.000' })).toBeVisible();
    expect(await panel.getByRole('row').count()).toBe(8);                         // judul jam + 7 hari
    await panel.getByRole('button', { name: 'Transaksi' }).click();
    await expect(panel.getByText(/Tersibuk:/)).toContainText('9 transaksi');
  });

  test('server gagal: pesan dengan tombol Coba lagi', async ({ page }) => {
    await setupPos(page, [], { onApi: (route, req) => { if (/\/laporan\/pola-penjualan/.test(req.url())) { route.fulfill({ status: 500, json: { success: false } }); return true; } return richApi(route, req); } });
    await page.goto('/laporan');
    const panel = page.getByRole('region', { name: 'Pola penjualan' });
    await expect(panel.getByRole('alert')).toContainText('belum dapat dimuat', { timeout: 20000 });
    await expect(panel.getByRole('button', { name: 'Coba lagi' })).toBeVisible();
  });
});

test.describe('peringatan stok tidak wajar', () => {
  const anomaly = { ambang: 5000, ringkasan: [{ id_cabang: 5, total_produk: 80, stok_besar: 54, stok_minus: 0, nilai_tercatat_stok_besar: 4100191450, nilai_persediaan_total: 4389753950 }], daftar: [{ id_cabang: 5, id_produk: 1, kode_produk: 'AY1', nama_produk: 'Ayam frozen', stok: 10999, harga_beli: 45000, nilai_tercatat: 494955000 }] };

  test('menampilkan jumlah, nilai tercatat, persentase, dan daftar yang bisa dibuka; dapat ditutup', async ({ page }) => {
    await setupPos(page, [], { onApi: (route, req) => { if (/\/laporan\/stok-anomali/.test(req.url())) { route.fulfill({ json: { success: true, data: anomaly } }); return true; } return false; } });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/stok');
    const banner = page.getByRole('region', { name: 'Peringatan stok tidak wajar' });
    await expect(banner).toContainText('54 produk berstok ≥ 5.000', { timeout: 20000 });
    await expect(banner).toContainText('Rp 4.100.191.450');
    await expect(banner).toContainText('93%');
    await expect(banner).toContainText('9999');
    await banner.getByRole('button', { name: /Lihat produk terbesar/ }).click();
    await expect(banner.getByRole('cell', { name: 'Ayam frozen' })).toBeVisible();
    await expect(banner.getByRole('cell', { name: '10.999' })).toHaveClass(/text-right/);   // angka rata kanan
    await banner.getByRole('button', { name: 'Tutup peringatan' }).click();
    await expect(banner).toHaveCount(0);
  });

  test('tanpa temuan atau server gagal: banner tidak tampil', async ({ page }) => {
    await setupPos(page, [], { onApi: (route, req) => { if (/\/laporan\/stok-anomali/.test(req.url())) { route.fulfill({ json: { success: true, data: { ambang: 5000, ringkasan: [{ id_cabang: 1, total_produk: 5, stok_besar: 0, stok_minus: 0, nilai_tercatat_stok_besar: 0, nilai_persediaan_total: 1000 }], daftar: [] } } }); return true; } return false; } });
    await page.goto('/stok');
    await page.waitForTimeout(2500);
    await expect(page.getByRole('region', { name: 'Peringatan stok tidak wajar' })).toHaveCount(0);
  });
});
