import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import HeaderActionButton from '../components/HeaderActionButton';
import DataTable from '../components/DataTable';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import { getAccounts, createAccount, updateAccount, deleteAccount } from '../services/api';
import { extractArray, extractData } from '../utils/apiResponseHelper';
import { toast } from 'react-toastify';
import ConfirmDialog from '../components/common/ConfirmDialog';

const AccountsPage = () => {
  const [accounts, setAccounts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Hapus',
    onConfirm: null,
    variant: 'danger'
  });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  const [formData, setFormData] = useState({
    kode_akun: '',
    nama_akun: '',
    tipe_akun: 'asset',
    saldo_normal: 'debit',
    deskripsi: ''
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await getAccounts();
      setAccounts(extractArray(response));
    } catch (err) {
      console.error('Failed to load accounts:', err);
      toast.error('Gagal memuat data akun');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id_akun, formData);
        toast.success('Akun berhasil diperbarui');
      } else {
        await createAccount(formData);
        toast.success('Akun berhasil dibuat');
      }

      setShowForm(false);
      setEditingAccount(null);
      resetForm();
      loadAccounts();
    } catch (err) {
      console.error('Failed to save account:', err);
      toast.error('Gagal menyimpan akun');
    }
  };

  const handleEdit = (account) => {
    setEditingAccount(account);
    setFormData({
      kode_akun: account.kode_akun || '',
      nama_akun: account.nama_akun || '',
      tipe_akun: account.tipe_akun || 'asset',
      saldo_normal: account.saldo_normal || 'debit',
      deskripsi: account.deskripsi || ''
    });
    setShowForm(true);
  };

  const handleDelete = (account) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Akun Keuangan',
      message: `Apakah Anda yakin ingin menghapus akun "${account.nama_akun}"?`,
      confirmText: 'Ya, Hapus',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteAccount(account.id_akun);
          toast.success('Akun berhasil dihapus');
          loadAccounts();
        } catch (err) {
          console.error('Failed to delete account:', err);
          toast.error('Gagal menghapus akun');
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const resetForm = () => {
    setFormData({
      kode_akun: '',
      nama_akun: '',
      tipe_akun: 'asset',
      saldo_normal: 'debit',
      deskripsi: ''
    });
  };

  const renderForm = () => {
    if (!showForm) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-xl max-w-md w-full">
          <h3 className="text-xl font-bold mb-4">
            {editingAccount ? 'Edit Akun' : 'Tambah Akun Baru'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Kode Akun</label>
              <input
                type="text"
                value={formData.kode_akun}
                onChange={(e) => setFormData(prev => ({ ...prev, kode_akun: e.target.value }))}
                className="w-full p-2 border rounded"
                required
                placeholder="Contoh: 1010"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Nama Akun</label>
              <input
                type="text"
                value={formData.nama_akun}
                onChange={(e) => setFormData(prev => ({ ...prev, nama_akun: e.target.value }))}
                className="w-full p-2 border rounded"
                required
                placeholder="Contoh: Kas Toko"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Tipe Akun</label>
              <select
                value={formData.tipe_akun}
                onChange={(e) => setFormData(prev => ({ ...prev, tipe_akun: e.target.value }))}
                className="w-full p-2 border rounded"
                required
              >
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="revenue">Revenue</option>
                <option value="expense">Expense</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Saldo Normal</label>
              <select
                value={formData.saldo_normal}
                onChange={(e) => setFormData(prev => ({ ...prev, saldo_normal: e.target.value }))}
                className="w-full p-2 border rounded"
                required
              >
                <option value="debit">Debit</option>
                <option value="kredit">Kredit</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Deskripsi</label>
              <textarea
                value={formData.deskripsi}
                onChange={(e) => setFormData(prev => ({ ...prev, deskripsi: e.target.value }))}
                className="w-full p-2 border rounded"
                rows={3}
                placeholder="Deskripsi akun (opsional)"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingAccount(null);
                  resetForm();
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                {editingAccount ? 'Update' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <PageLayout>
      <PageHeader title="Manajemen Akun Keuangan">
        <HeaderActionButton
          icon={Plus}
          label="Tambah Akun"
          onClick={() => setShowForm(true)}
        />
      </PageHeader>

      <PageContainer>
        <DataTable
          data={accounts}
          loading={loading}
          columns={[
            { key: 'kode_akun', header: 'Kode Akun' },
            { key: 'nama_akun', header: 'Nama Akun' },
            {
              key: 'tipe_akun',
              header: 'Tipe',
              render: (row) => (
                <span className={`px-2 py-1 rounded text-xs capitalize ${
                  row.tipe_akun === 'asset' ? 'bg-blue-100 text-blue-800' :
                  row.tipe_akun === 'liability' ? 'bg-red-100 text-red-800' :
                  row.tipe_akun === 'equity' ? 'bg-green-100 text-green-800' :
                  row.tipe_akun === 'revenue' ? 'bg-purple-100 text-purple-800' :
                  'bg-orange-100 text-orange-800'
                }`}>
                  {row.tipe_akun}
                </span>
              )
            },
            {
              key: 'saldo_normal',
              header: 'Saldo Normal',
              render: (row) => (
                <span className={`px-2 py-1 rounded text-xs ${
                  row.saldo_normal === 'debit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {row.saldo_normal === 'debit' ? 'Debit' : 'Kredit'}
                </span>
              )
            },
            { key: 'deskripsi', header: 'Deskripsi' },
            {
              key: 'actions',
              header: 'Aksi',
              render: (row) => (
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(row)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(row)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Hapus"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )
            }
          ]}
          searchKeys={['kode_akun', 'nama_akun', 'tipe_akun', 'deskripsi']}
        />

        {/* Form Modal */}
        {renderForm()}

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

export default AccountsPage;