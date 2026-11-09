import { test, expect } from '@playwright/test';
import { setupPos, prods } from './helpers.js';

// 3 produk milik cabang 5, 2 milik cabang 6, 2 global (id_cabang_pemilik null)
const mixed = [
  ...[1, 2, 3].map((i) => ({ ...prods[i], id_produk: 100 + i, nama_produk: `Menu A${i}`, id_cabang_pemilik: 5 })),
  ...[1, 2].map((i) => ({ ...prods[i], id_produk: 200 + i, nama_produk: `Menu B${i}`, id_cabang_pemilik: 6 })),
  ...[1, 2].map((i) => ({ ...prods[i], id_produk: 300 + i, nama_produk: `Barang G${i}`, id_cabang_pemilik: null })),
];

test('cabang terpisah hanya menampilkan produk miliknya', async ({ page }) => {
  await setupPos(page, [], { idCabang: 5, products: mixed, cabang: { id_cabang: 5, nama_cabang: 'Dapur A', tipe_katalog: 'terpisah' } });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/pos');
  await expect(page.getByText('Menu A1')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('3 produk')).toBeVisible();
  await expect(page.getByText('Menu B1')).toHaveCount(0);
  await expect(page.getByText('Barang G1')).toHaveCount(0);
});

test('cabang global hanya menampilkan produk global', async ({ page }) => {
  await setupPos(page, [], { idCabang: 1, products: mixed, cabang: { id_cabang: 1, nama_cabang: 'Toko', tipe_katalog: 'global' } });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/pos');
  await expect(page.getByText('Barang G1')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('2 produk')).toBeVisible();
  await expect(page.getByText('Menu A1')).toHaveCount(0);
});
