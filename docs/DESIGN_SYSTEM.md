# Standar Desain N-POS

Gaya mengacu pada Material Design 3 yang disesuaikan untuk POS (target sentuh besar, kontras tinggi, padat tapi terbaca).
Semua komponen di bawah didefinisikan di `src/styles/index.css` (`@layer components`) dan mendukung dark mode.

## 1. Tombol

Satu kelas varian + (opsional) satu modifier ukuran. Jangan menulis ulang warna, radius, atau padding secara manual.

| Varian | Kapan dipakai |
|---|---|
| `btn-primary` | Aksi utama satu-satunya di sebuah area (Simpan, Masuk, Validasi) |
| `btn-success` | Menyelesaikan transaksi (Bayar) |
| `btn-tonal` | Aksi sekunder yang tetap menonjol (tombol ikon di header, Tambah) |
| `btn-outlined` | Aksi sekunder netral (Batal, Filter) |
| `btn-text` | Aksi tersier atau di dalam baris tabel |
| `btn-secondary` | Abu-abu netral (tersedia, untuk kompatibilitas) |
| `btn-danger` | Aksi merusak (Hapus, Void). Selalu minta konfirmasi |

| Modifier | Ukuran | Pemakaian |
|---|---|---|
| `btn-sm` | 32 px | Tabel, toolbar padat (hanya desktop) |
| (default) | 40 px | Form dan dialog |
| `btn-lg` | 48 px | Aksi utama di kasir dan layar sentuh |
| `btn-icon` | 40 px bulat | Tombol ikon. Wajib `aria-label` |
| `btn-block` | lebar penuh | Mobile, login |

Aturan:
- Maksimal satu `btn-primary` per area. Sisanya `btn-tonal`, `btn-outlined`, atau `btn-text`.
- Target sentuh minimal 40 px, di layar sentuh pakai 44 px ke atas. Aksi utama kasir memakai `btn-lg`.
- Fokus keyboard memakai `focus-visible` (cincin hanya muncul saat navigasi keyboard).
- Tombol yang sedang memproses tetap di tempat: ganti isi dengan spinner (`Loader2` + `animate-spin`) dan beri `aria-busy`. Jangan pindahkan tata letak.
- Ikon hanya dari `lucide-react`, ukuran `h-4 w-4` (di dalam teks) atau `h-5 w-5`. Tidak ada emoji.

```jsx
<button className="btn-primary btn-lg btn-block">Masuk</button>
<button className="btn-icon btn-tonal" aria-label="Scan barcode"><Camera className="h-5 w-5" /></button>
<button className="btn-outlined btn-sm">Batal</button>
```

## 2. Kartu

| Kelas | Pemakaian |
|---|---|
| `card` | Kontainer statis (elevasi 1: border + bayangan tipis). **Tidak** ada efek hover |
| `card card-elevated` | Dialog, login, panel yang perlu terangkat (elevasi 2) |
| `card card-interactive` | Hanya jika seluruh kartu bisa diklik (hover, press, fokus) |
| `card-header` / `card-body` / `card-footer` | Bagian dalam kartu |

Radius kartu 16 px (`rounded-2xl`), tombol dan kolom input 12 px (`rounded-xl`), chip 8 px. Jangan menambahkan radius lain.

## 3. Form

- Kolom isian utama memakai `FloatingLabelInput` (`components/common/FloatingLabelField.jsx`). `aria-label` harus sama dengan label yang terlihat.
- Isian sederhana di dalam flex wajib `min-w-0` agar tidak mendorong elemen lain keluar layar.
- Pesan error memakai `role="alert"` dengan ikon `AlertCircle`; jangan hanya mengandalkan warna merah.
- Checkbox: `h-4 w-4 rounded text-blue-600`, dibungkus `<label>` setinggi minimal 44 px.

## 4. Tipografi

- Font: Inter (dimuat lokal lewat `@fontsource-variable/inter`, aman offline).
- Skala: judul halaman `text-2xl font-semibold`, judul panel `text-base sm:text-lg font-semibold`, isi `text-sm`, keterangan `text-xs`.
- Angka uang dan stok memakai `tabular-nums` agar kolom sejajar.

## 5. Warna

