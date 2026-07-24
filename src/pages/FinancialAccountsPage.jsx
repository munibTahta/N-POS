import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import HeaderActionButton from '../components/HeaderActionButton';
import DataTable from '../components/DataTable';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import { getFinancialAccounts, createFinancialAccount, updateFinancialAccount, deleteFinancialAccount, getBranches } from '../services/api';
import { extractArray, extractData } from '../utils/apiResponseHelper';
import { toast } from 'react-toastify';

const FinancialAccountsPage = () => {
  const [accounts, setAccounts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    nama_rekening: '',
    tipe_rekening: 'kas',
    saldo_awal: 0,
    id_cabang: '',
    deskripsi: '',
    aktif: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accountsRes, branchesRes] = await Promise.all([
        getFinancialAccounts(),
        getBranches()
      ]);
      setAccounts(extractArray(accountsRes));
      setBranches(extractArray(branchesRes));
    } catch (err) {
      console.error('Failed to load data:', err);
      toast.error('Gagal memuat data rekening');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const submitData = {
        ...formData,
        saldo_awal: Number(formData.saldo_awal),
        id_cabang: formData.id_cabang || null // Convert empty string to null for central warehouse
      };

      if (editingAccount) {
        await updateFinancialAccount(editingAccount.id_rekening, submitData);
        toast.success('Rekening berhasil diperbarui');
      } else {
        await createFinancialAccount(submitData);
        toast.success('Rekening berhasil dibuat');
      }

      setShowForm(false);
      setEditingAccount(null);
      resetForm();
      loadData();
    } catch (err) {
      console.error('Failed to save account:', err);
      toast.error('Gagal menyimpan rekening');
    }
  };

  const handleEdit = (account) => {
    setEditingAccount(account);
    setFormData({
      nama_rekening: account.nama_rekening || '',
      tipe_rekening: account.tipe_rekening || 'kas',
      saldo_awal: account.saldo_awal || 0,
      id_cabang: account.id_cabang || '',
      deskripsi: account.deskripsi || '',
      aktif: account.aktif !== false
    });
    setShowForm(true);
  };

  const handleDelete = async (account) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus rekening "${account.nama_rekening}"?`)) {
      return;
    }

    try {
      await deleteFinancialAccount(account.id_rekening);
      toast.success('Rekening berhasil dihapus');
      loadData();
    } catch (err) {
      console.error('Failed to delete account:', err);
      toast.error('Gagal menghapus rekening');
    }
  };

  const resetForm = () => {
    setFormData({
      nama_rekening: '',
      tipe_rekening: 'kas',
      saldo_awal: 0,
      id_cabang: '',
      deskripsi: '',
      aktif: true
    });
  };

  const filteredAccounts = accounts.filter(account =>
    account.nama_rekening?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.tipe_rekening?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const renderForm = () => {
    if (!showForm) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-xl max-w-md w-full">
          <h3 className="text-xl font-bold mb-4">
            {editingAccount ? 'Edit Rekening' : 'Tambah Rekening Baru'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nama Rekening</label>
              <input
                type="text"
                value={formData.nama_rekening}
                onChange={(e) => setFormData(prev => ({ ...prev, nama_rekening: e.target.value }))}
                className="w-full p-2 border rounded"
                required
                placeholder="Contoh: Kas Toko SYAHREE"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Tipe Rekening</label>
              <select
                value={formData.tipe_rekening}
                onChange={(e) => setFormData(prev => ({ ...prev, tipe_rekening: e.target.value }))}
                className="w-full p-2 border rounded"
                required
              >
                <option value="kas">Kas</option>
                <option value="bank">Bank</option>
                <option value="piutang">Piutang</option>
                <option value="hutang">Hutang</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Saldo Awal</label>
              <input
                type="number"
                value={formData.saldo_awal}
                onChange={(e) => setFormData(prev => ({ ...prev, saldo_awal: Number(e.target.value) }))}
                className="w-full p-2 border rounded"
                min="0"
                step="0.01"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Cabang</label>
              <select
                value={formData.id_cabang}
                onChange={(e) => setFormData(prev => ({ ...prev, id_cabang: e.target.value }))}
                className="w-full p-2 border rounded"
              >
                <option value="">Pusat (Gudang)</option>
                {branches.map(branch => (
                  <option key={branch.id_cabang} value={branch.id_cabang}>
                    {branch.nama_cabang}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Deskripsi</label>
              <textarea
                value={formData.deskripsi}
                onChange={(e) => setFormData(prev => ({ ...prev, deskripsi: e.target.value }))}
                className="w-full p-2 border rounded"
                rows={3}
                placeholder="Deskripsi rekening (opsional)"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="aktif"
                checked={formData.aktif}
                onChange={(e) => setFormData(prev => ({ ...prev, aktif: e.target.checked }))}
                className="mr-2"
              />
              <label htmlFor="aktif" className="text-sm font-medium">Aktif</label>
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
      <PageContainer>
        <PageHeader title="Manajemen Rekening Keuangan">
          <HeaderActionButton
            icon={Plus}
            label="Tambah Rekening"
            onClick={() => setShowForm(true)}
          />
        </PageHeader>

        {/* Search */}
        <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Cari rekening..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <DataTable
            data={filteredAccounts}
            loading={loading}
            columns={[
              { key: 'nama_rekening', header: 'Nama Rekening' },
              {
                key: 'tipe_rekening',
                header: 'Tipe',
                render: (row) => (
                  <span className={`px-2 py-1 rounded text-xs capitalize ${
                    row.tipe_rekening === 'kas' ? 'bg-green-100 text-green-800' :
                    row.tipe_rekening === 'bank' ? 'bg-blue-100 text-blue-800' :
                    row.tipe_rekening === 'piutang' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {row.tipe_rekening}
                  </span>
                )
              },
              {
                key: 'saldo_awal',
                header: 'Saldo Awal',
                render: (row) => formatCurrency(row.saldo_awal)
              },
              {
                key: 'id_cabang',
                header: 'Cabang',
                render: (row) => {
                  if (!row.id_cabang) return 'Pusat';
                  const branch = branches.find(b => b.id_cabang === row.id_cabang);
                  return branch?.nama_cabang || 'Unknown';
                }
              },
              { key: 'deskripsi', header: 'Deskripsi' },
              {
                key: 'aktif',
                header: 'Status',
                render: (row) => (
                  <span className={`px-2 py-1 rounded text-xs ${
                    row.aktif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {row.aktif ? 'Aktif' : 'Non-aktif'}
                  </span>
                )
              },
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
            searchKeys={['nama_rekening', 'tipe_rekening', 'deskripsi']}
          />
        </div>

        {/* Form Modal */}
        {renderForm()}
      </PageContainer>
    </PageLayout>
  );
};

export default FinancialAccountsPage;