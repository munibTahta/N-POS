# Stok: restok, opname, dan kebiasaan stok 9999

## Masalah
Mengisi stok 9999 agar penjualan tidak terhenti membuat nilai persediaan (stok × harga beli) tercatat jauh dari kenyataan,
sehingga HPP, laba, dan neraca ikut keliru. Pada data produksi: cabang 5 ≈ 93% dan cabang 6 ≈ 77% nilai persediaan berasal dari stok ≥ 5.000.

## Alat yang tersedia
| Kebutuhan | Di mana | Catatan |
|---|---|---|
| Jual terus walau stok belum tercatat | Pengaturan → Pengaturan POS → "Izinkan Jual Saat Stok Kurang" | Per perangkat. Stok menjadi minus (tercatat), bukan 9999. Kartu produk menampilkan "Minus N". Sinkron offline tidak menolak transaksi ini. |
| Mengetahui stok tidak wajar | Banner di Stok dan Stok Kasir; `GET /laporan/stok-anomali` | Tombol "Mulai opname produk ini". |
| Menghitung fisik dan menyesuaikan | Stok → Stok Opname (`/stok/opname`) | Isi hanya produk yang dihitung. Draf tersimpan per tab. Satu transaksi; tercatat di `log_stok` dan `riwayat_penyesuaian_stok` (kode OPN-…). |
| Tahu apa yang perlu dibeli | Stok → Saran Restok (`/stok/restok`) | Target = kecepatan jual × hari cover (min. stok_minimum). Stok ≥ 5.000 dianggap tidak wajar dan tidak dipercaya: opname dulu. |
| Membeli | Saran Restok → Buat pembelian | Satu pembelian per pemasok, masuk ke stok cabang. |

## Alur yang disarankan
1. **Bersihkan sekali**: Stok Opname dengan filter "Tidak wajar", hitung fisik, terapkan. Nilai persediaan langsung turun ke angka nyata.
2. **Ubah kebiasaan**: aktifkan "Izinkan Jual Saat Stok Kurang" di kasir, hentikan pengisian 9999.
3. **Rutin**: lihat Saran Restok tiap pagi; opname bergilir per kategori/rak (mis. satu rak per hari), stok minus dirapikan di opname berikutnya.

## Batasan saat ini
- Opname dan saran restok bekerja per cabang (bukan gudang pusat).
- Pembelian dari Saran Restok belum membuat jurnal terpisah selain yang sudah dilakukan alur pembelian biasa.
- Opname tidak membuat jurnal penyesuaian persediaan otomatis; selisih nilai ditampilkan sebelum diterapkan untuk dicatat bila perlu.
