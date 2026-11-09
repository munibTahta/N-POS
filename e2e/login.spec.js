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

// Pembatas laju backend: 429 + Retry-After. Pesan memuat waktu tunggu dan klien TIDAK mengulang otomatis
// (dulu RetryManager mengulang 429 dengan jeda 1-2 detik sehingga pesan tertunda dan beban bertambah).
test('login 429: pesan dengan waktu tunggu, tanpa percobaan ulang otomatis', async ({ page }) => {
  let loginPosts = 0;
  await page.route(/^(?!http:\/\/localhost:5199).*/, (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/(src|node_modules|@|assets)/.test(url)) return route.continue();
    if (route.request().resourceType() === 'document' || /fonts\.g/.test(url)) return route.continue();
    if (route.request().method() === 'POST') {
      loginPosts += 1;
      return route.fulfill({ status: 429, headers: { 'Retry-After': '600', 'Access-Control-Expose-Headers': 'Retry-After' }, json: { success: false, message: 'Terlalu banyak percobaan login untuk akun ini.' } });
    }
    return route.fulfill({ json: { success: true, data: [] } });
  });
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill('kasir1');
  await page.getByLabel('Password', { exact: true }).fill('salah');
  const t0 = Date.now();
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page.getByRole('alert')).toContainText('Terlalu banyak percobaan login', { timeout: 10000 });
  await expect(page.getByRole('alert')).toContainText('10 menit');
  expect(Date.now() - t0).toBeLessThan(2500); // tidak menunggu backoff 1-2 detik
  await page.waitForTimeout(3500);
  expect(loginPosts).toBe(1);
});

// Password salah = satu percobaan ke server (dulu dua: /session/login lalu cadangan /auth/login, sehingga pembatas laju
// backend menghitung ganda dan akun terkunci setelah 4 percobaan nyata, bukan 8).
test('password salah mengirim tepat satu permintaan login', async ({ page }) => {
  let loginPosts = 0;
  await page.route(/^(?!http:\/\/localhost:5199).*/, (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/(src|node_modules|@|assets)/.test(url)) return route.continue();
    if (route.request().resourceType() === 'document' || /fonts\.g/.test(url)) return route.continue();
    if (route.request().method() === 'POST' && /login/.test(url)) {
      loginPosts += 1;
      return route.fulfill({ status: 401, json: { success: false, message: 'Username atau password salah.' } });
    }
    return route.fulfill({ json: { success: true, data: [] } });
  });
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill('kasir1');
  await page.getByLabel('Password', { exact: true }).fill('salah');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page.getByRole('alert')).toContainText('Username atau password salah', { timeout: 10000 });
  await page.waitForTimeout(1500);
  expect(loginPosts).toBe(1);
});

// 409 dari /session/login (sesi lama masih aktif dari IP yang sama) TIDAK boleh memblokir kasir: login cadangan dipakai.
test('sesi lama masih aktif (409): login tetap berhasil lewat jalur cadangan', async ({ page }) => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
  const token = `${b({ alg: 'none' })}.${b({ id: 1, exp: 4102444800 })}.x`;
  const seen = [];
  await page.route(/^(?!http:\/\/localhost:5199).*/, (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/(src|node_modules|@|assets)/.test(url)) return route.continue();
    if (route.request().resourceType() === 'document' || /fonts\.g/.test(url)) return route.continue();
    if (route.request().method() === 'POST' && /session\/login/.test(url)) {
      seen.push('session');
      return route.fulfill({ status: 409, json: { success: false, message: 'Anda sudah login dari device ini.' } });
    }
    if (route.request().method() === 'POST' && /auth\/login/.test(url)) {
      seen.push('legacy');
      return route.fulfill({ json: { success: true, data: { token, user: { id_user: 1, username: 'kasir1', nama_lengkap: 'Kasir Satu', id_role: 1, role: 'admin', id_cabang: 1 } } } });
    }
    return route.fulfill({ json: { success: true, data: [] } });
  });
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill('kasir1');
  await page.getByLabel('Password', { exact: true }).fill('benar');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect.poll(() => seen.join(','), { timeout: 10000 }).toBe('session,legacy');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
