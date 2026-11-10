# N-POS

Aplikasi kasir (Point of Sale) multi-cabang yang berjalan sebagai **web app** dan **aplikasi desktop (Electron)**,
dengan mode **offline-first**: transaksi tetap bisa dibuat tanpa internet lalu disinkronkan otomatis.

## Teknologi

| Lapisan | Teknologi |
|---|---|
| UI | React 19, React Router 7, Tailwind CSS 3, lucide-react (ikon) |
| Build | Vite 7 |
| Desktop | Electron 39, electron-builder |
| Data offline | SQLite (`better-sqlite3`) di proses utama Electron, cache browser untuk mode web |
| Cetak | QZ Tray, ESC/POS lewat `serialport` |
| Uji | Playwright (`e2e/`) |

Backend adalah API REST terpisah (tidak ada di repo ini). Alamatnya diatur lewat `VITE_API_BASE_URL`.

## Mulai cepat

```bash
npm install
cp .env.example .env        # isi VITE_API_BASE_URL dan VITE_API_KEY
npm run dev                 # web, http://localhost:5173
npm run electron:dev        # desktop (mode development)
```

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server dev Vite |
| `npm run build` | Build web ke `dist/` |
| `npm run electron:build` | Build installer desktop ke `release/` |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Tes layout Playwright (mock API, tangkapan layar ke `e2e/shots/`) |
| `npm run generate-cert` / `setup-code-signing` | Sertifikat QZ Tray dan code signing (lihat dokumen) |

## Struktur proyek

```
electron/     Proses utama Electron: main.cjs, preload.cjs (jembatan IPC aman),
              productDatabase.cjs (SQLite produk), thermalPrintService.cjs, IPCSecurityMiddleware.cjs
src/
  pages/      Satu file per halaman/rute (PosPage = kasir)
  components/ Komponen UI bersama; components/pos/ khusus kasir; components/common/ generik
  context/    Auth, peran/izin, pengaturan, sinkronisasi
  hooks/      Hook data, offline, printer, sinkronisasi
  services/   api.js (REST), syncEngine, offlineDataSync, PrinterManager, webSocketService
  utils/      Helper (safeStorage, antrean offline, validasi, format)
  config/     Konstanta aplikasi
e2e/          Tes Playwright
docs/         Dokumentasi (lihat di bawah)
scripts/      Skrip bantu build
public/ resources/   Aset statis dan ikon aplikasi
```

## Dokumentasi

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): arsitektur, alur online/offline, database, keamanan, utang teknis.
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md): standar tombol, kartu, form, tipografi, dan warna.
- [docs/APP_DOCUMENTATION.md](docs/APP_DOCUMENTATION.md): panduan pengguna, pola UI, printer, shortcut, troubleshooting.
- [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md): referensi API backend.
- [docs/FINANCIAL_REPORTS_GUIDE.md](docs/FINANCIAL_REPORTS_GUIDE.md) dan [docs/IMPLEMENTATION_GUIDE.md](docs/IMPLEMENTATION_GUIDE.md): modul laporan keuangan.

## Keamanan singkat

- Jangan commit `.env`, `certs/`, `certificates/`, atau kunci/sertifikat apa pun (sudah ada di `.gitignore`).
- Semua yang diawali `VITE_` ikut masuk ke bundel klien dan bisa dibaca siapa pun. Jangan taruh rahasia sungguhan di sana.
