import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Edit2, Trash2 } from 'lucide-react';
import { AdminOwnerGuard, PermissionError } from '../components/PermissionGuard';
import HeaderActionButton from '../components/HeaderActionButton';
import DataTable from '../components/DataTable';
import { useMenuContext } from '../context/MenuContext';
import { getAllMenus } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { handleError } from '../utils/errorHandler';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import { renderLucideIcon } from '../utils/lucideIconHelper';

const MenuManagementPage = () => {
  const navigate = useNavigate();
  const { success: showSuccess, error: showError } = useNotifications();
  const { removeMenu } = useMenuContext();
  const [allMenus, setAllMenus] = useState([]);
  const [loading, setLoading] = useState(false);

  // Log when menus change
  useEffect(() => {

  }, [allMenus]);

  const fetchAllMenusForManagement = async () => {
    const allMenus = [];
    const pageSize = 100;
    let page = 1;

    while (true) {
      const response = await getAllMenus({ page, limit: pageSize });
      if (!response.data || !response.data.success) break;

      const pageData = response.data.data || [];
      allMenus.push(...pageData);

      const pagination = response.data.pagination;
      if (!pagination || pagination.page >= pagination.pages || pageData.length < pageSize) {
        break;
      }

      page += 1;
    }

    return allMenus;
  };

  // Load all menus for admin management
  useEffect(() => {
    const loadAllMenusForManagement = async () => {
      try {
        setLoading(true);
        const menus = await fetchAllMenusForManagement();
        setAllMenus(menus);
      } catch (_error) {
        showError('Gagal memuat semua menu untuk manajemen');
        setAllMenus([]);
      } finally {
        setLoading(false);
      }
    };

    loadAllMenusForManagement();
  }, [showError]);

  // Function to reload all menus
  const reloadAllMenus = async () => {
    try {
      const menus = await fetchAllMenusForManagement();
      setAllMenus(menus);
    } catch (_error) {
      showError('Gagal memuat ulang semua menu');
    }
  };

  // Grup menu options
  const grupOptions = [
    { value: 'utama', label: 'Menu Utama' },
    { value: 'master', label: 'Data Master' },
    { value: 'transaksi', label: 'Transaksi' },
    { value: 'laporan', label: 'Laporan' },
    { value: 'pengaturan', label: 'Pengaturan' }
  ];

  // Remove duplicate loadMenus function - using context's loadMenus instead

  const handleDelete = async (menuId, menuName) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus menu "${menuName}"?`)) {
      return;
    }

    try {
      await removeMenu(menuId);
      showSuccess('Menu berhasil dihapus');
      await reloadAllMenus();
    } catch (error) {
      handleError(error);
      const errorMessage = error.message || 'Gagal menghapus menu';
      showError(errorMessage);
    }
  };

  const getGrupLabel = (grup) => {
    const option = grupOptions.find(opt => opt.value === grup);
    return option ? option.label : grup;
  };

  const getParentMenuName = (parentId) => {
    if (!parentId) return '-';
    const parent = allMenus.find(m => m.id_menu === parentId);
    return parent ? parent.nama_menu : 'Unknown';
  };

  if (loading) {
    return (
      <AdminOwnerGuard
        fallback={
          <PermissionError
            permission="MANAGE_MENUS"
            message="Hanya Admin dan Owner yang dapat mengelola menu sistem"
          />
        }
      >
        <div className="container mx-auto p-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Memuat data menu...</p>
          </div>
        </div>
      </AdminOwnerGuard>
    );
  }

  return (
    <AdminOwnerGuard
      fallback={
        <PermissionError
          permission="MANAGE_MENUS"
          message="Hanya Admin dan Owner yang dapat mengelola menu sistem"
        />
      }
    >
      <PageLayout>
        <PageContainer>
          <PageHeader
            title="Manajemen Menu"
            description="Kelola menu sistem secara dinamis. Tambahkan, edit, dan hapus menu yang tersedia untuk aplikasi."
            actions={
              <>
                <HeaderActionButton
                  icon={Plus}
                  label="Tambah Menu"
                  to="/pengaturan/menu/tambah"
                  isLink
                  variant="blue"
                />
                <HeaderActionButton
                  icon={RefreshCw}
                  label="Refresh"
                  onClick={reloadAllMenus}
                  variant="secondary"
                />
              </>
            }
          />

          <div className="space-y-6">
            {/* Menu List with DataTable */}
            <DataTable
              data={allMenus}
              searchKeys={['nama_menu', 'menu_key', 'path', 'grup']}
              filters={[
                {
                  key: 'grup',
                  label: 'Filter Grup',
                  type: 'select',
                  options: [
                    { value: 'utama', label: 'Menu Utama' },
                    { value: 'master', label: 'Data Master' },
                    { value: 'transaksi', label: 'Transaksi' },
                    { value: 'laporan', label: 'Laporan' },
                    { value: 'pengaturan', label: 'Pengaturan' }
                  ],
                  defaultValue: ''
                },
                {
                  key: 'aktif',
                  label: 'Status',
                  type: 'select',
                  options: [
                    { value: 'true', label: 'Aktif' },
                    { value: 'false', label: 'Nonaktif' }
                  ],
                  defaultValue: ''
                }
              ]}
              columns={[
                {
                  key: 'nama_menu',
                  header: 'Menu',
                  width: '25%',
                  render: (item) => (
                    <div className="flex items-center gap-2">
                      <span className="text-lg flex items-center justify-center">
                        {renderLucideIcon(item.icon, 'w-5 h-5 text-gray-700')}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.nama_menu}</div>
                        {item.path && <div className="text-xs text-gray-500">{item.path}</div>}
                      </div>
                    </div>
                  )
                },
                {
                  key: 'menu_key',
                  header: 'Key',
                  width: '15%',
                  render: (item) => <span className="text-sm text-gray-900 font-mono">{item.menu_key}</span>
                },
                {
                  key: 'grup',
                  header: 'Grup',
                  width: '15%',
                  render: (item) => (
                    <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                      {getGrupLabel(item.grup)}
                    </span>
                  )
                },
                {
                  key: 'urutan',
                  header: 'Urutan',
                  width: '10%',
                  render: (item) => <span className="text-sm text-gray-900">{item.urutan ?? '-'}</span>
                },
                {
                  key: 'parent_menu',
                  header: 'Parent',
                  width: '15%',
                  render: (item) => <span className="text-sm text-gray-900">{getParentMenuName(item.parent_menu)}</span>
                },
                {
                  key: 'aktif',
                  header: 'Status',
                  width: '12%',
                  render: (item) => (
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      item.aktif
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {item.aktif ? 'Aktif' : 'Nonaktif'}
                    </span>
                  )
                }
              ]}
              actions={[
                {
                  label: 'Edit',
                  icon: Edit2,
                  onClick: (item) => navigate(`/pengaturan/menu/edit/${item.id_menu}`),
                  variant: 'blue'
                },
                {
                  label: 'Hapus',
                  icon: Trash2,
                  onClick: (item) => handleDelete(item.id_menu, item.nama_menu),
                  variant: 'red'
                }
              ]}
              itemsPerPage={20}
              showPagination={true}
              emptyMessage={allMenus.length === 0 ? 'Belum ada menu yang dibuat' : 'Tidak ada menu yang cocok dengan pencarian'}
            />
      </div>
      </PageContainer>
    </PageLayout>
    </AdminOwnerGuard>
  );
};

export default MenuManagementPage;