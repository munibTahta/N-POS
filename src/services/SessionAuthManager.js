import safeStorage from '../utils/safeStorage.js';

/**
 * Session Authentication Manager
 * Handles login with session tracking, offline support, and automatic header injection
 */

class SessionAuthManager {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.token = safeStorage.getItem('token');
    this.sessionId = safeStorage.getItem('session_id');
    this.user = safeStorage.getJSON('user', {});
  }

  /**
   * Login with username and password
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{token, session_id, user}>}
   */
  async login(username, password) {
    try {
      const response = await fetch(`${this.baseUrl}/session/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.getApiKey()
        },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('User sudah login di device lain. Gunakan allow_duplicate=true untuk force login');
        }
        const error = await response.json();
        throw new Error(error.message || 'Login gagal');
      }

      const data = await response.json();
      
      // Store in localStorage with error handling
      try {
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('session_id', data.data.session_id);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        localStorage.setItem('login_time', Date.now().toString());
      } catch (storageError) {
        console.warn('Failed to store auth data in localStorage:', storageError.message);
        // Continue anyway - data is in memory
      }

      // Update instance
      this.token = data.data.token;
      this.sessionId = data.data.session_id;
      this.user = data.data.user;

      return data.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Login dengan force duplicate (allow multiple sessions)
   */
  async loginWithDuplicate(username, password) {
    try {
      const response = await fetch(`${this.baseUrl}/session/login?allow_duplicate=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.getApiKey()
        },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login gagal');
      }

      const data = await response.json();
      
      // Store in localStorage with error handling
      safeStorage.setItem('token', data.data.token);
      safeStorage.setItem('session_id', data.data.session_id);
      safeStorage.setJSON('user', data.data.user);
      safeStorage.setItem('login_time', Date.now().toString());

      this.token = data.data.token;
      this.sessionId = data.data.session_id;
      this.user = data.data.user;

      return data.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Logout current session
   */
  async logout() {
    try {
      if (this.token && this.sessionId) {
        await fetch(`${this.baseUrl}/session/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            // X-Session-Id removed for CORS optimization per API v1.5.7 - Bearer token sufficient
            'api-key': this.getApiKey()
          }
        }).catch(() => {
          // Offline - silent fail, still clear local storage
        });
      }

      // Clear local storage
      safeStorage.removeItem('token');
      safeStorage.removeItem('session_id');
      safeStorage.removeItem('user');
      safeStorage.removeItem('login_time');
      safeStorage.removeItem('apiCache');

      this.token = null;
      this.sessionId = null;
      this.user = {};

      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  /**
   * Get authorization headers
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'api-key': this.getApiKey()
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    // X-Session-Id removed for CORS optimization per API v1.5.7 - Bearer token sufficient

    return headers;
  }

  /**
   * Verify current session is still valid
   */
  async verifySession() {
    if (!this.token || !this.sessionId) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/session/verify-session`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.clearSession();
          return false;
        }
      }

      return response.ok;
    } catch (_error) {
      // Offline - assume valid if token exists
      return !!this.token;
    }
  }

  /**
   * Get all active sessions for user
   */
  async getActiveSessions() {
    if (!this.token || !this.sessionId) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(`${this.baseUrl}/session/sessions`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to get sessions');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Get sessions error:', error);
      return [];
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.token && !!this.sessionId;
  }

  /**
   * Clear session from local storage
   */
  clearSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('session_id');
    localStorage.removeItem('user');
    localStorage.removeItem('login_time');

    this.token = null;
    this.sessionId = null;
    this.user = {};
  }

  /**
   * Get API key from environment
   */
  getApiKey() {
    return import.meta.env.VITE_API_KEY || '';
  }

  /**
   * Check if session is about to expire
   */
  isAboutToExpire(minutesBefore = 10) {
    const loginTime = parseInt(localStorage.getItem('login_time') || '0');
    const tokenExpiry = loginTime + (7 * 24 * 60 * 60 * 1000); // 7 days
    const now = Date.now();
    const minutesLeft = (tokenExpiry - now) / (60 * 1000);
    
    return minutesLeft < minutesBefore;
  }
}

export default SessionAuthManager;
