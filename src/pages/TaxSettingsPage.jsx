import React, { useState, useEffect } from 'react';
import { getPajak, addPajak, updatePajak, deletePajak } from '../services/api';
import { formatCurrency } from '../utils/formatHelper';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts/index.jsx';
import HeaderActionButton from '../components/HeaderActionButton';
import DataTable from '../components/DataTable';
import ActionButton from '../components/ActionButton';
import { Plus, Edit, Trash2 } from 'lucide-react';

const TaxSettingsPage = () => {
  const [taxSettings, setTaxSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTax, setEditingTax] = useState(null);
  const [formData, setFormData] = useState({
    nama_pajak: '',
    tipe_pajak: 'ppn',
    persentase: 0,
    nilai_tetap: 0,
    is_active: true,
    deskripsi: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchTaxSettings();
  }, []);

  const fetchTaxSettings = async () => {
    try {
      setLoading(true);
      const response = await getPajak();
      setTaxSettings(response.data || []);
    } catch (_err) {
      setError('Gagal memuat data pengaturan pajak');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTax) {
        await updatePajak(editingTax.id_pajak, formData);
        setSuccess('Pengaturan pajak berhasil diperbarui');
      } else {
        await addPajak(formData);
        setSuccess('Pengaturan pajak berhasil ditambahkan');
      }
      fetchTaxSettings();
      resetForm();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan data pengaturan pajak');
    }
  };

  const handleEdit = (tax) => {
    setEditingTax(tax);
    setFormData({
      nama_pajak: tax.nama_pajak,
      tipe_pajak: tax.tipe_pajak,
      persentase: tax.persentase || 0,
      nilai_tetap: tax.nilai_tetap || 0,
      is_active: tax.is_active,
      deskripsi: tax.deskripsi || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus pengaturan pajak ini?')) {
      try {
        await deletePajak(id);
        setSuccess('Pengaturan pajak berhasil dihapus');
        fetchTaxSettings();
      } catch {
        setError('Gagal menghapus pengaturan pajak');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      nama_pajak: '',
      tipe_pajak: 'ppn',
      persentase: 0,
      nilai_tetap: 0,
      is_active: true,
      deskripsi: ''
    });
    setEditingTax(null);
    setShowForm(false);
  };

  if (loading) return <div className="text-center mt-10">Memuat data pengaturan pajak...</div>;

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Manajemen Pajak & Biaya Tambahan"
          subtitle="Atur pajak dan biaya tambahan dengan antarmuka yang konsisten"
          actions={
            <HeaderActionButton
              icon={Plus}
              label="Tambah Pengaturan Pajak"
              variant="blue"
              onClick={() => setShowForm(true)}
              hideLabel={true}
            />
          }
        />

        <div className="space-y-6">

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}

      {/* Form Tambah/Edit */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6">
          <h2 className="text-xl font-semibold mb-4 text-slate-900">
            {editingTax ? 'Edit Pengaturan Pajak' : 'Tambah Pengaturan Pajak Baru'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 mb-2">Nama Pajak *</label>
              <input
                type="text"
                value={formData.nama_pajak}
                onChange={(e) => setFormData({...formData, nama_pajak: e.target.value})}
                className="w-full p-2 border rounded"
                required
                placeholder="PPN 11%"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Tipe Pajak</label>
              <select
                value={formData.tipe_pajak}
                onChange={(e) => setFormData({...formData, tipe_pajak: e.target.value})}
                className="w-full p-2 border rounded"
              >
                <option value="ppn">PPN (Persentase)</option>
                <option value="pph">PPH (Persentase)</option>
                <option value="service">Service Charge (Persentase)</option>
                <option value="fixed">Biaya Tetap (Nominal)</option>
              </select>
            </div>
            {formData.tipe_pajak !== 'fixed' && (
              <div>
                <label className="block text-gray-700 mb-2">Persentase (%)</label>
                <input
                  type="number"
                  value={formData.persentase}
                  onChange={(e) => setFormData({...formData, persentase: parseFloat(e.target.value) || 0})}
                  className="w-full p-2 border rounded"
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
            )}
            {formData.tipe_pajak === 'fixed' && (
              <div>
                <label className="block text-gray-700 mb-2">Nilai Tetap (Rp)</label>
                <input
                  type="number"
                  value={formData.nilai_tetap}
                  onChange={(e) => setFormData({...formData, nilai_tetap: parseFloat(e.target.value) || 0})}
                  className="w-full p-2 border rounded"
                  min="0"
                  step="1000"
                />
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-gray-700 mb-2">Deskripsi</label>
              <textarea
                value={formData.deskripsi}
                onChange={(e) => setFormData({...formData, deskripsi: e.target.value})}
                className="w-full p-2 border rounded"
                rows="3"
                placeholder="Deskripsi pengaturan pajak (opsional)"
              />
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="mr-2"
                />
                Aktif
              </label>
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
              >
                {editingTax ? 'Update' : 'Simpan'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center justify-center rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-300"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabel Pengaturan Pajak */}
      <DataTable
        data={taxSettings}
        loading={loading}
        showPagination={true}
        columns={[
          {
            key: 'nama_pajak',
            header: 'Nama Pajak',
            render: (tax) => tax.nama_pajak
          },
          {
            key: 'tipe_pajak',
            header: 'Tipe',
            render: (tax) => (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                tax.tipe_pajak === 'ppn' ? 'bg-blue-100 text-blue-800' :
                tax.tipe_pajak === 'pph' ? 'bg-emerald-100 text-emerald-800' :
                tax.tipe_pajak === 'service' ? 'bg-amber-100 text-amber-800' :
                'bg-purple-100 text-purple-800'
              }`}>
                {tax.tipe_pajak === 'ppn' ? 'PPN' :
                 tax.tipe_pajak === 'pph' ? 'PPH' :
                 tax.tipe_pajak === 'service' ? 'Service' :
                 'Tetap'}
              </span>
            )
          },
          {
            key: 'nilai',
            header: 'Nilai',
            render: (tax) => tax.tipe_pajak === 'fixed'
              ? formatCurrency(tax.nilai_tetap || 0)
              : `${tax.persentase || 0}%`
          },
          {
            key: 'deskripsi',
            header: 'Deskripsi',
            render: (tax) => tax.deskripsi || '-'
          },
          {
            key: 'status',
            header: 'Status',
            render: (tax) => (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                tax.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
              }`}>
                {tax.is_active ? 'Aktif' : 'Non-Aktif'}
              </span>
            )
          }
        ]}
        actions={[
          {
            icon: Edit,
            title: 'Edit',
            onClick: (tax) => handleEdit(tax),
            variant: 'primary',
            size: 'sm'
          },
          {
            icon: Trash2,
            title: 'Hapus',
            onClick: (tax) => handleDelete(tax.id_pajak),
            variant: 'danger',
            size: 'sm'
          }
        ]}
      />

      </div>
      </PageContainer>
    </PageLayout>
  );
};

export default TaxSettingsPage;