- Primer: `blue-600` (aksi), `blue-100/900` (tonal). Sukses: `green-600`. Bahaya: `red-600`. Peringatan: `amber`.
- Status stok: habis `red`, menipis (≤5) `amber`, normal `gray`.
- Selalu pastikan kontras teks minimal 4.5:1 dan sediakan varian `dark:`.

## 6. Tata letak responsif

- Breakpoint utama `lg` (1024 px): di bawahnya kasir memakai tab Produk | Keranjang dan bilah aksi bawah.
- Tidak boleh ada scroll horizontal di 390, 820, dan 1366 px (diuji di `e2e/`).

## 7. Migrasi halaman lama

Survei saat standar ini dibuat: sekitar 335 `<button>` di `src/`, hampir semuanya bergaya manual dengan warna dan radius berbeda-beda.
Sudah memakai standar: halaman Login, header kasir, bilah bawah kasir, tombol Validasi voucher.
Urutan migrasi yang disarankan: 1) Produk dan Pelanggan (paling sering dipakai), 2) dialog (`ConfirmDialog`, `DiscountDialog`), 3) halaman laporan.
Cara cepat: ganti string kelas tombol manual dengan varian yang sesuai di tabel atas, lalu jalankan `npm run test:e2e`.

## 8. Ikon aplikasi dan favicon

| Berkas | Dipakai untuk |
|---|---|
| `public/favicon.ico` (16/32/48), `favicon-16.png`, `favicon-32.png` | Tab browser (hanya logo, tanpa teks agar terbaca di 16 px) |
| `public/apple-touch-icon.png` (180, persegi penuh) | Layar utama iOS |
| `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | Manifest PWA (maskable memakai zona aman 80%) |
| `public/manifest.webmanifest` | Nama, warna tema `#050b42`, daftar ikon |
| `resources/icon.ico` (16, 24, 32, 48, 64, 128, 256) | Ikon aplikasi Windows: taskbar, judul jendela, installer |
| `resources/icon.png` (512) | Build macOS dan Linux |

Sumber desainnya satu: logo "NS" pada latar biru tua. Semua berkas di atas diturunkan darinya.
Catatan: sumber asli hanya tersedia 256 px, sehingga `resources/icon.png` (512 px) hasil pembesaran dan agak lembut.
Untuk hasil terbaik, ekspor ulang dari berkas desain asli (vektor atau minimal 1024 px) dan buat ulang semua ukuran.
`npm run test:e2e` memeriksa bahwa semua tautan ikon di `<head>` dan manifest mengembalikan gambar.


## 8. Tema terang dan gelap

- Tema dipilih lewat kelas `dark` di `<html>` (tombol di header, disimpan di `localStorage.theme`).
- Komponen baru: tulis varian `dark:` secara eksplisit (permukaan `zinc-900`, halaman `zinc-950`, teks `zinc-100/300/400`, batas `zinc-800/700`).
- Halaman lama yang belum punya `dark:` terbaca lewat **jaring pengaman otomatis**: `src/styles/dark-compat.css`, dibuat oleh `scripts/dark-compat.mjs` dari kelas warna yang benar-benar dipakai di kode. Jalankan `npm run theme:gen` setelah menambah kelas warna baru; CI menjalankan `npm run theme:check` dan gagal bila berkas basi. Aturannya memakai `:where(.dark)` sehingga varian `dark:` pada komponen **selalu menang**; jangan menambahkan override `!important`.
- Prinsip pemetaan: latar terang (50-300) menjadi permukaan gelap atau tint translusen dari warna 500; teks gelap (600-900) menjadi terang; isian solid (`bg-blue-600 text-white`) dan `text-white` tidak diubah.
- Kontras: teks kecil minimal 4,5:1, teks besar 3:1, di kedua tema. Palet terang dikoreksi di `tailwind.config.js` (`green/red/emerald/amber/yellow/orange` 600, `gray/slate` 500). Audit otomatis: `CONTRAST_OUT=hasil.json npx playwright test e2e/contrast-audit.spec.js` (laporan per halaman dan tema, memakai data contoh `e2e/richData.js`).
- Jangan memakai gradien pastel + kartu di dalam kartu untuk ringkasan angka; pakai blok tonal datar (`bg-gray-50 dark:bg-zinc-800/60 rounded-xl`).
