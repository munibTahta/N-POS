import { test } from '@playwright/test';
import fs from 'node:fs';
import { setupPos } from './helpers.js';
import { contrastReport } from './contrastCheck.js';
import { richApi } from './richData.js';

// Laporan kontras WCAG per halaman dan tema. Ditulis ke CONTRAST_OUT (JSON) bila diset. Bukan bagian dari suite biasa.
const ROUTES = (process.env.CONTRAST_ROUTES || '/login,/,/menu,/pos,/laporan,/laporan-keuangan,/penjualan,/produk,/produk/tambah,/kategori,/supplier,/pelanggan,/stok,/stok/gudang,/stok/transfer,/pembelian,/pembelian/history,/users,/cabang,/satuan,/metode-pembayaran,/voucher,/pajak,/diskon,/roles,/menu-management,/pengaturan,/offline-data,/audit-trail,/log-aktivitas,/return,/pembayaran/pending').split(',');
const THEMES = (process.env.CONTRAST_THEMES || 'light,dark').split(',');
const results = {};

test.describe.configure({ mode: 'serial' });
for (const theme of THEMES) {
  for (const route of ROUTES) {
    test(`kontras ${theme} ${route}`, async ({ page }) => {
      test.setTimeout(60000);
      await page.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch (_e) { /* abaikan */ } }, theme);
      if (route !== '/login') await setupPos(page, [], { onApi: richApi });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(route);
      await page.waitForTimeout(1800);
      const bad = await contrastReport(page);
      (results[`${theme} ${route}`] = bad);
    });
  }
}
test.afterAll(() => {
  const out = process.env.CONTRAST_OUT;
  if (out) fs.writeFileSync(out, JSON.stringify(results, null, 1));
  const lines = Object.entries(results).map(([k, v]) => `${String(v.length).padStart(4)}  ${k}`);
  console.log('KONTRAS-RINGKASAN\n' + lines.join('\n'));
});
