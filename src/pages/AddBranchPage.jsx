import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addBranch, getBranchById, updateBranch } from '../services/api';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';

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
  <svg className="w-8 h-8 text-blue-600 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a10 10 0 0 1 0 20" />
  </svg>
);

const AddBranchPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [branch, setBranch] = useState({
    kode_cabang: '',
    nama_cabang: '',
    alamat: '',
    kota: '',
    no_telp: '',
    tipe_katalog: 'global',
    struk_header: '',
    struk_footer: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      const fetchBranch = async () => {
        try {
          setLoading(true);
          const response = await getBranchById(id);
          if (response.data && response.data.data) {
            setBranch(response.data.data);
          }
        } catch (err) {
          setError('Gagal memuat data cabang untuk diedit.');
          console.error('Failed to fetch branch:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchBranch();
    }
  }, [id, isEditMode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setBranch(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      setSubmitting(true);
      if (isEditMode) {
        await updateBranch(id, branch);
        setSuccess('Cabang berhasil diperbarui!');
      } else {
        await addBranch(branch);
        setSuccess('Cabang berhasil ditambahkan!');
      }
      setTimeout(() => navigate('/cabang'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || `Gagal ${isEditMode ? 'memperbarui' : 'menambahkan'} cabang.`);
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
              <p className="mt-3 text-slate-600">Memuat data cabang...</p>
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
          title={isEditMode ? 'Edit Cabang' : 'Tambah Cabang Baru'}
          subtitle={isEditMode ? 'Perbarui informasi cabang bisnis Anda' : 'Tambahkan cabang baru untuk memperluas jaringan bisnis'}
          actions={
            <Link
              to="/cabang"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold px-3 py-2 hover:bg-slate-100 transition"
            >
              <BackIcon className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Kembali</span>
            </Link>
          }
        />

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-6 space-y-5">
              {/* Kode Cabang */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Kode Cabang</label>
                <input
                  type="text"
                  name="kode_cabang"
                  value={branch.kode_cabang}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., CAB001"
                />
                <p className="mt-1 text-xs text-slate-500">Gunakan kode unik untuk identifikasi cabang</p>
              </div>

              {/* Nama Cabang */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nama Cabang</label>
                <input
                  type="text"
                  name="nama_cabang"
                  value={branch.nama_cabang}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Cabang Jakarta Pusat"
                />
                <p className="mt-1 text-xs text-slate-500">Nama lengkap cabang bisnis</p>
              </div>

              {/* Alamat */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Alamat</label>
                <input
                  type="text"
                  name="alamat"
                  value={branch.alamat}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Jalan Sudirman No. 123"
                />
                <p className="mt-1 text-xs text-slate-500">Alamat lengkap lokasi cabang</p>
              </div>

              {/* Kota */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Kota</label>
                <input
                  type="text"
                  name="kota"
                  value={branch.kota}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Jakarta"
                />
                <p className="mt-1 text-xs text-slate-500">Nama kota tersebut</p>
              </div>

              {/* No. Telepon */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">No. Telepon</label>
                <input
                  type="text"
                  name="no_telp"
                  value={branch.no_telp}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., +62-21-1234567"
                />
                <p className="mt-1 text-xs text-slate-500">Nomor telepon cabang (opsional)</p>
              </div>

              {/* Tipe Katalog */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Tipe Katalog</label>
                <select
                  name="tipe_katalog"
                  value={branch.tipe_katalog || 'global'}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="global">🌐 Global — Produk dibagikan dengan semua cabang</option>
                  <option value="terpisah">🏠 Terpisah — Produk dikelola sendiri oleh cabang ini</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  <strong>Global:</strong> Cabang menggunakan katalog produk yang sama dengan pusat.<br />
                  <strong>Terpisah:</strong> Cabang memiliki katalog produk sendiri yang terpisah.
                </p>
              </div>

              {/* Header Struk */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Header Struk</label>
                <input
                  type="text"
                  name="struk_header"
                  value={branch.struk_header}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Selamat Datang di Toko Kami"
                />
                <p className="mt-1 text-xs text-slate-500">Pesan yang muncul di atas struk penjualan</p>
              </div>

              {/* Footer Struk */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Footer Struk</label>
                <input
                  type="text"
                  name="struk_footer"
                  value={branch.struk_footer}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Terima Kasih Atas Kunjungannya"
                />
                <p className="mt-1 text-xs text-slate-500">Pesan yang muncul di bawah struk penjualan</p>
              </div>
            </div>

            {/* Form Actions */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex gap-3 justify-end">
              <Link
                to="/cabang"
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition"
              >
                Batal
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <LoadingSpinner />
                    <span className="ml-2">Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <SaveIcon className="w-4 h-4" />
                    <span className="hidden sm:inline ml-2">{isEditMode ? 'Perbarui Cabang' : 'Simpan Cabang'}</span>
                    <span className="sm:hidden ml-2">{isEditMode ? 'Perbarui' : 'Simpan'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </PageContainer>
    </PageLayout>
  );
};

export default AddBranchPage;