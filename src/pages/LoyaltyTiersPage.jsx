import React, { useState, useEffect, useCallback } from 'react';
import { getLoyaltyTiers, addLoyaltyTier, updateLoyaltyTier, deleteLoyaltyTier } from '../services/api';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts/index.jsx';
import { SearchFilterBar } from '../components/SearchFilterBar';
import HeaderActionButton from '../components/HeaderActionButton';
import ActionButton from '../components/ActionButton';
import DataTable from '../components/DataTable';
import useSearchAndFilter from '../hooks/useSearchAndFilter';
import { useNotifications } from '../hooks/useNotifications';
import { Plus, Edit, Trash2 } from 'lucide-react';

const LoadingSpinner = () => (
  <div className="flex justify-center py-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
  </div>
);

const LoyaltyTiersPage = () => {
  const { success: showSuccess, error: showError } = useNotifications();
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nama_tier: '',
    poin_min: 0,
    poin_max: 0,
    diskon_persen: 0,
    bonus_poin_persen: 0,
    benefit: '',
    aktif: true,
  });

  // Fetch tiers - define before useEffect
  const fetchTiers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getLoyaltyTiers();
      // Defensive parsing: accept either top-level array or { success, data: [...] }
      const resData = response?.data;
      let tiersData = [];
      if (Array.isArray(resData)) tiersData = resData;
      else if (resData && Array.isArray(resData.data)) tiersData = resData.data;
      else tiersData = [];
      setTiers(tiersData);
    } catch (err) {
      showError(`Gagal memuat loyalty tiers: ${err.message}`);
      console.error('Error fetching loyalty tiers:', err);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name.includes('poin') || name.includes('persen') ? parseFloat(value) || 0 : value),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validasi
    if (!formData.nama_tier.trim()) {
      showError('Nama tier harus diisi');
      return;
    }
    if (formData.poin_min < 0) {
      showError('Poin minimum tidak boleh negatif');
      return;
    }
    if (formData.poin_max < formData.poin_min) {
      showError('Poin maksimum harus lebih besar atau sama dengan poin minimum');
      return;
    }
    if (formData.diskon_persen < 0 || formData.diskon_persen > 100) {
      showError('Diskon persen harus antara 0-100');
      return;
    }

    setSubmitting(true);
    try {
      const submitData = { ...formData };
      if (submitData.benefit) {
        try {
          submitData.benefit = JSON.parse(submitData.benefit);
        } catch (_e) {
          showError('Benefit harus berupa JSON yang valid');
          setSubmitting(false);
          return;
        }
      } else {
        delete submitData.benefit;
      }

      if (editingId) {
        await updateLoyaltyTier(editingId, submitData);
        showSuccess('Loyalty tier berhasil diperbarui');
        setEditingId(null);
      } else {
        await addLoyaltyTier(submitData);
        showSuccess('Loyalty tier berhasil ditambahkan');
      }
      resetForm();
      fetchTiers();
    } catch (err) {
      showError(`Gagal menyimpan loyalty tier: ${err.message}`);
      console.error('Error saving loyalty tier:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (tier) => {
    setEditingId(tier.id_tier);
    setFormData({
      nama_tier: tier.nama_tier,
      poin_min: tier.poin_min,
      poin_max: tier.poin_max,
      diskon_persen: tier.diskon_persen,
      bonus_poin_persen: tier.bonus_poin_persen,
      benefit: tier.benefit ? JSON.stringify(tier.benefit) : '',
      aktif: tier.aktif,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus tier ini?')) {
      return;
    }

    try {
      await deleteLoyaltyTier(id);
      showSuccess('Loyalty tier berhasil dihapus');
      fetchTiers();
    } catch (err) {
      showError(`Gagal menghapus loyalty tier: ${err.message}`);
      console.error('Error deleting loyalty tier:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      nama_tier: '',
      poin_min: 0,
      poin_max: 0,
      diskon_persen: 0,
      bonus_poin_persen: 0,
      benefit: '',
      aktif: true,
    });
    setShowModal(false);
    setEditingId(null);
  };

  // Search and filter
  const { filteredItems: filteredTiers } = useSearchAndFilter(tiers, {
    searchTerm: searchQuery,
    searchKeys: ['nama_tier', 'benefit'],
    debounceDelay: 300,
  });

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Manajemen Loyalty Tiers"
          subtitle="Kelola tier loyalitas pelanggan dan benefit yang tersedia"
          actions={
            <HeaderActionButton
              icon={Plus}
              label="Tambah Tier"
              variant="blue"
              onClick={() => setShowModal(true)}
              hideLabel={true}
            />
          }
        />

        <div className="space-y-6">
          {/* Stats Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div>
              <p className="text-sm font-medium text-slate-600">Total Loyalty Tiers</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{tiers.length}</p>
            </div>
          </div>

          {/* Search and Filter */}
          <SearchFilterBar
            searchTerm={searchQuery}
            onSearchChange={setSearchQuery}
            onClearSearch={() => setSearchQuery('')}
            searchPlaceholder="Cari berdasarkan nama tier atau benefit..."
            hasActiveFilters={false}
          />

          {/* Loading */}
          {loading && <LoadingSpinner />}

          {/* Tiers Table */}
          {!loading && (
            <DataTable
              data={filteredTiers}
              loading={loading}
              showPagination={true}
              columns={[
                {
                  key: 'nama_tier',
                  header: 'Nama Tier',
                  render: (tier) => tier.nama_tier
                },
                {
                  key: 'poin_range',
                  header: 'Poin Range',
                  render: (tier) => `${tier.poin_min.toLocaleString()} - ${tier.poin_max.toLocaleString()}`
                },
                {
                  key: 'diskon_persen',
                  header: 'Diskon %',
                  render: (tier) => `${tier.diskon_persen}%`
                },
                {
                  key: 'bonus_poin_persen',
                  header: 'Bonus Poin %',
                  render: (tier) => `${tier.bonus_poin_persen}%`
                },
                {
                  key: 'aktif',
                  header: 'Status',
                  render: (tier) => (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      tier.aktif
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      {tier.aktif ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                  )
                }
              ]}
              actions={[
                {
                  icon: Edit,
                  title: 'Edit',
                  onClick: (tier) => handleEdit(tier),
                  variant: 'primary',
                  size: 'sm'
                },
                {
                  icon: Trash2,
                  title: 'Hapus',
                  onClick: (tier) => handleDelete(tier.id_tier),
                  variant: 'danger',
                  size: 'sm'
                }
              ]}
            />
          )}
        </div>
      </PageContainer>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? 'Edit Loyalty Tier' : 'Tambah Loyalty Tier Baru'}
              </h2>
              <button
                onClick={resetForm}
                className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Nama Tier *
                  </label>
                  <input
                    type="text"
                    name="nama_tier"
                    value={formData.nama_tier}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Contoh: Silver, Gold, Platinum"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Poin Minimum *
                  </label>
                  <input
                    type="number"
                    name="poin_min"
                    value={formData.poin_min}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Poin Maksimum *
                  </label>
                  <input
                    type="number"
                    name="poin_max"
                    value={formData.poin_max}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Diskon Persen (%) *
                  </label>
                  <input
                    type="number"
                    name="diskon_persen"
                    value={formData.diskon_persen}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Bonus Poin Persen (%) *
                  </label>
                  <input
                    type="number"
                    name="bonus_poin_persen"
                    value={formData.bonus_poin_persen}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Benefit (JSON)
                  </label>
                  <textarea
                    name="benefit"
                    value={formData.benefit}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder='{"free_shipping": true, "priority_support": false}'
                    rows="3"
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
                    <span className="ml-2 text-sm text-slate-700">Aktif</span>
                  </label>
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg font-medium transition flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <SaveIcon className="w-4 h-4" />
                    {editingId ? 'Perbarui' : 'Simpan'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default LoyaltyTiersPage;
