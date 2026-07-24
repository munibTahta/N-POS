import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { getMySettings } from '../services/api';
import { AuthContext } from './AuthContext.js';
import safeStorage from '../utils/safeStorage';

// 1. Buat Context
const SettingsContext = createContext();

// 2. Buat custom hook untuk mempermudah penggunaan context
export const useSettings = () => useContext(SettingsContext);

// 3. Buat Provider Component
export const SettingsProvider = ({ children }) => {
  const [storeInfo, setStoreInfo] = useState({});
  const [posSettings, setPosSettings] = useState({
    showPaymentSelector: true,
    showCustomerSearch: true,
    enablePPN: false,
    showVoucherInput: true,
    allowOversellSync: false
  });
  const [loading, setLoading] = useState(true);
  const { user, token, logout } = useContext(AuthContext);

  // Fungsi untuk mengambil data pengaturan dari server
  const fetchSettings = useCallback(async () => {
    // Hanya load settings jika user sudah login dan ada token
    if (!user || !token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await getMySettings();
      if (response.data.success) {
        const cabangData = response.data.data.cabang || {};
        const userData = response.data.data.user || {};
        // Ambil printer dari user data (printer_nama) atau safeStorage
        const printerName = userData.printer_nama || safeStorage.getItem('defaultPrinterName') || '';
        // port name comes from user data (may have been synced from backend)
        // we no longer read any legacy value from safeStorage.
        const printerPort = userData.printer_port || '';
        const printerData = {
          nama: printerName,
          tipe: userData.printer_tipe || 'thermal',
          ...(safeStorage.getItem('printerPaperWidth') ? { paperWidth: safeStorage.getItem('printerPaperWidth') } : {})
        };
        if (printerPort) {
          printerData.portName = printerPort;
        }
        setStoreInfo({
          ...cabangData,
          printer: printerData
        });
        
        // Load POS settings dari safeStorage atau backend
        const savedPosSettings = safeStorage.getJSON('posSettings');
        if (savedPosSettings) {
          setPosSettings(savedPosSettings);
        }
      } else {
        console.error("Gagal memuat pengaturan toko:", response.data.message);
      }
    } catch (error) {
      // If the server returned 401 we consider the session expired and force a logout
      if (error.response?.status === 401) {
        console.error("Token tidak valid / kedaluwarsa, keluar otomatis", error);
        logout();
      } else {
        console.error("Error saat memuat pengaturan toko:", error);
      }
    } finally {
      setLoading(false);
    }
  }, [user, token, logout]);

  useEffect(() => {
    fetchSettings();
    
    // ⚠️ REMOVED: Auto-refresh interval was causing Settings page to blink/flicker
    // Refresh is now triggered only on demand via refreshSettings() or when user/token changes
    // This prevents excessive API calls and improves performance
    
    // Cleanup: no interval to clear
    return () => {};
  }, [fetchSettings, user, token]);

  // Fungsi untuk update POS settings
  const updatePosSettings = useCallback((newSettings) => {
    const updatedSettings = { ...posSettings, ...newSettings };
    setPosSettings(updatedSettings);
    safeStorage.setJSON('posSettings', updatedSettings);
  }, [posSettings]);

  const [theme, setTheme] = useState(() => {
    return safeStorage.getItem('theme') || 'light';
  });

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      safeStorage.setItem('theme', next);
      return next;
    });
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Nilai yang akan dibagikan ke seluruh aplikasi
  const value = { 
    storeInfo, 
    posSettings, 
    loadingSettings: loading, 
    refreshSettings: fetchSettings,
    updatePosSettings,
    setStoreInfo,
    theme,
    toggleTheme
  };

  return React.createElement(SettingsContext.Provider, { value: value }, children);
};