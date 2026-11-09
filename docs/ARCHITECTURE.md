# Arsitektur N-POS

Dokumen ini ringkasan teknis untuk developer. Panduan pengguna ada di [APP_DOCUMENTATION.md](APP_DOCUMENTATION.md).

## 1. Gambaran umum

```
React UI (src/)  ──REST──▶  Backend API (terpisah, VITE_API_BASE_URL)
     │  ▲
     │  └── WebSocket (webSocketService) untuk pembaruan real-time
     │
     ├─ mode Web: cache browser (safeStorage, sessionStorage, OfflinePageDataCache)
     └─ mode Desktop: IPC ──▶ Electron main ──▶ SQLite (better-sqlite3)
                                       └──▶ Printer (QZ Tray / ESC-POS serial)
```

## 2. Alur online dan offline

1. **Online**: UI memanggil `src/services/api.js` (axios, rate limit, header `Authorization`).
2. **Offline**: `NetworkStateService` / `useNetworkState` mendeteksi koneksi. Halaman memakai
   `apiWithOfflineSupport` / `offlineAPIFallback` untuk membaca dari data lokal.
3. **Transaksi offline**: disimpan ke antrean (`transactionQueue`, `OfflineQueue`, tabel `offline_transactions` / `sync_queue`).
4. **Sinkronisasi**: `syncEngine` mengirim antrean saat online lagi (maksimal 3 percobaan per item).
   Konflik stok ditangani `StockConflictError` dan `ConflictResolver`.
5. **Data master** (produk, stok, pelanggan, pajak, diskon, metode bayar) diunduh berkala oleh
   `offlineDataSync` / `optimizedDataSync` ke penyimpanan lokal.

## 3. Halaman kasir (`src/pages/PosPage.jsx`)

**Pencarian dan jelajah**
- Mode jelajah: produk tampil langsung (60 pertama, atau per kategori lewat chips). Jika API gagal, dipakai data lokal; jika keduanya gagal tampil pesan dengan tombol "Coba lagi" (bukan "tidak ada produk").
- Pencarian ketikan ditunda 300 ms (jelajah 50 ms) dengan penjaga race condition (`searchIdRef`). Daftar yang sudah termuat langsung difilter lokal sambil menunggu hasil server.
- Riwayat pencarian dan dropdown saran sudah dihapus. Data lama (`pos_recent_searches`) dibersihkan saat halaman dibuka.
- Chips "Terlaris" dan "Terakhir" dihitung lokal dari riwayat penambahan ke keranjang (`localStorage: pos_product_usage`).

**Scanner dan kamera**
- Scanner fisik: input barcode tersembunyi selalu difokuskan. Jika scanner mengetik ke kolom pencarian, Enter dengan rata-rata antar-karakter < 60 ms (minimal 6 karakter) diproses sebagai barcode lewat `handleBarcodeScan`, bukan sebagai pencarian.
- Ketik manual lalu Enter: kode yang persis cocok atau hasil tunggal langsung masuk keranjang. Kode yang ditempel dan tidak ditemukan secara lokal dicari persis ke sumber data.
- Kamera (`CameraBarcodeScanner`): callback hanya diproses sekali per sesi (`handledRef`), kotak pindai menyesuaikan lebar layar.
- Di layar sentuh, fokus otomatis ke kolom pencarian dimatikan agar keyboard virtual tidak muncul.

**Tata letak**
- Di bawah breakpoint `lg` layout memakai tab Produk | Keranjang dengan bilah bawah (Lihat Keranjang / Bayar); keranjang kosong otomatis kembali ke tab Produk.
- Item flex dan input di dalam flex wajib `min-w-0` agar tidak mendorong panel lain keluar layar (penyebab bug overlap dan tombol Validasi voucher).
- Font Inter dimuat lokal (`@fontsource-variable/inter`) agar tampil benar di Electron offline. Angka harga memakai `tabular-nums`.

## 3b. Katalog produk multi-cabang

| Tipe cabang | Katalog yang dipakai | Kolom penanda |
|---|---|---|
| `global` | produk bersama | `produk.id_cabang_pemilik` kosong |
| `terpisah` | produk milik cabang itu saja | `produk.id_cabang_pemilik` = id cabang |

- **Penentu utama adalah server.** `createPenjualan` menolak (400) produk di luar katalog cabang transaksi, dan `POST /stok/transfer` menolak produk katalog terpisah serta transfer antar cabang berbeda tipe (`src/utils/catalogGuard.js` di backend).
- **Klien** menentukan tipe cabang dari tabel `branches` lokal (Electron), lalu API (`getBranchById`), lalu cadangan `localStorage` (`branchTipeKatalog:<id>`). Selama tipe belum diketahui, produk tidak disaring. Setelah diketahui, produk di luar katalog disembunyikan dan ditolak masuk keranjang (`belongsToCatalog` di `PosPage.jsx`).
- Perhatian: sinkronisasi produk memakai `product-db-bulk-upsert` (menulis `product_offline.db`, tanpa kolom `id_cabang_pemilik`), sedangkan pencarian offline `product-db-search` membaca `offline.db` yang memfilter katalog. Jalur ini belum diverifikasi di perangkat nyata. `product-db-clear-all` terdaftar di preload dan allowlist IPC tetapi tidak punya handler.

