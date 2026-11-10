import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

const daftar = [
  { id_produk: 1, kode_produk: 'AY1', nama_produk: 'Ayam frozen', stok: 9999, harga_beli: 45000, lokasi_rak: 'A1' },
  { id_produk: 2, kode_produk: 'TL1', nama_produk: 'Telur', stok: 4, harga_beli: 2000, lokasi_rak: null },
];

test.describe('stok opname', () => {
  test('hitung fisik, ringkasan selisih, terapkan mengirim hanya baris terisi', async ({ page }) => {
    const sent = [];
    await setupPos(page, [], {
      onApi: (route, req) => {
        const u = req.url();
        if (/\/stok-opname\/daftar/.test(u)) { route.fulfill({ json: { success: true, data: { total: 2, daftar } } }); return true; }
        if (/\/stok-opname$/.test(u.split('?')[0]) && req.method() === 'POST') { sent.push(req.postDataJSON()); route.fulfill({ status: 201, json: { success: true, message: 'Opname OPN-X diterapkan' } }); return true; }
        if (/\/cabang/.test(u)) { route.fulfill({ json: { success: true, data: [{ id_cabang: 1, nama_cabang: 'Pusat' }] } }); return true; }
        return false;
      },
    });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/stok/opname');
    await expect(page.getByText('Ayam frozen')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /Tinjau/ })).toBeDisabled();
    await page.getByLabel('Stok fisik Ayam frozen').fill('40');
    await page.getByLabel('Stok fisik Telur').fill('-1');
    await expect(page.getByRole('status')).toContainText('1 isian tidak valid');
    await expect(page.getByRole('button', { name: /Tinjau/ })).toBeDisabled();
    await page.getByLabel('Stok fisik Telur').fill('4');
    await expect(page.getByRole('status')).toContainText('2 dihitung');
    await expect(page.getByRole('status')).toContainText('1 berubah');
    await expect(page.getByRole('cell', { name: '-9.959' })).toHaveClass(/text-right/);
    await page.getByRole('button', { name: /Tinjau/ }).click();
    await expect(page.getByRole('alertdialog')).toContainText('1 produk akan disesuaikan');
    await page.getByRole('button', { name: 'Terapkan', exact: true }).click();
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0].items).toEqual([{ id_produk: 1, stok_fisik: 40 }, { id_produk: 2, stok_fisik: 4 }]);
  });

  test('server gagal memuat: pesan dan coba lagi', async ({ page }) => {
    await setupPos(page, [], { onApi: (route, req) => { if (/\/stok-opname\/daftar/.test(req.url())) { route.fulfill({ status: 500, json: { success: false } }); return true; } if (/\/cabang/.test(req.url())) { route.fulfill({ json: { success: true, data: [{ id_cabang: 1, nama_cabang: 'Pusat' }] } }); return true; } return false; } });
    await page.goto('/stok/opname');
    await expect(page.getByRole('alert')).toContainText('belum dapat dimuat', { timeout: 20000 });
  });
});

test.describe('saran restok', () => {
  const saran = [
    { id_produk: 1, kode_produk: 'A', nama_produk: 'Ayam dada', id_supplier: 7, nama_supplier: 'PT Ayam', harga_beli: 30000, stok: 0, terjual: 60, kecepatan_per_hari: 2, sisa_hari: 0, saran: 28, alasan: 'habis' },
    { id_produk: 2, kode_produk: 'B', nama_produk: 'Beras', id_supplier: 7, nama_supplier: 'PT Ayam', harga_beli: 12000, stok: 3, terjual: 30, kecepatan_per_hari: 1, sisa_hari: 3, saran: 11, alasan: 'cepat_habis' },
    { id_produk: 3, kode_produk: 'C', nama_produk: 'Es batu', id_supplier: null, nama_supplier: null, harga_beli: 100, stok: 9999, terjual: 30, kecepatan_per_hari: 1, sisa_hari: null, saran: 0, alasan: 'stok_tidak_wajar' },
  ];
  test('dikelompokkan per pemasok, jumlah dapat diubah, membuat pembelian per pemasok ke cabang', async ({ page }) => {
    const posts = [];
    await setupPos(page, [], {
      onApi: (route, req) => {
        const u = req.url();
        if (/\/laporan\/saran-restok/.test(u)) { route.fulfill({ json: { success: true, data: { id_cabang: 1, daftar: saran } } }); return true; }
        if (/\/pembelian$/.test(u.split('?')[0]) && req.method() === 'POST') { posts.push(req.postDataJSON()); route.fulfill({ status: 201, json: { success: true, data: { id_pembelian: 1 } } }); return true; }
        if (/\/cabang/.test(u)) { route.fulfill({ json: { success: true, data: [{ id_cabang: 1, nama_cabang: 'Pusat' }] } }); return true; }
        return false;
      },
    });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/stok/restok');
    await expect(page.getByText('Ayam dada')).toBeVisible({ timeout: 20000 });
    await expect(page.getByLabel('Pilih Es batu')).toBeDisabled();           // stok tidak wajar: opname dulu
    await expect(page.getByRole('status')).toContainText('2 produk · 1 pemasok');
    await page.getByLabel('Jumlah beli Beras').fill('20');
    await page.getByRole('button', { name: 'Buat pembelian' }).first().click();
    await expect(page.getByRole('alertdialog')).toContainText('1 pembelian');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Buat pembelian' }).click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0].masuk_gudang).toBe(false);
    expect(posts[0].id_supplier).toBe(7);
    expect(posts[0].items).toEqual([{ id_produk: 1, jumlah: 28, harga_beli: 30000 }, { id_produk: 2, jumlah: 20, harga_beli: 12000 }]);
  });
});
