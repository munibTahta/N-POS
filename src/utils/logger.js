// src/utils/logger.js
const isDevelopment = (typeof import.meta !== 'undefined' && 
                      import.meta.env && 
                      import.meta.env.DEV) || 
                     (typeof window !== 'undefined' && 
                      window.location && 
                      window.location.hostname === 'localhost');

class Logger {
  debug(message, ...args) {
    if (isDevelopment) {
    }
  }

  info(message, ...args) {
    if (isDevelopment) {
    }
  }

  warn(message, ...args) {
    if (isDevelopment) {
      console.warn(`[WARN] ${message}`, ...args);
    } else {
      // In production, send to error reporting service
      this.reportToService('warning', message, args);
    }
  }

  error(message, error, ...args) {
    if (isDevelopment) {
      console.error(`[ERROR] ${message}`, error, ...args);
    } else {
      // In production, send to error reporting service
      this.reportToService('error', message, { error, args });
    }
  }

  reportToService(level, message, data) {
    // TODO: Integrate with error reporting service like Sentry
    // For now, we'll just store in localStorage for debugging
    try {
      const logs = JSON.parse(localStorage.getItem('app_logs') || '[]');
      logs.push({
        timestamp: new Date().toISOString(),
        level,
        message,
        data
      });
      // Keep only last 100 logs
      if (logs.length > 100) {
        logs.shift();
      }
      localStorage.setItem('app_logs', JSON.stringify(logs));
    } catch (_e) {
      // Silent fail if localStorage is not available
    }
  }

  // Method to get logs for debugging (development only)
  getLogs() {
    if (!isDevelopment) return [];
    try {
      return JSON.parse(localStorage.getItem('app_logs') || '[]');
    } catch (_e) {
      return [];
    }
  }

  // Method to clear logs
  clearLogs() {
    localStorage.removeItem('app_logs');
  }
}

export const logger = new Logger();
export default logger;