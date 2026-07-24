import { useCallback } from 'react';
import { getSettings as getSettingsAPI } from '../services/api';
import { dbBatchInsert } from '../utils/dbBatchOperations';
import { createOfflineDataHook } from './createOfflineDataHook';

/**
 * Unified hook for server-synced app settings
 * - Prefers API when online
 * - Persists to SQLite for offline fallback
 * - Provides typed access to settings (bool, int, string, json)
 * - For transactional/operational settings (tax enabled, receipt format, etc)
 * Uses factory pattern to eliminate code duplication
 */
export const useAppSettings = () => {
  // Normalize API response - convert to array format for factory pattern
  const fetchSettingsFromAPI = useCallback(async (params = {}) => {
    const response = await getSettingsAPI(params);
    const settingsObj = response?.data?.data || response?.data || {};
    
    // Convert settings object to array of {key, value} pairs
    return Object.entries(settingsObj).map(([key, value]) => ({
      kunci_setting: key,
      nilai_setting: typeof value === 'object' ? JSON.stringify(value) : String(value),
      tipe_data: typeof value === 'boolean' ? 'bool' : typeof value,
      ...value
    }));
  }, []);

  // Batch persist to SQLite
  const storeToDB = useCallback(async (settingsData) => {
    if (!window.electronAPI?.dbBatchInsert) return;
    
    const records = settingsData.map(setting => ({
      kunci_setting: setting.kunci_setting,
      nilai_setting: typeof setting.nilai_setting === 'object' 
        ? JSON.stringify(setting.nilai_setting)
        : String(setting.nilai_setting || ''),
      tipe_data: setting.tipe_data || 'string',
      kategori: setting.kategori || 'general',
      deskripsi: setting.deskripsi || '',
      dapat_diedit: setting.dapat_diedit === undefined ? 1 : (setting.dapat_diedit ? 1 : 0),
      sync_at: new Date().toISOString()
    }));

    try {
      await dbBatchInsert('settings', records);
    } catch (err) {
      console.warn('⚠️ Failed to persist settings:', err);
    }
  }, []);

  // Load from SQLite
  const loadFromDB = useCallback(async () => {
    if (!window.electronAPI?.dbSelect) return [];
    
    try {
      const result = await window.electronAPI.dbSelect({
        table: 'settings',
        limit: 1000
      });
      return result || [];
    } catch (dbErr) {
      console.warn('⚠️ Failed to load settings from offline DB:', dbErr);
      return [];
    }
  }, []);

  // Use factory hook for all offline-first logic
  const { data, loading, error, lastSync, refetch, refresh, invalidateCache: invalidateCacheFactory } = createOfflineDataHook({
    tableName: 'settings',
    fetchFn: fetchSettingsFromAPI,
    storeFn: storeToDB,
    loadFn: loadFromDB
  });

  /**
   * Convert array back to object format for easier access
   */
  const settingsObject = useCallback(() => {
    const obj = {};
    data.forEach(setting => {
      let value = setting.nilai_setting;
      
      // Parse JSON if needed
      try {
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          value = JSON.parse(value);
        }
      } catch (_e) {
        // Keep as string if not valid JSON
      }
      
      obj[setting.kunci_setting] = value;
    });
    return obj;
  }, [data]);

  /**
   * Get single setting value by key
   */
  const getSetting = useCallback((key, defaultValue = null) => {
    const setting = data.find(s => s.kunci_setting === key);
    if (!setting) return defaultValue;
    
    let value = setting.nilai_setting;
    
    // Parse based on type
    if (setting.tipe_data === 'bool') {
      return value === '1' || value === true || value === 'true';
    } else if (setting.tipe_data === 'int' || setting.tipe_data === 'number') {
      return parseInt(value, 10);
    } else if (setting.tipe_data === 'json' || setting.tipe_data === 'object') {
      try {
        return JSON.parse(value);
      } catch (_e) {
        return defaultValue;
      }
    }
    
    return value || defaultValue;
  }, [data]);

  /**
   * Get all settings as object
   */
  const getSettings = useCallback(() => {
    return settingsObject();
  }, [settingsObject]);

  /**
   * Check if a setting exists and is enabled (for boolean settings)
   */
  const isEnabled = useCallback((key) => {
    return getSetting(key, false) === true;
  }, [getSetting]);

  return {
    settings: settingsObject(),
    settingsArray: data,
    loading,
    error,
    lastSync,
    fetchSettings: refetch,
    getSetting,
    getSettings,
    isEnabled,
    invalidateCache: invalidateCacheFactory,
    refresh
  };
};

export default useAppSettings;
