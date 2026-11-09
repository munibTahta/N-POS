import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Store, AlertCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSync } from '../context/SyncContext';
import { FloatingLabelInput } from '../components/common/FloatingLabelField';
import safeStorage from '../utils/safeStorage';

const REMEMBER_KEY = 'rememberedUsername';

const LoginPage = () => {
  // "Ingat saya" hanya menyimpan username (tidak pernah password).
  const [username, setUsername] = useState(() => safeStorage.getItem(REMEMBER_KEY) || '');
  const [remember, setRemember] = useState(() => !!safeStorage.getItem(REMEMBER_KEY));
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
      if (remember && username.trim()) safeStorage.setItem(REMEMBER_KEY, username.trim());
      else safeStorage.removeItem(REMEMBER_KEY);
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
        errorMessage = responseData?.message || responseData?.error || "Username atau password salah.";
        if (err.response.status === 429) {
          // Pembatas laju server: beri tahu berapa lama harus menunggu (header Retry-After, detik)
          const secs = Number(err.response.headers?.['retry-after']);
          if (Number.isFinite(secs) && secs > 0) {
            errorMessage = `${errorMessage} Coba lagi dalam ${secs >= 90 ? `${Math.ceil(secs / 60)} menit` : `${Math.ceil(secs)} detik`}.`;
          }
        }
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
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gray-50 dark:bg-zinc-950">
      <main className="w-full max-w-md">
        <div className="card card-elevated p-6 sm:p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
              <Store className="h-7 w-7" aria-hidden="true" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100">Masuk ke N-POS</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">Gunakan akun kasir atau admin Anda.</p>
          </div>

          {error && (
            <div
              role="alert"
              className={`mb-5 flex items-start gap-3 rounded-xl p-3 text-sm ${isDuplicateLogin ? 'bg-yellow-50 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-200' : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200'}`}
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">{error}</p>
                {isDuplicateLogin && (
                  <p className="mt-1 opacity-80">
                    Silakan logout terlebih dahulu dari device lain atau tunggu session expire.
                  </p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
            <FloatingLabelInput
              ref={usernameRef}
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Username"
            />
            <FloatingLabelInput
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              autoComplete="current-password"
              aria-label="Password"
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  aria-pressed={showPassword}
                  className="btn-icon !min-h-0 h-9 w-9 text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800 focus-visible:ring-blue-500"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                </button>
              }
            />

            <div className="flex items-center justify-between gap-3 text-sm">
              <label className="inline-flex min-h-[44px] items-center gap-2 cursor-pointer select-none text-gray-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Ingat username</span>
              </label>
              <span
                className={`inline-flex items-center gap-1.5 text-xs ${isOnline ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}
                role="status"
              >
                {isOnline ? <Wifi className="h-4 w-4" aria-hidden="true" /> : <WifiOff className="h-4 w-4" aria-hidden="true" />}
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            <button type="submit" disabled={isLoading} aria-busy={isLoading} className="btn-primary btn-lg btn-block">
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  Memproses...
                </>
              ) : (
                'Masuk'
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;