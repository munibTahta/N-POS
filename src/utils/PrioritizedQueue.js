/**
 * PrioritizedQueue - Request queue dengan priority levels
 * Critical > High > Normal > Low
 * 
 * Usage:
 * prioritizedQueue.enqueue(request, 'critical');  // Sales, payments
 * prioritizedQueue.enqueue(request, 'high');      // Inventory, customers
 * prioritizedQueue.enqueue(request, 'normal');    // Categories, units
 * prioritizedQueue.enqueue(request, 'low');       // Logs, analytics
 */

class PrioritizedQueue {
  constructor() {
    this.queues = {
      critical: [],  // Sales, payments, transactions
      high: [],      // Customers, inventory, stocks
      normal: [],    // Categories, units, suppliers
      low: []        // Logs, analytics, tracking
    };
    this.priorities = ['critical', 'high', 'normal', 'low'];
  }

  /**
   * Add request to queue with priority
   */
  enqueue(request, priority = 'normal') {
    if (!this.queues[priority]) {
      console.warn(`Unknown priority: ${priority}, using 'normal'`);
      priority = 'normal';
    }

    const queueItem = {
      ...request,
      priority,
      enqueuedAt: Date.now(),
      id: request.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    this.queues[priority].push(queueItem);
    
    return queueItem.id;
  }

  /**
   * Get next request from highest priority queue
   */
  dequeue() {
    for (const priority of this.priorities) {
      if (this.queues[priority].length > 0) {
        const item = this.queues[priority].shift();
        return item;
      }
    }
    return null;
  }

  /**
   * Get next N requests (batch processing)
   */
  dequeueBatch(count = 50) {
    const batch = [];
    for (let i = 0; i < count; i++) {
      const item = this.dequeue();
      if (!item) break;
      batch.push(item);
    }
    return batch;
  }

  /**
   * Peek at next request without removing
   */
  peek() {
    for (const priority of this.priorities) {
      if (this.queues[priority].length > 0) {
        return this.queues[priority][0];
      }
    }
    return null;
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      critical: this.queues.critical.length,
      high: this.queues.high.length,
      normal: this.queues.normal.length,
      low: this.queues.low.length,
      total: Object.values(this.queues).reduce((a, b) => a + b.length, 0),
      byPriority: { ...this.queues }
    };
  }

  /**
   * Get detailed status with info
   */
  getDetailedStatus() {
    const status = this.getStatus();
    return {
      ...status,
      nextItem: this.peek(),
      estimatedItems: {
        critical: status.critical,
        high: status.high,
        normal: status.normal,
        low: status.low
      },
      isEmpty: status.total === 0,
      hasUrgent: status.critical > 0,
      criticalCount: status.critical
    };
  }

  /**
   * Clear specific priority queue
   */
  clearPriority(priority) {
    const count = this.queues[priority].length;
    this.queues[priority] = [];
    return count;
  }

  /**
   * Clear all queues
   */
  clear() {
    const totalCount = this.getStatus().total;
    Object.keys(this.queues).forEach(priority => {
      this.queues[priority] = [];
    });
    return totalCount;
  }

  /**
   * Find request by ID
   */
  findById(id) {
    for (const priority of this.priorities) {
      const item = this.queues[priority].find(item => item.id === id);
      if (item) return { item, priority };
    }
    return null;
  }

  /**
   * Remove request by ID
   */
  removeById(id) {
    for (const priority of this.priorities) {
      const index = this.queues[priority].findIndex(item => item.id === id);
      if (index !== -1) {
        const [removed] = this.queues[priority].splice(index, 1);
        return removed;
      }
    }
    return null;
  }

  /**
   * Get queue length
   */
  size() {
    return this.getStatus().total;
  }

  /**
   * Check if empty
   */
  isEmpty() {
    return this.size() === 0;
  }

  /**
   * Get all items (for debugging)
   */
  getAll() {
    const all = [];
    for (const priority of this.priorities) {
      this.queues[priority].forEach(item => {
        all.push({ ...item, priority });
      });
    }
    return all;
  }

  /**
   * Requeue item with different priority
   */
  requeue(id, newPriority) {
    const found = this.findById(id);
    if (!found) return false;

    this.removeById(id);
    this.enqueue(found.item, newPriority);
    return true;
  }

  /**
   * Get priority for endpoint (helper)
   * Call this to auto-detect priority based on endpoint
   */
  static getPriorityForEndpoint(endpoint) {
    const critical = ['/sales', '/transactions', '/pembayaran', '/payments', '/transaksi'];
    const high = ['/customers', '/pelanggan', '/inventory/stocks', '/stok', '/stock'];
    const normal = ['/categories', '/kategori', '/units', '/satuan', '/products'];

    if (critical.some(p => endpoint.includes(p))) return 'critical';
    if (high.some(p => endpoint.includes(p))) return 'high';
    if (normal.some(p => endpoint.includes(p))) return 'normal';
    return 'low';
  }
}

// Singleton instance
const prioritizedQueue = new PrioritizedQueue();

export default prioritizedQueue;
export { PrioritizedQueue };