## 4. Database lokal (Electron)

Dua file SQLite di `app.getPath('userData')`:

| File | Dikelola oleh | Isi |
|---|---|---|
| `product_offline.db` | `electron/productDatabase.cjs` | `products`, `product_stocks`, `sync_metadata`, `offline_transactions` |
| `offline.db` | `electron/main.cjs` | `categories`, `units`, `customers`, `products`, `sales`, `sale_items`, `payment_details`, `sync_queue`, `metode_pembayaran`, `supplier`, `purchases`, `purchase_items`, `warehouse_stock`, `tax_rates`, `discounts`, `settings`, `branches` |

Catatan: tabel `products` dan `sync_metadata` didefinisikan di kedua file, dan `supplier`, `purchases`, `purchase_items` didefinisikan dua kali di `main.cjs`.
Lihat bagian utang teknis.

## 5. Keamanan

- Electron: `contextIsolation: true`, `nodeIntegration: false`, CSP diset di `main.cjs`, IPC divalidasi (`IPCSecurityMiddleware.cjs`, `utils/IPCValidator.js`).
- Token login dan sesi disimpan lewat `utils/safeStorage.js`.
- Hak akses menu: `RoleContext` + `ProtectedRoute` (`menuKey`).
- **Batasan**: `VITE_API_KEY` ikut ke bundel klien sehingga bukan rahasia. Autorisasi harus ditegakkan di backend, bukan hanya di UI.
- Sertifikat dan kunci (`certs/`, `certificates/`) tidak boleh masuk git.

## 6. Pengujian

`npm run test:e2e` menjalankan Playwright dengan API di-mock dan JWT palsu (`e2e/helpers.js`). Cakupan saat ini:
tata letak tanpa overflow (1366, 820, 390 px), tidak ada dropdown riwayat, debounce satu request, input cepat ala scanner,
dan pemulihan dari error server produk. Alur transaksi lengkap (keranjang, bayar, sinkronisasi offline) belum dicakup.

## 7. Utang teknis yang diketahui

- `electron/main.cjs` sangat besar (3500+ baris) dan memuat skema DB, IPC, printer, dan jendela sekaligus. Pecah per modul.
- `PosPage.jsx` ±4000 baris. Pecah menjadi hook (`useProductBrowse`, `useCart`, `usePayment`) dan komponen panel.
- Skema SQLite ganda (lihat bagian 4). Satukan dengan migrasi berversi (`PRAGMA user_version`).
- `scripts/remove-console.cjs` (dijalankan sebelum build desktop) mengubah `console.log` menjadi `void 0 && (...)`. Sisa yang ada sudah dihapus; ganti skrip ini dengan `esbuild.drop: ['console']` di Vite.
- 23 error ESLint tersisa (20 `no-unused-vars` berupa penghitung yang hanya ditulis dan stub logger, 3 `set-state-in-effect`) dan 9 peringatan `exhaustive-deps`.
- `FinancialReportsPageNew.jsx` tidak dipakai rute mana pun.
- `npm audit`: 10 kerentanan high (rantai `exceljs` → `tmp`).

## 8. Backend (toko.nusasoft.my.id, repo terpisah)

Express + Sequelize + MySQL, berjalan di pm2 sebagai `n-toko`.

- **Autentikasi**: semua rute data sensitif lewat `authMiddleware.protect` (JWT, pengguna harus masih ada di DB). Master data (kategori, satuan, cabang, metode bayar, pajak, diskon, menu, role) tetap hanya butuh API key. `JWT_SECRET` wajib ada (server gagal start jika kosong).
- **Penjualan** (`createPenjualan`): satu transaksi DB; baris `stok_cabang` dikunci (`FOR UPDATE`); kegagalan update stok membatalkan transaksi; `kode_transaksi` yang sama mengembalikan transaksi lama (`duplicate: true`) sehingga aman untuk retry/sinkronisasi offline.
- **Error**: `errorHandler` memakai status dari error, memetakan error Sequelize (409/400/503), menyembunyikan pesan dan stack untuk 5xx kecuali `NODE_ENV=development`. Rute `/api` yang tidak dikenal dibalas JSON 404. `unhandledRejection` dicatat, `uncaughtException` mengakhiri proses agar pm2 memulai ulang.
- **Katalog**: lihat bagian 3b. Riwayat 5.541 baris penjualan diverifikasi 0 pelanggaran terhadap aturan katalog.
- **Perlu keputusan**: pajak tetap 10% di `createPenjualan`; kuantitas pecahan (total memakai `parseFloat`, detail `parseInt`); kebijakan stok minus; `id_user` dipercaya dari body; indeks unik duplikat (lihat `backups/databases/drop-duplicate-indexes.sql`).

