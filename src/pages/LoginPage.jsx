import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSync } from '../context/SyncContext';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isDuplicateLogin, setIsDuplicateLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { isOnline } = useSync();
  const usernameRef = useRef(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsDuplicateLogin(false);
    setIsLoading(true);

    try {
      await login({ username, password });
      navigate('/', { replace: true }); // Selalu arahkan ke menu
    } catch (err) {
      setIsLoading(false);
      // Error handler yang lebih baik
      let errorMessage = "Terjadi kesalahan pada server. Coba lagi nanti.";

      // Check for duplicate login error
      if (err.message?.includes('sudah login di device lain')) {
        setIsDuplicateLogin(true);
        errorMessage = err.message;
      } else if (err.response) {
        // Server merespons dengan status error (4xx, 5xx)
        const responseData = err.response.data;
        errorMessage = responseData.message || responseData.error || "Username atau password salah.";
      } else if (err.request) {
        // Request dikirim tapi tidak ada respons (masalah jaringan atau DevTools blocking)
        if (!navigator.onLine) {
          errorMessage = "Tidak ada koneksi internet. Aplikasi akan berjalan dalam mode offline.";
        } else {
          errorMessage = "Tidak dapat terhubung ke server. Periksa koneksi internet atau DevTools Anda.";
        }
      } else {
        // Error lainnya
        errorMessage = err.message || "Terjadi kesalahan yang tidak diketahui.";
      }

      setError(errorMessage);
    }
  };

  useEffect(() => {
    // Autofocus username on mount
    usernameRef.current?.focus();
  }, []);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center">Login</h2>
        {error && (
          <div className={`p-3 rounded text-center ${isDuplicateLogin ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-500'}`}>
            <p className="font-semibold">{error}</p>
            {isDuplicateLogin && (
              <p className="text-sm mt-2 opacity-80">
                Silakan logout terlebih dahulu dari device lain atau tunggu session expire.
              </p>
            )}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium">Username</label>
            <input 
              ref={usernameRef}
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              disabled={isLoading}
              required
              autoComplete="username"
              aria-label="username"
              className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring focus:ring-blue-200 disabled:bg-gray-100" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Password</label>
            <div className="mt-1 relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                autoComplete="current-password"
                aria-label="password"
                className="w-full pr-12 px-3 py-2 border rounded-md focus:outline-none focus:ring focus:ring-blue-200 disabled:bg-gray-100"
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
          <div className="flex items-center justify-between text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className="form-checkbox" />
              <span>Remember me</span>
            </label>
            <div className="text-gray-500">{isOnline ? 'Online' : 'Offline'}</div>
          </div>
          <button 
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 font-bold text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                Loading...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;