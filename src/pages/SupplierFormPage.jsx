import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getSupplierById, addSupplier, updateSupplier } from '../services/api';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts/index.jsx';
import { useNotifications } from '../hooks/useNotifications';
import LoadingPage from '../components/common/LoadingPage';

const BackIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const SaveIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const SupplierFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);
  const { success: showSuccess, error: showError } = useNotifications();

  const [supplier, setSupplier] = useState({
    nama_supplier: '',
    kontak: '',
    alamat: '',
  });
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    if (!isEditMode) return;

    const fetchSupplier = async () => {
      try {
        const response = await getSupplierById(id);
        setSupplier(response.data.data);
      } catch (err) {
        setPageError('Gagal memuat data supplier.');
        console.error('Error loading supplier:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSupplier();
  }, [id, isEditMode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSupplier((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPageError('');
    setSubmitting(true);

    try {
      if (isEditMode) {
        await updateSupplier(id, supplier);
        showSuccess('Supplier berhasil diperbarui.');
      } else {
        await addSupplier(supplier);
        showSuccess('Supplier berhasil ditambahkan.');
      }
      setTimeout(() => navigate('/supplier'), 1200);
    } catch (err) {
      const message = err.response?.data?.message || `Gagal ${isEditMode ? 'memperbarui' : 'menambahkan'} supplier.`;
      setPageError(message);
      showError(message);
      console.error('Supplier save error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingPage message="Memuat data supplier..." />;

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title={isEditMode ? 'Edit Supplier' : 'Tambah Supplier Baru'}
          subtitle="Lengkapi informasi supplier dengan benar untuk manajemen yang lebih rapi"
          actions={
            <Link to="/supplier" className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition">
              <BackIcon className="w-4 h-4" />
              Kembali
            </Link>
          }
        />

        <div className="space-y-6">
          {pageError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              {pageError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nama Supplier *</label>
                <input
                  type="text"
                  name="nama_supplier"
                  value={supplier.nama_supplier}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Kontak (No. Telp / Email)</label>
                <input
                  type="text"
                  name="kontak"
                  value={supplier.kontak}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Alamat</label>
              <textarea
                name="alamat"
                value={supplier.alamat}
                onChange={handleChange}
                rows="4"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-4">
              <Link
                to="/supplier"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              >
                Batal
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                    Menyimpan...
                  </span>
                ) : (
                  <>
                    <SaveIcon className="w-4 h-4" />
                    {isEditMode ? 'Simpan Perubahan' : 'Simpan Supplier'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </PageContainer>
    </PageLayout>
  );
};

export default SupplierFormPage;
