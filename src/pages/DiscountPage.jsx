import React, { useState, useEffect } from 'react';
import { getDiscounts, addDiscount, updateDiscount, deleteDiscount } from '../services/api';
import { formatCurrency } from '../utils/formatHelper';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts/index.jsx';
import HeaderActionButton from '../components/HeaderActionButton';
import DataTable from '../components/DataTable';
import ActionButton from '../components/ActionButton';
import { Plus, Edit, Trash2 } from 'lucide-react';

const DiscountPage = () => {
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nama_diskon: '',
    tipe: 'persentase',
    nilai: 0,
    berlaku_dari: '',
    berlaku_sampai: '',
    aktif: true,
  });

  // Fetch discounts
  useEffect(() => {
    fetchDiscounts();
  }, []);

  const fetchDiscounts = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getDiscounts();
      const discountsData = response.data.data || [];
      setDiscounts(Array.isArray(discountsData) ? discountsData : []);
    } catch (err) {
      setError(`Gagal memuat diskon: ${err.message}`);
      console.error('Error fetching discounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'nilai' ? parseFloat(value) || 0 : value),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validasi
    if (!formData.nama_diskon.trim()) {
      setError('Nama diskon harus diisi');
      return;
    }
    if (formData.nilai <= 0) {
      setError('Nilai diskon harus lebih dari 0');
      return;
    }
    if (formData.tipe === 'persentase' && (formData.nilai > 100)) {
      setError('Diskon persentase tidak boleh lebih dari 100%');
      return;
    }
    if (formData.berlaku_dari && formData.berlaku_sampai) {
      if (new Date(formData.berlaku_dari) > new Date(formData.berlaku_sampai)) {
        setError('Tanggal mulai tidak boleh lebih besar dari tanggal akhir');
        return;
      }
    }

    try {
      const submitData = {
        nama_diskon: formData.nama_diskon,
        tipe: formData.tipe,
        nilai: formData.nilai,
        aktif: formData.aktif,
        ...(formData.berlaku_dari && { berlaku_dari: formData.berlaku_dari }),
        ...(formData.berlaku_sampai && { berlaku_sampai: formData.berlaku_sampai }),
      };

      if (editingId) {
        await updateDiscount(editingId, submitData);
        setSuccess('Diskon berhasil diperbarui');
        setEditingId(null);
      } else {
        await addDiscount(submitData);
        setSuccess('Diskon berhasil ditambahkan');
      }
      resetForm();
      fetchDiscounts();
    } catch (err) {
      setError(`Gagal menyimpan diskon: ${err.message}`);
      console.error('Error saving discount:', err);
    }
  };

  const handleEdit = (discount) => {
    setEditingId(discount.id_diskon);
    setFormData({
      nama_diskon: discount.nama_diskon,
      tipe: discount.tipe,
      nilai: discount.nilai,
      berlaku_dari: discount.berlaku_dari ? discount.berlaku_dari.split('T')[0] : '',
      berlaku_sampai: discount.berlaku_sampai ? discount.berlaku_sampai.split('T')[0] : '',
      aktif: discount.aktif,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus diskon ini?')) {
      return;
    }

    try {
      await deleteDiscount(id);
      setSuccess('Diskon berhasil dihapus');
      fetchDiscounts();
    } catch (err) {
      setError(`Gagal menghapus diskon: ${err.message}`);
      console.error('Error deleting discount:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      nama_diskon: '',
      tipe: 'persentase',
      nilai: 0,
      berlaku_dari: '',
      berlaku_sampai: '',
      aktif: true,
    });
    setShowForm(false);
    setEditingId(null);
  };

  const formatDiscountValue = (type, value) => {
    return type === 'persentase' ? `${value}%` : formatCurrency(value);
  };

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Manajemen Diskon"
          subtitle="Kelola diskon produk dan promo dengan tampilan yang konsisten"
          actions={
            <HeaderActionButton
              icon={Plus}
              label={showForm ? "Batal" : "Tambah Diskon Baru"}
              variant={showForm ? "slate" : "blue"}
              onClick={() => (showForm ? resetForm() : setShowForm(true))}
              hideLabel={true}
            />
          }
        />

        <div className="space-y-6">

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">
              {editingId ? 'Edit Diskon' : 'Tambah Diskon Baru'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Diskon *
                  </label>
                  <input
                    type="text"
                    name="nama_diskon"
                    value={formData.nama_diskon}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Contoh: Flash Sale, Member Baru"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipe Diskon *
                  </label>
                  <select
                    name="tipe"
                    value={formData.tipe}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="persentase">Persentase (%)</option>
                    <option value="nominal">Nominal (Rp)</option>
                    <option value="buy_x_get_y">Beli X Gratis Y</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nilai Diskon *
                  </label>
                  <input
                    type="number"
                    name="nilai"
                    value={formData.nilai}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Berlaku Dari
                  </label>
                  <input
                    type="date"
                    name="berlaku_dari"
                    value={formData.berlaku_dari}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Berlaku Sampai
                  </label>
                  <input
                    type="date"
                    name="berlaku_sampai"
                    value={formData.berlaku_sampai}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="aktif"
                      checked={formData.aktif}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Aktif</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 inline-flex justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  {editingId ? 'Perbarui' : 'Simpan'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 inline-flex justify-center rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-300"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-2">Memuat data...</p>
          </div>
        )}

        {/* Discounts List */}
        {!loading && (
          <DataTable
            data={discounts}
            loading={loading}
            showPagination={true}
            columns={[
              {
                key: 'nama_diskon',
                header: 'Nama Diskon',
                render: (discount) => discount.nama_diskon
              },
              {
                key: 'tipe',
                header: 'Tipe',
                render: (discount) => (
                  <span className="capitalize">
                    {discount.tipe === 'buy_x_get_y' ? 'Beli X Gratis Y' : discount.tipe}
                  </span>
                )
              },
              {
                key: 'nilai',
                header: 'Nilai',
                render: (discount) => formatDiscountValue(discount.tipe, discount.nilai)
              },
              {
                key: 'periode',
                header: 'Periode',
                render: (discount) => {
                  if (discount.berlaku_dari || discount.berlaku_sampai) {
                    return (
                      <div>
                        {discount.berlaku_dari && <div>{new Date(discount.berlaku_dari).toLocaleDateString('id-ID')}</div>}
                        {discount.berlaku_sampai && <div>s/d {new Date(discount.berlaku_sampai).toLocaleDateString('id-ID')}</div>}
                      </div>
                    );
                  }
                  return 'Tidak terbatas';
                }
              },
              {
                key: 'aktif',
                header: 'Status',
                render: (discount) => (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    discount.aktif
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-800'
                  }`}>
                    {discount.aktif ? 'Aktif' : 'Tidak Aktif'}
                  </span>
                )
              }
            ]}
            actions={[
              {
                icon: Edit,
                title: 'Edit',
                onClick: (discount) => handleEdit(discount),
                variant: 'primary',
                size: 'sm'
              },
              {
                icon: Trash2,
                title: 'Hapus',
                onClick: (discount) => handleDelete(discount.id_diskon),
                variant: 'danger',
                size: 'sm'
              }
            ]}
          />
        )}

        {/* Empty State */}
        {!loading && discounts.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600">Belum ada diskon. Tambahkan diskon baru untuk memulai.</p>
          </div>
        )}
        </div>
      </PageContainer>
    </PageLayout>
  );
};

export default DiscountPage;
