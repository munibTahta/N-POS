// Logika murni halaman Stok Opname dan Saran Restok (tanpa React) agar mudah diuji.

/** '' -> null (belum dihitung); '12' -> 12; selain bilangan bulat >= 0 -> NaN (tidak valid). */
export function parseCount(raw) {
  const s = String(raw ?? '').trim();
  if (s === '') return null;
  if (!/^\d{1,9}$/.test(s)) return NaN;
  return Number(s);
}

/** rows: [{id_produk, stok, harga_beli}], counts: { [id_produk]: string }. */
export function summarizeCounts(rows, counts) {
  let dihitung = 0, berubah = 0, tidakValid = 0, nilai = 0;
  const items = [];
  for (const r of rows) {
    const c = parseCount(counts[r.id_produk]);
    if (c === null) continue;
    if (Number.isNaN(c)) { tidakValid += 1; continue; }
    dihitung += 1;
    items.push({ id_produk: r.id_produk, stok_fisik: c });
    if (c !== r.stok) { berubah += 1; nilai += (c - r.stok) * (Number(r.harga_beli) || 0); }
  }
  return { dihitung, berubah, tidakValid, nilai, items };
}

/** Kelompokkan saran restok per pemasok untuk membuat satu pembelian per pemasok. qty: { [id_produk]: number }. */
export function groupBySupplier(suggestions, selectedIds, qty) {
  const picked = new Set(selectedIds);
  const groups = new Map();
  for (const s of suggestions) {
    if (!picked.has(s.id_produk)) continue;
    const jumlah = Math.floor(Number(qty[s.id_produk] ?? s.saran));
    if (!Number.isFinite(jumlah) || jumlah <= 0) continue;
    const key = s.id_supplier ?? 0;
    if (!groups.has(key)) groups.set(key, { id_supplier: s.id_supplier ?? null, nama_supplier: s.nama_supplier || 'Tanpa pemasok', items: [], total: 0 });
    const g = groups.get(key);
    g.items.push({ id_produk: s.id_produk, nama_produk: s.nama_produk, jumlah, harga_beli: s.harga_beli });
    g.total += jumlah * (Number(s.harga_beli) || 0);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}
