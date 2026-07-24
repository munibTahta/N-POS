// src/services/posService.js
import { createSale, recordPayment, createPaymentPending, createLogAktivitas } from './api';
import { extractData } from '../utils/apiResponseHelper';

class PosService {
  constructor() {
    this.pendingTransactions = new Map();
  }

  // Validasi transaksi sebelum submit
  validateTransaction(cart, paymentAmount, total, selectedPaymentMethod, isPendingPayment = false) {
    const errors = [];

    // Validasi keranjang
    if (!cart || cart.length === 0) {
      errors.push('Keranjang kosong');
      return { isValid: false, errors };
    }

    // Validasi item dalam keranjang
    cart.forEach((item, index) => {
      if (!item.id_produk || typeof item.id_produk !== 'number') {
        errors.push(`Item ${index + 1}: ID produk tidak valid`);
      }
      if (!item.jumlah || item.jumlah <= 0) {
        errors.push(`Item ${item.nama_produk || `ke-${index + 1}`}: Jumlah harus lebih dari 0`);
      }
      if (!item.harga_jual || item.harga_jual < 0) {
        errors.push(`Item ${item.nama_produk || `ke-${index + 1}`}: Harga jual tidak valid`);
      }
    });

    // Validasi metode pembayaran
    if (!selectedPaymentMethod || !selectedPaymentMethod.id_metode_pembayaran) {
      errors.push('Metode pembayaran belum dipilih');
    }

    // Validasi pembayaran
    if (typeof paymentAmount !== 'number' || paymentAmount < 0) {
      errors.push('Jumlah pembayaran tidak valid');
    }

    // Validasi pembayaran lengkap vs pending
    if (!isPendingPayment && paymentAmount < total) {
      errors.push(`Pembayaran kurang dari total. Total: ${total}, Dibayar: ${paymentAmount}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Membuat data transaksi untuk API
  prepareTransactionData(cart, customer, payment, discount, totals, user) {
    const saleData = {
      kode_transaksi: `POS-${window.crypto?.randomUUID ? window.crypto.randomUUID() : Date.now()}-${Math.floor(Math.random() * 1000)}`,
      id_cabang: user.id_cabang,
      id_user: user.id_user,
      bayar: payment.amount,
      items: cart.map(item => ({
        id_produk: item.id_produk,
        jumlah: item.jumlah,
        harga_jual: item.harga_jual
      }))
    };

    const baseTotal = (totals && (typeof totals.total === 'number') ? totals.total : saleData.items.reduce((s, it) => s + (it.harga_jual * it.jumlah), 0));
    saleData.total = baseTotal;

    // Tambahkan field opsional
    if (customer?.id_pelanggan) {
      saleData.id_pelanggan = customer.id_pelanggan;
    }

    if (discount?.amount > 0) {
      saleData.diskon = discount.amount;
    }

    // Attach tax if provided
    if (totals && totals.taxAmount > 0) {
      saleData.pajak = totals.taxAmount;
    }

    // Compute and attach payment fee (prefer nominal, then percent, then konfigurasi.biaya_admin)
    try {
      const method = payment.method || {};
      const nominal = Number(method.biaya_tambahan_nominal ?? method.biaya_tambahan ?? method.konfigurasi?.biaya_admin ?? 0) || 0;
      const persen = Number(method.biaya_tambahan_persen ?? 0) || 0;
      let computedFee = 0;
      if (nominal > 0) computedFee = nominal;
      else if (persen > 0) computedFee = (baseTotal * persen) / 100;
      if (computedFee > 0) saleData.biaya_tambahan = Number(computedFee);
    } catch (_e) {
      // ignore and continue
    }

    return saleData;
  }

  // Submit transaksi online
  async submitOnlineTransaction(transactionData, paymentData, isPendingPayment) {
    try {
      // 1. Buat penjualan
      const saleResponse = await createSale(transactionData);
      const saleResult = extractData(saleResponse);
      const saleId = saleResult.id_penjualan || saleResult.id;

      if (!saleId) {
        throw new Error('Gagal mendapatkan ID penjualan dari server');
      }

      // 2. Record pembayaran
      const paymentPayload = {
        id_metode_pembayaran: paymentData.method.id_metode_pembayaran,
        jumlah_bayar: paymentData.amount
      };

      if (isPendingPayment) {
        await createPaymentPending(saleId, paymentPayload);
      } else {
        await recordPayment(saleId, paymentPayload);
      }

      // 3. Log audit trail
      await createLogAktivitas({
        aktivitas: `Penjualan POS: ${transactionData.kode_transaksi} - Total: Rp${transactionData.total?.toLocaleString('id-ID') || 'N/A'}`
      });

      return {
        success: true,
        saleId,
        transactionCode: transactionData.kode_transaksi,
        data: saleResult
      };

    } catch (error) {
      console.error('Online transaction failed:', error);
      throw new Error(`Transaksi online gagal: ${error.message}`);
    }
  }

  // Submit transaksi offline
  async submitOfflineTransaction(transactionData, paymentData) {
    let tempSaleId = null;
    try {
      tempSaleId = (window.crypto && window.crypto.randomUUID)
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const saleTotal = transactionData.total ?? transactionData.items.reduce((sum, item) => sum + (item.harga_jual * item.jumlah), 0);
      const paymentTotal = Number(paymentData.amount || 0);
      if (paymentTotal > saleTotal) {
        throw new Error(`Jumlah pembayaran ${paymentTotal} melebihi total transaksi ${saleTotal}`);
      }

      // Prepare offline data structure
      const offlineData = {
        id_penjualan: tempSaleId,
        kode_transaksi: transactionData.kode_transaksi,
        id_cabang: transactionData.id_cabang,
        id_user: transactionData.id_user,
        id_pelanggan: transactionData.id_pelanggan || null,
        total: saleTotal,
        created_at: new Date().toISOString(),
        is_offline: true
      };

      const items = transactionData.items.map(item => ({
        id_produk: item.id_produk,
        jumlah: item.jumlah,
        harga_satuan: item.harga_jual,
        subtotal: item.harga_jual * item.jumlah
      }));

      const payments = [{
        id_metode_pembayaran: paymentData.method.id_metode_pembayaran,
        jumlah_bayar: paymentData.amount,
        created_at: new Date().toISOString()
      }];

      // Save to local database with proper error handling
      if (window.electronAPI?.dbSaveSale) {
        const saveResult = await window.electronAPI.dbSaveSale({
          saleData: offlineData,
          items,
          payments
        });

        // Verify save operation was successful
        if (!saveResult || !saveResult.lastInsertRowid) {
          throw new Error('Database save operation failed - no valid result returned');
        }

        // Store for later sync only after successful save
        this.pendingTransactions.set(tempSaleId, {
          saleData: offlineData,
          items,
          payments,
          timestamp: Date.now()
        });

        return {
          success: true,
          saleId: tempSaleId,
          transactionCode: transactionData.kode_transaksi,
          isOffline: true,
          dbResult: saveResult // Include for debugging
        };
      } else {
        throw new Error('Offline database API tidak tersedia');
      }

    } catch (error) {
      console.error('Offline transaction failed:', error);

      // Store failed transaction for recovery (only if we have a tempSaleId)
      if (tempSaleId) {
        const failedTransaction = {
          id: tempSaleId,
          transactionData,
          paymentData,
          error: error.message,
          timestamp: Date.now(),
          retryCount: 0
        };

        // Store in localStorage as backup (will be retried on next app start)
        try {
          const failedTransactions = JSON.parse(localStorage.getItem('failedOfflineTransactions') || '[]');
          failedTransactions.push(failedTransaction);
          localStorage.setItem('failedOfflineTransactions', JSON.stringify(failedTransactions));
        } catch (storageError) {
          console.error('Failed to store failed transaction for recovery:', storageError);
        }
      }

      throw new Error(`Transaksi offline gagal disimpan: ${error.message}${tempSaleId ? '. Data telah disimpan untuk recovery otomatis.' : ''}`);
    }
  }

  // Process transaksi utama
  async processTransaction(cart, customer, payment, discount, totals, user, isOnline) {
    const transactionData = this.prepareTransactionData(
      cart, customer, payment, discount, totals, user
    );

    const isPendingPayment = payment.amount < totals.total;

    if (isOnline) {
      return await this.submitOnlineTransaction(transactionData, payment, isPendingPayment);
    } else {
      return await this.submitOfflineTransaction(transactionData, payment);
    }
  }

  // Get pending transactions
  getPendingTransactions() {
    return Array.from(this.pendingTransactions.values());
  }

  // Clear pending transaction
  clearPendingTransaction(saleId) {
    this.pendingTransactions.delete(saleId);
  }

  // Recover failed offline transactions on app start
  async recoverFailedTransactions() {
    try {
      const failedTransactions = JSON.parse(localStorage.getItem('failedOfflineTransactions') || '[]');

      if (failedTransactions.length === 0) {
        return { recovered: 0, failed: 0 };
      }
      let recovered = 0;
      let failed = 0;

      for (const failedTx of failedTransactions) {
        try {
          // Skip if already retried too many times
          if (failedTx.retryCount >= 3) {
            console.warn(`[POS] Skipping transaction ${failedTx.id} - max retries exceeded`);
            failed++;
            continue;
          }

          // Attempt to resave
          const result = await this.submitOfflineTransaction(failedTx.transactionData, failedTx.paymentData);

          if (result.success) {
            recovered++;
          } else {
            throw new Error('Recovery failed - invalid result');
          }

        } catch (recoveryError) {
          console.error(`[POS] Failed to recover transaction ${failedTx.id}:`, recoveryError);
          failedTx.retryCount = (failedTx.retryCount || 0) + 1;
          failed++;
        }
      }

      // Update localStorage with remaining failed transactions
      const remainingFailed = failedTransactions.filter(tx => tx.retryCount < 3);
      localStorage.setItem('failedOfflineTransactions', JSON.stringify(remainingFailed));
      return { recovered, failed };

    } catch (error) {
      console.error('[POS] Failed transaction recovery process:', error);
      return { recovered: 0, failed: 0, error: error.message };
    }
  }
}

export default new PosService();