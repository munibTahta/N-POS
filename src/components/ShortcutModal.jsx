import React, { useMemo, useState } from 'react';

// SVG Icons
const IconGeneral = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconSearch = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const IconCart = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.57 6.75A1 1 0 005.41 21h13.18a1 1 0 00.98-1.25L17 13M9 5h6m-6 0a1 1 0 110 2 1 1 0 010-2zm6 0a1 1 0 110 2 1 1 0 010-2z" />
  </svg>
);

const IconUsers = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 8.048M12 4.354L8.646 7.708m6.708 0L12 4.354m0 8.048l3.354 3.354m-6.708 0L12 12.402m6.708 3.354L12 12.402M4 20h16a2 2 0 002-2v-1a6 6 0 00-6-6H8a6 6 0 00-6 6v1a2 2 0 002 2z" />
  </svg>
);

const IconPayment = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h10m4 0a1 1 0 11-2 0 1 1 0 012 0zM6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const IconHardware = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const IconNavigation = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const SHORTCUTS_GROUPED = [
  {
    group: 'Umum',
    icon: IconGeneral,
    items: [
      { keys: 'F1', description: 'Buka/Tutup daftar shortcut' },
      { keys: 'Esc', description: 'Tutup modal atau batal' },
      { keys: 'Ctrl+Z', description: 'Batalkan aksi terakhir' },
    ]
  },
  {
    group: 'Pencarian & Scanning',
    icon: IconSearch,
    items: [
      { keys: 'F2', description: 'Cari produk' },
      { keys: 'F3', description: 'Scan barcode' },
      { keys: 'Alt+B', description: 'Buka scanner kamera' },
    ]
  },
  {
    group: 'Keranjang & Item',
    icon: IconCart,
    items: [
      { keys: 'F4', description: 'Fokus input nominal pembayaran (di POS)' },
      { keys: 'Backspace', description: 'Hapus item terpilih di keranjang' },
      { keys: 'Delete', description: 'Hapus item terakhir di keranjang' },
      { keys: 'Ctrl+Del / Ctrl+Backspace', description: 'Kosongkan seluruh keranjang' },
    ]
  },
  {
    group: 'Pelanggan & Diskon',
    icon: IconUsers,
    items: [
      { keys: 'F5', description: 'Cari/Pilih pelanggan' },
      { keys: 'F6', description: 'Terapkan diskon' },
    ]
  },
  {
    group: 'Pembayaran',
    icon: IconPayment,
    items: [
      { keys: 'F7', description: 'Pilih metode pembayaran' },
      { keys: 'Ctrl+1', description: 'Isi nominal Rp 10.000' },
      { keys: 'Ctrl+2', description: 'Isi nominal Rp 20.000' },
      { keys: 'Ctrl+3', description: 'Isi nominal Rp 50.000' },
      { keys: 'Ctrl+4', description: 'Isi nominal Rp 100.000' },
      { keys: 'Ctrl+0', description: 'Isi nominal = Total Tagihan' },
      { keys: 'F12 / End', description: 'Lanjut ke Pembayaran/Checkout' },
      { keys: 'Ctrl+Enter', description: 'Selesaikan transaksi' },
    ]
  },
  {
    group: 'Hardware & Navigasi',
    icon: IconHardware,
    items: [
      { keys: 'F8', description: 'Buka cash drawer' },
      { keys: 'Alt+P', description: 'Fokus ke Pencarian Produk' },
      { keys: 'Alt+C', description: 'Fokus ke Keranjang' },
      { keys: 'Alt+M', description: 'Fokus ke Pembayaran' },
    ]
  },
  {
    group: 'Navigasi Halaman',
    icon: IconNavigation,
    items: [
      { keys: 'F9', description: 'Ke halaman POS (di Menu/Riwayat)' },
      { keys: 'F10', description: 'Ke halaman Manajemen Pembelian' },
      { keys: 'F11', description: 'Ke halaman Riwayat Penjualan' },
      { keys: 'Ctrl+P', description: 'Print ulang transaksi terakhir' },
    ]
  },
];

export default function ShortcutModal({ onClose }) {
  const [query, setQuery] = useState('');

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return SHORTCUTS_GROUPED;
    
    return SHORTCUTS_GROUPED
      .map(group => ({
        ...group,
        items: group.items.filter(item =>
          item.keys.toLowerCase().includes(normalized) ||
          item.description.toLowerCase().includes(normalized)
        )
      }))
      .filter(group => group.items.length > 0);
  }, [query]);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-800">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Shortcut Keyboard POS</h3>
            <p className="text-sm text-gray-500 mt-1">Cari shortcut dan lihat semua pintasan keyboard.</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 p-1"
            aria-label="Tutup modal shortcut"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4">
          <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="shortcut-search">
            Cari shortcut
          </label>
          <input
            id="shortcut-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari dengan kata kunci atau tombol..."
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
            autoFocus
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 pb-6">
          <div className="space-y-6">
            {filteredGroups.length > 0 ? (
              filteredGroups.map((group) => {
                const IconComponent = group.icon;
                return (
                  <div key={group.group} className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <div className="text-blue-600">
                        <IconComponent />
                      </div>
                      <h4 className="text-sm font-bold text-gray-900">{group.group}</h4>
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <div key={item.keys} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                          <span className="font-semibold text-blue-700 text-sm">{item.keys}</span>
                          <span className="text-gray-700 text-sm">{item.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-900">
                Tidak ditemukan shortcut dengan kata kunci "{query}".
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}