## 9. Rekomendasi pengembangan dan skala

Berdasarkan temuan audit (ukuran file, skema ganda, indeks duplikat, kunci di installer, tanpa CI, backend tanpa git).
Urutan di bawah adalah urutan kerja yang disarankan; tiap fase bisa dikerjakan bertahap karena `e2e/` sudah menjadi jaring pengaman.

### Fase 0: segera (hari ini sampai minggu ini)
- Rotasi sertifikat dan kunci QZ Tray; keluarkan kunci privat dari installer (tanda tangan permintaan cetak dilakukan backend).
- `.gitattributes` dengan `* text=auto eol=lf` dan Prettier. Repo ini campuran CRLF/LF sehingga satu edit bisa menjadi diff satu file penuh (terjadi saat pekerjaan ini).
- CI (GitHub Actions) pada setiap PR: `npm run lint`, `npm run build`, `npm run test:e2e`. Targetkan 0 error ESLint (sisa 23).
- Backend: jalankan `backups/databases/drop-duplicate-indexes.sql`, set `NODE_ENV=production` di pm2, taruh backend di git.

### Fase 1: struktur dan kemudahan perawatan (1-2 bulan)
- **Pecah `PosPage.jsx` (±4.000 baris)** menjadi hook dan komponen: `useProductBrowse` (jelajah, debounce, fallback offline), `useCart`, `usePayment`, `useBarcodeScanner`, `useCatalogGuard`; panel `ProductPanel`, `CartPanel`, `PaymentPanel`. Target < 400 baris per file.
- **Pecah `electron/main.cjs` (±3.500 baris)** menjadi `db/` (skema + migrasi), `ipc/` (handler per domain), `printing/`, `window/`.
- **Satu database SQLite** dengan migrasi berversi (`PRAGMA user_version`), menggantikan `offline.db` + `product_offline.db`. Tutup celah handler `product-db-clear-all` yang belum ada.
- **Struktur per fitur**: `src/features/{pos,products,customers,reports,...}` berisi page, komponen, hook, dan akses API fitur itu; `src/shared/` untuk yang dipakai bersama. Saat ini 58 komponen dan 40 hook berada rata dalam satu folder.
- **Server state dengan TanStack Query** (cache, retry, dedupe, stale-while-revalidate, persister offline) menggantikan loader manual (`useDataLoader`, `usePageData`, cache `sessionStorage`, penjaga race `searchIdRef`).
- **Aturan desain otomatis**: ESLint melarang `<button className="bg-*">` mentah; wajib varian dari `DESIGN_SYSTEM.md`.

### Fase 2: kontrak dan integrasi (2-4 bulan)
- **Backend**: migrasi nyata (umzug/sequelize-cli), bukan `sync({alter})` (penyebab 57 indeks duplikat); validasi input per rute (zod/joi); `helmet`, rate limiting, log terstruktur dengan request-id (pino); `/api/v1` berversi.
- **Kontrak API**: hasilkan OpenAPI dari kode/skema dan buat tipe klien dari sana. `API_DOCUMENTATION.md` (±10.000 baris, ditulis manual) cepat usang.
- **TypeScript bertahap**: mulai dari `services/api`, model data, dan hook; `tsconfig.json` sudah ada.
- **Otorisasi di server**: izin per peran diperiksa middleware dari tabel `role_menu_permissions`, bukan hanya `protect`. Total, pajak, dan harga dihitung ulang di server; `id_user` diambil dari token.
- **Kredensial per klien**: ganti `VITE_API_KEY` tunggal (terbaca siapa pun di bundel) dengan token per perangkat atau client-credentials berscope, yang bisa dicabut.
- **Pembayaran dan integrasi luar**: QRIS/e-wallet lewat webhook bertanda tangan + kunci idempoten (pola `kode_transaksi` sudah ada); webhook keluar untuk akuntansi/ERP; ekspor terjadwal.

### Fase 3: skala besar
- **Sinkronisasi delta**: unduh perubahan sejak `updated_at` terakhir, bukan seluruh ±9.000 produk; kebijakan konflik tertulis (stok: server yang menentukan); antrean keluar (outbox) dengan status terlihat di UI.
- **Data**: partisi bulanan untuk `audit_trail`, `log_aktivitas`, `log_stok`, `jurnal_*`; pagination berbasis kursor untuk penjualan; indeks gabungan untuk daftar produk (`status`, `id_cabang_pemilik`, `nama_produk`).
- **Beban kerja berat** (jurnal, laporan, ekspor) lewat antrean (BullMQ) dan cache master data (Redis); WebSocket yang sudah ada dipakai untuk stok real-time.
- **Observabilitas**: aktifkan Sentry (`utils/sentry.js` sudah ada) di klien dan backend, monitor uptime, dan uji pemulihan cadangan secara berkala.
- **Multi-tenant** bila akan dijual sebagai layanan: `tenant_id` di semua tabel atau skema per tenant, ditentukan sebelum jumlah data membesar.
