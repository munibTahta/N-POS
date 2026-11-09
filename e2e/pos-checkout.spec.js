import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

// Menjaga logika checkout (validasi stok -> POST /penjualan -> POST /penjualan/:id/bayar) yang dipindah ke
// features/pos/hooks/usePosCheckout.js. Memeriksa payload yang benar-benar dikirim ke server.
test('bayar tunai: mengirim penjualan dan pembayaran dengan isi yang benar', async ({ page }) => {
  const posts = [];
  await setupPos(page, [], {
    onApi: (route, req) => {
      if (req.method() !== 'POST') return null;
      const url = req.url();
      let body = {};
      try { body = req.postDataJSON() || {}; } catch (_e) { /* bukan JSON */ }
      posts.push({ url, body });
      if (/\/penjualan\/\d+\/bayar/.test(url)) {
        return route.fulfill({ status: 201, json: { success: true, data: { id_pembayaran: 7 } } });
      }
      if (/\/penjualan$/.test(url.split('?')[0])) {
        return route.fulfill({ status: 201, json: { success: true, data: { id_penjualan: 99, kode_transaksi: body.kode_transaksi || 'TRX-TEST', total: 10500, items: body.items || [] } } });
      }
      return null; // log aktivitas dll: jawaban umum
    },
  });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/pos');
  await expect(page.locator('[data-product-id="2"]')).toBeVisible({ timeout: 15000 });

  await page.locator('[data-product-id="2"]').click();              // Produk contoh 2: Rp 10.500
  await page.getByRole('button', { name: /Isi Total/ }).first().click();
  await page.getByTitle(/Selesaikan transaksi/).first().click();

  await expect.poll(() => posts.some((p) => /\/penjualan$/.test(p.url.split('?')[0])), { timeout: 15000 }).toBe(true);
  const sale = posts.find((p) => /\/penjualan$/.test(p.url.split('?')[0])).body;
  expect(sale.items).toHaveLength(1);
  expect(sale.items[0]).toMatchObject({ id_produk: 2, jumlah: 1, harga_jual: 10500 });
  expect(Number(sale.bayar)).toBe(10500);
  expect(sale.id_cabang).toBeTruthy();
  expect(sale.kode_transaksi).toBeTruthy();            // kunci idempotensi untuk retry/sinkronisasi offline

  await expect.poll(() => posts.some((p) => /\/penjualan\/99\/bayar/.test(p.url)), { timeout: 15000 }).toBe(true);
  const pay = posts.find((p) => /\/penjualan\/99\/bayar/.test(p.url)).body;
  expect(Number(pay.jumlah_bayar ?? pay.jumlah ?? pay.amount ?? 0)).toBe(10500);

  // setelah sukses keranjang dikosongkan
  await expect(page.getByText('Keranjang kosong')).toBeVisible({ timeout: 15000 });
});

test('keranjang kosong: tombol selesaikan transaksi tidak mengirim apa pun', async ({ page }) => {
  const posts = [];
  await setupPos(page, [], { onApi: (route, req) => { if (req.method() === 'POST') posts.push(req.url()); return null; } });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/pos');
  await expect(page.locator('[data-product-id="2"]')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTitle(/Selesaikan transaksi/).first()).toBeDisabled();
  expect(posts.filter((u) => /penjualan/.test(u))).toEqual([]);
});
