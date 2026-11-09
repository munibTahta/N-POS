import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';
import { richApi } from './richData.js';

// Aksi massal: pilih baris (checkbox, Shift+klik rentang, header indeterminate), bilah aksi, konfirmasi, hasil, Esc.
const setup = async (page, bulkHandler) => {
  const bulkCalls = [];
  await setupPos(page, [], {
    onApi: (route, req) => {
      const url = req.url();
      if (req.method() !== 'GET' && /pelanggan/.test(url) && /bulk/.test(url)) {
        let body = null; try { body = req.postDataJSON(); } catch (_e) { /* bukan JSON */ }
        bulkCalls.push({ method: req.method(), url, body });
        return bulkHandler ? bulkHandler(route) : (route.fulfill({ json: { success: true, message: 'ok' } }), true);
      }
      return richApi(route, req);
    },
  });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/pelanggan');
  await expect(page.getByText('Pelanggan 1', { exact: true }).first()).toBeVisible({ timeout: 20000 });
  return bulkCalls;
};
const rowBox = (page, n) => page.getByRole('checkbox', { name: `Pilih baris ${n}` });

test('pilih baris: hitungan, header indeterminate, Shift+klik rentang, Esc membersihkan', async ({ page }) => {
  await setup(page);
  const bar = page.getByRole('region', { name: 'Aksi massal' });
  await expect(bar).toHaveCount(0);

  await rowBox(page, 2).check();
  await expect(bar).toContainText('1 pelanggan dipilih');
  const header = page.getByRole('checkbox', { name: 'Pilih semua baris di halaman ini' });
  expect(await header.evaluate((el) => el.indeterminate)).toBe(true);

  await rowBox(page, 5).click({ modifiers: ['Shift'] });          // rentang 2..5
  await expect(bar).toContainText('4 pelanggan dipilih');
  for (const n of [2, 3, 4, 5]) await expect(rowBox(page, n)).toBeChecked();
  await expect(rowBox(page, 1)).not.toBeChecked();
  await expect(page.locator('tr[aria-selected="true"]')).toHaveCount(4);

  await header.check();                                            // semua di halaman
  expect(await header.evaluate((el) => el.indeterminate)).toBe(false);
  await header.uncheck();
  await expect(bar).toHaveCount(0);

  await rowBox(page, 1).check();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Escape');
  await expect(bar).toHaveCount(0);
});

test('hapus massal: konfirmasi dulu, lalu server dipanggil dengan id terpilih, pilihan dibersihkan', async ({ page }) => {
  const calls = await setup(page);
  await rowBox(page, 1).check();
  await rowBox(page, 3).check();
  const bar = page.getByRole('region', { name: 'Aksi massal' });
  await bar.getByRole('button', { name: 'Hapus' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Hapus pelanggan terpilih' });
  await expect(dialog).toContainText('Hapus 2 pelanggan');
  expect(calls.length).toBe(0);                                    // belum ada panggilan sebelum konfirmasi
  await dialog.getByRole('button', { name: 'Ya, hapus' }).click();
  await expect.poll(() => calls.length).toBe(1);
  expect(JSON.stringify(calls[0].body)).toContain('1');
  await expect(bar).toHaveCount(0);                                // semua berhasil -> pilihan kosong
});

test('hapus massal gagal: pilihan dipertahankan agar bisa dicoba lagi; batal di dialog tidak memanggil server', async ({ page }) => {
  const calls = await setup(page, (route) => { route.fulfill({ status: 200, json: { success: false, message: 'Pelanggan masih punya transaksi' } }); return true; });
  await rowBox(page, 2).check();
  const bar = page.getByRole('region', { name: 'Aksi massal' });

  await bar.getByRole('button', { name: 'Hapus' }).click();
  await page.getByRole('alertdialog', { name: 'Hapus pelanggan terpilih' }).getByRole('button', { name: 'Batal', exact: true }).last().click();
  expect(calls.length).toBe(0);
  await expect(bar).toContainText('1 pelanggan dipilih');

  await bar.getByRole('button', { name: 'Hapus' }).click();
  await page.getByRole('alertdialog', { name: 'Hapus pelanggan terpilih' }).getByRole('button', { name: 'Ya, hapus' }).click();
  await expect.poll(() => calls.length).toBe(1);
  await expect(page.getByText(/Semua 1 pelanggan gagal dihapus/)).toBeVisible();
  await expect(page.getByText(/Pelanggan masih punya transaksi/)).toBeVisible();
  await expect(bar).toContainText('1 pelanggan dipilih');          // item yang gagal tetap terpilih
});
