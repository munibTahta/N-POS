import { createSale, updateProduct, getStockReport, createPurchase, recordPayment, createPaymentPending } from './api.js';
import { extractArray } from '../utils/apiResponseHelper.js';
import { logger } from '../utils/logger.js';
import { TIMEOUTS, RETRY } from '../config/appConstants.js';
import webSocketService from './webSocketService.js';
import safeStorage from '../utils/safeStorage.js';

const MAX_SYNC_ITEM_RETRIES = 3;

class StockConflictError extends Error {
  constructor(message, conflicts = []) {
    super(message);
    this.name = 'StockConflictError';
    this.isStockConflict = true;
    this.conflicts = conflicts;
  }
}

class SyncEngine {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.lastSyncTime = null;
    this.progressCallback = null; // Untuk progress tracking
    this.syncStats = { total: 0, completed: 0 }; // Track sync progress
    
    // ✅ FIX #1: Add transaction write lock to prevent race conditions
    this.transactionWriteLock = false; // Prevent concurrent writes during sync
    this.queuedTransactions = []; // Queue transactions during sync
    this.transactionsLocked = false; // ✅ FIX #2: UI-level transaction lock

    // Listen for online/offline events
    window.addEventListener('online', async () => {
      this.isOnline = true;
      this.transactionsLocked = true;  // ✅ FIX #2: Lock transactions during sync
      try {
        // Notify UI that sync is happening
        window.dispatchEvent(new CustomEvent('syncStarted'));
        this.connectWebSocket();
        await this.autoSync();
      } catch (error) {
        console.error('Auto sync failed', error);
      } finally {
        this.transactionsLocked = false;  // Unlock after sync
        window.dispatchEvent(new CustomEvent('syncCompleted'));
      }
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      webSocketService.disconnect();
    });

    // Setup WebSocket listeners for real-time updates
    this.setupWebSocketListeners();

    // Load last sync time
    this.loadLastSyncTime();

