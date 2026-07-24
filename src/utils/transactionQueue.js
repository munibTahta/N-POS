/**
 * Offline Transaction Queue Manager
 * 
 * Handles queueing of POS transactions when offline
 * Auto-processes queue when back online
 * Implements retry logic with exponential backoff
 * Maintains data integrity across network failures
 */

const TRANSACTION_QUEUE_TABLE = 'transaction_queue';
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds

/**
 * Initialize transaction queue database table
 * Called during app startup
 */
export const initializeTransactionQueue = async () => {
  if (!window.electronAPI?.dbExec) {
    console.warn('⚠️ electronAPI not available for transaction queue');
    return false;
  }

  try {
    const schema = `
      CREATE TABLE IF NOT EXISTS ${TRANSACTION_QUEUE_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        data JSON NOT NULL,
        retry_count INTEGER DEFAULT 0,
        last_error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME,
        sync_started_at DATETIME,
        metadata JSON
      )
    `;

    // Create indices for performance
    const indices = [
      `CREATE INDEX IF NOT EXISTS idx_transaction_status ON ${TRANSACTION_QUEUE_TABLE}(status)`,
      `CREATE INDEX IF NOT EXISTS idx_transaction_created ON ${TRANSACTION_QUEUE_TABLE}(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_transaction_id ON ${TRANSACTION_QUEUE_TABLE}(transaction_id)`
    ];

    await window.electronAPI.dbExec(schema);
    
    for (const index of indices) {
      await window.electronAPI.dbExec(index);
    }
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize transaction queue:', error);
    return false;
  }
};

/**
 * Enqueue a transaction for processing
 * Persists to SQLite immediately
 * 
 * @param {string} transactionId - Unique transaction identifier
 * @param {string} type - Transaction type: 'sale', 'return', 'payment'
 * @param {object} data - Transaction data to persist
 * @param {object} metadata - Optional metadata (user, location, etc)
 * @returns {Promise<boolean>} Success status
 */
export const enqueueTransaction = async (
  transactionId,
  type,
  data,
  metadata = {}
) => {
  if (!window.electronAPI?.dbInsert) {
    console.error('❌ electronAPI not available');
    throw new Error('Database not available');
  }

  try {
    // Validate transaction
    if (!transactionId || !type || !data) {
      throw new Error('Invalid transaction: missing required fields');
    }
    await window.electronAPI.dbInsert({
      table: TRANSACTION_QUEUE_TABLE,
      data: {
        transaction_id: transactionId,
        type,
        status: 'pending',
        data: JSON.stringify(data),
        retry_count: 0,
        metadata: JSON.stringify(metadata),
        created_at: new Date().toISOString()
      }
    });
    return true;
  } catch (error) {
    console.error(`❌ Failed to enqueue transaction: ${transactionId}`, error);
    throw error;
  }
};

/**
 * Get all pending transactions
 * @returns {Promise<Array>} Array of pending transactions
 */
export const getPendingTransactions = async () => {
  if (!window.electronAPI?.dbSelect) {
    return [];
  }

  try {
    const result = await window.electronAPI.dbSelect({
      table: TRANSACTION_QUEUE_TABLE,
      where: { status: 'pending' },
      orderBy: 'created_at ASC'
    });

    return result || [];
  } catch (error) {
    console.error('❌ Failed to get pending transactions:', error);
    return [];
  }
};

/**
 * Get transaction by ID
 * @param {string} transactionId - Transaction ID to fetch
 * @returns {Promise<object|null>}
 */
export const getTransaction = async (transactionId) => {
  if (!window.electronAPI?.dbSelect) {
    return null;
  }

  try {
    const result = await window.electronAPI.dbSelect({
      table: TRANSACTION_QUEUE_TABLE,
      where: { transaction_id: transactionId },
      limit: 1
    });

    return result?.[0] || null;
  } catch (error) {
    console.error(`❌ Failed to get transaction ${transactionId}:`, error);
    return null;
  }
};

/**
 * Mark transaction as processing
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<boolean>}
 */
export const markProcessing = async (transactionId) => {
  if (!window.electronAPI?.dbUpdate) {
    return false;
  }

  try {
    await window.electronAPI.dbUpdate({
      table: TRANSACTION_QUEUE_TABLE,
      where: { transaction_id: transactionId },
      data: {
        status: 'processing',
        sync_started_at: new Date().toISOString()
      }
    });
    return true;
  } catch (error) {
    console.error(`❌ Failed to mark processing: ${transactionId}`, error);
    return false;
  }
};

/**
 * Mark transaction as completed (synced)
 * @param {string} transactionId - Transaction ID
 * @param {object} serverResponse - Response from server
 * @returns {Promise<boolean>}
 */
export const markCompleted = async (transactionId, serverResponse = null) => {
  if (!window.electronAPI?.dbUpdate) {
    return false;
  }

  try {
    await window.electronAPI.dbUpdate({
      table: TRANSACTION_QUEUE_TABLE,
      where: { transaction_id: transactionId },
      data: {
        status: 'completed',
        processed_at: new Date().toISOString(),
        metadata: JSON.stringify({
          serverResponse,
          syncedAt: new Date().toISOString()
        })
      }
    });
    return true;
  } catch (error) {
    console.error(`❌ Failed to mark completed: ${transactionId}`, error);
    return false;
  }
};

