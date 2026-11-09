/**
 * Sumber tunggal daftar pintasan keyboard kasir (dipakai modal bantuan).
 * `keys`: daftar alternatif; tiap alternatif = urutan tombol yang ditekan bersamaan.
 * Token 'Mod' = Ctrl (Windows/Linux) atau Cmd (macOS); hanya dipakai pada pintasan yang menerima keduanya.
 * Bila menambah/mengubah pintasan di usePosKeyboardShortcuts.js, ubah juga di sini.
 */
export const SHORTCUT_GROUPS = [
  {
    group: 'Umum',
    icon: 'Settings',
    items: [
      { keys: [['?'], ['F1']], description: 'Buka/tutup bantuan pintasan' },
      { keys: [['Esc']], description: 'Tutup dialog, batalkan, atau kosongkan pencarian' },
      { keys: [['Ctrl', 'Z']], description: 'Batalkan aksi terakhir pada keranjang' },
    ],
  },
  {
    group: 'Pencarian & Scan',
    icon: 'Search',
    items: [
      { keys: [['/'], ['Mod', 'K'], ['F2']], description: 'Fokus ke kolom pencarian produk' },
      { keys: [['Alt', 'P']], description: 'Fokus ke panel produk' },
      { keys: [['↓'], ['↑'], ['←'], ['→']], description: 'Pilih produk pada daftar hasil' },
      { keys: [['Enter']], description: 'Tambahkan produk terpilih ke keranjang' },
      { keys: [['F3'], ['Alt', 'B']], description: 'Buka scanner barcode kamera' },
    ],
  },
  {
    group: 'Keranjang',
    icon: 'ShoppingCart',
    items: [
      { keys: [['Alt', 'C']], description: 'Fokus ke keranjang' },
      { keys: [['+'], ['-']], description: 'Tambah/kurangi jumlah item terpilih' },
      { keys: [['1-9']], description: 'Ketik angka (beruntun: 1 lalu 2 = 12) untuk mengubah jumlah item yang disorot' },
      { keys: [['Backspace']], description: 'Hapus item terpilih di keranjang' },
      { keys: [['Delete']], description: 'Hapus item terakhir' },
      { keys: [['Ctrl', 'Delete']], description: 'Kosongkan seluruh keranjang' },
    ],
  },
  {
    group: 'Pelanggan & Diskon',
    icon: 'Users',
    items: [
      { keys: [['F5']], description: 'Cari/pilih pelanggan' },
      { keys: [['F6']], description: 'Terapkan diskon' },
    ],
  },
  {
    group: 'Pembayaran',
    icon: 'CreditCard',
    items: [
      { keys: [['F12'], ['End']], description: 'Lanjut ke pembayaran' },
      { keys: [['F7']], description: 'Pilih metode pembayaran' },
      { keys: [['F4'], ['Alt', 'M']], description: 'Fokus ke nominal pembayaran' },
      { keys: [['Ctrl', '1']], description: 'Isi nominal Rp 10.000' },
      { keys: [['Ctrl', '2']], description: 'Isi nominal Rp 20.000' },
      { keys: [['Ctrl', '3']], description: 'Isi nominal Rp 50.000' },
      { keys: [['Ctrl', '4']], description: 'Isi nominal Rp 100.000' },
      { keys: [['Ctrl', '0']], description: 'Isi nominal sama dengan total tagihan' },
      { keys: [['Ctrl', 'Enter']], description: 'Selesaikan transaksi' },
    ],
  },
  {
    group: 'Perangkat & Halaman',
    icon: 'Printer',
    items: [
      { keys: [['F8']], description: 'Buka cash drawer' },
      { keys: [['Ctrl', 'P']], description: 'Cetak ulang struk transaksi terakhir' },
      { keys: [['F9']], description: 'Ke halaman kasir (dari Menu/Riwayat)' },
      { keys: [['F10']], description: 'Ke halaman Pembelian' },
      { keys: [['F11']], description: 'Ke halaman Riwayat Penjualan' },
    ],
  },
];

export const SHORTCUT_TIPS = [
  'Tekan / dari mana saja untuk langsung mengetik pencarian (seperti di GitHub atau Gmail).',
  'Scanner barcode: pastikan kolom pencarian aktif (tekan /), lalu scan. Kode yang diketik cepat diakhiri Enter otomatis ditambahkan ke keranjang.',
  'Di layar sentuh, ketuk ikon keyboard di bilah atas untuk membuka bantuan ini.',
];

/** True bila fokus ada di elemen tempat pengguna mengetik teks (pintasan satu-tombol tidak boleh aktif). */
export function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return true;
  if (tag === 'INPUT') return !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(el.type);
  return false;
}
