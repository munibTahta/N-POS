/**
 * Database Batch Operations Utility
 * Prevents N+1 query problems by batching writes
 * Uses transactions for atomicity
 */

/**
 * Batch insert multiple rows into a table
 * More efficient than sequential inserts
 */
export const dbBatchInsert = async (table, rows) => {
  if (!rows || rows.length === 0) return { inserted: 0, failed: 0 };

  try {
    return await window.electronAPI.dbBatchInsert({
      table,
      rows
    });
  } catch (error) {
    console.error(`Batch insert failed for ${table}:`, error);
    throw error;
  }
};

/**
 * Batch update multiple rows
 */
export const dbBatchUpdate = async (table, updates) => {
  if (!updates || updates.length === 0) return { updated: 0, failed: 0 };

  try {
    return await window.electronAPI.dbBatchUpdate({
      table,
      updates
    });
  } catch (error) {
    console.error(`Batch update failed for ${table}:`, error);
    throw error;
  }
};

/**
 * Batch delete with where clause
 */
export const dbBatchDelete = async (table, whereClause) => {
  try {
    return await window.electronAPI.dbBatchDelete({
      table,
      whereClause
    });
  } catch (error) {
    console.error(`Batch delete failed for ${table}:`, error);
    throw error;
  }
};

/**
 * Upsert (insert or update) batch of rows
 */
export const dbBatchUpsert = async (table, rows, conflictKeys) => {
  if (!rows || rows.length === 0) return { upserted: 0, failed: 0 };

  try {
    return await window.electronAPI.dbBatchUpsert({
      table,
      rows,
      conflictKeys
    });
  } catch (error) {
    console.error(`Batch upsert failed for ${table}:`, error);
    throw error;
  }
};

export default {
  dbBatchInsert,
  dbBatchUpdate,
  dbBatchDelete,
  dbBatchUpsert
};