/**
 * Mark transaction as failed (with retry)
 * @param {string} transactionId - Transaction ID
 * @param {string} errorMessage - Error message
 * @returns {Promise<boolean>}
 */
export const markFailed = async (transactionId, errorMessage) => {
  if (!window.electronAPI?.dbUpdate) {
    return false;
  }

  try {
    const transaction = await getTransaction(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    const newRetryCount = (transaction.retry_count || 0) + 1;
    const status = newRetryCount >= MAX_RETRIES ? 'failed' : 'pending';

    await window.electronAPI.dbUpdate({
      table: TRANSACTION_QUEUE_TABLE,
      where: { transaction_id: transactionId },
      data: {
        status,
        retry_count: newRetryCount,
        last_error: errorMessage,
        sync_started_at: null // Clear to allow retry
      }
    });
    return true;
  } catch (error) {
    console.error(`❌ Failed to mark failed: ${transactionId}`, error);
    return false;
  }
};

/**
 * Calculate retry delay with exponential backoff
 * @param {number} retryCount - Current retry attempt
 * @returns {number} Delay in milliseconds
 */
export const calculateRetryDelay = (retryCount) => {
  const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount - 1);
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 1000;
  return Math.min(delay + jitter, MAX_RETRY_DELAY);
};

/**
 * Get queue statistics
 * @returns {Promise<object>} Queue stats
 */
export const getQueueStats = async () => {
  if (!window.electronAPI?.dbSelect) {
    return {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0
    };
  }

  try {
    const pending = await window.electronAPI.dbSelect({
      table: TRANSACTION_QUEUE_TABLE,
      where: { status: 'pending' }
    });

    const processing = await window.electronAPI.dbSelect({
      table: TRANSACTION_QUEUE_TABLE,
      where: { status: 'processing' }
    });

    const completed = await window.electronAPI.dbSelect({
      table: TRANSACTION_QUEUE_TABLE,
      where: { status: 'completed' }
    });

    const failed = await window.electronAPI.dbSelect({
      table: TRANSACTION_QUEUE_TABLE,
      where: { status: 'failed' }
    });

    return {
      pending: pending?.length || 0,
      processing: processing?.length || 0,
      completed: completed?.length || 0,
      failed: failed?.length || 0,
      total: (pending?.length || 0) + (processing?.length || 0) + 
             (completed?.length || 0) + (failed?.length || 0)
    };
  } catch (error) {
    console.error('❌ Failed to get queue stats:', error);
    return {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0
    };
  }
};

/**
 * Clear completed transactions (cleanup)
 * Optionally delete older than specified days
 * @param {number} olderThanDays - Delete completed transactions older than N days
 * @returns {Promise<number>} Number of transactions deleted
 */
export const clearCompletedTransactions = async (olderThanDays = 30) => {
  if (!window.electronAPI?.dbDelete) {
    return 0;
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await window.electronAPI.dbDelete({
      table: TRANSACTION_QUEUE_TABLE,
      where: {
        status: 'completed',
        processed_at_before: cutoffDate.toISOString()
      }
    });
    return result;
  } catch (error) {
    console.error('❌ Failed to clear completed transactions:', error);
    return 0;
  }
};

/**
 * Reset transaction (requeue after failure)
 * @param {string} transactionId - Transaction ID to reset
 * @returns {Promise<boolean>}
 */
export const resetTransaction = async (transactionId) => {
  if (!window.electronAPI?.dbUpdate) {
    return false;
  }

  try {
    await window.electronAPI.dbUpdate({
      table: TRANSACTION_QUEUE_TABLE,
      where: { transaction_id: transactionId },
      data: {
        status: 'pending',
        retry_count: 0,
        last_error: null,
        sync_started_at: null
      }
    });
    return true;
  } catch (error) {
    console.error(`❌ Failed to reset transaction: ${transactionId}`, error);
    return false;
  }
};

/**
 * Get failed transactions for retry
 * @returns {Promise<Array>} Failed transactions ready to retry
 */
export const getFailedTransactions = async () => {
  if (!window.electronAPI?.dbSelect) {
    return [];
  }

  try {
    const result = await window.electronAPI.dbSelect({
      table: TRANSACTION_QUEUE_TABLE,
      where: { status: 'failed' },
      orderBy: 'processed_at DESC'
    });

    return result || [];
  } catch (error) {
    console.error('❌ Failed to get failed transactions:', error);
    return [];
  }
};

/**
 * Export queue for backup/analysis
 * @returns {Promise<Array>} All transactions in queue
 */
export const exportQueue = async () => {
  if (!window.electronAPI?.dbSelect) {
    return [];
  }

  try {
    const result = await window.electronAPI.dbSelect({
      table: TRANSACTION_QUEUE_TABLE,
      orderBy: 'created_at DESC'
    });

    return result || [];
  } catch (error) {
    console.error('❌ Failed to export queue:', error);
    return [];
  }
};
