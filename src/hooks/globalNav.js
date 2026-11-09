/**
 * Navigasi keyboard global gaya "g lalu huruf" (seperti GitHub/Gmail). Tabel dan logika murni agar bisa diuji;
 * pendaftar event ada di useGlobalShortcuts.js.
 */
export const GO_SHORTCUTS = [
  { key: 'p', path: '/pos', label: 'Kasir (POS)' },
  { key: 'j', path: '/penjualan', label: 'Riwayat Penjualan' },
  { key: 'b', path: '/pembelian', label: 'Pembelian' },
  { key: 'k', path: '/produk', label: 'Produk' },
  { key: 's', path: '/stok', label: 'Stok' },
  { key: 'c', path: '/pelanggan', label: 'Pelanggan' },
  { key: 'l', path: '/laporan', label: 'Laporan' },
  { key: 'a', path: '/pengaturan', label: 'Pengaturan' },
  { key: 'd', path: '/', label: 'Dashboard' },
];

/** Tujuan untuk huruf kedua; null bila tak dikenal atau halaman tidak boleh diakses pengguna. `canAccess(path)` opsional. */
export function resolveGoTarget(key, canAccess = () => true) {
  const hit = GO_SHORTCUTS.find((g) => g.key === String(key).toLowerCase());
  return hit && canAccess(hit.path) ? hit.path : null;
}

/** Jendela waktu (ms) antara "g" dan huruf berikutnya. */
export const GO_WINDOW_MS = 1200;
