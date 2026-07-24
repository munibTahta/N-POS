import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getUsers, deleteUser, getBranches } from '../services/api';
import DropdownActionMenu from '../components/common/DropdownActionMenu';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { useNotifications } from '../hooks/useNotifications';
import { logger } from '../utils/logger';
import LoadingPage from '../components/common/LoadingPage';
import ResponsiveTable from '../components/common/ResponsiveTable';
import { SearchFilterBar, FilterPanel } from '../components/SearchFilterBar';
import useSearchAndFilter from '../hooks/useSearchAndFilter';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import HeaderActionButton from '../components/HeaderActionButton';
import ActionButton from '../components/ActionButton';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { Plus, Edit, Trash2 } from 'lucide-react';

const UsersPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Hapus',
    onConfirm: null,
    variant: 'danger'
  });
  const { canManageUsers } = usePermissions();
  const { success, error: showError } = useNotifications();
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterRole, setFilterRole] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');

  useEffect(() => {
    if (!user) return;

    if (!canManageUsers) {
      setLoading(false);
      return;
    }

    const fetchUsersAndBranches = async () => {
      try {
        // Fetch Users
        try {
          const response = await getUsers();
          if (response.data && response.data.success && Array.isArray(response.data.data)) {
            setUsers(response.data.data);
          } else if (Array.isArray(response.data)) {
            setUsers(response.data);
          } else {
            setUsers([]);
          }
        } catch (usersErr) {
          logger.error('Failed to fetch users:', usersErr);
        }

        // Fetch Branches
        try {
          const response = await getBranches();
          if (response.data && response.data.success && Array.isArray(response.data.data)) {
            setBranches(response.data.data);
          } else if (Array.isArray(response.data)) {
            setBranches(response.data);
          }
        } catch (branchesErr) {
          logger.warn('Failed to fetch branches from API, trying SQLite:', branchesErr);
          if (window.electronAPI?.dbSelect) {
            try {
              const sqliteBranches = await window.electronAPI.dbSelect({
                table: 'branches'
              });
              if (sqliteBranches && Array.isArray(sqliteBranches)) {
                setBranches(sqliteBranches);
              }
            } catch (sqliteErr) {
              logger.error('SQLite branches fallback error:', sqliteErr);
            }
          }
        }
      } catch (err) {
        logger.error('Unexpected error in fetch:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsersAndBranches();
  }, [user, canManageUsers]);

  const handleDelete = (id) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Pengguna',
      message: 'Apakah Anda yakin ingin menghapus pengguna ini?',
      confirmText: 'Ya, Hapus',
      variant: 'danger',
      onConfirm: async () => {
        setDeleting(true);
        try {
          await deleteUser(id);
          success('Pengguna berhasil dihapus.');
          const response = await getUsers();
          if (response.data && response.data.success && Array.isArray(response.data.data)) {
            setUsers(response.data.data);
          } else if (Array.isArray(response.data)) {
            setUsers(response.data);
          }
        } catch (error) {
          let errorMessage = error?.response?.data?.message || error?.message || 'Gagal menghapus pengguna.';
          const rawError = String(errorMessage || '').toLowerCase();
          if (rawError.includes('foreign key') || rawError.includes('constraint fails') || rawError.includes('user_sessions_ibfk_1')) {
            errorMessage = 'Tidak dapat menghapus pengguna karena ada data sesi aktif yang masih terkait. Hapus session user terlebih dahulu sebelum mencoba lagi.';
          }
          showError(`Gagal menghapus pengguna: ${errorMessage}`);
          logger.error('Delete user error:', error);
        } finally {
          setDeleting(false);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const usersWithBranch = React.useMemo(() => {
    return users.map(u => {
      const branch = branches.find(b => String(b.id_cabang) === String(u.id_cabang));
      return {
        ...u,
        nama_cabang: branch ? branch.nama_cabang : 'Semua Cabang'
      };
    });
  }, [users, branches]);

  const roleOptions = [...new Set(users.map((userItem) => userItem.role).filter(Boolean))];

  const { filteredItems: filteredUsers } = useSearchAndFilter(usersWithBranch, {
    searchTerm: searchQuery,
    searchKeys: ['nama_lengkap', 'username', 'role', 'nama_cabang'],
    filters: {
      role: filterRole === 'all' ? '' : filterRole,
      id_cabang: filterBranch === 'all' ? '' : filterBranch,
    },
    filterFns: {
      role: (item, value) => {
        if (!value) return true;
        return item.role === value;
      },
      id_cabang: (item, value) => {
        if (!value) return true;
        if (value === 'global') return !item.id_cabang;
        return String(item.id_cabang) === String(value);
      }
    },
    debounceDelay: 300,
  });

  const { currentData: paginatedUsers, currentPage, totalPages, setPage, itemsPerPage } = usePagination({
    data: filteredUsers,
    itemsPerPage: 20,
  });

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterRole, filterBranch, setPage]);

  if (loading) return <LoadingPage message="Memuat data pengguna..." />;

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Manajemen Pengguna"
          description="Kelola akun pengguna, role, dan akses sistem dengan mudah."
          actions={
            canManageUsers && (
              <HeaderActionButton
                icon={Plus}
                label="Tambah Pengguna"
                variant="blue"
                to="/pengguna/tambah"
                isLink
                hideLabel={true}
              />
            )
          }
        />

        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">Total Pengguna</p>
              <p className="text-2xl font-bold text-gray-900">{users.length.toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">Hasil Filter</p>
              <p className="text-2xl font-bold text-blue-600">{filteredUsers.length.toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">Jumlah Role</p>
              <p className="text-2xl font-bold text-green-600">{roleOptions.length.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="p-6">
              <SearchFilterBar
                searchTerm={searchQuery}
                onSearchChange={setSearchQuery}
                onClearSearch={() => setSearchQuery('')}
                onFilterToggle={() => setShowFilters((prev) => !prev)}
                isFilterActive={showFilters}
                hasActiveFilters={filterRole !== 'all' || filterBranch !== 'all'}
                onClearFilters={() => {
                  setFilterRole('all');
                  setFilterBranch('all');
                  setSearchQuery('');
                }}
                searchPlaceholder="Cari nama, username, role, atau cabang..."
                className="mb-4"
              />

              <FilterPanel visible={showFilters} className="mb-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Role Pengguna</label>
                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Semua Role</option>
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Cabang</label>
                    <select
                      value={filterBranch}
                      onChange={(e) => setFilterBranch(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Semua Cabang (Tanpa Filter)</option>
                      <option value="global">Akses Global (Tanpa Cabang)</option>
                      {branches.map((branch) => (
                        <option key={branch.id_cabang} value={String(branch.id_cabang)}>
                          {branch.nama_cabang}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </FilterPanel>

              <ResponsiveTable>
                <table className="min-w-full divide-y divide-gray-200 bg-white">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">Nama Lengkap</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">Username</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">Cabang</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                          Tidak ada pengguna ditemukan dengan filter yang dipilih.
                        </td>
                      </tr>
                    ) : (
                      paginatedUsers.map((userItem) => (
                        <tr key={userItem.id_user} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{userItem.id_user}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{userItem.nama_lengkap}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{userItem.username}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{userItem.nama_cabang}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{userItem.role}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm">
                            <DropdownActionMenu
                              actions={[
                                {
                                  key: 'edit',
                                  icon: Edit,
                                  title: 'Edit',
                                  variant: 'primary',
                                  onClick: () => navigate(`/pengguna/edit/${userItem.id_user}`)
                                },
                                {
                                  key: 'delete',
                                  icon: Trash2,
                                  title: 'Hapus',
                                  variant: 'danger',
                                  show: canManageUsers,
                                  disabled: deleting,
                                  onClick: () => handleDelete(userItem.id_user)
                                }
                              ]}
                              item={userItem}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </ResponsiveTable>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-end">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
                itemsPerPage={itemsPerPage}
                totalItems={filteredUsers.length}
              />
            </div>
          )}
        </div>

        {/* Reusable Confirm Dialog */}
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
          variant={confirmDialog.variant}
        />
      </PageContainer>
    </PageLayout>
  );
};

export default UsersPage;
