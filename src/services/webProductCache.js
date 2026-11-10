/**
 * Cadangan katalog & stok untuk mode WEB (browser) di IndexedDB.
 * Aplikasi desktop (Electron) memakai SQLite lokal, jadi modul ini tidak aktif di sana.
 * Tujuannya: bila API tak terjangkau, kasir di web tetap bisa menelusuri/mencari produk dari snapshot terakhir.
 * Semua operasi aman-gagal (tidak pernah melempar): bila IndexedDB tidak tersedia, hasilnya null/false.
 */
const DB_NAME = 'npos-web-cache';
const STORE = 'kv';
const FRESH_MS = 30 * 60 * 1000; // snapshot dianggap segar 30 menit

export const isWebMode = () => typeof window !== 'undefined' && !window.electronAPI && typeof indexedDB !== 'undefined';

export const productScope = (idCabang, tipeKatalog) => `${idCabang ?? '-'}:${tipeKatalog || 'global'}`;

let dbPromise = null;
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    }).catch((e) => { dbPromise = null; throw e; });
  }
  return dbPromise;
}

async function kvGet(key) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function kvSet(key, value) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch { return false; }
}

export const saveProducts = (scope, products) => kvSet(`products:${scope}`, { products, savedAt: Date.now() });
export const loadProducts = (scope) => kvGet(`products:${scope}`);
export const saveStocks = (idCabang, stocks) => kvSet(`stocks:${idCabang}`, { stocks, savedAt: Date.now() });
export const loadStocks = (idCabang) => kvGet(`stocks:${idCabang}`);

export async function isSnapshotFresh(scope, maxAgeMs = FRESH_MS) {
  const snap = await loadProducts(scope);
  return !!(snap && Array.isArray(snap.products) && snap.products.length > 0 && Date.now() - snap.savedAt < maxAgeMs);
}

/** Filter snapshot di sisi klien: kata kunci (nama/kode/barcode), kategori, batas hasil. Fungsi murni. */
export function filterProducts(products, { query = '', isBarcode = false, kategori, limit = 200 } = {}) {
  const q = String(query || '').trim().toLowerCase();
  let list = Array.isArray(products) ? products : [];
  if (kategori && !['all', 'fav', 'recent'].includes(String(kategori))) {
    list = list.filter((p) => String(p.id_kategori) === String(kategori));
  }
  if (q) {
    if (isBarcode) {
      list = list.filter((p) => String(p.kode_produk || '').toLowerCase() === q || String(p.barcode || '').toLowerCase() === q);
    } else {
      list = list.filter((p) =>
        String(p.nama_produk || '').toLowerCase().includes(q) ||
        String(p.kode_produk || '').toLowerCase().includes(q) ||
        String(p.barcode || '').toLowerCase().includes(q));
    }
  }
  return [...list].sort((a, b) => String(a.nama_produk || '').localeCompare(String(b.nama_produk || ''))).slice(0, limit);
}
