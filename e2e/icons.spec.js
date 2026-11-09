import { test, expect } from '@playwright/test';

test('semua ikon di <head> dan manifest dapat dimuat sebagai gambar', async ({ page, request }) => {
  await page.goto('/login');
  expect(await page.locator('html').getAttribute('lang')).toBe('id');

  const hrefs = await page.$$eval('link[rel~="icon"], link[rel="apple-touch-icon"]', (els) => els.map((e) => e.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThanOrEqual(3);
  expect(hrefs.join(' ')).not.toContain('vite.svg'); // bukan logo bawaan Vite

  for (const href of hrefs) {
    const res = await request.get(href);
    expect(res.status(), href).toBe(200);
    expect(res.headers()['content-type'], href).toMatch(/image\//);
    expect((await res.body()).length, href).toBeGreaterThan(100);
  }

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(manifestHref)).json();
  expect(manifest.name).toBeTruthy();
  const sizes = manifest.icons.map((i) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) {
    const res = await request.get(icon.src);
    expect(res.status(), icon.src).toBe(200);
  }

  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /#[0-9a-f]{6}/i);
});
