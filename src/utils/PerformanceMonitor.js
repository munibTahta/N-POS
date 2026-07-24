/**
 * PerformanceMonitor Utility
 * Tracks and logs performance metrics for POS transactions
 * Helps identify bottlenecks and measure optimization improvements
 */
class PerformanceMonitor {
  constructor(name = 'Transaction') {
    this.name = name;
    this.markers = new Map();
    this.startTime = performance.now();
    this.metrics = {};
  }

  /**
   * Mark a point in time for later measurement
   * 
   * @param {string} label - Name of the marker
   */
  mark(label) {
    this.markers.set(label, performance.now());
  }

  /**
   * Measure time between two markers or from start
   * 
   * @param {string} label - Name of the measurement
   * @param {string} startMarker - Starting marker (defaults to start)
   * @param {string} endMarker - Ending marker (defaults to now)
   * @returns {number} - Duration in milliseconds
   */
  measure(label, startMarker = 'start', endMarker = null) {
    let start = this.markers.get(startMarker) || this.startTime;
    let end = endMarker ? this.markers.get(endMarker) : performance.now();
    
    const duration = end - start;
    this.metrics[label] = duration;
    
    return duration;
  }

  /**
   * Get all recorded metrics
   * 
   * @returns {Object} - Map of metric names to durations (ms)
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Log all metrics to console
   */
  log() {
    console.group(`📊 ${this.name} Performance Metrics`);
    
    const totalTime = performance.now() - this.startTime;
    Object.entries(this.metrics).forEach(([label, duration]) => {
      const percentage = ((duration / totalTime) * 100).toFixed(1);
      const color = duration > 1000 ? '#ff6b6b' : duration > 500 ? '#ffa500' : '#51cf66';
      void 0 && (`  %c${label}%c: ${duration.toFixed(2)}ms (${percentage}%)`,
        `color: ${color}; font-weight: bold;`,
        'color: inherit; font-weight: normal;'
      );
    });
    
    console.groupEnd();
  }

  /**
   * Get a formatted summary string
   * 
   * @returns {string}
   */
  getSummary() {
    const totalTime = performance.now() - this.startTime;
    const summaries = Object.entries(this.metrics)
      .map(([label, duration]) => `${label}: ${duration.toFixed(0)}ms`)
      .join(', ');
    
    return `${this.name} (${totalTime.toFixed(0)}ms total): ${summaries}`;
  }
}

export default PerformanceMonitor;
