import React, { useState, useEffect, useCallback } from 'react';
import { login as apiLogin, getUserById, apiClient } from '../services/api';
import SessionAuthManager from '../services/SessionAuthManager';
import { AuthContext } from './AuthContext.js';
import { jwtDecode } from 'jwt-decode';
import safeStorage from '../utils/safeStorage';

export const AuthProvider = ({ children }) => {
  // Initialize user dari localStorage jika ada (untuk restore session)
  const storedUser = safeStorage.getItem('user');
  const initialUser = storedUser ? (() => {
    try {
      const parsed = JSON.parse(storedUser);
      // Normalize saat restore dari localStorage
      return {
        ...parsed,
        nama_lengkap: parsed.nama_lengkap || parsed.nama || 'Unknown'
      };
    } catch (e) {
      console.error('Error parsing user from localStorage:', e);
      return null;
    }
  })() : null;

  const [user, setUser] = useState(initialUser);
  const [token, setToken] = useState(safeStorage.getItem('authToken'));
  const [loading, setLoading] = useState(true);

  // Definisikan logout di sini, sebelum useEffect
  const logout = useCallback(async () => {
    // Get token and session ID
    const token = safeStorage.getItem('authToken');
    const sessionId = safeStorage.getItem('session_id');
    // First: Record logout di database via API
    if (token && sessionId) {
      try {
        await apiClient.post('/session/logout', {}, {
          headers: {
            'Authorization': `Bearer ${token}`
            // X-Session-Id removed for CORS optimization per API v1.5.7
            // Bearer token sufficient to identify the session
          }
        });
      } catch (logoutError) {
        // Log error tapi tetap lanjut dengan local logout
        console.warn('⚠️ Session logout API failed:', logoutError.message || logoutError);
      }
    } else {
      // No remote session to log out from; proceed with local cleanup
    }

    // Second: Clear all local storage with error handling
    safeStorage.removeItem('authToken');
    safeStorage.removeItem('user');
    safeStorage.removeItem('session_id');
    safeStorage.removeItem('apiCache');
    try {
      sessionStorage.clear();
    } catch (e) {
      console.warn('Failed to clear sessionStorage:', e);
    }
    
    // Third: Clear API headers
    delete apiClient.defaults.headers.common['Authorization'];
    delete apiClient.defaults.headers.common['X-Session-Id'];
    
    // Fourth: Update state
    setToken(null);
    setUser(null);
  }, []);

  // Fungsi untuk refresh data user
  const refreshUser = useCallback(async () => {
    if (!token) return;
    
    try {
      // Decode token untuk mendapatkan ID pengguna
      const decodedToken = jwtDecode(token);
      const userId = decodedToken.id || decodedToken.userId || decodedToken.sub;
      
      if (!userId) {
        throw new Error('Token tidak mengandung ID pengguna yang valid');
      }
      
      // Panggil API untuk mendapatkan data user TERBARU
      const userDetailsResponse = await getUserById(userId);
      const completeUserData = userDetailsResponse.data.data;

      // Normalize user data for consistency and ensure role normalization
      const normalizedUserData = {
        ...completeUserData,
        nama_lengkap: completeUserData.nama_lengkap || completeUserData.nama || 'Unknown',
        role: (completeUserData.role || completeUserData.nama_role || '')?.toString().toLowerCase(),
        role_display: completeUserData.nama_role || completeUserData.role || ''
      };

      // Save and set verified user data
      safeStorage.setJSON('user', normalizedUserData);
      setUser(normalizedUserData);
    } catch (error) {
      console.error("Gagal refresh data user:", error);
    }
  }, [token]);

  useEffect(() => {
    // listen for global logout events triggered by axios interceptors
    const handleGlobalLogout = () => {
      logout();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('logout', handleGlobalLogout);
    }

    // Create AbortController untuk cancel ongoing requests jika component unmount
    const abortController = new AbortController();
    
    const validateToken = async () => {
      if (token) {
        try {
          // 1. Set header otentikasi
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // 2. Decode token untuk mendapatkan ID pengguna
          const decodedToken = jwtDecode(token);
          
          // 3. Cari ID user dari berbagai kemungkinan property JWT payload
          const userId = decodedToken.id || decodedToken.userId || decodedToken.sub;
          
          if (!userId) {
            throw new Error('Token tidak mengandung ID pengguna yang valid');
          }
          
          // 4. Check if user data already exists in localStorage (from session login)
          const storedUser = safeStorage.getItem('user');
          if (storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                setLoading(false);
                return;
              } catch (_e) {
                // Failed to parse cached user; ignore and continue to fetch
                console.warn('Failed to parse cached user session during validation', _e);
              }
          }
          
          // 5. If no stored user, fetch from API
          const userDetailsResponse = await getUserById(userId);
          const completeUserData = userDetailsResponse.data.data;

          // Normalize user data for consistency and ensure role normalization
          const normalizedUserData = {
            ...completeUserData,
            nama_lengkap: completeUserData.nama_lengkap || completeUserData.nama || 'Unknown',
            role: (completeUserData.role || completeUserData.nama_role || '')?.toString().toLowerCase(),
            role_display: completeUserData.nama_role || completeUserData.role || ''
          };

          // 6. Save and set verified user data (only if not aborted)
          if (!abortController.signal.aborted) {
            safeStorage.setJSON('user', normalizedUserData);
            setUser(normalizedUserData);
          }
        } catch (error) {
          // Handle offline case gracefully - use cached session
          if (!navigator.onLine) {
            const storedUser = safeStorage.getItem('user');
            if (storedUser) {
              try {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                if (!abortController.signal.aborted) {
                  setLoading(false);
                }
                return;
              } catch (parseError) {
                console.error('Error parsing cached user:', parseError);
              }
            }
          }
          
          // Only log error if not aborted
          if (error.name !== 'AbortError') {
            console.error("Token tidak valid atau gagal mengambil data user:", error);
            logout();
          }
        }
      }
      
      // Only set loading to false if not aborted
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    };

    validateToken();
    
    // Cleanup: abort ongoing requests jika component unmount atau token berubah
    return () => {
      abortController.abort();
      if (typeof window !== 'undefined') {
        window.removeEventListener('logout', handleGlobalLogout);
      }
    };
  }, [token, logout]);

  const login = useCallback(async (credentials) => {
    try {
      // Initialize SessionAuthManager
      const auth = new SessionAuthManager(import.meta.env.VITE_API_BASE_URL);
      
      // Try session login (new system)
      try {
        const sessionResponse = await auth.login(credentials.username, credentials.password);
        
        // Set both old and new auth tokens for backward compatibility
        const token = sessionResponse.token;
        const sessionId = sessionResponse.session_id;
        const completeUserData = sessionResponse.user;

        // Normalize user data
        const normalizedUserData = {
          ...completeUserData,
          nama_lengkap: completeUserData.nama_lengkap || completeUserData.nama || 'Unknown',
          role: (completeUserData.role || completeUserData.nama_role || '')?.toString().toLowerCase(),
          role_display: completeUserData.nama_role || completeUserData.role || ''
        };

        // Store in localStorage
        safeStorage.setItem('authToken', token);
        safeStorage.setItem('session_id', sessionId);
        safeStorage.setJSON('user', normalizedUserData);

        // Update state
        setToken(token);
        setUser(normalizedUserData);

        // Set headers for API client
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        // X-Session-Id removed for CORS optimization per API v1.5.7 - Bearer token sufficient
        return;
      } catch (sessionError) {
        // Check if it's a 409 Conflict (duplicate login)
        if (sessionError.response?.status === 409) {
          // Hanya satu login aktif per user - tampilkan error dan minta logout
          throw new Error('❌ Anda sudah login di device lain.\n\nSilakan logout terlebih dahulu dari device lain, kemudian coba login kembali.');
        }

        // Fallback to old login system
        try {
          const response = await apiLogin(credentials);
          const responseData = response.data.data;
          const { token } = responseData;
          
          // Extract user object from response (API returns nested structure: { token, user: {...} })
          const completeUserData = responseData.user || responseData;

          // Normalize user data
          const normalizedUserData = {
            ...completeUserData,
            nama_lengkap: completeUserData.nama_lengkap || completeUserData.nama || 'Unknown',
            role: (completeUserData.role || completeUserData.nama_role || '')?.toString().toLowerCase(),
            role_display: completeUserData.nama_role || completeUserData.role || ''
          };

          safeStorage.setItem('authToken', token);
          safeStorage.setJSON('user', normalizedUserData);
          
          // Generate dummy session_id for old login system
          const dummySessionId = 'old-system-' + Date.now();
          safeStorage.setItem('session_id', dummySessionId);
          
          setToken(token);
          setUser(normalizedUserData);
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          // X-Session-Id removed for CORS optimization per API v1.5.7 - Bearer token sufficient
          return;
        } catch (oldSystemError) {
          console.error('Old system login juga gagal:', oldSystemError.message);
          throw oldSystemError;
        }
      }
    } catch (error) {
      // Offline login: use cached session
      if (!navigator.onLine) {
        const storedUser = safeStorage.getItem('user');
        const storedToken = safeStorage.getItem('authToken');

        if (storedUser && storedToken) {
          try {
            const parsedUser = JSON.parse(storedUser);
            setToken(storedToken);
            setUser(parsedUser);
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
            // X-Session-Id removed for CORS optimization per API v1.5.7 - Bearer token sufficient
            return;
          } catch (parseError) {
            console.error('Error parsing stored user data:', parseError);
          }
        }

        throw new Error('Tidak dapat login. Tidak ada koneksi internet dan tidak ada session tersimpan.');
      }

      throw error;
    }
  }, []);

  const register = useCallback(async (_userData) => {
    // Register tidak didukung oleh API saat ini
    throw new Error('Fitur register belum tersedia');
  }, []);

  const value = { user, token, login, register, logout, refreshUser, isAuthenticated: !!user, loading };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
