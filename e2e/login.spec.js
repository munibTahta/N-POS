import { test, expect } from '@playwright/test';

async function mockApi(page, { loginStatus = 401 } = {}) {
  await page.route(/^(?!http:\/\/localhost:5199).*/, (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/(src|node_modules|@|assets)/.test(url)) return route.continue();
    if (route.request().resourceType() === 'document' || /fonts\.g/.test(url)) return route.continue();
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: loginStatus, json: { success: false, message: 'Username atau password salah.' } });
    }
    return route.fulfill({ json: { success: true, data: [] } });
  });
}

for (const [name, w, h] of [['desktop', 1366, 768], ['mobile', 390, 844]]) {
  test(`login tampil rapi dan tidak overflow - ${name}`, async ({ page }) => {
    await mockApi(page);
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Masuk ke N-POS' })).toBeVisible();
    await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    const submit = page.getByRole('button', { name: 'Masuk' });
    await expect(submit).toBeVisible();
    // target sentuh utama minimal 48px
    const box = await submit.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(47);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `e2e/shots/login-${name}.png` });
  });
}

test('login gagal menampilkan pesan error yang dapat diakses (role=alert)', async ({ page }) => {
  await mockApi(page);
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill('kasir1');
  await page.getByLabel('Password', { exact: true }).fill('salah');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page.getByRole('alert')).toContainText('Username atau password salah', { timeout: 10000 });
  // form tetap bisa dipakai lagi setelah gagal
  await expect(page.getByRole('button', { name: 'Masuk' })).toBeEnabled();
});

test('ingat username: terisi otomatis dan kotak tercentang, password tidak pernah disimpan', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rememberedUsername', 'kasir_toko'));
  await mockApi(page);
  await page.goto('/login');
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue('kasir_toko');
  await expect(page.getByRole('checkbox', { name: 'Ingat username' })).toBeChecked();
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
});

test('tombol tampilkan password bekerja dan punya label aksesibilitas', async ({ page }) => {
  await mockApi(page);
  await page.goto('/login');
  const pw = page.getByLabel('Password', { exact: true });
  await pw.fill('rahasia123');
  await expect(pw).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Tampilkan password' }).click();
  await expect(pw).toHaveAttribute('type', 'text');
  await expect(page.getByRole('button', { name: 'Sembunyikan password' })).toBeVisible();
});
