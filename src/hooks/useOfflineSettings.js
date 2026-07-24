import { useState, useCallback, useEffect } from 'react';
import offlineDataSync from '../services/offlineDataSync';

/**
 * Hook untuk manage offline app settings
 * Store di localStorage untuk instant access
 */
export const useOfflineSettings = () => {
  const [settings, setSettings] = useState({
    storeName: 'POS Store',
    storePhone: '',
    storeAddress: '',
    printerName: '',
    printerType: 'thermal', // thermal, inkjet, network
    paperWidth: '80', // 80mm or 58mm
    logoUrl: '',
    footerText: 'Terima kasih telah berbelanja',
    autoSync: true,
    autoSyncInterval: 5, // minutes
    offlineModeEnabled: true,
    receiptCopies: 1,
    showFooter: true,
    showQRCode: false,
    useBarcode: true,
    currencyCode: 'IDR'
  });
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Load settings from localStorage
   */
  useEffect(() => {
    try {
      const saved = localStorage.getItem('offlineSettings');
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...parsedSettings }));
      } else {
        // Load from offlineDataSync
        const loadedSettings = offlineDataSync.loadSettings();
        setSettings(prev => ({ ...prev, ...loadedSettings }));
      }
    } catch (error) {
      console.error('Error loading offline settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Save settings to localStorage
   */
  const saveSettings = useCallback((newSettings) => {
    try {
      const updated = { ...settings, ...newSettings };
      setSettings(updated);
      
      // Save to localStorage
      localStorage.setItem('offlineSettings', JSON.stringify(updated));
      
      // Also save via offlineDataSync
      offlineDataSync.saveSettings(updated);
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  }, [settings]);

  /**
   * Update single setting
   */
  const updateSetting = useCallback((key, value) => {
    saveSettings({ [key]: value });
  }, [saveSettings]);

  /**
   * Reset settings to default
   */
  const resetSettings = useCallback(() => {
    try {
      const defaults = {
        storeName: 'POS Store',
        storePhone: '',
        storeAddress: '',
        printerName: '',
        printerType: 'thermal',
        paperWidth: '80',
        logoUrl: '',
        footerText: 'Terima kasih telah berbelanja',
        autoSync: true,
        autoSyncInterval: 5,
        offlineModeEnabled: true,
        receiptCopies: 1,
        showFooter: true,
        showQRCode: false,
        useBarcode: true,
        currencyCode: 'IDR'
      };
      
      saveSettings(defaults);
      return true;
    } catch (error) {
      console.error('Error resetting settings:', error);
      return false;
    }
  }, [saveSettings]);

  /**
   * Export settings for backup
   */
  const exportSettings = useCallback(() => {
    try {
      const exported = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        settings
      };
      
      const json = JSON.stringify(exported, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `pos-settings-${Date.now()}.json`;
      a.click();
      return true;
    } catch (error) {
      console.error('Error exporting settings:', error);
      return false;
    }
  }, [settings]);

  /**
   * Import settings from file
   */
  const importSettings = useCallback((file) => {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            if (data.settings) {
              saveSettings(data.settings);
              resolve(true);
            } else {
              reject(new Error('Invalid settings file format'));
            }
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      } catch (error) {
        reject(error);
      }
    });
  }, [saveSettings]);

  return {
    settings,
    isLoading,
    saveSettings,
    updateSetting,
    resetSettings,
    exportSettings,
    importSettings
  };
};

export default useOfflineSettings;
