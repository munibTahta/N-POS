import React, { useState } from 'react';
import { useRoleContext } from '../context/RoleContext.jsx';
import { useMenuContext } from '../context/MenuContext';
import { PermissionError, AdminOwnerGuard } from '../components/PermissionGuard';
import { updateRolePermissions as apiUpdateRolePermissions, getMenuPermissionsForRole, updateMenuPermissionsForRole } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { handleError } from '../utils/errorHandler';
import { renderLucideIcon } from '../utils/lucideIconHelper';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';

const RoleManagementPage = () => {
  const { success: showSuccess, error: showError, warning, info: _info } = useNotifications();
  const { roles, updateRolePermissions } = useRoleContext();
  const { loadMenus } = useMenuContext();

  const [selectedRole, setSelectedRole] = useState(null);
  const [editingPermissions, setEditingPermissions] = useState({});
  const [editingMenuPermissions, setEditingMenuPermissions] = useState([]);
  const [availableMenus, setAvailableMenus] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingMenus, setLoadingMenus] = useState(false);

  // All available permissions - Updated to match API structure
  const ALL_PERMISSIONS = [
    { key: 'sales', name: 'Akses Penjualan', description: 'Membuat dan mengelola transaksi penjualan' },
    { key: 'inventory', name: 'Akses Inventori', description: 'Mengelola stok dan produk' },
    { key: 'reports', name: 'Akses Laporan', description: 'Melihat laporan dan analisis' },
    { key: 'users', name: 'Akses Pengguna', description: 'Mengelola pengguna dan role' },
    { key: 'all', name: 'Akses Penuh', description: 'Akses ke semua fitur sistem' },
  ];

  const handleRoleSelect = async (roleId) => {
    setSelectedRole(roleId);
    if (roles[roleId]) {
      setEditingPermissions({ ...roles[roleId].permissions });

      // Load menu permissions for this role
      setLoadingMenus(true);
      try {
        const response = await getMenuPermissionsForRole(roleId);
        if (response.data && response.data.success) {
          setAvailableMenus(response.data.data.menuPermissions || []);
          setEditingMenuPermissions(response.data.data.menuPermissions || []);
        }
      } catch (_error) {
        showError('Gagal memuat izin menu');
        setAvailableMenus([]);
        setEditingMenuPermissions([]);
      } finally {
        setLoadingMenus(false);
      }
    }
  };

  const handlePermissionToggle = (permission) => {
    setEditingPermissions(prev => ({
      ...prev,
      [permission]: !prev[permission]
    }));
  };

  const handleMenuPermissionToggle = (menuId) => {
    setEditingMenuPermissions(prev => {
      const newPermissions = prev.map(menu =>
        menu.id_menu === menuId
          ? { ...menu, dapat_akses: !menu.dapat_akses }
          : menu
      );
      return newPermissions;
    });
  };

  const handleSavePermissions = async () => {
    if (!selectedRole || !editingPermissions) {
      warning('Pilih role dan atur permission terlebih dahulu');
      return;
    }

    setSaving(true);
    try {
      // Prepare full role data for API
      const currentRole = roles[selectedRole];
      const roleData = {
        nama_role: currentRole.nama_role,
        deskripsi: currentRole.deskripsi,
        permissions: editingPermissions
      };

      // Save general permissions to API first
      await apiUpdateRolePermissions(selectedRole, roleData);

      // Save menu permissions separately
      const menuPermissionsData = editingMenuPermissions.map(menu => ({
        id_menu: menu.id_menu,
        dapat_akses: menu.dapat_akses
      }));
      await updateMenuPermissionsForRole(selectedRole, menuPermissionsData);

      // Update role permissions in context
      updateRolePermissions(selectedRole, editingPermissions);

      // Reload menus so MenuContext reflects updated role menu permissions
      try {
        await loadMenus();
      } catch (e) {
        // ignore load error, UI will reflect changes on next refresh
        console.warn('Failed to reload menus after updating permissions', e);
      }

      showSuccess(`Permission untuk role "${roles[selectedRole]?.nama_role}" berhasil diperbarui dan disimpan`);

      // Reset editing state
      setSelectedRole(null);
      setEditingPermissions({});
      setEditingMenuPermissions([]);
      setAvailableMenus([]);
    } catch (error) {
      handleError(error);
      showError('Terjadi kesalahan saat menyimpan permission ke server');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminOwnerGuard
      fallback={
        <PermissionError
          permission="MANAGE_USERS"
          message="Hanya Admin dan Owner yang dapat mengelola role dan permission"
        />
      }
    >
      <PageLayout>
        <PageContainer>
          <PageHeader
            title="Manajemen Role & Permission"
            description="Kelola role dan permission pengguna dalam sistem"
          />

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 border-b border-gray-200">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Daftar Role</h2>
                    <p className="text-sm text-gray-600 mt-1">Pilih role untuk mengatur permission dan akses menu.</p>
                  </div>
                  <div className="space-y-2">
                    {Object.values(roles).map((roleData) => (
                      <button
                        key={roleData.id_role}
                        type="button"
                        onClick={() => handleRoleSelect(roleData.id_role)}
                        className={`w-full text-left p-4 rounded-lg transition-colors ${
                          selectedRole === roleData.id_role
                            ? 'bg-blue-50 border-blue-200 border'
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="font-medium text-gray-900">{roleData.nama_role}</div>
                        <div className="text-sm text-gray-600 mt-1">{roleData.deskripsi}</div>
                        <div className="text-xs text-gray-500 mt-2">
                          Level: {roleData.level} | {Object.values(roleData.permissions).filter(Boolean).length} permission aktif
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Editor Permission</h2>
                      <p className="text-sm text-gray-600 mt-1">Sesuaikan permission umum dan akses menu untuk role yang dipilih.</p>
                    </div>
                    {selectedRole && (
                      <div className="text-sm text-slate-500">Role: <span className="font-semibold text-slate-700">{roles[selectedRole]?.nama_role}</span></div>
                    )}
                  </div>

                  {selectedRole ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {ALL_PERMISSIONS.map((permission) => (
                          <label key={permission.key} className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={editingPermissions?.[permission.key] || false}
                              onChange={() => handlePermissionToggle(permission.key)}
                              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{permission.name}</div>
                              <p className="text-sm text-gray-600 mt-1">{permission.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>

                      <div className="mb-6">
                        <div className="flex items-center justify-between gap-4 mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">Akses Menu</h3>
                            <p className="text-sm text-gray-600 mt-1">Aktifkan akses menu yang tersedia untuk role ini.</p>
                          </div>
                        </div>

                        {loadingMenus ? (
                          <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="mt-3 text-gray-600">Memuat menu...</p>
                          </div>
                        ) : availableMenus.length > 0 ? (
                          <div className="space-y-4">
                            {['utama', 'master', 'transaksi', 'laporan', 'pengaturan'].map((grup) => {
                              const grupMenus = editingMenuPermissions.filter(menu => menu.grup === grup);
                              if (!grupMenus.length) return null;

                              const title = grup === 'utama' ? 'Menu Utama'
                                : grup === 'master' ? 'Data Master'
                                : grup === 'transaksi' ? 'Transaksi'
                                : grup === 'laporan' ? 'Laporan'
                                : 'Pengaturan';

                              return (
                                <div key={grup} className="border border-gray-200 rounded-lg p-4">
                                  <h4 className="font-semibold text-gray-900 mb-3">{title}</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {grupMenus.map((menu) => (
                                      <label key={`menu-${menu.id_menu}`} className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                        <input
                                          type="checkbox"
                                          checked={menu.dapat_akses || false}
                                          onChange={() => handleMenuPermissionToggle(menu.id_menu)}
                                          className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded"
                                        />
                                        <div className="flex-1">
                                          <div className="font-medium text-gray-900 text-sm flex items-center gap-2">
                                            {renderLucideIcon(menu.icon, 'w-4 h-4')}
                                            {menu.nama_menu}
                                          </div>
                                          <p className="text-xs text-gray-600 mt-1">{menu.menu_key}</p>
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-10 text-gray-500 border border-dashed border-gray-200 rounded-lg">
                            <p>Tidak ada menu yang tersedia untuk role ini</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:justify-end sm:items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRole(null);
                            setEditingPermissions({});
                            setEditingMenuPermissions([]);
                            setAvailableMenus([]);
                          }}
                          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={handleSavePermissions}
                          disabled={saving}
                          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                        >
                          {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
                      <p>Pilih role dari daftar untuk mengedit permission</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Hierarki Role</h2>
                  <p className="text-sm text-gray-600 mt-1">Lihat level hak akses role dan kemampuan manajemen role yang lebih bawah.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(roles)
                  .sort(([, a], [, b]) => b.level - a.level)
                  .map(([roleName, roleData]) => (
                    <div key={roleName} className="rounded-lg border border-gray-200 p-4">
                      <div className="font-semibold text-lg text-gray-900">{roleData.nama_role}</div>
                      <div className="text-sm text-gray-600 mb-2">Level: {roleData.level}</div>
                      <div className="text-xs text-gray-500">Dapat mengelola role dengan level di bawah {roleData.level}</div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </PageContainer>
      </PageLayout>
    </AdminOwnerGuard>
  );
};

export default RoleManagementPage;