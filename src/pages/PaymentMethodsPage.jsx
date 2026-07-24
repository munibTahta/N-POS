import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Edit2, Trash2, Star } from 'lucide-react';
import { toast } from 'react-toastify';
import { addMetodePembayaran, updateMetodePembayaran, deleteMetodePembayaran, setDefaultPaymentMethod } from '../services/api';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import HeaderActionButton from '../components/HeaderActionButton';
import DataTable from '../components/DataTable';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts/index.jsx';

const PaymentMethodsPage = () => {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [formData, setFormData] = useState({
    kode_metode: '',
    nama_metode: '',
    tipe_metode: 'tunai',
    aktif: true,
    konfigurasi: null,
    is_default: false,
    urutan_tampil: 0,
    biaya_tambahan_persen: 0,
    biaya_tambahan_nominal: 0,
    minimum_transaksi: 0,
    maksimum_transaksi: ''
  });

  // Payment method cache hook
  const { fetchPaymentMethods: fetchFromCache, isFromCache } = usePaymentMethods();

  const fetchPaymentMethodsData = useCallback(async () => {
    try {
      setLoading(true);
      // Use cache-aware fetch
      const raw = await fetchFromCache();
      const methods = raw.map(m => ({
        ...m,
        id: m.id_metode || m.id_metode_pembayaran || m.id || null,
        id_metode_pembayaran: m.id_metode || m.id_metode_pembayaran || m.id || null
      }));

      // Sort by urutan_tampil (ascending), then by nama_metode as fallback
      const sortedMethods = methods.sort((a, b) => {
        const aUrutan = a.urutan_tampil || 0;
        const bUrutan = b.urutan_tampil || 0;

        if (aUrutan !== bUrutan) {
          return aUrutan - bUrutan;
        }

        // If urutan_tampil is the same, sort by nama_metode
        return (a.nama_metode || '').localeCompare(b.nama_metode || '');
      });

      setPaymentMethods(sortedMethods);
      if (isFromCache) {
        if (import.meta.env.DEV) void 0 && ('Payment methods loaded from cache');
      }
    } catch (_err) {
      toast.error('Gagal memuat data metode pembayaran');
      console.error('Error fetching payment methods:', _err);
    } finally {
      setLoading(false);
    }
  }, [fetchFromCache, isFromCache]);

  useEffect(() => {
    fetchPaymentMethodsData();
  }, [fetchPaymentMethodsData]);

  const fetchPaymentMethods = async () => {
    // Use the new cache-aware fetch function
    await fetchPaymentMethodsData();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Prepare data for API - convert maksimum_transaksi from string to number/null
      const submitData = {
        ...formData,
        maksimum_transaksi: formData.maksimum_transaksi === '' ? null : parseFloat(formData.maksimum_transaksi),
        urutan_tampil: parseInt(formData.urutan_tampil) || 0,
        biaya_tambahan_persen: parseFloat(formData.biaya_tambahan_persen) || 0,
        biaya_tambahan_nominal: parseFloat(formData.biaya_tambahan_nominal) || 0,
        minimum_transaksi: parseFloat(formData.minimum_transaksi) || 0
      };

      const methodId = editingMethod?.id_metode_pembayaran || editingMethod?.id_metode || editingMethod?.id;
      if (editingMethod) {
        const response = await updateMetodePembayaran(methodId, submitData);
        const updatedMethod = response.data?.data || response.data;
        
        // Optimistic update with shifting to avoid duplicate positions
        setPaymentMethods(prev => {
          const currentId = methodId;
          const updatedId = updatedMethod.id_metode || updatedMethod.id_metode_pembayaran || updatedMethod.id || currentId;

          // Build list of other methods (exclude the updated one)
          const others = prev.filter(m => (m.id_metode_pembayaran || m.id_metode || m.id) !== currentId).map(m => ({ ...m }));

          // Determine target position (1-based)
          let targetPos = parseInt(updatedMethod.urutan_tampil) || 1;
          if (targetPos < 1) targetPos = 1;
          if (targetPos > others.length + 1) targetPos = others.length + 1;

          // Insert updated method data into the desired position
          const updatedEntry = {
            ...updatedMethod,
            id: updatedId,
            id_metode_pembayaran: updatedId
          };

          const newList = [...others];
          newList.splice(targetPos - 1, 0, updatedEntry);

          // Reassign sequential urutan_tampil to avoid duplicates
          const reassigned = newList.map((m, idx) => ({
            ...m,
            urutan_tampil: idx + 1
          }));

          // Sort by urutan_tampil and return
          return reassigned.sort((a, b) => (a.urutan_tampil || 0) - (b.urutan_tampil || 0));
        });
        
        toast.success('Metode pembayaran berhasil diperbarui');
      } else {
        await addMetodePembayaran(submitData);
        toast.success('Metode pembayaran berhasil ditambahkan');
        fetchPaymentMethods(); // Fetch for new item
      }
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan data metode pembayaran');
      console.error('Error saving payment method:', err);
    }
  };

  const handleEdit = (method) => {
    setEditingMethod(method);
    setFormData({
      kode_metode: method.kode_metode || '',
      nama_metode: method.nama_metode,
      tipe_metode: method.tipe_metode,
      aktif: method.aktif,
      konfigurasi: method.konfigurasi || null,
      is_default: method.is_default || false,
      urutan_tampil: method.urutan_tampil || 1,
      biaya_tambahan_persen: method.biaya_tambahan_persen || 0,
      biaya_tambahan_nominal: method.biaya_tambahan_nominal || 0,
      minimum_transaksi: method.minimum_transaksi || 0,
      maksimum_transaksi: method.maksimum_transaksi || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus metode pembayaran ini?')) {
      try {
        await deleteMetodePembayaran(id);
        toast.success('Metode pembayaran berhasil dihapus');
        fetchPaymentMethods();
      } catch {
        toast.error('Gagal menghapus metode pembayaran');
      }
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await setDefaultPaymentMethod(id);
      toast.success('Metode pembayaran default berhasil diubah');
      fetchPaymentMethods();
    } catch {
      toast.error('Gagal mengubah metode pembayaran default');
    }
  };

  const resetForm = () => {
    setFormData({
      kode_metode: '',
      nama_metode: '',
      tipe_metode: 'tunai',
      aktif: true,
      konfigurasi: null,
      is_default: false,
      urutan_tampil: paymentMethods.length + 1 || 1,
      biaya_tambahan_persen: 0,
      biaya_tambahan_nominal: 0,
      minimum_transaksi: 0,
      maksimum_transaksi: ''
    });
    setEditingMethod(null);
    setShowForm(false);
  };

  if (loading) return <div className="text-center mt-10">Memuat data metode pembayaran...</div>;

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Manajemen Metode Pembayaran"
          subtitle="Atur metode pembayaran dan biaya tambahan dengan konsistensi UI"
          actions={
            <>
              <HeaderActionButton
                icon={Plus}
                label="Tambah Metode"
                onClick={() => setShowForm(true)}
                variant="blue"
              />
              <HeaderActionButton
                icon={RefreshCw}
                label="Refresh"
                onClick={fetchPaymentMethods}
                variant="secondary"
              />
            </>
          }
        />

        <div className="space-y-6">

      {/* Form Tambah/Edit */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6">
          <h2 className="text-xl font-semibold mb-4 text-slate-900">
            {editingMethod ? 'Edit Metode Pembayaran' : 'Tambah Metode Pembayaran Baru'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 mb-2">Kode Metode *</label>
              <input
                type="text"
                value={formData.kode_metode}
                onChange={(e) => setFormData({...formData, kode_metode: e.target.value})}
                className="w-full p-2 border rounded"
                required
                placeholder="Contoh: TUNAI, DEBIT, QRIS"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Nama Metode *</label>
              <input
                type="text"
                value={formData.nama_metode}
                onChange={(e) => setFormData({...formData, nama_metode: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Tipe Metode</label>
              <select
                value={formData.tipe_metode}
                onChange={(e) => setFormData({...formData, tipe_metode: e.target.value})}
                className="w-full p-2 border rounded"
              >
                <option value="tunai">Tunai</option>
                <option value="kartu">Kartu</option>
                <option value="ewallet">E-Wallet</option>
                <option value="qris">QRIS</option>
                <option value="transfer_bank">Transfer Bank</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Urutan Tampil</label>
              <select
                value={formData.urutan_tampil}
                onChange={(e) => setFormData({...formData, urutan_tampil: parseInt(e.target.value) || 1})}
                className="w-full p-2 border rounded"
              >
                {(() => {
                  const max = editingMethod ? paymentMethods.length : paymentMethods.length + 1;
                  const opts = [];
                  for (let i = 1; i <= Math.max(1, max); i++) {
                    opts.push(
                      <option key={i} value={i}>
                        {`Posisi ${i}${i <= paymentMethods.length ? ' (akan menggeser)' : ''}`}
                      </option>
                    );
                  }
                  return opts;
                })()}
              </select>
              <p className="text-xs text-gray-500 mt-1">Pilih posisi; posisi terpilih akan menggeser metode lainnya.</p>
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Biaya Tambahan (%)</label>
              <input
                type="number"
                value={formData.biaya_tambahan_persen}
                onChange={(e) => setFormData({...formData, biaya_tambahan_persen: parseFloat(e.target.value) || 0})}
                className="w-full p-2 border rounded"
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Biaya Tambahan (Nominal)</label>
              <input
                type="number"
                value={formData.biaya_tambahan_nominal}
                onChange={(e) => setFormData({...formData, biaya_tambahan_nominal: parseFloat(e.target.value) || 0})}
                className="w-full p-2 border rounded"
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Minimum Transaksi</label>
              <input
                type="number"
                value={formData.minimum_transaksi}
                onChange={(e) => setFormData({...formData, minimum_transaksi: parseFloat(e.target.value) || 0})}
                className="w-full p-2 border rounded"
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Maksimum Transaksi</label>
              <input
                type="number"
                value={formData.maksimum_transaksi}
                onChange={(e) => setFormData({...formData, maksimum_transaksi: e.target.value})}
                className="w-full p-2 border rounded"
                step="0.01"
                min="0"
                placeholder="Opsional"
              />
            </div>
            <div className="md:col-span-2 flex gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.aktif}
                  onChange={(e) => setFormData({...formData, aktif: e.target.checked})}
                  className="mr-2"
                />
                Aktif
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({...formData, is_default: e.target.checked})}
                  className="mr-2"
                  disabled={editingMethod && formData.is_default} // Disable jika sudah default
                />
                Default
              </label>
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
              >
                {editingMethod ? 'Update' : 'Simpan'}
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

      {/* Tabel Metode Pembayaran */}
      <DataTable
        data={paymentMethods}
        columns={[
          {
            key: 'kode_metode',
            header: 'Kode',
            width: '12%',
            render: (item) => <span className="font-medium">{item.kode_metode}</span>
          },
          {
            key: 'nama_metode',
            header: 'Nama Metode',
            width: '20%',
            render: (item) => <span className="font-medium">{item.nama_metode}</span>
          },
          {
            key: 'tipe_metode',
            header: 'Tipe',
            width: '15%',
            render: (item) => (
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                item.tipe_metode === 'tunai' ? 'bg-green-100 text-green-800' :
                item.tipe_metode === 'kartu' ? 'bg-blue-100 text-blue-800' :
                item.tipe_metode === 'ewallet' ? 'bg-orange-100 text-orange-800' :
                item.tipe_metode === 'qris' ? 'bg-pink-100 text-pink-800' :
                'bg-indigo-100 text-indigo-800'
              }`}>
                {item.tipe_metode === 'tunai' ? 'Tunai' :
                 item.tipe_metode === 'kartu' ? 'Kartu' :
                 item.tipe_metode === 'ewallet' ? 'E-Wallet' :
                 item.tipe_metode === 'qris' ? 'QRIS' :
                 'Transfer Bank'}
              </span>
            )
          },
          {
            key: 'is_default',
            header: 'Default',
            width: '15%',
            render: (item) => (
              item.is_default ? (
                <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800 flex items-center gap-1 w-fit">
                  <Star className="w-3 h-3 fill-yellow-800" />
                  Default
                </span>
              ) : (
                <button
                  onClick={() => handleSetDefault(item.id_metode_pembayaran || item.id_metode || item.id)}
                  className="bg-yellow-500 text-white px-2 py-1 rounded text-xs font-medium hover:bg-yellow-600"
                >
                  Set Default
                </button>
              )
            )
          },
          {
            key: 'aktif',
            header: 'Status',
            width: '12%',
            render: (item) => (
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                item.aktif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {item.aktif ? 'Aktif' : 'Non-Aktif'}
              </span>
            )
          },
          {
            key: 'urutan_tampil',
            header: 'Urutan',
            width: '10%',
            render: (item) => <span className="text-center">{item.urutan_tampil || 0}</span>
          }
        ]}
        actions={[
          {
            label: 'Edit',
            icon: Edit2,
            onClick: (item) => handleEdit(item),
            variant: 'blue'
          },
          {
            label: 'Hapus',
            icon: Trash2,
            onClick: (item) => handleDelete(item.id_metode_pembayaran || item.id_metode || item.id),
            variant: 'red'
          }
        ]}
        emptyMessage="Belum ada data metode pembayaran"
      />

      </div>
      </PageContainer>
    </PageLayout>
  );
};

export default PaymentMethodsPage;