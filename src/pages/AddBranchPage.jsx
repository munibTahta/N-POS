import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Globe, Store } from 'lucide-react';
import { addBranch, getBranchById, updateBranch } from '../services/api';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import { FloatingLabelInput } from '../components/common/FloatingLabelField';
import { useNotifications } from '../hooks/useNotifications';

const AddBranchPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  const { success: showSuccess, error: showError } = useNotifications();

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
          showError('Gagal memuat data cabang untuk diedit.');
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
    try {
      setSubmitting(true);
      if (isEditMode) {
        await updateBranch(id, branch);
        showSuccess('Cabang berhasil diperbarui!');
      } else {
        await addBranch(branch);
        showSuccess('Cabang berhasil ditambahkan!');
      }
      setTimeout(() => navigate('/cabang'), 1500);
    } catch (err) {
      showError(err.response?.data?.message || `Gagal ${isEditMode ? 'memperbarui' : 'menambahkan'} cabang.`);
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
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
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
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Kembali</span>
            </Link>
          }
        />

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Informasi Dasar */}
            <div className="pb-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Informasi Dasar</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FloatingLabelInput
                  label="Kode Cabang"
                  name="kode_cabang"
                  value={branch.kode_cabang}
                  onChange={handleChange}
                  required
                  helper="Gunakan kode unik untuk identifikasi cabang"
                />

                <FloatingLabelInput
                  label="Nama Cabang"
                  name="nama_cabang"
                  value={branch.nama_cabang}
                  onChange={handleChange}
                  required
                  helper="Nama lengkap cabang bisnis"
                />

                <div className="sm:col-span-2">
                  <FloatingLabelInput
                    label="Alamat"
                    name="alamat"
                    value={branch.alamat}
                    onChange={handleChange}
                    required
                    helper="Alamat lengkap lokasi cabang"
                  />
                </div>

                <FloatingLabelInput
                  label="Kota"
                  name="kota"
                  value={branch.kota}
                  onChange={handleChange}
                  required
                  helper="Nama kota tersebut"
                />

                <FloatingLabelInput
                  label="No. Telepon"
                  name="no_telp"
                  value={branch.no_telp}
                  onChange={handleChange}
                  helper="Nomor telepon cabang (opsional)"
                />
              </div>
            </div>

            {/* Tipe Katalog */}
            <div className="pb-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Tipe Katalog</h2>
              <p className="text-xs text-slate-500 mb-4">Tentukan apakah cabang ini berbagi katalog produk dengan pusat atau mengelola katalognya sendiri</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBranch(prev => ({ ...prev, tipe_katalog: 'global' }))}
                  className={`flex items-start gap-3 text-left rounded-lg border p-4 transition ${
                    (branch.tipe_katalog || 'global') === 'global'
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <Globe className={`w-5 h-5 shrink-0 mt-0.5 ${(branch.tipe_katalog || 'global') === 'global' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">Global</span>
                    <span className="block text-xs text-slate-500 mt-0.5">Produk dibagikan dengan semua cabang</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBranch(prev => ({ ...prev, tipe_katalog: 'terpisah' }))}
                  className={`flex items-start gap-3 text-left rounded-lg border p-4 transition ${
                    branch.tipe_katalog === 'terpisah'
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <Store className={`w-5 h-5 shrink-0 mt-0.5 ${branch.tipe_katalog === 'terpisah' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">Terpisah</span>
                    <span className="block text-xs text-slate-500 mt-0.5">Produk dikelola sendiri oleh cabang ini</span>
                  </span>
                </button>
              </div>
            </div>

            {/* Struk */}
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Pengaturan Struk</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FloatingLabelInput
                  label="Header Struk"
                  name="struk_header"
                  value={branch.struk_header}
                  onChange={handleChange}
                  helper="Pesan yang muncul di atas struk penjualan"
                />

                <FloatingLabelInput
                  label="Footer Struk"
                  name="struk_footer"
                  value={branch.struk_footer}
                  onChange={handleChange}
                  helper="Pesan yang muncul di bawah struk penjualan"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="mt-6 pt-6 border-t border-slate-200 flex gap-3 justify-end">
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
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="ml-2">Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline ml-2">{isEditMode ? 'Perbarui Cabang' : 'Simpan Cabang'}</span>
                  <span className="sm:hidden ml-2">{isEditMode ? 'Perbarui' : 'Simpan'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </PageContainer>
    </PageLayout>
  );
};

export default AddBranchPage;
