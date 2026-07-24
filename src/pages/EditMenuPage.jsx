import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMenuContext } from '../context/MenuContext';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import { useNotifications } from '../hooks/useNotifications';
import { renderLucideIcon } from '../utils/lucideIconHelper';

const EditMenuPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { menus, editMenu, loading } = useMenuContext();
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

  const selectedMenu = menus.find(menu => String(menu.id_menu) === String(id));

  useEffect(() => {
    if (selectedMenu) {
      setFormData({
        menu_key: selectedMenu.menu_key || '',
        nama_menu: selectedMenu.nama_menu || '',
        icon: selectedMenu.icon || '',
        path: selectedMenu.path || '',
        parent_menu: selectedMenu.parent_menu || '',
        urutan: selectedMenu.urutan || 0,
        aktif: selectedMenu.aktif !== false,
        grup: selectedMenu.grup || 'utama'
      });
    }
  }, [selectedMenu]);

  const grupOptions = [
    { value: 'utama', label: 'Menu Utama' },
    { value: 'master', label: 'Data Master' },
    { value: 'transaksi', label: 'Transaksi' },
    { value: 'laporan', label: 'Laporan' },
    { value: 'pengaturan', label: 'Pengaturan' }
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
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

    if (!selectedMenu) {
      showError('Menu tidak ditemukan. Silakan kembali ke daftar menu.');
      return;
    }

    setSaving(true);

    try {
      const menuData = {
        ...formData,
        parent_menu: formData.parent_menu || null,
        urutan: parseInt(formData.urutan, 10) || 0
      };

      await editMenu(selectedMenu.id_menu, menuData);
      showSuccess('Menu berhasil diperbarui');
      navigate('/pengaturan/menu');
    } catch (error) {
      const message = error.message || 'Gagal memperbarui menu';
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !selectedMenu) {
    return (
      <PageLayout>
        <PageContainer>
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Memuat menu untuk diedit...</p>
          </div>
        </PageContainer>
      </PageLayout>
    );
  }

  if (!selectedMenu) {
    return (
      <PageLayout>
        <PageContainer>
          <PageHeader
            title="Edit Menu"
            description="Menu yang diminta tidak ditemukan atau belum dimuat."
            actions={
              <Link
                to="/pengaturan/menu"
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-slate-800 transition"
              >
                &larr; Kembali ke Daftar Menu
              </Link>
            }
          />
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Pastikan data menu telah dimuat terlebih dahulu atau kembali ke daftar menu untuk mencoba lagi.</p>
          </div>
        </PageContainer>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Edit Menu"
          description="Perbarui detail menu dari halaman edit khusus ini."
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
                  {menus
                    .filter(menu => String(menu.id_menu) !== String(id))
                    .map(menu => (
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
                  min="0"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <p className="text-sm text-gray-500">Biarkan dicentang agar menu tetap aktif.</p>
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
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </PageContainer>
    </PageLayout>
  );
};

export default EditMenuPage;