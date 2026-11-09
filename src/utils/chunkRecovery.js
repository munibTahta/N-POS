/**
 * Pemulihan dari galat muat modul/chunk setelah penerapan versi baru.
 * Tab lama masih menunjuk berkas hasil build lama (nama ber-hash) yang sudah diganti; server mengembalikan index.html
 * (bukan 404) sehingga browser gagal memuat modul. Obatnya: muat ulang SEKALI agar mengambil versi terbaru.
 */
const KEY = 'chunk_reload_at';
const WINDOW_MS = 30000; // dalam 30 dtk setelah muat ulang, jangan mengulang (hindari loop bila masalahnya bukan versi)

export const CHUNK_ERROR_RE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed|Unable to preload CSS|ChunkLoadError/i;

export const isChunkLoadError = (err) => CHUNK_ERROR_RE.test(String(err?.message || err || ''));

/**
 * Muat ulang halaman sekali untuk mengambil versi baru. Mengembalikan true bila muat ulang dipicu,
 * false bila sudah dicoba baru-baru ini (pemanggil harus menampilkan pesan + tombol manual).
 * `storage`/`reload`/`now` dapat disuntik untuk pengujian.
 */
export function reloadOnceForNewVersion({ storage = (typeof sessionStorage !== 'undefined' ? sessionStorage : null), reload = () => window.location.reload(), now = Date.now() } = {}) {
  try {
    const last = Number(storage?.getItem(KEY) || 0);
    if (last && now - last < WINDOW_MS) return false;
    storage?.setItem(KEY, String(now));
  } catch (_e) { /* storage tidak tersedia: tetap coba sekali */ }
  reload();
  return true;
}
