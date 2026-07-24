import React from 'react';

/**
 * Batch Progress Manager
 * Provides progress tracking callbacks and utilities for batch operations
 * 
 * Usage:
 * const progress = new BatchProgressManager(5000); // Total items
 * progress.onProgress((p) => void 0 && (`${p.percent}% - ETA: ${p.eta}s`));
 * 
 * for (let i = 0; i < items.length; i++) {
 *   processItem(items[i]);
 *   progress.update(i + 1);
 * }
 */

export class BatchProgressManager {
  constructor(totalItems = 0) {
    this.totalItems = totalItems;
    this.processedItems = 0;
    this.startTime = Date.now();
    this.callbacks = [];
    this.lastUpdate = 0;
    this.updateInterval = 200; // Only notify every 200ms to avoid thrashing
  }

  /**
   * Register progress callback
   * @param {Function} callback - Called with progress object
   */
  onProgress(callback) {
    if (typeof callback === 'function') {
      this.callbacks.push(callback);
    }
  }

  /**
   * Update progress
   * @param {number} itemsProcessed - Current count of processed items
   */
  update(itemsProcessed) {
    this.processedItems = itemsProcessed;
    const now = Date.now();
    
    // Only notify if enough time has passed (throttle updates)
    if (now - this.lastUpdate < this.updateInterval && itemsProcessed < this.totalItems) {
      return;
    }

    this.lastUpdate = now;
    this._notify();
  }

  /**
   * Mark operation as complete
   */
  complete() {
    this.processedItems = this.totalItems;
    this._notify();
  }

  /**
   * Get current progress data
   */
  getProgress() {
    const elapsedMs = Date.now() - this.startTime;
    const percent = this.totalItems > 0 
      ? Math.round((this.processedItems / this.totalItems) * 100)
      : 0;

    // Calculate ETA
    let eta = '?';
    if (this.processedItems > 0 && this.processedItems < this.totalItems) {
      const itemsPerMs = this.processedItems / elapsedMs;
      const remainingItems = this.totalItems - this.processedItems;
      const remainingMs = remainingItems / itemsPerMs;
      eta = Math.ceil(remainingMs / 1000); // seconds
    }

    return {
      processed: this.processedItems,
      total: this.totalItems,
      percent,
      elapsed: Math.ceil(elapsedMs / 1000), // seconds
      eta,
      isComplete: this.processedItems >= this.totalItems,
      itemsPerSecond: (this.processedItems / (elapsedMs / 1000)).toFixed(2)
    };
  }

  /**
   * Format progress for display
   */
  formatProgress() {
    const p = this.getProgress();
    return `${p.processed}/${p.total} (${p.percent}%) - ETA: ${p.eta}s`;
  }

  /**
   * Internal: Notify all callbacks
   */
  _notify() {
    const progress = this.getProgress();
    this.callbacks.forEach(cb => {
      try {
        cb(progress);
      } catch (err) {
        console.error('Progress callback error:', err);
      }
    });
  }
}

/**
 * Hook for using batch progress in React components
 * 
 * Usage:
 * const progress = useBatchProgress(5000);
 * useEffect(() => {
 *   progress.onProgress((p) => setProgress(p));
 * }, [progress]);
 */
export const useBatchProgress = (totalItems = 0) => {
  const [progress] = React.useState(() => new BatchProgressManager(totalItems));
  
  React.useEffect(() => {
    return () => {
      progress.complete();
    };
  }, [progress]);

  return progress;
};

export default BatchProgressManager;
