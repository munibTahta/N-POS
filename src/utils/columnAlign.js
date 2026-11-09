/**
 * Perataan kolom tabel. Aturan: angka, uang, dan jumlah RATA KANAN (digit sejajar, mudah dibandingkan dan dijumlahkan),
 * teks rata kiri, status/aksi rata tengah. Judul kolom mengikuti perataan isinya.
 */
const NUMERIC_WORDS = [
  'total', 'subtotal', 'harga', 'jumlah', 'qty', 'kuantitas', 'nominal', 'saldo', 'debit', 'kredit', 'biaya', 'pajak', 'ppn',
  'diskon', 'kurang', 'kekurangan', 'bayar', 'dibayar', 'laba', 'rugi', 'pendapatan', 'pengeluaran', 'pemasukan', 'nilai',
  'poin', 'stok', 'sisa', 'modal', 'margin', 'omzet', 'kembalian', 'tagihan', 'piutang', 'hutang', 'utang', 'rp',
];
const HEADER_RE = new RegExp(`(^|[^a-z])(${NUMERIC_WORDS.join('|')})([^a-z]|$)`, 'i');
const KEY_RE = new RegExp(`(^|_)(${NUMERIC_WORDS.join('|')})(_|$)`, 'i');
// kolom yang judulnya memuat kata teks/penanda ("Status Stok", "Metode Pembayaran") tetap kiri, kecuali ada kata nilai yang KUAT
// ("Jumlah Stok", "Total Harga"). Pencocokan dengan batas kata: "Pembayaran" bukan "bayar".
const TEXT_RE = /(^|[^a-z])(status|metode|kode|nama|jenis|tipe|keterangan|catatan|kategori|satuan|tanggal|cabang|lokasi|aksi|barcode|merek)([^a-z]|$)/i;
const STRONG_RE = /(^|[^a-z])(jumlah|total|subtotal|harga|nominal|saldo|nilai|qty|biaya|diskon|pajak|kurang|bayar|dibayar|laba|rugi|pendapatan|pengeluaran|kembalian|omzet)([^a-z]|$)/i;

/** 'right' | 'center' | 'left'. `column.align` eksplisit selalu menang; `column.numeric`/`type` ('currency'|'number') memaksa kanan. */
export function resolveColumnAlign(column = {}) {
  if (column.align === 'left' || column.align === 'right' || column.align === 'center') return column.align;
  if (column.numeric === true || column.type === 'currency' || column.type === 'number') return 'right';
  const header = String(column.header ?? '');
  const key = String(column.key ?? '');
  if (header) {
    if (TEXT_RE.test(header)) return STRONG_RE.test(header) ? 'right' : 'left';
    return HEADER_RE.test(header) ? 'right' : 'left';
  }
  return KEY_RE.test(key) && !TEXT_RE.test(key.replace(/_/g, ' ')) ? 'right' : 'left';
}

export const isNumericAlign = (a) => a === 'right';
