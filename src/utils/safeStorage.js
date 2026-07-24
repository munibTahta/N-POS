/**
 * Safe localStorage/sessionStorage wrapper
 * Handles errors in private browsing mode and quota issues
 */
export const safeStorage = {
  /**
   * Safe get from localStorage
   */
  getItem(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item || defaultValue;
    } catch (error) {
      console.warn(`Failed to read localStorage key "${key}":`, error);
      return defaultValue;
    }
  },

  /**
   * Safe set to localStorage
   */
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn(`Failed to write localStorage key "${key}":`, error);
      // Could be quota exceeded or private mode
      return false;
    }
  },

  /**
   * Safe remove from localStorage
   */
  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`Failed to remove localStorage key "${key}":`, error);
      return false;
    }
  },

  /**
   * Safe get JSON from localStorage
   */
  getJSON(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn(`Failed to parse JSON from localStorage key "${key}":`, error);
      return defaultValue;
    }
  },

  /**
   * Safe set JSON to localStorage
   */
  setJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`Failed to write JSON to localStorage key "${key}":`, error);
      return false;
    }
  }
};

export default safeStorage;
