export const cats = Array.from({ length: 30 }, (_, i) => ({ id_kategori: i + 1, nama_kategori: `KAT${i + 1}` }));
export const prods = Array.from({ length: 24 }, (_, i) => ({
  id_produk: i + 1, kode_produk: `P${i + 1}`, nama_produk: `Produk contoh ${i + 1}`,
  harga_jual: 10000 + i * 500, id_kategori: (i % 30) + 1, status: 'aktif',
}));

/** Login palsu + mock seluruh API eksternal. `log` menampung URL request ke /produk. */
export async function setupPos(page, log = [], opts = {}) {
  const idCabang = opts.idCabang ?? 1;
  const productList = opts.products ?? prods;
  await page.addInitScript((idCab) => {
    const b = (o) => btoa(JSON.stringify(o)).replace(/=/g, '');
    localStorage.setItem('authToken', `${b({ alg: 'none' })}.${b({ id: 1, exp: 4102444800 })}.x`);
    localStorage.setItem('session_id', 's');
    localStorage.setItem('user', JSON.stringify({ id_user: 1, id_pengguna: 1, id_role: 1, nama: 'admin', username: 'admin', role: 'admin', nama_role: 'admin', id_cabang: idCab }));
  }, idCabang);
  await page.route(/^(?!http:\/\/localhost:5199).*/, (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/(src|node_modules|@|assets)/.test(url)) return route.continue();
    if (route.request().resourceType() === 'document' || /fonts\.g/.test(url)) return route.continue();
    if (/menu-permission|permission/.test(url)) return route.fulfill({ json: { success: true, data: { menuPermissions: [{ menu_key: 'pos', dapat_akses: true }] } } });
    if (/\/role/.test(url)) return route.fulfill({ json: { success: true, data: [{ id_role: 1, nama_role: 'admin', permissions: { all: true } }] } });
    if (opts.onApi) {
      const handled = opts.onApi(route, route.request());
      if (handled) return handled;
    }
    if (/\/laporan\/stok/.test(url)) {
      const data = prods.map((p, i) => ({ id_produk: p.id_produk, detail_lokasi: { cabang: [{ id_cabang: 1, stok: i % 5 === 0 ? 0 : i % 7 === 0 ? 3 : 25 }] } }));
      return route.fulfill({ json: { success: true, data } });
    }
    const one = url.split('?')[0].match(/\/produk\/(\d+)$/);
    if (one) { // GET /produk/:id (validasi checkout): satu produk lengkap dengan stok
      const p = productList.find((x) => x.id_produk === Number(one[1]));
      return route.fulfill({ json: { success: true, data: p ? { ...p, stok: 25 } : null } });
    }
    if (/\/produk/.test(url)) {
      log.push(url);
      if (opts.failProducts && opts.failProducts()) return route.fulfill({ status: 500, json: { success: false, message: 'boom' } });
    }
    if (opts.cabang && /\/cabang(\/|\?|$)/.test(url)) {
      return route.fulfill({ json: { success: true, data: /\/cabang\/\d+/.test(url) ? opts.cabang : [opts.cabang] } });
    }
    // cocokkan pada PATH (bukan seluruh URL): "/produk?kategori=3" bukan endpoint kategori
    const path = url.split('?')[0];
    const kat = new URL(url).searchParams.get('kategori');
    const data = /\/kategori/.test(path) ? cats
      : /\/produk/.test(path) ? (kat ? productList.filter((p) => String(p.id_kategori) === String(kat)) : productList)
      : [];
    return route.fulfill({ json: { success: true, data, pagination: { total: data.length } } });
  });
}