    // If app starts online, connect websocket and trigger an initial sync
    if (this.isOnline) {
      try {
        this.connectWebSocket();
        // run autoSync asynchronously to avoid blocking constructor
        setTimeout(() => this.autoSync(), 500);
      } catch (e) {
        logger.warn('Failed to start initial sync', { error: e?.message });
      }
    }
  }

  setupWebSocketListeners() {
    webSocketService.on('connected', () => {
      // Send authentication if needed
      const token = safeStorage.getItem('authToken');
      if (token) {
        webSocketService.send({ type: 'authenticate', token });
      }
    });

    webSocketService.on('message', (data) => {
      this.handleRealTimeUpdate(data);
    });

    webSocketService.on('disconnected', () => {
    });

    webSocketService.on('error', (error) => {
      logger.error('WebSocket error', error);
    });
  }

  // Set progress callback untuk UI update
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  // Emit progress update ke UI
  updateProgress(current, total, message = '') {
    const percent = Math.round((current / total) * 100);
    if (this.progressCallback) {
      this.progressCallback(percent, message);
    }
  }

  connectWebSocket() {
    if (this.isOnline) {
      const wsUrl = import.meta.env.VITE_WS_URL;
      // Only connect if WS URL is explicitly configured
      if (wsUrl) {
        webSocketService.connect(wsUrl);
      }
    }
  }

  handleRealTimeUpdate(data) {
    switch (data.type) {
      case 'product_updated':
        // Trigger product refresh in components
        window.dispatchEvent(new CustomEvent('productUpdated', { detail: data.product }));
        break;
      case 'sale_created':
        // Trigger sales refresh
        window.dispatchEvent(new CustomEvent('saleCreated', { detail: data.sale }));
        break;
      case 'stock_changed':
        // Trigger stock refresh
        window.dispatchEvent(new CustomEvent('stockChanged', { detail: data.stock }));
        break;
      default:
    }
  }

  async loadLastSyncTime() {
    // Use IPC to get sync metadata
    if (window.electronAPI && window.electronAPI.dbGetSyncMetadata) {
      try {
        const value = await window.electronAPI.dbGetSyncMetadata({ key: 'last_sync_time' });
        this.lastSyncTime = value;
      } catch (error) {
        logger.error('Failed to load last sync time', error);
      }
    }
  }

  saveLastSyncTime(time = new Date().toISOString()) {
    this.lastSyncTime = time;
    // Use IPC to set sync metadata - return Promise for proper await
    if (window.electronAPI && window.electronAPI.dbSetSyncMetadata) {
      return window.electronAPI.dbSetSyncMetadata({ key: 'last_sync_time', value: time }).then(result => {
        return result;
      }).catch(error => {
        logger.error('Failed to save last sync time', error);
        throw error;
      });
    }
    return Promise.resolve();
  }

  isSyncLocked() {
    return this.transactionsLocked || this.transactionWriteLock;
  }

  async autoSync() {
    if (!this.isOnline || this.syncInProgress) return;

    this.syncInProgress = true;
    try {
      await this.performFullSync();
    } catch (error) {
      logger.error('Auto sync failed', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  async performFullSync() {
    // Note: syncInProgress flag should be managed by caller (forceSync or autoSync)
    try {
      // ✅ FIX #1: Acquire write lock before sync to prevent race conditions
      this.transactionWriteLock = true;
      this.transactionsLocked = true;
      // Add timeout to prevent indefinite hanging
      const syncTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Sync timeout after 10 minutes')), TIMEOUTS.SYNC_TIMEOUT)
      );

      // Step 1: Recover any stuck sync queue items before pushing local changes
      await this.recoverStuckSyncItems();

      // Step 2: Push local changes to server (with retry)
      let pushSuccess = false;
      let pushAttempts = 0;

      while (!pushSuccess && pushAttempts < RETRY.SYNC_PUSH_ATTEMPTS) {
        try {
          pushAttempts++;
          await Promise.race([this.pushLocalChanges(), syncTimeout]);
          pushSuccess = true;
        } catch (error) {
          logger.warn('Push attempt failed', {
            attempt: pushAttempts,
            maxAttempts: RETRY.SYNC_PUSH_ATTEMPTS,
            error: error?.message
          });
          if (pushAttempts >= RETRY.SYNC_PUSH_ATTEMPTS) {
            throw new Error(`Gagal mengirim data lokal setelah ${RETRY.SYNC_PUSH_ATTEMPTS} percobaan: ${error?.message}`);
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * pushAttempts));
        }
      }

      // Cleanup old sync queue items before pull
      await this.cleanupOldSyncQueueItems(7);

      // Step 2: Pull latest data from server (with retry)
      let pullSuccess = false;
      let pullAttempts = 0;

      while (!pullSuccess && pullAttempts < RETRY.SYNC_PULL_ATTEMPTS) {
        try {
          pullAttempts++;
          await Promise.race([this.pullServerData(), syncTimeout]);
          pullSuccess = true;
        } catch (error) {
          logger.warn('Pull attempt failed', {
            attempt: pullAttempts,
            maxAttempts: RETRY.SYNC_PULL_ATTEMPTS,
            error: error?.message
          });
          if (pullAttempts >= RETRY.SYNC_PULL_ATTEMPTS) {
            throw new Error(`Gagal mengambil data server setelah ${RETRY.SYNC_PULL_ATTEMPTS} percobaan: ${error?.message}`);
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * pullAttempts));
        }
      }

      // Step 3: Update sync metadata
      await this.saveLastSyncTime();
    } catch (error) {
      console.error('❌ Full sync failed:', error?.message);
      throw error;
    } finally {
      // ✅ FIX #1: Release write lock and process queued transactions
      this.transactionWriteLock = false;
      this.transactionsLocked = false;
      // Process any transactions that were queued during sync
      if (this.queuedTransactions.length > 0) {
        const queued = [...this.queuedTransactions];
        this.queuedTransactions = [];
        
        for (const transaction of queued) {
          try {
            await transaction();
          } catch (err) {
            console.error('Failed to process queued transaction:', err.message);
          }
        }
      }
    }
  }

  async pushLocalChanges() {
    if (!window.electronAPI?.dbGetSyncQueue) {
      console.warn('IPC not available for sync operations');
      return;
    }

    try {
      const pendingItems = await window.electronAPI.dbGetSyncQueue({ status: ['pending', 'syncing', 'processing', 'failed'] });
      if (pendingItems.length === 0) {
        return;
      }

      let successCount = 0;
      let failureCount = 0;

      for (const item of pendingItems) {
        try {
          if (item.status === 'failed' && (item.retry_count || 0) >= MAX_SYNC_ITEM_RETRIES) {
            logger.warn(`Skipping sync item ${item.id} because it exceeded max retries`);
            continue;
          }

          if (window.electronAPI?.dbUpdateSyncStatus) {
            await window.electronAPI.dbUpdateSyncStatus({
              id: item.id,
              status: 'syncing'
            });
          }

          await this.processSyncItem(item);

          // ✅ CRITICAL: Validate server_id exists before deleting from queue
          // This ensures we have proof the item was successfully synced to server
          let hasServerId = item.server_id;

          if (!hasServerId) {
            // Re-fetch the item to check if server_id was updated during processSyncItem
            try {
              const updatedItem = await window.electronAPI.dbSelect({
                table: 'sync_queue',
                whereClause: 'id = ?',
                whereValues: [item.id]
              });

              if (updatedItem && updatedItem.length > 0) {
                hasServerId = updatedItem[0].server_id;
                item.server_id = hasServerId;
              }
            } catch (selectErr) {
              console.warn(`Could not verify server_id for item ${item.id}, proceeding with caution:`, selectErr.message);
            }
          }

          // For critical data (sales), require server_id. For others, allow deletion if processing succeeded
          const requiresServerId = ['sales', 'payment_details', 'purchases'].includes(item.table_name);

          if (requiresServerId && !hasServerId) {
            throw new Error(`Sync item ${item.id} (${item.table_name}) processed successfully but missing server_id - cannot delete from queue`);
          }

          // ✅ ATOMIC: Use transaction to ensure status update + delete happen together
          if (window.electronAPI?.dbTransaction) {
            await window.electronAPI.dbTransaction([
              {
                type: 'update',
                table: 'sync_queue',
                data: { status: 'completed', updated_at: new Date().toISOString() },
                whereClause: 'id = ?',
                whereValues: [item.id]
              },
              {
                type: 'delete',
                table: 'sync_queue',
                whereClause: 'id = ?',
                whereValues: [item.id]
              }
            ]);
            successCount++;
          } else {
            // Fallback to individual operations if transaction not available
            if (window.electronAPI?.dbUpdateSyncStatus) {
              await window.electronAPI.dbUpdateSyncStatus({
                id: item.id,
                status: 'completed'
              });
            }

            if (window.electronAPI?.dbDelete) {
              await window.electronAPI.dbDelete({
                table: 'sync_queue',
                whereClause: 'id = ?',
                whereValues: [item.id]
              });
              successCount++;
            } else {
              console.warn('dbDelete not available, marking as completed');
              if (window.electronAPI?.dbUpdateSyncStatus) {
                await window.electronAPI.dbUpdateSyncStatus({ id: item.id, status: 'completed' });
                successCount++;
              }
            }
          }
        } catch (error) {
          failureCount++;
          console.error(`Failed to sync item ${item.id}:`, error);

          if (error.isStockConflict) {
            if (window.electronAPI?.dbUpdateSyncStatus) {
              await window.electronAPI.dbUpdateSyncStatus({
                id: item.id,
                status: 'failed',
                retryCount: item.retry_count || 0
              });
            }
            continue;
          }

          const newRetryCount = (item.retry_count || 0) + 1;

          if (newRetryCount >= 3) {
            if (window.electronAPI?.dbUpdateSyncStatus) {
              await window.electronAPI.dbUpdateSyncStatus({
                id: item.id,
                status: 'failed',
                retryCount: newRetryCount
              });
            }
          } else {
            if (window.electronAPI?.dbUpdateSyncStatus) {
              await window.electronAPI.dbUpdateSyncStatus({
                id: item.id,
                status: 'pending',
                retryCount: newRetryCount
              });
            }
          }
        }
      }

      if (pendingItems.length > 0 && successCount === 0) {
        throw new Error(`Gagal mengirim semua ${pendingItems.length} item lokal ke server`);
      }

      return { successCount, failureCount };
    } catch (error) {
      console.error('Failed during push operation:', error?.message);
      throw error;
    }
  }

  async processSyncItem(item) {
    let data;
    try {
      data = JSON.parse(item.data);
    } catch (parseErr) {
      console.error('Failed to parse corrupted sync item data:', parseErr);
      logger.error('Corrupted sync data for item', item.id, ':', parseErr.message);
      throw new Error(`Invalid data format in sync queue: ${parseErr.message}`);
    }

    switch (item.operation) {
      case 'INSERT':
        if (item.table_name === 'sales') {
          return await this.syncSaleToServer(data, item);
        } else if (item.table_name === 'products') {
          return await this.syncProductToServer(data, item);
        } else if (item.table_name === 'purchases') {
          return await this.syncPurchaseToServer(data, item);
        } else if (item.table_name === 'payment_details') {
          return await this.syncPaymentDetailToServer(data, item);
        }
        break;

      case 'UPDATE':
        if (item.table_name === 'products') {
          return await updateProduct(item.record_id, data);
        }
        break;

      case 'DELETE':
        break;

      default:
        console.warn('Unknown sync operation:', item.operation);
    }
  }

  async syncSaleToServer(saleData, syncItem) {
    try {
      if (!saleData.id_penjualan || !saleData.kode_transaksi || saleData.total === undefined) {
        throw new Error(`Invalid sale data: missing required fields. Data: ${JSON.stringify(saleData)}`);
      }

      // ✅ FIX #4: Mark transaction as "processing" to indicate atomicity boundary
      if (window.electronAPI?.dbUpdate) {
        await window.electronAPI.dbUpdate({
          table: 'sync_queue',
          data: { status: 'processing' },
          whereClause: 'id = ?',
          whereValues: [syncItem.id]
        });
      }

      if (syncItem.server_id) {
        return { id: syncItem.server_id, status: 'already_synced' };
      }

      if (!window.electronAPI?.dbSelect) {
        throw new Error('IPC not available');
      }

      const saleItems = await window.electronAPI.dbSelect({
        table: 'sale_items',
        whereClause: 'id_penjualan = ?',
        whereValues: [saleData.id_penjualan]
      });

      const paymentDetails = await window.electronAPI.dbSelect({
        table: 'payment_details',
        whereClause: 'id_penjualan = ?',
        whereValues: [saleData.id_penjualan]
      });

      if (!saleItems || saleItems.length === 0) {
        throw new Error(`No sale items found for sale ID ${saleData.id_penjualan}`);
      }

      if (!paymentDetails || paymentDetails.length === 0) {
        throw new Error(`No payment details found for sale ID ${saleData.id_penjualan}`);
      }

      const posSettings = safeStorage.getJSON('posSettings', {});
      const allowOversellSync = posSettings.allowOversellSync === true;

      if (!allowOversellSync) {
        const stockConflicts = await this.checkStockConflicts(saleItems);
        if (stockConflicts.length > 0) {
          const conflictMessage = stockConflicts
            .map(conflict => `${conflict.productName} short ${conflict.shortage}`)
            .join('; ');

          await this.markSyncItemFailed(syncItem, `Stock conflict prevented sync: ${conflictMessage}`, {
            saleId: saleData.id_penjualan,
            kode_transaksi: saleData.kode_transaksi,
            conflicts: stockConflicts
          });

          throw new StockConflictError(`Stock conflict prevented sync for sale ${saleData.kode_transaksi}`, stockConflicts);
        }
      } else {
        logger.info(`Bypassing stock conflict check for sale ${saleData.kode_transaksi} (allowOversellSync is active)`);
      }

      const user = safeStorage.getJSON('user', {});
      const id_user = user.id_user || user.id;

      if (!id_user) {
        throw new Error('User ID not found in session - please login again');
      }

      const computedSaleTotal = saleData.total ?? saleItems.reduce((sum, item) => sum + (Number(item.jumlah) * Number(item.harga_satuan)), 0);
      const paymentTotal = paymentDetails.reduce((sum, payment) => sum + (Number(payment.jumlah_bayar) || 0), 0);

      if (paymentTotal > computedSaleTotal) {
        const errorMessage = `Total pembayaran ${paymentTotal} melebihi total transaksi ${computedSaleTotal}`;
        await this.markSyncItemFailed(syncItem, errorMessage, {
          saleId: saleData.id_penjualan,
          kode_transaksi: saleData.kode_transaksi
        });
        throw new Error(errorMessage);
      }

      if (saleData.status_pembayaran === 'lunas' && paymentTotal < computedSaleTotal) {
        const errorMessage = `Status pembayaran lunas tidak cocok dengan jumlah bayar ${paymentTotal} untuk total ${computedSaleTotal}`;
        await this.markSyncItemFailed(syncItem, errorMessage, {
          saleId: saleData.id_penjualan,
          kode_transaksi: saleData.kode_transaksi
        });
        throw new Error(errorMessage);
      }

      const saleStatus = saleData.status_pembayaran || (paymentTotal >= computedSaleTotal ? 'lunas' : 'pending');

      const serverSaleData = {
        kode_transaksi: saleData.kode_transaksi,
        id_cabang: saleData.id_cabang,
        id_user: id_user,
        bayar: saleData.bayar || paymentTotal || 0,
        id_pelanggan: saleData.id_pelanggan || null,
        total: computedSaleTotal,
        diskon: saleData.diskon || 0,
        pajak: saleData.pajak || 0,
        status_pembayaran: saleStatus,
        catatan: saleData.catatan || null,
        items: saleItems.map(item => ({
          id_produk: item.id_produk,
          jumlah: item.jumlah,
          harga_jual: item.harga_satuan
        }))
      };

      let response;
      try {
        response = await createSale(serverSaleData);
      } catch (apiError) {
        throw new Error(`API Error: ${apiError?.response?.data?.message || apiError?.message || 'Unknown error'}`);
      }

      if (!response || (!response.data && !response.success)) {
        throw new Error('Invalid server response - no data returned');
      }

      const serverId = response.data?.id_penjualan || response.data?.id;
      if (serverId && window.electronAPI?.dbUpdateSyncQueueServerId) {
        await window.electronAPI.dbUpdateSyncQueueServerId({
          syncId: syncItem.id,
          serverId: serverId,
          serverResponse: JSON.stringify(response)
        });
      }

      let paymentSyncErrors = [];
      if (paymentDetails && paymentDetails.length > 0) {
        paymentSyncErrors = await this.syncSalePaymentDetailsWithRecovery(serverId, paymentDetails, computedSaleTotal, saleData.id_penjualan);
      }

      if (window.electronAPI?.dbUpdate) {
        await window.electronAPI.dbUpdate({
          table: 'sales',
          data: { synced: 1 },
          whereClause: 'id_penjualan = ?',
          whereValues: [saleData.id_penjualan]
        });
      }

      if (paymentSyncErrors.length > 0) {
        await this.queueFailedPayments(paymentSyncErrors, saleData.id_penjualan, serverId);
      }

      return response;
    } catch (error) {
      console.error('Failed to sync sale to server:', error?.message);
      throw error;
    }
  }

  async syncSalePaymentDetails(serverSaleId, paymentDetails, saleTotal = 0) {
    if (!Array.isArray(paymentDetails) || paymentDetails.length === 0) return;

    const paidTotal = paymentDetails.reduce((sum, payment) => sum + (Number(payment.jumlah_bayar) || 0), 0);
    const isPending = paidTotal < saleTotal;

    for (const payment of paymentDetails) {
      const payload = {
        id_metode_pembayaran: payment.id_metode_pembayaran,
        jumlah_bayar: Number(payment.jumlah_bayar) || 0
      };

      if (payment.nomor_referensi) payload.nomor_referensi = payment.nomor_referensi;
      if (payment.catatan) payload.catatan = payment.catatan;

      try {
        if (isPending) {
          await createPaymentPending(serverSaleId, payload);
        } else {
          await recordPayment(serverSaleId, payload);
        }
      } catch (error) {
        throw new Error(`Failed to sync payment details: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
      }
    }
  }

  async syncSalePaymentDetailsWithRecovery(serverSaleId, paymentDetails, saleTotal = 0, saleId = null) {
    if (!Array.isArray(paymentDetails) || paymentDetails.length === 0) return [];

    const paidTotal = paymentDetails.reduce((sum, payment) => sum + (Number(payment.jumlah_bayar) || 0), 0);
    if (saleTotal <= 0) {
      throw new Error('Total transaksi tidak valid untuk sinkronisasi pembayaran');
    }
    if (paidTotal > saleTotal) {
      throw new Error(`Total pembayaran ${paidTotal} melebihi total transaksi ${saleTotal}`);
    }

    const isPending = paidTotal < saleTotal;
    const failedPayments = [];

    for (const payment of paymentDetails) {
      const payload = {
        id_metode_pembayaran: payment.id_metode_pembayaran,
        jumlah_bayar: Number(payment.jumlah_bayar) || 0
      };

      if (payment.nomor_referensi) payload.nomor_referensi = payment.nomor_referensi;
      if (payment.catatan) payload.catatan = payment.catatan;

      try {
        if (isPending) {
          await createPaymentPending(serverSaleId, payload);
        } else {
          await recordPayment(serverSaleId, payload);
        }
      } catch (error) {
        failedPayments.push({
          payment,
          payload,
          error: error?.response?.data?.message || error?.message || 'Unknown error',
          saleId,
          isPending
        });
        console.warn(`Payment sync failed for sale ${saleId}, method ${payment.id_metode_pembayaran}:`, error?.message);
      }
    }

    return failedPayments;
  }

  async queueFailedPayments(failedPayments, saleId, serverId) {
    if (!window.electronAPI?.dbInsert || failedPayments.length === 0) return;

    for (const failed of failedPayments) {
      try {
        const existingItems = window.electronAPI.dbSelect
          ? await window.electronAPI.dbSelect({
              table: 'sync_queue',
              whereClause: "table_name = ? AND record_id = ? AND operation = 'INSERT' AND status IN ('pending','syncing','processing','failed')",
              whereValues: ['payment_details', saleId]
            })
          : [];

        const payloadData = {
          id_penjualan: saleId,
          server_id_penjualan: serverId,
          ...failed.payload,
          isPending: failed.isPending,
          syncError: failed.error,
          originalError: failed.error
        };

        const duplicate = Array.isArray(existingItems) && existingItems.some(item => {
          try {
            const itemData = typeof item.data === 'string' ? JSON.parse(item.data) : item.data || {};
            return itemData.id_metode_pembayaran === failed.payload.id_metode_pembayaran &&
              Number(itemData.jumlah_bayar) === Number(failed.payload.jumlah_bayar) &&
              itemData.id_penjualan === saleId;
          } catch (_e) {
            return false;
          }
        });

        if (duplicate) {
          logger.info(`Duplicate payment retry queue item detected for sale ${saleId}, skipping duplicate insert`);
          continue;
        }

        await window.electronAPI.dbInsert({
          table: 'sync_queue',
          data: {
            table_name: 'payment_details',
            record_id: saleId,
            operation: 'INSERT',
            data: JSON.stringify(payloadData),
            status: 'pending',
            retry_count: 0,
            server_id: serverId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        });
      } catch (err) {
        console.error('Failed to queue payment for retry:', err?.message);
      }
    }
  }

  async syncPaymentDetailToServer(paymentData, syncItem) {
    const serverSaleId = paymentData.server_id_penjualan || paymentData.server_id;
    if (!serverSaleId) {
      throw new Error('Missing server sale ID for payment detail sync');
    }
    const payload = {
      id_metode_pembayaran: paymentData.id_metode_pembayaran,
      jumlah_bayar: Number(paymentData.jumlah_bayar) || 0
    };

    if (paymentData.nomor_referensi) payload.nomor_referensi = paymentData.nomor_referensi;
    if (paymentData.catatan) payload.catatan = paymentData.catatan;

    if (window.electronAPI?.dbUpdate) {
      await window.electronAPI.dbUpdate({
        table: 'sync_queue',
        data: { status: 'processing' },
        whereClause: 'id = ?',
        whereValues: [syncItem.id]
      });
    }

    const apiCall = paymentData.isPending ? createPaymentPending : recordPayment;
    const response = await apiCall(serverSaleId, payload);

    if (response && response.data && response.data.id && window.electronAPI?.dbUpdateSyncQueueServerId) {
      await window.electronAPI.dbUpdateSyncQueueServerId({
        syncId: syncItem.id,
        serverId: response.data.id,
        serverResponse: JSON.stringify(response)
      });
    }

    return response;
  }

  async cleanupOldSyncQueueItems(daysOld = 7) {
    if (!window.electronAPI?.dbDelete) return 0;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      const cutoffISO = cutoffDate.toISOString();

      const result = await window.electronAPI.dbDelete({
        table: 'sync_queue',
        whereClause: "status = 'completed' AND updated_at < ?",
        whereValues: [cutoffISO]
      });

      if (result?.changes > 0) {
      }
      return result?.changes || 0;
    } catch (error) {
      console.error('Failed to cleanup old sync queue items:', error?.message);
      return 0;
    }
  }

  async syncPurchaseToServer(purchaseData, syncItem) {
    try {
      if (!window.electronAPI?.dbSelect) {
        throw new Error('IPC not available');
      }

      if (syncItem.server_id) {
        return { id: syncItem.server_id, status: 'already_synced' };
      }

      const purchaseItems = await window.electronAPI.dbSelect({
        table: 'purchase_items',
        whereClause: 'id_pembelian = ?',
        whereValues: [purchaseData.id_pembelian]
      });

      const serverPurchaseData = {
        ...purchaseData,
        items: purchaseItems.map(item => ({
          id_produk: item.id_produk,
          jumlah: item.jumlah,
          harga_beli: item.harga_beli
        }))
      };

      const response = await createPurchase(serverPurchaseData);

      const serverId = response.data?.id_pembelian || response.data?.id;
      if (serverId && window.electronAPI?.dbUpdateSyncQueueServerId) {
        await window.electronAPI.dbUpdateSyncQueueServerId({
          syncId: syncItem.id,
          serverId: serverId,
          serverResponse: JSON.stringify(response)
        });
      }

      if (window.electronAPI?.dbUpdate) {
        await window.electronAPI.dbUpdate({
          table: 'purchases',
          data: { synced: 1 },
          whereClause: 'id_pembelian = ?',
          whereValues: [purchaseData.id_pembelian]
        });
      }

      return response;
    } catch (error) {
      console.error('Failed to sync purchase to server:', error);
      throw error;
    }
  }

  async checkStockConflicts(saleItems) {
    const conflicts = [];

    try {
      // Get current stock from server
      const stockResponse = await getStockReport();
      const stockData = stockResponse.data?.data || [];

      // Create stock map for current branch or fallback to global stock
      const stockMap = {};
      const currentBranchId = this.getCurrentBranchId();

      stockData.forEach(productStock => {
        let branchStock = null;

        if (productStock.detail_lokasi?.cabang && Array.isArray(productStock.detail_lokasi.cabang)) {
          branchStock = productStock.detail_lokasi.cabang.find(c => c.id_cabang === currentBranchId);
        }

        if (!branchStock && productStock.stok !== undefined) {
          branchStock = { stok: productStock.stok };
        }

        stockMap[productStock.id_produk] = branchStock?.stok || 0;
      });

      // Check each sale item against current stock
      for (const item of saleItems) {
        const currentStock = stockMap[item.id_produk] || 0;
        if (item.jumlah > currentStock) {
          conflicts.push({
            productId: item.id_produk,
            productName: item.nama_produk || `Product ${item.id_produk}`,
            requested: item.jumlah,
            available: currentStock,
            shortage: item.jumlah - currentStock
          });
        }
      }

    } catch (error) {
      console.error('Failed to check stock conflicts:', error);
      // If we can't check stock, assume no conflicts to avoid blocking sync
    }

    return conflicts;
  }

  async markSyncItemFailed(syncItem, errorMessage, extraData = null) {
    try {
      if (!window.electronAPI?.dbUpdate) return;

      let updatedData = syncItem.data;
      if (extraData) {
        try {
          const originalData = typeof syncItem.data === 'string' ? JSON.parse(syncItem.data) : syncItem.data || {};
          updatedData = JSON.stringify({ ...originalData, syncError: errorMessage, conflictDetails: extraData });
        } catch {
          updatedData = JSON.stringify({ rawData: syncItem.data, syncError: errorMessage, conflictDetails: extraData });
        }
      }

      await window.electronAPI.dbUpdate({
        table: 'sync_queue',
        data: {
          status: 'failed',
          error_message: errorMessage,
          data: updatedData
        },
        whereClause: 'id = ?',
        whereValues: [syncItem.id]
      });
    } catch (error) {
      console.error('Failed to mark sync item failed:', error?.message);
    }
  }

  async recoverStuckSyncItems() {
    if (!window.electronAPI?.dbUpdate) return;

    try {
      await window.electronAPI.dbUpdate({
        table: 'sync_queue',
        data: { status: 'pending' },
        whereClause: "status IN ('syncing','processing')",
        whereValues: []
      });

      await window.electronAPI.dbUpdate({
        table: 'sync_queue',
        data: { status: 'pending' },
        whereClause: "status = 'failed' AND retry_count < ?",
        whereValues: [MAX_SYNC_ITEM_RETRIES]
      });
    } catch (error) {
      console.error('Failed to recover stuck sync queue items:', error?.message);
    }
  }

  getCurrentBranchId() {
    // Get current branch ID from user context or local storage
    const user = safeStorage.getJSON('user', {});
    return user.id_cabang;
  }

  async syncProductToServer(productData, syncItem) {
    try {
      if (syncItem.server_id) {
        return { id: syncItem.server_id, status: 'already_synced' };
      }

      const response = await updateProduct(productData.id, productData);

      const serverId = response.data?.id || productData.id;
      if (serverId && window.electronAPI?.dbUpdateSyncQueueServerId) {
        await window.electronAPI.dbUpdateSyncQueueServerId({
          syncId: syncItem.id,
          serverId: serverId,
          serverResponse: JSON.stringify(response)
        });
      }

      if (window.electronAPI?.dbUpdate) {
        await window.electronAPI.dbUpdate({
          table: 'products',
          data: { synced: 1 },
          whereClause: 'id = ?',
          whereValues: [productData.id]
        });
      }

      return response;
    } catch (error) {
      console.error('Failed to sync product to server:', error);
      throw error;
    }
  }

  async pullServerData() {
    try {
      const { getSales, getPurchases } = await import('./api.js');

      // Total steps untuk tracking progress
      const totalSteps = 8; // Products, Stocks, Categories, Units, Suppliers, Branches, Sales, Purchases
      let currentStep = 0;

      currentStep++;
      this.updateProgress(currentStep, totalSteps, '📦 Products...');
      await this.pullProducts();

      currentStep++;
      this.updateProgress(currentStep, totalSteps, '📊 Stock...');
      await this.pullStocks();


      
      currentStep++;
      this.updateProgress(currentStep, totalSteps, '📋 Categories...');
      await this.pullCategories();
      
      currentStep++;
      this.updateProgress(currentStep, totalSteps, '📋 Units...');
      await this.pullUnits();
      
      currentStep++;
      this.updateProgress(currentStep, totalSteps, '📋 Suppliers...');
      await this.pullSuppliers();

      currentStep++;
      this.updateProgress(currentStep, totalSteps, '🏢 Branches...');
      await this.pullBranches();


      
      currentStep++;
      this.updateProgress(currentStep, totalSteps, '📊 Sales & Items...');
      
      // Pull sales dan purchases
      try {
        // Pull sales (only recent ones based on last sync)
        const salesParams = this.lastSyncTime ? { updated_after: this.lastSyncTime } : {};
        const salesResponse = await getSales(salesParams);
        const salesData = extractArray(salesResponse);

        // Update local sales
        const skippedSales = [];
        for (const sale of salesData) {
          if (!window.electronAPI?.dbSelect || !window.electronAPI?.dbInsert) continue;

          // Check if sale exists by id_penjualan OR kode_transaksi (UNIQUE constraint)
          const existing = await window.electronAPI.dbSelect({
            table: 'sales',
            whereClause: 'id_penjualan = ? OR kode_transaksi = ?',
            whereValues: [sale.id_penjualan, sale.kode_transaksi]
          });

          if (existing.length === 0) {
            // Insert new sale
            const mappedSale = {
              id_penjualan: sale.id_penjualan,
              kode_transaksi: sale.kode_transaksi,
              id_cabang: sale.id_cabang,
              id_pelanggan: sale.id_pelanggan,
              tanggal: sale.tanggal || sale.tanggal_transaksi || null,
              total: sale.total,
              status_pembayaran: sale.status_pembayaran,
              synced: 1
            };
            
            try {
              await window.electronAPI.dbInsert({
                table: 'sales',
                data: mappedSale
              });

              // Insert sale items with batch product existence validation
              if (sale.detail_penjualan && Array.isArray(sale.detail_penjualan)) {
                const productIds = [...new Set(sale.detail_penjualan.map(item => item.id_produk).filter(Boolean))];
                const validProductIds = new Set();

                if (productIds.length > 0) {
                  const placeholders = productIds.map(() => '?').join(',');
                  const existingProducts = await window.electronAPI.dbSelect({
                    table: 'products',
                    whereClause: `id_produk IN (${placeholders})`,
                    whereValues: productIds,
                    limit: productIds.length
                  });
                  existingProducts.forEach(product => validProductIds.add(product.id_produk));
                }

                for (const item of sale.detail_penjualan) {
                  if (!validProductIds.has(item.id_produk)) {
                    console.warn(`Skipping sale item for non-existent product ${item.id_produk}`);
                    continue;
                  }

                  try {
                    await window.electronAPI.dbInsert({
                      table: 'sale_items',
                      data: {
                        id_penjualan: sale.id_penjualan,
                        id_produk: item.id_produk,
                        jumlah: item.jumlah,
                        harga_jual: item.harga_jual
                      }
                    });
                  } catch (itemErr) {
                    console.warn(`Failed to sync sale item for ${sale.kode_transaksi}:`, itemErr.message);
                  }
                }
              }
            } catch (err) {
              console.warn(`Failed to sync sale ${sale.kode_transaksi}:`, err.message);
            }
          } else {
            // Collect skipped sale to summarize later (avoid noisy per-item logs)
            skippedSales.push({ kode: sale.kode_transaksi, id: sale.id_penjualan });
          }
        }
        if (skippedSales.length > 0) {
          const sample = skippedSales.slice(0, 6).map(s => s.kode).join(', ');
        }

        // Pull purchases (dengan products sudah tersinkron - tidak ada skip lagi)
        const purchasesResponse = await getPurchases();
        const purchasesData = extractArray(purchasesResponse);

        for (const purchase of purchasesData) {
          if (!window.electronAPI?.dbSelect || !window.electronAPI?.dbInsert) continue;

          // Check if purchase exists by id_pembelian OR kode_pembelian (likely UNIQUE)
          const existing = await window.electronAPI.dbSelect({
            table: 'purchases',
            whereClause: 'id_pembelian = ? OR kode_pembelian = ?',
            whereValues: [purchase.id_pembelian, purchase.kode_pembelian]
          });

          if (existing.length === 0) {
            // Insert new purchase
            const mappedPurchase = {
              id_pembelian: purchase.id_pembelian,
              kode_pembelian: purchase.kode_pembelian,
              id_supplier: purchase.id_supplier,
              id_cabang: purchase.id_cabang,
              tanggal: purchase.tanggal,
              total: purchase.total,
              status: purchase.status,
              masuk_gudang: purchase.masuk_gudang,
              catatan: purchase.catatan,
              id_user: purchase.id_user,
              synced: 1,
              sync_version: 1
            };

            try {
              await window.electronAPI.dbInsert({
                table: 'purchases',
                data: mappedPurchase
              });

              // Insert purchase items with batch product lookup
              if (purchase.items) {
                const productIds = [...new Set(purchase.items.map(item => item.id_produk).filter(Boolean))];
                const validProductIds = new Set();

                if (productIds.length > 0) {
                  const placeholders = productIds.map(() => '?').join(',');
                  const existingProducts = await window.electronAPI.dbSelect({
                    table: 'products',
                    whereClause: `id_produk IN (${placeholders})`,
                    whereValues: productIds,
                    limit: productIds.length
                  });
                  existingProducts.forEach(product => validProductIds.add(product.id_produk));
                }

                for (const item of purchase.items) {
                  if (!validProductIds.has(item.id_produk)) {
                    console.warn(`Skipping purchase item for non-existent product ${item.id_produk}`);
                    continue;
                  }

                  const mappedItem = {
                    id_pembelian: purchase.id_pembelian,
                    id_produk: item.id_produk,
                    jumlah: item.jumlah,
                    harga_beli: item.harga_beli,
                    subtotal: item.jumlah * item.harga_beli
                  };

                  await window.electronAPI.dbInsert({
                    table: 'purchase_items',
                    data: mappedItem
                  });
                }
              }
            } catch (purchaseError) {
              // Handle duplicate constraint or other errors gracefully
              if (purchaseError.message.includes('UNIQUE constraint failed')) {
                console.warn(`Skipping duplicate purchase ${purchase.kode_pembelian}:`, purchaseError.message);
              } else {
                throw purchaseError;
              }
            }
          }
        }
      } catch (error) {
        console.warn('Failed to pull sales and purchases:', error);
      }

      this.updateProgress(totalSteps, totalSteps, '✅ Sync Complete!');

    } catch (error) {
      console.error('Failed to pull server data:', error);
      throw error;
    }
  }

  // Get sync status
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      pendingCount: 0, // Will be updated via IPC in SyncContext
      failedCount: 0  // Will be updated via IPC in SyncContext
    };
  }

  // Get detailed sync statistics
  async getSyncStats() {
    try {
      if (!window.electronAPI?.dbSelect) {
        return { pending: 0, failed: 0, completed: 0 };
      }

      const [pending, failed, completed] = await Promise.all([
        window.electronAPI.dbSelect({ table: 'sync_queue', whereClause: "status = 'pending'" }),
        window.electronAPI.dbSelect({ table: 'sync_queue', whereClause: "status = 'failed'" }),
        window.electronAPI.dbSelect({ table: 'sync_queue', whereClause: "status = 'completed'" })
      ]);

      return {
        pending: pending.length,
        failed: failed.length,
        completed: completed.length,
        total: pending.length + failed.length + completed.length
      };
    } catch (error) {
      console.error('Failed to get sync stats:', error);
      return { pending: 0, failed: 0, completed: 0, total: 0 };
    }
  }

  // Force sync with enhanced error handling
  async forceSync() {
    if (!this.isOnline) {
      throw new Error('Tidak dapat sync saat offline');
    }

    if (this.syncInProgress) {
      throw new Error('Sync sedang berlangsung');
    }
    this.syncInProgress = true;

    try {
      // Validate IPC availability
      if (!window.electronAPI) {
        throw new Error('IPC tidak tersedia - aplikasi tidak dapat berkomunikasi dengan database');
      }

      await this.performFullSync();
      return { success: true, message: 'Sinkronisasi berhasil' };
    } catch (error) {
      console.error('Force sync failed:', error);

      // Provide detailed error information
      let errorType = 'unknown';
      let userMessage = 'Sinkronisasi gagal';

      if (error.message.includes('network') || error.message.includes('fetch')) {
        errorType = 'network';
        userMessage = 'Koneksi internet bermasalah - periksa koneksi Anda';
      } else if (error.message.includes('timeout')) {
        errorType = 'timeout';
        userMessage = 'Server tidak merespons - coba lagi nanti';
      } else if (error.message.includes('unauthorized') || error.message.includes('403')) {
        errorType = 'auth';
        userMessage = 'Akses ditolak - periksa kredensial login Anda';
      } else if (error.message.includes('IPC') || error.message.includes('electronAPI')) {
        errorType = 'ipc';
        userMessage = 'Kesalahan internal aplikasi - restart aplikasi';
      }

      throw new Error(`${userMessage} (${errorType})`);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Refresh data from server without pushing local changes
  // ⭐ Perbarui Data: Hanya ambil data terbaru dari server
  async updateDataFromServer() {
    if (!this.isOnline) {
      throw new Error('Tidak dapat update saat offline');
    }
    try {
      // Validate IPC availability
      if (!window.electronAPI) {
        throw new Error('IPC tidak tersedia');
      }

      // Only pull server data, don't push local changes
      await this.pullServerData();

      // Update sync metadata
      await this.saveLastSyncTime();
      return { success: true, message: 'Data berhasil di-update dari server' };
    } catch (error) {
      console.error('Data update failed:', error);
      throw new Error(`Update gagal: ${error.message}`);
    }
  }

  // ⭐ Sinkron Data: Kirim perubahan lokal + ambil data terbaru dari server
  async syncDataBidirectional() {
    if (!this.isOnline) {
      throw new Error('Tidak dapat sinkron saat offline');
    }
    try {
      // Validate IPC availability
      if (!window.electronAPI) {
        throw new Error('IPC tidak tersedia');
      }

      await this.pushLocalData();
      await this.pullServerData();

      // Update sync metadata
      await this.saveLastSyncTime();
      return { success: true, message: 'Sinkronisasi data berhasil' };
    } catch (error) {
      console.error('Data sync failed:', error);
      throw new Error(`Sinkron gagal: ${error.message}`);
    }
  }

  // Push local changes to server
  async pushLocalData() {
    try {
      if (!window.electronAPI?.dbSelect) return;

      // Push pending sales (filter in client to avoid DB schema issues)
      let allSales = [];
      try {
        allSales = await window.electronAPI.dbSelect({
          table: 'sales'
        }) || [];
      } catch (err) {
        console.warn('Could not fetch sales from DB:', err.message);
      }
      
      const pendingSales = allSales.filter(s => s.synced === 0 || s.synced === false || !s.synced);

      for (const sale of pendingSales) {
        try {
          await createSale(sale);
          if (window.electronAPI?.dbUpdate) {
            await window.electronAPI.dbUpdate({
              table: 'sales',
              data: { synced: 1 },
              whereClause: 'id_penjualan = ?',
              whereValues: [sale.id_penjualan]
            });
          }
        } catch (err) {
          console.warn(`Failed to push sale ${sale.kode_transaksi}:`, err.message);
        }
      }

      // Push pending purchases (filter in client)
      let allPurchases = [];
      try {
        allPurchases = await window.electronAPI.dbSelect({
          table: 'purchases'
        }) || [];
      } catch (err) {
        console.warn('Could not fetch purchases from DB:', err.message);
      }
      
      const pendingPurchases = allPurchases.filter(p => p.synced === 0 || p.synced === false || !p.synced);

      for (const purchase of pendingPurchases) {
        try {
          await createPurchase(purchase);
          if (window.electronAPI?.dbUpdate) {
            await window.electronAPI.dbUpdate({
              table: 'purchases',
              data: { synced: 1 },
              whereClause: 'id_pembelian = ?',
              whereValues: [purchase.id_pembelian]
            });
          }
        } catch (err) {
          console.warn(`Failed to push purchase ${purchase.kode_pembelian}:`, err.message);
        }
      }


    } catch (error) {
      console.warn('Failed to push local data:', error);
    }
  }

  // Get data with fallback to local if offline
  async getDataWithFallback(apiCall, tableName, whereClause = '', whereValues = []) {
    if (this.isOnline) {
      try {
        const response = await apiCall();
        return extractArray(response);
      } catch (error) {
        console.warn('API call failed, falling back to local data:', error);
      }
    }

    // Fallback to local data
    if (window.electronAPI?.dbSelect) {
      return await window.electronAPI.dbSelect({ table: tableName, whereClause, whereValues });
    }

    return [];
  }

  // Helper: Pull Products (PRIORITAS TERTINGGI)
  async pullProducts() {
    try {
      const { getProducts } = await import('./api.js');
      const productsResponse = await getProducts();
      const productsData = extractArray(productsResponse);

      for (const product of productsData) {
        if (!window.electronAPI?.dbSelect || !window.electronAPI?.dbInsert || !window.electronAPI?.dbUpdate) {
          continue;
        }

        const existing = await window.electronAPI.dbSelect({
          table: 'products',
          whereClause: 'id_produk = ?',
          whereValues: [product.id_produk || product.id]
        });

        const mappedProduct = {
          id_produk: product.id_produk || product.id,
          kode_produk: product.kode_produk,
          nama_produk: product.nama_produk,
          id_kategori: product.id_kategori,
          id_satuan: product.id_satuan,
          harga_beli: product.harga_beli,
          harga_jual: product.harga_jual,
          harga_grosir: product.harga_grosir || 0,
          min_qty_grosir: product.min_qty_grosir || 0,
          stok_minimum: product.stok_minimum,
          status: product.status,
          gambar: product.gambar,
          barcode: product.barcode,
          id_cabang_pemilik: product.id_cabang_pemilik || null,
          urutan: product.urutan || 0,
          created_at: product.created_at,
          updated_at: product.updated_at,
          synced: 1,
          sync_version: existing.length > 0 ? (existing[0].sync_version || 0) + 1 : 1
        };

        if (existing.length > 0) {
          await window.electronAPI.dbUpdate({
            table: 'products',
            data: mappedProduct,
            whereClause: 'id_produk = ?',
            whereValues: [product.id_produk || product.id]
          });
        } else {
          await window.electronAPI.dbInsert({
            table: 'products',
            data: mappedProduct
          });
        }
      }

      // Also sync products to product_offline.db for product database indexing
      if (productsData.length > 0 && window.electronAPI?.productDB_bulkUpsertProducts) {
        try {
          const result = await window.electronAPI.productDB_bulkUpsertProducts(productsData);
        } catch (indexError) {
          console.warn('Failed to index products:', indexError.message);
          // Continue - don't fail entire sync if indexing fails
        }
      }

    } catch (error) {
      console.warn('Failed to pull products:', error);
      throw error;
    }
  }

  // Helper: Pull Stocks dari detail lokasi cabang di products
  async pullStocks() {
    try {
      const { getProducts } = await import('./api.js');
      const productsResponse = await getProducts();
      const productsData = extractArray(productsResponse);

      const stocks = [];
      
      for (const product of productsData) {
        // Extract stock data dari detail_lokasi.cabang
        if (product.detail_lokasi?.cabang && Array.isArray(product.detail_lokasi.cabang)) {
          for (const branchStock of product.detail_lokasi.cabang) {
            stocks.push({
              id_produk: product.id_produk || product.id,
              id_cabang: branchStock.id_cabang,
              stok: branchStock.stok || 0,
              lokasi_rak: branchStock.lokasi_rak || null,
              updated_at: product.updated_at || new Date().toISOString()
            });
          }
        }
      }

      // Bulk upsert stocks ke product_offline.db
      if (stocks.length > 0 && window.electronAPI?.productDB_bulkUpsertStocks) {
        try {
          const result = await window.electronAPI.productDB_bulkUpsertStocks(stocks);
          if (result?.synced > 0 || (result?.failed > 0)) {
          }
        } catch (stockError) {
          console.warn('Failed to upsert stocks:', stockError.message);
          // Continue jangan fail entire sync jika stock sync gagal
        }
      }
    } catch (error) {
      console.warn('Failed to pull stocks:', error);
      // Don't throw - let sync continue even if stocks fail
    }
  }
  async pullCategories() {
    try {
      const { getCategories } = await import('./api.js');
      const categoriesResponse = await getCategories();
      const categoriesData = extractArray(categoriesResponse);
      
      for (const category of categoriesData) {
        if (!window.electronAPI?.dbSelect || !window.electronAPI?.dbInsert || !window.electronAPI?.dbUpdate) continue;

        const existing = await window.electronAPI.dbSelect({
          table: 'categories',
          whereClause: 'id_kategori = ?',
          whereValues: [category.id_kategori || category.id]
        });

        if (existing.length > 0) {
          await window.electronAPI.dbUpdate({
            table: 'categories',
            data: {
              nama_kategori: category.nama_kategori,
              updated_at: category.updated_at,
              synced: 1
            },
            whereClause: 'id_kategori = ?',
            whereValues: [category.id_kategori || category.id]
          });
        } else {
          await window.electronAPI.dbInsert({
            table: 'categories',
            data: {
              id_kategori: category.id_kategori || category.id,
              nama_kategori: category.nama_kategori,
              created_at: category.created_at,
              updated_at: category.updated_at,
              synced: 1
            }
          });
        }
      }
    } catch (error) {
      console.warn('Failed to pull categories:', error);
    }
  }

  // Helper: Pull Units
  async pullUnits() {
    try {
      const { getUnits } = await import('./api.js');
      const unitsResponse = await getUnits();
      const unitsData = extractArray(unitsResponse);
      
      for (const unit of unitsData) {
        if (!window.electronAPI?.dbSelect || !window.electronAPI?.dbInsert || !window.electronAPI?.dbUpdate) continue;

        const existing = await window.electronAPI.dbSelect({
          table: 'units',
          whereClause: 'id_satuan = ?',
          whereValues: [unit.id_satuan || unit.id]
        });

        if (existing.length > 0) {
          await window.electronAPI.dbUpdate({
            table: 'units',
            data: {
              nama_satuan: unit.nama_satuan,
              updated_at: unit.updated_at,
              synced: 1
            },
            whereClause: 'id_satuan = ?',
            whereValues: [unit.id_satuan || unit.id]
          });
        } else {
          await window.electronAPI.dbInsert({
            table: 'units',
            data: {
              id_satuan: unit.id_satuan || unit.id,
              nama_satuan: unit.nama_satuan,
              created_at: unit.created_at,
              updated_at: unit.updated_at,
              synced: 1
            }
          });
        }
      }
    } catch (error) {
      console.warn('Failed to pull units:', error);
    }
  }

  // Helper: Pull Suppliers
  async pullSuppliers() {
    try {
      const { getSuppliers } = await import('./api.js');
      const suppliersResponse = await getSuppliers();
      const suppliersData = extractArray(suppliersResponse);
      
      for (const supplier of suppliersData) {
        if (!window.electronAPI?.dbSelect || !window.electronAPI?.dbInsert || !window.electronAPI?.dbUpdate) continue;

        const existing = await window.electronAPI.dbSelect({
          table: 'supplier',
          whereClause: 'id_supplier = ?',
          whereValues: [supplier.id_supplier || supplier.id]
        });

        if (existing.length > 0) {
          await window.electronAPI.dbUpdate({
            table: 'supplier',
            data: {
              nama_supplier: supplier.nama_supplier,
              alamat: supplier.alamat,
              telepon: supplier.telepon,
              email: supplier.email,
              updated_at: supplier.updated_at,
              synced: 1
            },
            whereClause: 'id_supplier = ?',
            whereValues: [supplier.id_supplier || supplier.id]
          });
        } else {
          await window.electronAPI.dbInsert({
            table: 'supplier',
            data: {
              id_supplier: supplier.id_supplier || supplier.id,
              nama_supplier: supplier.nama_supplier,
              alamat: supplier.alamat,
              telepon: supplier.telepon,
              email: supplier.email,
              created_at: supplier.created_at,
              updated_at: supplier.updated_at,
              synced: 1
            }
          });
        }
      }
    } catch (error) {
      console.warn('Failed to pull suppliers:', error);
    }
  }

  async pullBranches() {
    try {
      const { getBranches } = await import('./api.js');
      const branchesResponse = await getBranches();
      const branchesData = extractArray(branchesResponse);
      
      for (const branch of branchesData) {
        if (!window.electronAPI?.dbSelect || !window.electronAPI?.dbInsert || !window.electronAPI?.dbUpdate) continue;

        const existing = await window.electronAPI.dbSelect({
          table: 'branches',
          whereClause: 'id_cabang = ?',
          whereValues: [branch.id_cabang || branch.id]
        });

        const data = {
          id_cabang: branch.id_cabang || branch.id,
          kode_cabang: branch.kode_cabang,
          nama_cabang: branch.nama_cabang,
          alamat: branch.alamat,
          kota: branch.kota,
          no_telp: branch.no_telp || branch.telepon || '',
          status: branch.status || 'aktif',
          tipe_katalog: branch.tipe_katalog || 'global',
          created_at: branch.created_at || new Date().toISOString()
        };

        if (existing.length > 0) {
          await window.electronAPI.dbUpdate({
            table: 'branches',
            data,
            whereClause: 'id_cabang = ?',
            whereValues: [branch.id_cabang || branch.id]
          });
        } else {
          await window.electronAPI.dbInsert({
            table: 'branches',
            data
          });
        }
      }
    } catch (error) {
      console.warn('Failed to pull branches:', error);
    }
  }

  async initializeFromCrash() {
    try {
      if (!window.electronAPI?.dbGetSyncQueue) return;

      const syncingItems = await window.electronAPI.dbGetSyncQueue({ status: 'syncing' });
      for (const item of syncingItems) {
        await window.electronAPI.dbUpdateSyncStatus({
          id: item.id,
          status: 'pending'
        });
      }
    } catch (error) {
      console.warn('Failed to recover from crash:', error);
    }
  }
}

const syncEngineInstance = new SyncEngine();

// Helper function for exponential backoff retry
function scheduleRecoveryRetry(retryCount = 0, maxRetries = 3) {
  const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30 seconds
  
  if (retryCount >= maxRetries) {
    console.warn('Sync recovery failed after max retries. Will retry on next online event.');
    return;
  }
  setTimeout(async () => {
    try {
      await syncEngineInstance.initializeFromCrash();
    } catch (err) {
      console.warn('Sync recovery retry failed:', err);
      scheduleRecoveryRetry(retryCount + 1, maxRetries);
    }
  }, delay);
}

if (window.electronAPI) {
  // Initial recovery attempt with retry mechanism
  syncEngineInstance.initializeFromCrash().catch(err => {
    console.warn('Initial crash recovery failed:', err);
    scheduleRecoveryRetry(0, 3);
  });
  
  // Also retry on online event for extra resilience
  window.addEventListener('online', () => {
    syncEngineInstance.initializeFromCrash().catch(err => {
      console.warn('Recovery on online event failed:', err);
    });
  });
}

export default syncEngineInstance;