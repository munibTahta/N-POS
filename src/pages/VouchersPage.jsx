import React, { useState, useEffect } from 'react';
import { getVouchers, addVoucher, updateVoucher, deleteVoucher } from '../services/api';
import { formatCurrency } from '../utils/formatHelper';
import LoadingPage from '../components/common/LoadingPage';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts/index.jsx';
import HeaderActionButton from '../components/HeaderActionButton';
import DataTable from '../components/DataTable';
import ActionButton from '../components/ActionButton';
import { Plus, Edit, Trash2 } from 'lucide-react';

const VouchersPage = () => {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [formData, setFormData] = useState({
    kode_voucher: '',
    nama_voucher: '',
    tipe_diskon: 'percentage',
    nilai_diskon: 0,
    minimum_pembelian: 0,
    maksimum_diskon: 0,
    tanggal_mulai: '',
    tanggal_berakhir: '',
    is_active: true,
    deskripsi: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const response = await getVouchers();
      // Defensive parsing: API may return either a top-level array
      // or an object like { success: true, data: [...] }
      const raw = response.data;
      const items = Array.isArray(raw) ? raw : (raw && raw.data) ? raw.data : [];

      // Normalize server fields to the client-side shape expected by this page
      const normalized = items.map(v => ({
        id_voucher: v.id_voucher ?? v.id ?? null,
        kode_voucher: v.kode_voucher || v.kode || '',
        nama_voucher: v.nama_voucher || v.nama || '',
        // Map server tipe values (e.g. 'persentase'|'nominal') to client ('percentage'|'fixed')
        tipe_diskon: v.tipe_diskon === 'persentase' ? 'percentage' : (v.tipe_diskon === 'nominal' ? 'fixed' : v.tipe_diskon),
        nilai_diskon: Number(v.nilai_diskon ?? v.value ?? 0),
        minimum_pembelian: Number(v.minimal_belanja ?? v.minimum_pembelian ?? 0),
        maksimum_diskon: Number(v.maksimal_diskon ?? v.maksimum_diskon ?? 0),
        tanggal_mulai: v.berlaku_dari ?? v.tanggal_mulai ?? null,
        tanggal_berakhir: v.berlaku_sampai ?? v.tanggal_berakhir ?? null,
        is_active: typeof v.aktif !== 'undefined' ? Boolean(v.aktif) : (typeof v.is_active !== 'undefined' ? Boolean(v.is_active) : true),
        deskripsi: v.deskripsi || ''
      }));

      setVouchers(normalized);
    } catch (_err) {
      setError('Gagal memuat data voucher');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Format dates for API
      const submitData = {
        ...formData,
        tanggal_mulai: formData.tanggal_mulai ? new Date(formData.tanggal_mulai).toISOString().split('T')[0] : null,
        tanggal_berakhir: formData.tanggal_berakhir ? new Date(formData.tanggal_berakhir).toISOString().split('T')[0] : null
      };

      if (editingVoucher) {
        await updateVoucher(editingVoucher.id_voucher, submitData);
        setSuccess('Voucher berhasil diperbarui');
      } else {
        await addVoucher(submitData);
        setSuccess('Voucher berhasil ditambahkan');
      }
      fetchVouchers();
      resetForm();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan data voucher');
    }
  };

  const handleEdit = (voucher) => {
    setEditingVoucher(voucher);
    setFormData({
      kode_voucher: voucher.kode_voucher,
      nama_voucher: voucher.nama_voucher,
      tipe_diskon: voucher.tipe_diskon,
      nilai_diskon: voucher.nilai_diskon,
      minimum_pembelian: voucher.minimum_pembelian || 0,
      maksimum_diskon: voucher.maksimum_diskon || 0,
      tanggal_mulai: voucher.tanggal_mulai ? voucher.tanggal_mulai.split('T')[0] : '',
      tanggal_berakhir: voucher.tanggal_berakhir ? voucher.tanggal_berakhir.split('T')[0] : '',
      is_active: voucher.is_active,
      deskripsi: voucher.deskripsi || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus voucher ini?')) {
      try {
        await deleteVoucher(id);
        setSuccess('Voucher berhasil dihapus');
        fetchVouchers();
      } catch {
        setError('Gagal menghapus voucher');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      kode_voucher: '',
      nama_voucher: '',
      tipe_diskon: 'percentage',
      nilai_diskon: 0,
      minimum_pembelian: 0,
      maksimum_diskon: 0,
      tanggal_mulai: '',
      tanggal_berakhir: '',
      is_active: true,
      deskripsi: ''
    });
    setEditingVoucher(null);
    setShowForm(false);
  };

  const getStatusBadge = (voucher) => {
    const now = new Date();
    const startDate = voucher.tanggal_mulai ? new Date(voucher.tanggal_mulai) : null;
    const endDate = voucher.tanggal_berakhir ? new Date(voucher.tanggal_berakhir) : null;

    if (!voucher.is_active) {
      return <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">Non-Aktif</span>;
    }

    if (startDate && now < startDate) {
      return <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">Belum Dimulai</span>;
    }

    if (endDate && now > endDate) {
      return <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">Kadaluarsa</span>;
    }

    return <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">Aktif</span>;
  };

  if (loading) return <LoadingPage message="Memuat data voucher..." />;

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Manajemen Voucher & Diskon"
          subtitle="Kelola kode voucher dan diskon promosi dengan tampilan konsisten"
          actions={
            <HeaderActionButton
              icon={Plus}
              label="Tambah Voucher"
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
            {editingVoucher ? 'Edit Voucher' : 'Tambah Voucher Baru'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 mb-2">Kode Voucher *</label>
              <input
                type="text"
                value={formData.kode_voucher}
                onChange={(e) => setFormData({...formData, kode_voucher: e.target.value.toUpperCase()})}
                className="w-full p-2 border rounded"
                required
                placeholder="VOUCHER2024"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Nama Voucher *</label>
              <input
                type="text"
                value={formData.nama_voucher}
                onChange={(e) => setFormData({...formData, nama_voucher: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Tipe Diskon</label>
              <select
                value={formData.tipe_diskon}
                onChange={(e) => setFormData({...formData, tipe_diskon: e.target.value})}
                className="w-full p-2 border rounded"
              >
                <option value="percentage">Persentase (%)</option>
                <option value="fixed">Nominal (Rp)</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-700 mb-2">
                Nilai Diskon {formData.tipe_diskon === 'percentage' ? '(%)' : '(Rp)'} *
              </label>
              <input
                type="number"
                value={formData.nilai_diskon}
                onChange={(e) => setFormData({...formData, nilai_diskon: parseFloat(e.target.value) || 0})}
                className="w-full p-2 border rounded"
                min="0"
                step={formData.tipe_diskon === 'percentage' ? '0.01' : '1000'}
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Minimum Pembelian (Rp)</label>
              <input
                type="number"
                value={formData.minimum_pembelian}
                onChange={(e) => setFormData({...formData, minimum_pembelian: parseFloat(e.target.value) || 0})}
                className="w-full p-2 border rounded"
                min="0"
                step="1000"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Maksimum Diskon (Rp)</label>
              <input
                type="number"
                value={formData.maksimum_diskon}
                onChange={(e) => setFormData({...formData, maksimum_diskon: parseFloat(e.target.value) || 0})}
                className="w-full p-2 border rounded"
                min="0"
                step="1000"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Tanggal Mulai</label>
              <input
                type="date"
                value={formData.tanggal_mulai}
                onChange={(e) => setFormData({...formData, tanggal_mulai: e.target.value})}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Tanggal Berakhir</label>
              <input
                type="date"
                value={formData.tanggal_berakhir}
                onChange={(e) => setFormData({...formData, tanggal_berakhir: e.target.value})}
                className="w-full p-2 border rounded"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-gray-700 mb-2">Deskripsi</label>
              <textarea
                value={formData.deskripsi}
                onChange={(e) => setFormData({...formData, deskripsi: e.target.value})}
                className="w-full p-2 border rounded"
                rows="3"
                placeholder="Deskripsi voucher (opsional)"
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
                {editingVoucher ? 'Update' : 'Simpan'}
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

      {/* Tabel Voucher */}
      <DataTable
        data={vouchers}
        loading={loading}
        showPagination={true}
        columns={[
          {
            key: 'kode_voucher',
            header: 'Kode',
            render: (voucher) => voucher.kode_voucher
          },
          {
            key: 'nama_voucher',
            header: 'Nama',
            render: (voucher) => voucher.nama_voucher
          },
          {
            key: 'diskon',
            header: 'Diskon',
            render: (voucher) => (
              <div>
                {voucher.tipe_diskon === 'percentage'
                  ? `${voucher.nilai_diskon}%`
                  : formatCurrency(voucher.nilai_diskon)
                }
                {voucher.maksimum_diskon > 0 && voucher.tipe_diskon === 'percentage' && (
                  <div className="text-xs text-slate-500">
                    Max: {formatCurrency(voucher.maksimum_diskon)}
                  </div>
                )}
              </div>
            )
          },
          {
            key: 'minimum_pembelian',
            header: 'Min. Pembelian',
            render: (voucher) => voucher.minimum_pembelian > 0 ? formatCurrency(voucher.minimum_pembelian) : '-'
          },
          {
            key: 'berlaku',
            header: 'Berlaku',
            render: (voucher) => {
              if (voucher.tanggal_mulai && voucher.tanggal_berakhir) {
                return (
                  <div>
                    {new Date(voucher.tanggal_mulai).toLocaleDateString('id-ID')}
                    <br />
                    s/d {new Date(voucher.tanggal_berakhir).toLocaleDateString('id-ID')}
                  </div>
                );
              }
              return 'Selamanya';
            }
          },
          {
            key: 'status',
            header: 'Status',
            render: (voucher) => getStatusBadge(voucher)
          }
        ]}
        actions={[
          {
            icon: Edit,
            title: 'Edit',
            onClick: (voucher) => handleEdit(voucher),
            variant: 'primary',
            size: 'sm'
          },
          {
            icon: Trash2,
            title: 'Hapus',
            onClick: (voucher) => handleDelete(voucher.id_voucher),
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

export default VouchersPage;