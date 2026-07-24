import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getBranches, deleteBranch } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { handleError } from '../utils/errorHandler';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts/index.jsx';
import DataTable from '../components/DataTable';
import HeaderActionButton from '../components/HeaderActionButton';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { Plus, Edit, Trash2, Loader } from 'lucide-react';

const LoadingSpinner = () => (
  <Loader className="w-8 h-8 text-blue-600 animate-spin" />
);

const BranchesPage = () => {
  const navigate = useNavigate();
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Hapus',
    onConfirm: null,
    variant: 'danger'
  });
  const { success: _showSuccess, error: showError } = useNotifications();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const handleDeleteBranch = (id) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Cabang',
      message: 'Apakah Anda yakin ingin menghapus cabang ini?',
      confirmText: 'Ya, Hapus',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteBranch(id);
          // Refresh data setelah hapus
          const response = await getBranches();
          if (response.data && response.data.success && Array.isArray(response.data.data)) {
            setBranches(response.data.data);
          } else {
            setBranches([]);
          }
        } catch (err) {
          handleError(err);
          showError('Gagal menghapus cabang');
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await getBranches();
        // Sesuai dokumentasi, data ada di dalam response.data.data
        if (response.data && response.data.success && Array.isArray(response.data.data)) {
          setBranches(response.data.data);
        } else {
          setBranches([]);
        }
      } catch (err) {
        // Memberikan pesan yang lebih spesifik untuk error 500
        const message = err.response?.status === 500 ? 'Terjadi kesalahan internal pada server.' : 'Gagal memuat data cabang.';
        
        // Fallback to SQLite when offline and cache is empty
        console.warn('Failed to fetch branches from API, trying SQLite cache:', err.message);
        if (window.electronAPI?.dbSelect) {
          try {
            const sqliteBranches = await window.electronAPI.dbSelect({
              table: 'branches'
            });
            if (sqliteBranches && Array.isArray(sqliteBranches) && sqliteBranches.length > 0) {
              setBranches(sqliteBranches);
              setError('');
            } else {
              setError(message);
              showError(message);
            }
          } catch (sqliteErr) {
            setError(message);
            showError(message);
            console.error('SQLite fallback error:', sqliteErr);
          }
        } else {
          setError(message);
          showError(message);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchBranches();
  }, [showError]);

  if (loading) {
    return (
      <PageLayout>
        <PageContainer>
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="inline-block">
                <LoadingSpinner />
              </div>
              <p className="mt-3 text-slate-600">Memuat data cabang...</p>
            </div>
          </div>
        </PageContainer>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <PageContainer>
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          </div>
        </PageContainer>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Manajemen Cabang"
          subtitle="Kelola data cabang bisnis untuk koordinasi operasional yang lebih efisien dan terstruktur."
          actions={
            <HeaderActionButton
              icon={Plus}
              label="Tambah Cabang"
              variant="blue"
              to="/cabang/tambah"
              isLink
              hideLabel={true}
            />
          }
        />

        <DataTable
          data={branches}
          loading={loading}
          error={error}
          showPagination={true}
          searchKeys={['kode_cabang', 'nama_cabang', 'kota', 'alamat', 'no_telp', 'telepon']}
          columns={[
            {
              key: 'kode_cabang',
              header: 'Kode Cabang',
              render: (branch) => branch.kode_cabang
            },
            {
              key: 'nama_cabang',
              header: 'Nama Cabang',
              render: (branch) => branch.nama_cabang
            },
            {
              key: 'kota',
              header: 'Kota',
              render: (branch) => branch.kota
            },
            {
              key: 'alamat',
              header: 'Alamat',
              render: (branch) => branch.alamat || '—'
            },
            {
              key: 'telepon',
              header: 'Telepon',
              render: (branch) => branch.no_telp || branch.telepon || '—'
            }
          ]}
          actions={[
            {
              icon: Edit,
              title: 'Edit',
              onClick: (branch) => {
                navigate(`/cabang/edit/${branch.id_cabang}`);
              },
              variant: 'primary',
              size: 'sm'
            },
            {
              icon: Trash2,
              title: 'Hapus',
              onClick: (branch) => handleDeleteBranch(branch.id_cabang),
              variant: 'danger',
              size: 'sm'
            }
          ]}
          filters={[
            {
              key: 'kota',
              label: 'Kota',
              type: 'select',
              options: [
                { value: '', label: 'Semua Kota' },
                ...([...new Set(branches.map(b => b.kota).filter(Boolean))].map((kota) => ({
                  value: kota,
                  label: kota
                })))
              ]
            }
          ]}
        />

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

export default BranchesPage;