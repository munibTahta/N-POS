/**
 * OFFLINE DATA MANAGEMENT MENU SETUP
 * 
 * Untuk menambahkan menu "Manajemen Data Offline" ke sistem:
 * 
 * 1. Via API (Recommended):
 *    POST /api/menus dengan data:
 *    {
 *      "menu_key": "offline-data",
 *      "nama_menu": "Manajemen Data Offline",
 *      "icon": "database",
 *      "path": "/pengaturan/offline-data",
 *      "parent_menu": "pengaturan",
 *      "urutan": 99,
 *      "aktif": true,
 *      "grup": "pengaturan"
 *    }
 * 
 * 2. Via Menu Management Page:
 *    - Login sebagai Admin/Owner
 *    - Buka: Pengaturan > Manajemen Menu
 *    - Klik "Tambah Menu"
 *    - Isi form dengan data di atas
 *    - Simpan
 * 
 * 3. Optional - Grant Permission ke Role:
 *    PUT /api/menus/role/{roleId}/permissions
 *    {
 *      "menuPermissions": [
 *        { "menu_key": "offline-data", "can_view": true, "can_create": false, "can_edit": false, "can_delete": false }
 *      ]
 *    }
 * 
 * FITUR HALAMAN:
 * - Melihat status sync queue dan offline data
 * - Menampilkan statistik penjualan, pembelian, produk offline
 * - Retry failed sync items
 * - Hapus completed sync items
 * - Export offline data untuk backup/debugging
 * - Filter queue berdasarkan tipe (penjualan, pembelian, produk)
 * - Lihat detail JSON dari setiap queue item
 * 
 * ROUTE: /pengaturan/offline-data
 * PERMISSION KEY: offline-data
 */

export const OFFLINE_DATA_MENU_CONFIG = {
  menu_key: 'offline-data',
  nama_menu: 'Manajemen Data Offline',
  icon: 'database',
  path: '/pengaturan/offline-data',
  parent_menu: 'pengaturan',
  urutan: 99,
  aktif: true,
  grup: 'pengaturan'
};

export default OFFLINE_DATA_MENU_CONFIG;
