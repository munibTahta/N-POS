import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

for (const [path, label] of [['/produk/tambah', /Simpan Produk/], ['/supplier/tambah', /Simpan Supplier/], ['/kategori/tambah', /Simpan Kategori/], ['/satuan/tambah', /Simpan Satuan/], ['/cabang/tambah', /Simpan Cabang/], ['/pengguna/tambah', /Tambah Pengguna/]]) {
  test(`${path}: bilah aksi seragam menempel di bawah layar (Batal + Simpan terjangkau tanpa scroll)`, async ({ page }) => {
    await setupPos(page);
    await page.setViewportSize({ width: 1366, height: 700 });
    await page.goto(path);
    const save = page.getByRole('button', { name: label });
    await expect(save).toBeVisible({ timeout: 20000 });
    await expect(save).toHaveClass(/btn-primary/);
    const box = await save.boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(700);                   // di dalam layar walau form panjang
    await expect(page.locator('main').getByRole('link', { name: 'Batal' }).or(page.locator('main').getByRole('button', { name: 'Batal' })).first()).toBeVisible();
  });
}
