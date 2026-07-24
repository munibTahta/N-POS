/**
 * Network State Service
 * Robust network status tracking dengan fallback checks
 * Production-level reliability untuk offline/online detection
 * 
 * Health-check endpoint memerlukan X-API-Key header untuk autentikasi
 * - Service otomatis mengirim X-API-Key dari VITE_API_KEY
 * - Jika API key tidak tersedia, health-check akan return 401
 * - 401 diinterpretasi sebagai "API server online tapi auth failed"
 * - Error ini di-suppress agar tidak menggangu console log
 */

class NetworkStateService {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = [];
    this.lastOnlineTime = new Date();
    this.offlineSinceTime = null;
    this.connectionType = this.getConnectionType();
    this.failedRequests = 0;
    this.successfulRequests = 0;
    this.initCheckInterval = null;

    this.init();
  }

  init() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Fallback check every 10 seconds
    // Some browsers don't fire online/offline events reliably
    this.initCheckInterval = setInterval(() => {
      this.fallbackCheck();
    }, 10000);

    // Initial check
    this.fallbackCheck();
  }

  /**
   * Fallback connection check via API ping
   */
  async fallbackCheck() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const headers = {
        'X-API-Key': import.meta.env.VITE_API_KEY || ''
      };

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/health`,
        {
          method: 'GET',
          headers,
          signal: controller.signal,
          credentials: 'omit'
        }
      );

      clearTimeout(timeoutId);

      // If fetch succeeds, network is available
      if (response && response.ok) {
        if (!this.isOnline) {
          this.handleOnline();
        }
      }
    } catch (_error) {
      // Network error = offline
      if (this.isOnline) {
        this.handleOffline();
      }
    }
  }

  /**
   * Get connection type (4g, 3g, wifi, etc)
   */
  getConnectionType() {
    if (!navigator.connection) return 'unknown';

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return connection?.effectiveType || 'unknown';
  }

  /**
   * Handle online transition
   */
  handleOnline() {
    if (this.isOnline) return; // Already online
    this.isOnline = true;
    this.lastOnlineTime = new Date();
    this.offlineSinceTime = null;
    this.connectionType = this.getConnectionType();

    // Dispatch events
    window.dispatchEvent(new CustomEvent('networkOnline', {
      detail: { timestamp: this.lastOnlineTime, connectionType: this.connectionType }
    }));

    // Notify listeners
    this.notifyListeners('online');

    // Trigger sync immediately when online
    this.triggerAutoSync();
  }

  /**
   * Handle offline transition
   */
  handleOffline() {
    if (!this.isOnline) return; // Already offline
    this.isOnline = false;
    this.offlineSinceTime = new Date();
    this.connectionType = 'offline';

    // Dispatch events
    window.dispatchEvent(new CustomEvent('networkOffline', {
      detail: { timestamp: this.offlineSinceTime, offlineSince: this.getOfflineTime() }
    }));

    // Notify listeners
    this.notifyListeners('offline');
  }

  /**
   * Subscribe to network changes
   */
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Notify all listeners
   */
  notifyListeners(status) {
    this.listeners.forEach(listener => {
      try {
        listener({ status, isOnline: this.isOnline });
      } catch (error) {
        console.error('Error in network listener:', error);
      }
    });
  }

  /**
   * Track request success
   */
  recordSuccess() {
    this.successfulRequests++;
    // Reset failed count on success
    if (this.failedRequests > 0) {
      this.failedRequests = 0;
    }
  }

  /**
   * Track request failure
   */
  recordFailure() {
    this.failedRequests++;
    // If too many failures, assume offline
    if (this.failedRequests >= 3 && this.isOnline) {
      console.warn('Multiple request failures, marking as offline');
      this.handleOffline();
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      offlineSince: this.offlineSinceTime,
      offlineTime: this.getOfflineTime(),
      connectionType: this.connectionType,
      failedRequests: this.failedRequests,
      successfulRequests: this.successfulRequests,
      uptime: this.lastOnlineTime ? new Date() - this.lastOnlineTime : 0
    };
  }

  /**
   * Get how long offline (in ms)
   */
  getOfflineTime() {
    if (!this.offlineSinceTime) return 0;
    return new Date() - this.offlineSinceTime;
  }

  /**
   * Get offline time formatted
   */
  getOfflineTimeFormatted() {
    const ms = this.getOfflineTime();
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Trigger auto-sync when online
   */
  triggerAutoSync() {
    try {
      window.dispatchEvent(new CustomEvent('autoSync'));
    } catch (_error) {
      console.warn('Could not trigger auto-sync');
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.initCheckInterval) {
      clearInterval(this.initCheckInterval);
    }
    this.listeners = [];
  }
}

// Singleton instance
const networkStateService = new NetworkStateService();

export default networkStateService;
