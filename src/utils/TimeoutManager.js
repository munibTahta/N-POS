/**
 * TimeoutManager Utility
 * Centralized management of setTimeout/clearTimeout to prevent memory leaks
 * Ensures all timeouts are tracked and can be cleaned up at once
 */
class TimeoutManager {
  constructor() {
    this.timeouts = new Map();
  }

  /**
   * Set a timeout with a key for later reference/cleanup
   * Automatically clears any existing timeout for the same key
   * 
   * @param {string} key - Unique identifier for this timeout
   * @param {Function} callback - Function to execute when timeout fires
   * @param {number} delay - Delay in milliseconds
   * @returns {number} - Timeout ID
   */
  set(key, callback, delay) {
    // Clear any existing timeout with same key
    this.clear(key);

    const id = setTimeout(() => {
      callback();
      this.timeouts.delete(key);
    }, delay);

    this.timeouts.set(key, id);
    return id;
  }

  /**
   * Clear a specific timeout by key
   * 
   * @param {string} key - Timeout identifier
   * @returns {boolean} - True if timeout was cleared, false if not found
   */
  clear(key) {
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
      this.timeouts.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Clear all timeouts at once
   * Useful for component cleanup
   */
  clearAll() {
    for (const [, id] of this.timeouts) {
      clearTimeout(id);
    }
    this.timeouts.clear();
  }

  /**
   * Check if a timeout exists
   * 
   * @param {string} key - Timeout identifier
   * @returns {boolean}
   */
  has(key) {
    return this.timeouts.has(key);
  }

  /**
   * Get count of pending timeouts
   * Useful for debugging and monitoring
   * 
   * @returns {number}
   */
  getCount() {
    return this.timeouts.size;
  }

  /**
   * Get all pending timeout keys
   * 
   * @returns {string[]}
   */
  getKeys() {
    return Array.from(this.timeouts.keys());
  }
}

export default TimeoutManager;
