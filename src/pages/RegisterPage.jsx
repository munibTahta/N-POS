import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    nama_lengkap: '',
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const { nama_lengkap, username, password } = formData;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!nama_lengkap || !username || !password) {
      setError("Semua field wajib diisi.");
      return;
    }
    try {
      await register({ nama_lengkap, username, password });
      navigate('/'); // Arahkan ke halaman menu setelah berhasil registrasi
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Registrasi gagal. Coba lagi.";
      setError(errorMessage);
    }
  };

  return (
    <div className="flex justify-center items-center mt-10">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center">Register</h2>
        {error && <p className="text-red-500 text-center bg-red-100 p-2 rounded">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium">Nama Lengkap</label>
            <input type="text" name="nama_lengkap" value={nama_lengkap} onChange={handleChange} required
              className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring focus:ring-blue-200" />
          </div>
          <div>
            <label className="block text-sm font-medium">Username</label>
            <input type="text" name="username" value={username} onChange={handleChange} required
              className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring focus:ring-blue-200" />
          </div>
          <div>
            <label className="block text-sm font-medium">Password</label>
            <div className="mt-1 relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={handleChange}
                required
                className="w-full pr-12 px-3 py-2 border rounded-md focus:outline-none focus:ring focus:ring-blue-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900 p-1 h-9 w-9 flex items-center justify-center bg-transparent focus:outline-none rounded"
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
          <button type="submit"
            className="w-full px-4 py-2 font-bold text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            Register
          </button>
          <div className="text-center mt-4">
            <p className="text-sm">
              Sudah punya akun? <Link to="/login" className="font-medium text-blue-600 hover:underline">Login di sini</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;