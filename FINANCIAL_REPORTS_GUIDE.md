# 📊 Panduan Lengkap Laporan Keuangan CRUD - N-POS

**Versi:** 1.0  
**Last Updated:** April 30, 2026  
**Status:** Production Ready ✅

---

## 📑 Daftar Isi

1. [Overview](#overview-laporan-keuangan)
2. [Struktur UI Components](#struktur-ui-components)
3. [Fitur CRUD](#fitur-crud)
4. [API Endpoints](#api-endpoints)
5. [Contoh Penggunaan](#contoh-penggunaan)
6. [Database Schema](#database-schema)
7. [Troubleshooting](#troubleshooting)

---

## Overview Laporan Keuangan

### Fitur Utama

Laporan Keuangan N-POS menyediakan empat jenis laporan komprehensif untuk manajemen finansial bisnis:

✅ **Buku Besar (General Ledger)** - Rekam semua transaksi per akun  
✅ **Arus Kas (Cash Flow)** - Tracking masuk/keluar kas  
✅ **Kas (Cash Account)** - Saldo rekening kas per cabang/pusat  
✅ **Neraca (Balance Sheet)** - Aset, Liabilitas, Ekuitas  
✅ **Jurnal (Journal Entry)** - Create/Edit/Delete jurnal manual  

### User Workflow

```
┌─ Halaman Laporan Keuangan
│
├─ Tab Navigation (Buku Besar | Arus Kas | Kas | Neraca | Jurnal)
│
├─ Search & Filter Bar
│  ├─ Search by Keterangan/Akun/Cabang
│  ├─ Toggle Filter Panel [Filter]
│  └─ [✕ Clear] button
│
├─ Filter Panel (Toggle)
│  ├─ Cabang selector
│  ├─ Tanggal Dari/Sampai
│  ├─ Akun/Rekening selector
│  └─ Applied filters indicator
│
├─ Summary Cards
│  ├─ Card 1: Saldo Awal / Total Masuk
│  ├─ Card 2: Total Debit / Total Keluar
│  ├─ Card 3: Total Kredit / Saldo Bersih
│  └─ Card 4: Saldo Akhir / Transaksi
│
├─ Data Table
│  ├─ Responsive horizontal scroll
│  ├─ Columns per report type
│  └─ Status badges & currency formatting
│
├─ Pagination
│  ├─ Page navigation (Prev/Next)
│  ├─ Page jump input
│  ├─ Items per page selector
│  └─ Total info display
│
└─ Export & Actions
   ├─ Export Excel button
   ├─ Add Journal button (Jurnal tab)
   └─ Edit/Delete actions (Jurnal tab)
```

---

## Struktur UI Components

### ✅ Mengikuti APP_DOCUMENTATION.md Design Patterns

#### 1. **SearchFilterBar** (Search + Filter Toggle)
```jsx
<SearchFilterBar
  searchTerm={searchQuery}
  onSearchChange={setSearchQuery}
  onClearSearch={() => setSearchQuery('')}
  onFilterToggle={() => setShowFilters(prev => !prev)}
  isFilterActive={showFilters}
  hasActiveFilters={hasActiveFilters}
  onClearFilters={handleClearFilters}
  searchPlaceholder="Cari berdasarkan keterangan, akun, cabang..."
/>
```

**Features:**
- Debounced search (300ms)
- Filter toggle button (blue when active)
- Clear button (visible when filters active)
- Mobile responsive (icon only on small screens)

---

#### 2. **FilterPanel** (Hidden by Default)
```jsx
{showFilters && (
  <FilterPanel>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Filter options */}
    </div>
  </FilterPanel>
)}
```

**Filters:**
- Cabang (dropdown)
- Tanggal Dari (date input)
- Tanggal Sampai (date input)
- Akun/Rekening (dropdown - conditional per tab)

**Behavior:**
- Hidden by default (minimal UI clutter)
- Toggle on demand with Filter button
- Clear all with Clear button
- Applied filters shown as count

---

#### 3. **Summary Cards** (Key Metrics)
```jsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
  {cards.map(card => (
    <div className="bg-white p-4 rounded-xl shadow-sm border">
      <div className="text-sm text-gray-600">{card.label}</div>
      <div className="text-2xl font-bold text-blue-600">{card.value}</div>
    </div>
  ))}
</div>
```

**Per Report Type:**
- **Buku Besar:** Saldo Awal | Total Debit | Total Kredit | Saldo Akhir
- **Arus Kas:** Total Masuk | Total Keluar | Saldo Bersih | Transaksi
- **Kas:** Total Rekening | - | - | Total Saldo
- **Neraca:** Total Kategori | - | - | Total Saldo

---

#### 4. **Data Table** (Minimalist 6-Column Design)
```jsx
<DataTable
  data={filteredData}
  columns={columns}
  searchKeys={['keterangan', 'akun.nama_akun']}
/>
```

**Per Report Type Columns:**

**Buku Besar:**
1. Tanggal
2. Akun (kode + nama)
3. Cabang
4. Keterangan
5. Debit (currency)
6. Kredit (currency)
7. Saldo Berjalan (currency)

**Arus Kas:**
1. Tanggal
2. Kategori
3. Keterangan
4. Jumlah (currency)
5. Tipe (badge: Masuk/Keluar)

**Kas:**
1. Nama Rekening
2. Tipe
3. Saldo Awal (currency)
4. Saldo Akhir (currency)
5. Cabang

**Neraca:** (Grouped by Tipe Akun)
1. Akun
2. Total Debit
3. Total Kredit
4. Balance
+ Subtotal per kategori

---

#### 5. **Pagination** (Client-Side)
```jsx
<Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  onPageChange={setCurrentPage}
  itemsPerPage={itemsPerPage}
  onItemsPerPageChange={setItemsPerPage}
  totalItems={totalData}
/>
```

**Features:**
- Page navigation (Prev/Next)
- Page jump input
- Items per page selector (10, 20, 50)
- Current page info display
- Disable state on first/last page

---

#### 6. **Tab Navigation** (Report Type Selection)
```jsx
{tabs.map(tab => {
  const Icon = tab.icon;
  return (
    <button
      onClick={() => setActiveTab(tab.id)}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        activeTab === tab.id
          ? 'bg-blue-500 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      <Icon size={18} />
      <span>{tab.label}</span>
    </button>
  );
})}
```

**Tabs:**
1. Buku Besar - BookOpen icon
2. Arus Kas - TrendingUp icon
3. Kas - Wallet icon
4. Neraca - FileText icon
5. Jurnal - FileText icon

---

### 7. **Journal Entry Modal** (CRUD Form)

#### Create Mode
```jsx
{showJournalForm && (
  <JournalFormModal
    title="Buat Jurnal Baru"
    journal={null}
    onSave={handleCreateOrUpdateJournal}
    onClose={handleCloseJournalForm}
  />
)}
```

#### Edit Mode
```jsx
{showJournalForm && (
  <JournalFormModal
    title="Edit Jurnal"
    journal={editingJournal}
    onSave={handleCreateOrUpdateJournal}
    onClose={handleCloseJournalForm}
  />
)}
```

**Form Fields:**
- Tanggal (date input)
- Cabang (dropdown)
- Jenis Transaksi (dropdown: Penjualan | Pembelian | Biaya | Transfer | Lainnya)
- Keterangan (textarea)

**Journal Detail Table:**
- Akun (dropdown)
- Debit (number input)
- Kredit (number input)
- Keterangan (text input)
- Aksi (Delete button untuk row > 2)

**Totals Footer:**
- Total Debit (currency)
- Total Kredit (currency)
- Status badge (✓ Seimbang / ✗ Tidak Seimbang)

**Submit Validation:**
- Both field required
- Min 2 journal lines
- Total Debit = Total Kredit
- Save button disabled if not balanced

---

## Fitur CRUD

### ✅ Create Journal Entry

**Workflow:**
```
1. Click [+ Buat Jurnal] button
2. Modal form opens
3. Fill form fields (Tanggal, Cabang, Keterangan, Jenis Transaksi)
4. Add minimum 2 journal lines
5. Each line: Akun + Debit/Kredit + Keterangan
6. System validates: Debit = Kredit
7. Click [Simpan Jurnal]
8. API creates entry in database
9. Success toast notification
10. Journal list refreshed
11. Page reset to 1
```

**API Call:**
```javascript
POST /api/journal-entries
{
  tanggal: "2026-04-30",
  keterangan: "Setoran penjualan hari ini",
  id_cabang: "1",
  jenis_transaksi: "penjualan",
  referensi_tabel: "penjualan",
  referensi_id: "123",
  lines: [
    { id_akun: "1", debit: 1000000, kredit: 0, keterangan: "Kas masuk" },
    { id_akun: "5", debit: 0, kredit: 1000000, keterangan: "Penjualan" }
  ]
}
```

---

### ✅ Read Journal Entries

**Listing with Pagination:**
```javascript
GET /api/journal-entries?page=1&limit=20&search=&id_cabang=&tanggal_dari=&tanggal_sampai=
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "id_jurnal": 1,
        "tanggal": "2026-04-30",
        "keterangan": "Setoran penjualan",
        "id_cabang": "1",
        "cabang": { "nama_cabang": "Cabang A" },
        "jenis_transaksi": "penjualan",
        "total_debit": 1000000,
        "total_kredit": 1000000,
        "lines": [
          { "id_akun": 1, "akun": { "kode_akun": "1110", "nama_akun": "Kas" }, "debit": 1000000, "kredit": 0 },
          { "id_akun": 5, "akun": { "kode_akun": "5100", "nama_akun": "Penjualan" }, "debit": 0, "kredit": 1000000 }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

---

### ✅ Update Journal Entry

**Workflow:**
```
1. Locate journal entry in list
2. Click [✏️ Edit] button
3. Modal opens with populated data
4. Edit any field
5. Modify journal lines (add/remove/edit)
6. Validate: Debit = Kredit
7. Click [Perbarui Jurnal]
8. API updates entry
9. Success toast notification
10. Journal list refreshed
```

**API Call:**
```javascript
PUT /api/journal-entries/1
{
  tanggal: "2026-04-30",
  keterangan: "Setoran penjualan hari ini (updated)",
  id_cabang: "1",
  jenis_transaksi: "penjualan",
  lines: [ /* updated lines */ ]
}
```

---

### ✅ Delete Journal Entry

**Workflow:**
```
1. Locate journal entry in list
2. Click [🗑️ Delete] button
3. Confirmation dialog appears: "Yakin ingin menghapus jurnal ini?"
4. User clicks [OK]
5. API deletes entry
6. Success toast: "Jurnal berhasil dihapus"
7. Journal list refreshed
```

**API Call:**
```javascript
DELETE /api/journal-entries/1
```

---

## API Endpoints

### Report Endpoints

#### 1. GET /api/laporan/buku-besar
**General Ledger Report**
```
Parameters:
- id_cabang (optional): Filter by branch
- id_akun (optional): Filter by account
- tanggal_dari (optional): Start date
- tanggal_sampai (optional): End date

Response:
{
  "rows": [ { tanggal, akun, cabang, keterangan, debit, kredit, saldo_berjalan } ],
  "summary": { opening_balance, total_debit, total_kredit, ending_balance }
}
```

#### 2. GET /api/laporan/arus-kas
**Cash Flow Report**
```
Parameters:
- id_cabang (optional)
- id_rekening (optional)
- tanggal_dari (optional)
- tanggal_sampai (optional)

Response:
{
  "items": [ { tanggal, kategori, keterangan, jumlah, tipe } ],
  "summary": { total_masuk, total_keluar, saldo_bersih, transaksi }
}
```

#### 3. GET /api/laporan/kas
**Cash Account Report**
```
Parameters:
- id_cabang (optional)
- id_rekening (optional)

Response:
{
  "rekening": [ { nama_rekening, tipe_rekening, saldo_awal, saldo_akhir } ],
  "summary": { total_rekening, total_saldo_akhir }
}
```

#### 4. GET /api/laporan/neraca
**Balance Sheet Report**
```
Parameters:
- id_cabang (optional)
- tanggal_sampai (optional): As of date

Response:
{
  "neraca": [
    {
      "tipe_akun": "Aset",
      "accounts": [ { akun, total_debit, total_kredit, balance } ],
      "total_balance": 5000000
    }
  ],
  "summary": { total_kategori, total_saldo }
}
```

---

### Journal Entry Endpoints

#### 1. POST /api/journal-entries
**Create Journal Entry**
```
Request:
{
  tanggal: string (YYYY-MM-DD),
  keterangan: string (required),
  id_cabang: number (optional),
  jenis_transaksi: string (penjualan|pembelian|biaya|transfer|lainnya),
  referensi_tabel: string (optional),
  referensi_id: number (optional),
  lines: [
    { id_akun, debit, kredit, keterangan }
  ]
}

Response:
{
  "success": true,
  "data": { id_jurnal, tanggal, keterangan, ... }
}
```

#### 2. GET /api/journal-entries
**List Journal Entries (Paginated)**
```
Parameters:
- page: number (default 1)
- limit: number (default 20)
- search: string (optional)
- id_cabang: number (optional)
- tanggal_dari: date (optional)
- tanggal_sampai: date (optional)

Response:
{
  "success": true,
  "data": {
    "rows": [ { id_jurnal, tanggal, keterangan, ... } ],
    "pagination": { page, limit, total, totalPages }
  }
}
```

#### 3. PUT /api/journal-entries/:id
**Update Journal Entry**
```
Parameters:
- id: number (journal ID)

Request: (same as POST)

Response:
{
  "success": true,
  "data": { id_jurnal, ... (updated) }
}
```

#### 4. DELETE /api/journal-entries/:id
**Delete Journal Entry**
```
Parameters:
- id: number (journal ID)

Response:
{
  "success": true,
  "message": "Jurnal berhasil dihapus"
}
```

---

## Contoh Penggunaan

### Skenario 1: View Laporan Buku Besar

```jsx
const [activeTab, setActiveTab] = useState('buku-besar');
const [selectedBranch, setSelectedBranch] = useState('');
const [startDate, setStartDate] = useState('2026-01-01');
const [endDate, setEndDate] = useState('2026-04-30');

// Automatic load saat params berubah
useEffect(() => {
  loadReportData();
}, [activeTab, selectedBranch, startDate, endDate]);

// User lihat:
// 1. Tab: "Buku Besar" selected (blue)
// 2. Filter bar: Cabang, Tanggal Dari, Tanggal Sampai
// 3. Summary cards: Saldo Awal, Total Debit, Total Kredit, Saldo Akhir
// 4. Table: All ledger entries for period
// 5. Pagination: Page 1 of 5 (100 entries)
// 6. Export button: Download as Excel
```

---

### Skenario 2: Create Journal Entry

```jsx
// User clicks [+ Buat Jurnal]
handleOpenJournalForm();

// Modal appears with empty form
// User fills:
// - Tanggal: 2026-04-30
// - Cabang: Cabang Utama
// - Jenis Transaksi: Penjualan
// - Keterangan: Setoran penjualan hari ini

// User adds journal lines:
// Line 1: Akun "1110 - Kas", Debit: 5,000,000, Kredit: 0
// Line 2: Akun "5100 - Penjualan", Debit: 0, Kredit: 5,000,000

// Total shows: Debit 5M = Kredit 5M ✓ Seimbang
// [Simpan Jurnal] button enabled
// User clicks [Simpan Jurnal]

// API: POST /api/journal-entries
// Response: { id_jurnal: 101, ... }
// Toast: "Jurnal berhasil dibuat"
// List refreshed: New entry appears at top
```

---

### Skenario 3: Edit & Delete Journal

```jsx
// User sees journal list in "Jurnal" tab
// Each row has: Tanggal | Keterangan | Debit | Kredit | Aksi
// Aksi: [✏️ Edit] [🗑️ Delete]

// To Edit:
// 1. Click [✏️ Edit]
// 2. Modal opens with current data
// 3. User modifies keterangan
// 4. Update journal lines
// 5. Click [Perbarui Jurnal]
// 6. API: PUT /api/journal-entries/101
// 7. Toast: "Jurnal berhasil diperbarui"

// To Delete:
// 1. Click [🗑️ Delete]
// 2. Confirmation: "Yakin ingin menghapus jurnal ini?"
// 3. User confirms
// 4. API: DELETE /api/journal-entries/101
// 5. Toast: "Jurnal berhasil dihapus"
// 6. List refreshed (entry removed)
```

---

## Database Schema

### Tabel: jurnal

```sql
CREATE TABLE jurnal (
  id_jurnal INT PRIMARY KEY AUTO_INCREMENT,
  tanggal DATE NOT NULL,
  keterangan TEXT NOT NULL,
  id_cabang INT,
  jenis_transaksi ENUM('penjualan', 'pembelian', 'biaya', 'transfer', 'lainnya'),
  referensi_tabel VARCHAR(50),
  referensi_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (id_cabang) REFERENCES cabang(id_cabang)
);
```

### Tabel: detail_jurnal

```sql
CREATE TABLE detail_jurnal (
  id_detail INT PRIMARY KEY AUTO_INCREMENT,
  id_jurnal INT NOT NULL,
  id_akun INT NOT NULL,
  debit DECIMAL(18, 2) DEFAULT 0,
  kredit DECIMAL(18, 2) DEFAULT 0,
  keterangan VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (id_jurnal) REFERENCES jurnal(id_jurnal) ON DELETE CASCADE,
  FOREIGN KEY (id_akun) REFERENCES akun(id_akun)
);
```

---

## Troubleshooting

### ❌ Filter panel tidak muncul
**Solution:**
- Pastikan `showFilters` state ter-set ke `true`
- Check `onFilterToggle` handler properly updates state
- Verify CSS classes tidak di-override

### ❌ Journal entry save gagal
**Solution:**
- Verify debit = kredit balance
- Check all required fields filled (keterangan, akun)
- Minimum 2 journal lines required
- Check console for API error messages

### ❌ Pagination tidak working
**Solution:**
- Verify `currentPage` updates on link click
- Check `itemsPerPage` correctly limits data
- Ensure `totalPages` calculated correctly
- Clear page cache if stale

### ❌ Report data tidak load
**Solution:**
- Check API endpoint returns data in expected format
- Verify filter parameters sent correctly
- Check date format (YYYY-MM-DD)
- Review network tab for API errors

### ❌ Export Excel tidak bekerja
**Solution:**
- Verify `exportToExcel` utility function exists
- Check data array format matches expected structure
- Ensure filename valid (no special characters)
- Check browser has permission to download

---

## Fitur Tambahan (Future)

- [ ] Multi-currency support
- [ ] Custom report builder
- [ ] Scheduled report email
- [ ] Report comparison (period to period)
- [ ] Drill-down details per row
- [ ] Journal approval workflow
- [ ] Batch journal import
- [ ] Report templates
- [ ] Audit trail per journal
- [ ] Reconciliation helper

---

**Created by:** N-POS Development Team  
**Last Modified:** April 30, 2026  
**Version:** 1.0.0
