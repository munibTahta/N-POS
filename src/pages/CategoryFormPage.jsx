import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getCategoryById, addCategory, updateCategory } from '../services/api';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';

const BackIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const SaveIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <path d="M17 21v-8H7v8" />
    <path d="M7 3v5h8" />
  </svg>
);

const CategoryFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [category, setCategory] = useState({
    nama_kategori: '',
    deskripsi: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      const fetchCategory = async () => {
        try {
          const response = await getCategoryById(id);
          setCategory(response.data.data);
        } catch (err) {
          setError('Gagal memuat data kategori.');
          console.error('Failed to fetch category:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchCategory();
    }
  }, [id, isEditMode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCategory((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!category.nama_kategori.trim()) {
      setError('Nama kategori tidak boleh kosong');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditMode) {
        await updateCategory(id, category);
        setSuccess('Kategori berhasil diperbarui!');
      } else {
        await addCategory(category);
        setSuccess('Kategori berhasil ditambahkan!');
      }
      setTimeout(() => navigate('/kategori'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || `Gagal ${isEditMode ? 'memperbarui' : 'menambahkan'} kategori.`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <PageContainer>
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            <p className="ml-3 text-slate-600">Memuat data kategori...</p>
          </div>
        </PageContainer>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title={isEditMode ? 'Edit Kategori' : 'Tambah Kategori Baru'}
          subtitle={isEditMode ? 'Perbarui informasi kategori produk' : 'Buat kategori produk baru untuk organisir inventaris'}
          actions={
            <Link
              to="/kategori"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <BackIcon className="w-4 h-4" />
              <span>Kembali</span>
            </Link>
          }
        />

        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="nama_kategori" className="block text-sm font-semibold text-slate-700 mb-2">
                  Nama Kategori
                </label>
                <input
                  id="nama_kategori"
                  type="text"
                  name="nama_kategori"
                  value={category.nama_kategori}
                  onChange={handleChange}
                  placeholder="Contoh: Minuman, Makanan, Elektronik"
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-slate-500">Berikan nama kategori yang deskriptif dan mudah diingat</p>
              </div>

              <div>
                <label htmlFor="deskripsi" className="block text-sm font-semibold text-slate-700 mb-2">
                  Deskripsi (Opsional)
                </label>
                <textarea
                  id="deskripsi"
                  name="deskripsi"
                  value={category.deskripsi || ''}
                  onChange={handleChange}
                  placeholder="Deskripsi singkat kategori ini (misal: Minuman segar tanpa alkohol)"
                  rows="4"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-slate-500">Jelaskan maksud kategori ini agar pengguna lebih paham</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting || loading}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  <SaveIcon className="w-4 h-4 mr-2" />
                  {submitting ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : 'Simpan Kategori'}
                </button>
                <Link
                  to="/kategori"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Batal
                </Link>
              </div>
            </form>
          </div>
        </div>
      </PageContainer>
    </PageLayout>
  );
};

export default CategoryFormPage;