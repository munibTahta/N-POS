/**
 * IPC Security Middleware Enhancement
 * Validates all IPC messages before processing
 * According to copilot-instructions.md: "Use IPC defensively and validate all messages"
 */

const allowedChannels = {
  // Thermal Printer
  'print-thermal': { args: ['printerName', 'content', 'paperWidth'], maxAttempts: 3 },
  
  // Database Operations
  'db-select': { args: ['table'], maxAttempts: 1 },
  'db-insert': { args: ['table', 'data'], maxAttempts: 1 },
  'db-update': { args: ['table', 'data'], maxAttempts: 1 },
  'db-delete': { args: ['table', 'where'], maxAttempts: 1 },
  'db-batch': { args: ['operations'], maxAttempts: 1 },
  
  // Product Database
  'productDB_bulkUpsertProducts': { args: ['products'], maxAttempts: 1 },
  'productDB_searchProducts': { args: ['query'], maxAttempts: 1 },
  
  // System
  'get-app-version': { args: [], maxAttempts: 1 },
  'get-platform': { args: [], maxAttempts: 1 }
};

const blockedTables = [
  'user_sessions', // Prevent direct user session manipulation
  'users'          // Prevent direct user data access
];

/**
 * Validate IPC message format and content
 */
function validateIPCMessage(channel, args) {
  // Whitelist check
  if (!allowedChannels[channel]) {
    throw new Error(`❌ Blocked IPC channel: ${channel}`);
  }

  const spec = allowedChannels[channel];

  // Argument count check
  if (!Array.isArray(args) || args.length !== spec.args.length) {
    throw new Error(
      `❌ Invalid argument count for ${channel}. Expected ${spec.args.length}, got ${args.length}`
    );
  }

  // Argument validation by channel
  switch (channel) {
    case 'db-select':
    case 'db-insert':
    case 'db-update':
    case 'db-delete':
      validateTableAccess(args[0]);
      break;
    
    case 'print-thermal':
      validatePrintMessage(args);
      break;
    
    case 'productDB_bulkUpsertProducts':
      validateProductBulkOp(args[0]);
      break;
  }

  return true;
}

/**
 * Prevent access to sensitive tables
 */
function validateTableAccess(tableName) {
  if (typeof tableName !== 'string') {
    throw new Error('❌ Table name must be string');
  }

  if (blockedTables.includes(tableName)) {
    throw new Error(`❌ Access denied to table: ${tableName}`);
  }

  // Prevent SQL injection: only alphanumeric, underscore
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    throw new Error(`❌ Invalid table name: ${tableName}`);
  }
}

/**
 * Validate print message structure
 */
function validatePrintMessage(args) {
  const [printerName, content, paperWidth] = args;

  if (typeof printerName !== 'string' || !printerName.trim()) {
    throw new Error('❌ Printer name must be non-empty string');
  }

  if (typeof content !== 'string') {
    throw new Error('❌ Receipt content must be string');
  }

  // Content size limit: 100KB
  if (content.length > 102400) {
    throw new Error('❌ Receipt content too large (max 100KB)');
  }

  if (paperWidth && !['58mm', '80mm', '100mm'].includes(paperWidth)) {
    throw new Error(`❌ Invalid paper width: ${paperWidth}`);
  }
}

/**
 * Validate bulk product operation
 */
function validateProductBulkOp(products) {
  if (!Array.isArray(products)) {
    throw new Error('❌ Products must be array');
  }

  if (products.length === 0) {
    throw new Error('❌ Products array cannot be empty');
  }

  // Limit bulk operations to prevent DoS
  if (products.length > 50000) {
    throw new Error('❌ Too many products (max 50000 per batch)');
  }

  // Validate first few items
  for (let i = 0; i < Math.min(3, products.length); i++) {
    const product = products[i];
    if (typeof product !== 'object' || product === null) {
      throw new Error(`❌ Invalid product at index ${i}`);
    }

    if (typeof product.id_produk !== 'number') {
      throw new Error(`❌ Missing id_produk at index ${i}`);
    }
  }
}

/**
 * Rate limiting per channel
 */
class RateLimiter {
  constructor() {
    this.attempts = new Map();
    this.resetInterval = 60000; // 1 minute
    
    // Clear old attempts periodically
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.attempts.entries()) {
        if (now - data.firstAttempt > this.resetInterval) {
          this.attempts.delete(key);
        }
      }
    }, this.resetInterval);
  }

  /**
   * Check if request is allowed
   */
  isAllowed(channel, key = 'default') {
    const allowedPerMinute = 100; // Reasonable limit
    const mapKey = `${channel}:${key}`;
    
    const now = Date.now();
    let data = this.attempts.get(mapKey);

    if (!data) {
      this.attempts.set(mapKey, {
        count: 1,
        firstAttempt: now
      });
      return true;
    }

    // Reset if older than 1 minute
    if (now - data.firstAttempt > this.resetInterval) {
      this.attempts.set(mapKey, {
        count: 1,
        firstAttempt: now
      });
      return true;
    }

    // Check if within limit
    if (data.count >= allowedPerMinute) {
      console.warn(`⚠️ Rate limit exceeded for ${channel}`);
      return false;
    }

    data.count++;
    return true;
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Main IPC handler wrapper
 * Usage in electron/main.cjs:
 * 
 * ipcMain.handle('safe-channel', async (event, channel, ...args) => {
 *   return await handleSecureIPC(channel, args);
 * });
 */
export async function handleSecureIPC(channel, args = []) {
  try {
    // Validate message format
    validateIPCMessage(channel, args);

    // Check rate limiting
    if (!rateLimiter.isAllowed(channel)) {
      throw new Error('Rate limit exceeded');
    }

    // Message is valid, proceed with processing
    return {
      valid: true,
      channel,
      args
    };
  } catch (error) {
    console.error('❌ IPC validation error:', error.message);
    return {
      valid: false,
      error: error.message,
      channel
    };
  }
}

/**
 * Preload bridge validator
 * Usage in electron/preload.cjs to validate before sending
 */
export function createSecureIPCBridge() {
  return {
    invoke: async (channel, ...args) => {
      try {
        validateIPCMessage(channel, args);
        // Safe to invoke
        return true;
      } catch (error) {
        console.error('❌ IPC validation failed:', error.message);
        return false;
      }
    },
    
    on: (channel) => {
      if (!allowedChannels[channel]) {
        console.warn(`⚠️ Listening to unknown channel: ${channel}`);
      }
    }
  };
}

export default {
  validateIPCMessage,
  validateTableAccess,
  validatePrintMessage,
  validateProductBulkOp,
  rateLimiter,
  handleSecureIPC,
  createSecureIPCBridge,
  allowedChannels,
  blockedTables
};
