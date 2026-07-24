import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getUnitById, addUnit, updateUnit } from '../services/api';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts/index.jsx';
import { useNotifications } from '../hooks/useNotifications';

// SVG Icons
const BackIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const SaveIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a10 10 0 0 1 0 20" />
  </svg>
);

const UnitFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success: showSuccess, error: showError } = useNotifications();
  const isEditMode = !!id;

  const [unit, setUnit] = useState({
    nama_satuan: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      const fetchUnit = async () => {
        try {
          const response = await getUnitById(id);
          setUnit(response.data.data);
        } catch {
          setError('Gagal memuat data satuan.');
        } finally {
          setLoading(false);
        }
      };
      fetchUnit();
    }
  }, [id, isEditMode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUnit(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      if (isEditMode) {
        await updateUnit(id, unit);
        showSuccess('Satuan berhasil diperbarui!');
      } else {
        await addUnit(unit);
        showSuccess('Satuan berhasil ditambahkan!');
      }
      setTimeout(() => navigate('/satuan'), 1500);
    } catch (err) {
      const errorMsg = err.response?.data?.message || `Gagal ${isEditMode ? 'memperbarui' : 'menambahkan'} satuan.`;
      showError(errorMsg);
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <PageContainer>
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="inline-block">
                <LoadingSpinner />
              </div>
              <p className="mt-3 text-slate-600">Memuat data satuan...</p>
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
          title={isEditMode ? 'Edit Satuan' : 'Tambah Satuan Baru'}
          subtitle={isEditMode ? 'Ubah data satuan produk sesuai kebutuhan.' : 'Tambahkan satuan ukuran baru untuk produk.'}
          actions={
            <Link
              to="/satuan"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold px-3 py-2 hover:bg-slate-50 transition"
              title="Kembali ke Manajemen Satuan"
            >
              <BackIcon className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Kembali</span>
            </Link>
          }
        />

        <div className="max-w-2xl mx-auto mt-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Alert */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            )}

            {/* Success Alert */}
            {success && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                <p className="text-sm font-medium text-emerald-800">{success}</p>
              </div>
            )}

            {/* Form Section */}
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Nama Satuan</label>
                <p className="text-sm text-slate-600 mb-3">Contoh: Pcs, Kilo, Liter, Box, Karton, dll.</p>
                <input
                  type="text"
                  name="nama_satuan"
                  value={unit.nama_satuan}
                  onChange={handleChange}
                  placeholder="Masukkan nama satuan..."
                  required
                  disabled={submitting}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <Link
                to="/satuan"
                className="px-6 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition"
              >
                Batal
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <LoadingSpinner />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <SaveIcon className="w-4 h-4" />
                    {isEditMode ? 'Simpan Perubahan' : 'Simpan Satuan'}
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

export default UnitFormPage;