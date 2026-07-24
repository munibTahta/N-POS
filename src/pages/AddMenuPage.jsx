import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMenuContext } from '../context/MenuContext';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import { useNotifications } from '../hooks/useNotifications';
import { renderLucideIcon } from '../utils/lucideIconHelper';

const AddMenuPage = () => {
  const navigate = useNavigate();
  const { menus, addMenu } = useMenuContext();
  const { success: showSuccess, error: showError } = useNotifications();
  const [formData, setFormData] = useState({
    menu_key: '',
    nama_menu: '',
    icon: '',
    path: '',
    parent_menu: '',
    urutan: 0,
    aktif: true,
    grup: 'utama'
  });
  const [saving, setSaving] = useState(false);

  const grupOptions = [
    { value: 'utama', label: 'Menu Utama' },
    { value: 'master', label: 'Data Master' },
    { value: 'transaksi', label: 'Transaksi' },
    { value: 'laporan', label: 'Laporan' },
    { value: 'pengaturan', label: 'Pengaturan' }
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.menu_key || !formData.nama_menu) {
      showError('Menu Key dan Nama Menu wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const menuData = {
        ...formData,
        parent_menu: formData.parent_menu || null,
        urutan: parseInt(formData.urutan, 10) || 0
      };

      await addMenu(menuData);
      showSuccess('Menu berhasil dibuat');
      navigate('/pengaturan/menu');
    } catch (error) {
      const message = error.message || 'Gagal menyimpan menu';
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Tambah Menu Baru"
          description="Tambah menu sistem baru dari halaman khusus ini."
          actions={
            <Link
              to="/pengaturan/menu"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              &larr; Kembali
            </Link>
          }
        />

        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 max-w-3xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Menu Key *</label>
                <input
                  type="text"
                  name="menu_key"
                  value={formData.menu_key}
                  onChange={handleChange}
                  placeholder="contoh: produk, penjualan, laporan"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Menu *</label>
                <input
                  type="text"
                  name="nama_menu"
                  value={formData.nama_menu}
                  onChange={handleChange}
                  placeholder="contoh: Manajemen Produk"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon (Lucide React name atau Emoji)</label>
                <input
                  type="text"
                  name="icon"
                  value={formData.icon}
                  onChange={handleChange}
                  placeholder="contoh: Home, ShoppingCart, Menu, atau emoji 🏠"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">Isi nama ikon Lucide React atau gunakan emoji sederhana.</p>
                {formData.icon && (
                  <div className="mt-3 flex items-center gap-3 text-sm text-slate-600">
                    <span>Preview:</span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                      {renderLucideIcon(formData.icon, 'w-6 h-6')}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Path/Route</label>
                <input
                  type="text"
                  name="path"
                  value={formData.path}
                  onChange={handleChange}
                  placeholder="contoh: /produk, /laporan"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Menu</label>
                <select
                  name="parent_menu"
                  value={formData.parent_menu}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Pilih Parent Menu (opsional) --</option>
                  {menus.map(menu => (
                    <option key={menu.id_menu} value={menu.id_menu}>
                      {menu.nama_menu}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grup Menu</label>
                <select
                  name="grup"
                  value={formData.grup}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {grupOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Urutan</label>
                <input
                  type="number"
                  name="urutan"
                  value={formData.urutan}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="aktif"
                  checked={formData.aktif}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700">Menu Aktif</label>
                  <p className="text-sm text-gray-500">Biarkan dicentang agar menu langsung aktif.</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4 justify-end">
                <Link
                  to="/pengaturan/menu"
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </Link>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-70"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Menu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </PageContainer>
    </PageLayout>
  );
};

export default AddMenuPage;
