/**
 * Debug logging utility
 * Disables console output in production builds
 */
class DebugLogger {
  constructor() {
    // Detect if we're in production
    this.isProduction = import.meta.env.PROD;
    this.isDev = import.meta.env.DEV;
  }

  /**
   * Log message (only in dev)
   */
  log(...args) {
    if (!this.isProduction) {
    }
  }

  /**
   * Warn message (only in dev)
   */
  warn(...args) {
    if (!this.isProduction) {
      console.warn(...args);
    }
  }

  /**
   * Error message (always log errors)
   */
  error(...args) {
    console.error(...args);
  }

  /**
   * Info message (only in dev)
   */
  info(...args) {
    if (!this.isProduction) {
    }
  }

  /**
   * Debug message (only in dev)
   */
  debug(...args) {
    if (!this.isProduction) {
    }
  }
}

export const debugLogger = new DebugLogger();
export default debugLogger;
