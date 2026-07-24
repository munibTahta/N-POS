import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getUserById, updateUser, createUser, getBranches } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import { useRoleContext } from '../context/RoleContext.jsx';
import { PermissionError } from '../components/PermissionGuard';
import LoadingPage from '../components/common/LoadingPage';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';

const UserFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canManageUsers } = usePermissions();
  const { getAvailableRoles } = useRoleContext();
  const isEditMode = !!id;

  const [userData, setUserData] = useState({
    nama_lengkap: '',
    username: '',
    password: '',
    role: '',
    id_cabang: '',
    printer_nama: '',
    printer_tipe: 'thermal',
  });
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const branchesRes = await getBranches();
        setBranches(branchesRes.data.data || []);

        if (isEditMode) {
          const userRes = await getUserById(id);
          const userDataResponse = userRes.data.data;
          const processedUserData = {
            ...userDataResponse,
            id_cabang: userDataResponse.id_cabang ? String(userDataResponse.id_cabang) : '',
          };
          setUserData(processedUserData);
        }
      } catch (_err) {
        setError(isEditMode ? 'Gagal memuat data pengguna.' : 'Gagal memuat data cabang.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isEditMode, id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!canManageUsers()) {
      setError('Anda tidak memiliki izin untuk mengelola pengguna.');
      return;
    }

    if (!isEditMode) {
      if (!userData.username?.trim() || !userData.password?.trim() || !userData.nama_lengkap?.trim() || !userData.role?.trim()) {
        setError('Username, password, nama lengkap, dan role harus diisi!');
        return;
      }
    } else if (!userData.nama_lengkap?.trim() || !userData.role?.trim()) {
      setError('Nama lengkap dan role harus diisi!');
      return;
    }

    try {
      if (isEditMode) {
        const { nama_lengkap, printer_nama, printer_tipe } = userData;
        const updateData = {
          nama_lengkap,
          printer_nama: printer_nama || null,
          printer_tipe: printer_tipe || 'thermal',
        };

        await updateUser(id, updateData);
        setSuccess('Data pengguna berhasil diperbarui! Catatan: role dan cabang hanya bisa diubah saat pembuatan user baru.');
      } else {
        const { nama_lengkap, username, password, role, id_cabang, printer_nama, printer_tipe } = userData;
        const createData = {
          nama_lengkap,
          username,
          password,
          role,
          id_cabang: id_cabang && id_cabang !== '' ? parseInt(id_cabang, 10) : null,
          printer_nama: printer_nama || null,
          printer_tipe: printer_tipe || 'thermal',
        };

        await createUser(createData);
        setSuccess('Pengguna baru berhasil ditambahkan!');
      }

      setTimeout(() => navigate('/pengguna'), 1500);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || `Gagal ${isEditMode ? 'memperbarui' : 'menambahkan'} data pengguna.`;
      setError(errorMessage);
    }
  };

  if (loading) {
    return <LoadingPage message="Memuat data pengguna..." subtitle="Mengambil data pengguna dan cabang" />;
  }

  return (
    <PermissionError permission="MANAGE_USERS">
      <PageLayout>
        <PageContainer className="space-y-6">
          <PageHeader
            title={isEditMode ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}
            subtitle={isEditMode ? 'Perbarui detail pengguna dengan catatan batasan role dan cabang.' : 'Buat akun pengguna baru untuk mengakses sistem.'}
            actions={
              <Link
                to="/pengguna"
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                &larr; Kembali ke Pengguna
              </Link>
            }
          />

          {isEditMode && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
              <p className="font-semibold">Pembatasan Edit Pengguna</p>
              <p className="mt-2 text-gray-700">Role dan cabang pengguna tidak dapat diubah setelah pembuatan. Jika perlu mengubah role atau cabang, buat ulang user baru.</p>
            </div>
          )}

          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div>}

          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">Username</label>
                <input
                  type="text"
                  name="username"
                  value={userData.username}
                  onChange={handleChange}
                  required
                  disabled={isEditMode}
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${isEditMode ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-white text-slate-900 border-slate-300'} focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100`}
                />
              </div>

              {!isEditMode && (
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={userData.password}
                      onChange={handleChange}
                      required
                      className="w-full pr-12 rounded-lg border px-3 py-2 text-sm bg-white text-slate-900 border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900 p-1 h-8 w-8 flex items-center justify-center bg-transparent focus:outline-none rounded"
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10a9.97 9.97 0 012.122-5.937M6.18 6.18A9.953 9.953 0 0112 5c5.523 0 10 4.477 10 10 0 1.036-.168 2.036-.48 2.94M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">Nama Lengkap</label>
                <input
                  type="text"
                  name="nama_lengkap"
                  value={userData.nama_lengkap}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900 border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Role {isEditMode && <span className="text-xs text-slate-500">(tidak dapat diubah)</span>}
                  </label>
                  <select
                    name="role"
                    value={userData.role}
                    onChange={handleChange}
                    disabled={isEditMode}
                    className={`w-full rounded-lg border px-3 py-2 text-sm ${isEditMode ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed' : 'bg-white text-slate-900 border-slate-300'} focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100`}
                  >
                    <option value="">Pilih Role</option>
                    {getAvailableRoles().map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Cabang {isEditMode && <span className="text-xs text-slate-500">(tidak dapat diubah)</span>}
                  </label>
                  <select
                    name="id_cabang"
                    value={userData.id_cabang || ''}
                    onChange={handleChange}
                    disabled={isEditMode}
                    className={`w-full rounded-lg border px-3 py-2 text-sm ${isEditMode ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed' : 'bg-white text-slate-900 border-slate-300'} focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100`}
                  >
                    <option value="">Tidak ada cabang</option>
                    {branches.map((branch) => (
                      <option key={branch.id_cabang} value={String(branch.id_cabang)}>
                        {branch.nama_cabang}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">Printer Nama</label>
                  <input
                    type="text"
                    name="printer_nama"
                    value={userData.printer_nama || ''}
                    onChange={handleChange}
                    className="w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900 border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Contoh: EPSON TM-T88V"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">Tipe Printer</label>
                  <select
                    name="printer_tipe"
                    value={userData.printer_tipe || 'thermal'}
                    onChange={handleChange}
                    className="w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900 border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="thermal">Thermal</option>
                    <option value="dot_matrix">Dot Matrix</option>
                    <option value="inkjet">Inkjet</option>
                    <option value="laser">Laser</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  {isEditMode ? 'Simpan Perubahan' : 'Tambah Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </PageContainer>
      </PageLayout>
    </PermissionError>
  );
};

export default UserFormPage;
