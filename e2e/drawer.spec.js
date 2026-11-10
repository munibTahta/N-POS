import { test, expect } from '@playwright/test';
import { setupPos } from './helpers.js';

async function openPos(page, w, h) {
  await setupPos(page);
  await page.setViewportSize({ width: w, height: h });
  await page.goto('/pos');
  await expect(page.locator('[data-product-id="2"]')).toBeVisible({ timeout: 15000 });
}

test.describe('mobile (390px)', () => {
  test('keranjang tampil sebagai drawer: buka, tutup dengan Esc, fokus kembali, scroll terkunci', async ({ page }) => {
    await openPos(page, 390, 844);
    const dialog = page.getByRole('dialog', { name: 'Keranjang' });
    await expect(dialog).toBeHidden();                       // tertutup: tidak ada di pohon aksesibilitas
    await expect(page.getByText('Lihat Keranjang')).toHaveCount(0); // bilah bawah belum ada saat keranjang kosong

    await page.locator('[data-product-id="2"]').click();     // produk dengan stok
    const bar = page.getByRole('button', { name: /Lihat Keranjang/ });
    await expect(bar).toBeVisible();
    await expect(page.getByRole('button', { name: /Buka keranjang \(1 item\)/ })).toBeVisible();

    await bar.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Keranjang kosong')).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    await expect(bar).toBeFocused();                         // fokus dikembalikan ke pemicu
  });

  test('klik backdrop menutup, dan Tab tidak keluar dari drawer', async ({ page }) => {
    await openPos(page, 390, 844);
    await page.locator('[data-product-id="2"]').click();
    await page.getByRole('button', { name: /Lihat Keranjang/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Keranjang' });
    await expect(dialog).toBeVisible();

    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
      expect(inside, `Tab ke-${i + 1} keluar dari drawer`).toBe(true);
    }

    await page.locator('[data-testid="drawer-backdrop"].opacity-100').click({ position: { x: 10, y: 300 } });
    await expect(dialog).toBeHidden();
  });

  test('tidak ada scroll horizontal dan tidak ada tab Produk|Keranjang lama', async ({ page }) => {
    await openPos(page, 390, 844);
    await expect(page.getByRole('tab', { name: /Keranjang/ })).toHaveCount(0);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over).toBeLessThanOrEqual(1);
  });

  test('menu navigasi adalah drawer dari kiri', async ({ page }) => {
    await openPos(page, 390, 844);
    const nav = page.getByRole('dialog', { name: 'Menu' });
    await expect(nav).toBeHidden();
    const burger = page.getByRole('button', { name: 'Buka menu navigasi' });
    await expect(burger).toHaveAttribute('aria-expanded', 'false');
    await burger.click();
    await expect(nav).toBeVisible();
    await expect(burger).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
  });
});

test.describe('desktop (1366px)', () => {
  test('keranjang adalah panel tetap, bukan dialog; tidak ada backdrop atau hamburger', async ({ page }) => {
    await openPos(page, 1366, 768);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('drawer-backdrop')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Keranjang' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Buka menu navigasi' })).toBeHidden();
    await expect(page.getByRole('button', { name: /Buka keranjang/ })).toBeHidden();
    await expect(page.getByRole('button', { name: /Lihat Keranjang/ })).toHaveCount(0);
  });

  test('tidak ada permukaan bersarang di panel pembayaran', async ({ page }) => {
    await openPos(page, 1366, 768);
    const nested = await page.evaluate(() => {
      const surface = (el) => {
        const cs = getComputedStyle(el);
        if ((parseFloat(cs.borderTopLeftRadius) || 0) < 6) return false;
        const bg = cs.backgroundColor;
        if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') return false;
        const edge = cs.boxShadow !== 'none' || ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none');
        const r = el.getBoundingClientRect();
        // kontrol form (input/select/button) boleh berbingkai di dalam kartu
        return edge && r.width > 120 && r.height > 40 && !el.matches('input,select,textarea,button,[data-product-id]') && !el.closest('[data-product-id]');
      };
      const bad = [];
      for (const el of document.querySelectorAll('body *')) {
        if (!surface(el)) continue;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          if (surface(p)) { bad.push((el.innerText || '').trim().slice(0, 30)); break; }
        }
      }
      return bad;
    });
    expect(nested).toEqual([]);
  });
});
