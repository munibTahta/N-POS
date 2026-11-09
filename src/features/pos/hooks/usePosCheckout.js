import { useCallback } from 'react';
import { createLogAktivitas, createPaymentPending, createSale, getProductById, getStockReport, recordPayment } from '../../../services/api';
import { logger } from '../../../utils/logger';
import PerformanceMonitor from '../../../utils/PerformanceMonitor';
import SubmissionProgressHandler from '../../../utils/SubmissionProgressHandler';
import { getRecoverySuggestion, mapErrorToUserMessage } from '../../../utils/errorMessageMapper';
import { extractData } from '../../../utils/apiResponseHelper';
import { formatCurrency } from '../../../utils/formatHelper';
import { unstable_batchedUpdates } from 'react-dom';

export function usePosCheckout({ dueDate, setDueDate, cart, createTemporarySaleId, discountAmount, finalTotal, getConnectionStatus, getProductStock, idCabangPengguna, isPendingPayment, isSyncLocked, paymentAmount, pendingPaymentRef, pendingTransactionCodeRef, posSettings, searchOfflineProducts, selectedCustomer, selectedPaymentMethod, setAppliedVoucher, setCart, setIsPendingPayment, setIsSubmitting, setLastTransaction, setManualPricingOverrides, setPaymentAmount, setSaleDataForPrint, setSelectedCustomer, setSelectedPaymentMethod, setShowOfflineWarning, setShowPaymentModal, setShowPrintModal, setStockInfo, setTaxAmount, showError, showSuccess, taxAmount, tipeKatalog, user }) {
  const validateStockAvailability = useCallback(async (retryCount = 0) => {
    const MAX_RETRIES = 2;

    try {
      // Refresh stock data before validation to ensure we have latest data
      if (getConnectionStatus().isOnline) {
        const stockReportRes = await getStockReport();
        const stockReportData = stockReportRes.data.data || [];
        const stockMap = {};
        stockReportData.forEach(productStock => {
          if (productStock.detail_lokasi?.cabang && Array.isArray(productStock.detail_lokasi.cabang)) {
            const cabangStock = productStock.detail_lokasi.cabang.find(c => c.id_cabang === idCabangPengguna);
            stockMap[productStock.id_produk] = cabangStock?.stok || 0;
          }
        });
        setStockInfo(stockMap);
      }

      // Real-time stock validation
      for (const item of cart) {
        const currentStock = getProductStock(item.id_produk);
        const requiredQuantity = item.jumlah;

        if (currentStock < requiredQuantity) {
          const errorMsg = `Stok ${item.nama_produk} tidak mencukupi. Tersedia: ${currentStock}, dibutuhkan: ${requiredQuantity}`;
          showError(errorMsg);
          return false;
        }
      }
      return true;
    } catch (error) {
      logger.error('Stock validation error:', error);

      // Retry logic for network errors
      if (retryCount < MAX_RETRIES && getConnectionStatus().isOnline) {
        logger.info(`Retrying stock validation (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return validateStockAvailability(retryCount + 1);
      }

      // If offline or max retries reached, use cached stock data
      logger.warn('Using cached stock data for validation');
      for (const item of cart) {
        const currentStock = getProductStock(item.id_produk);
        const requiredQuantity = item.jumlah;

        if (currentStock < requiredQuantity) {
          const errorMsg = `Stok ${item.nama_produk} tidak mencukupi (data cache). Tersedia: ${currentStock}, dibutuhkan: ${requiredQuantity}`;
          showError(errorMsg);
          return false;
        }
      }
      return true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, getProductStock, getConnectionStatus, idCabangPengguna]);

  const handleSubmit = useCallback(async () => {
    // Initialize performance monitoring for this transaction
    const perfMonitor = new PerformanceMonitor('Transaction');
    const progress = new SubmissionProgressHandler({ isOnline: getConnectionStatus().isOnline });
    perfMonitor.mark('start');

    // Block submissions while sync is active
    if (isSyncLocked()) {
      showError('Sinkronisasi sedang berlangsung. Tunggu sampai selesai sebelum membuat transaksi baru.');
      return;
    }

    // Check for offline mode and show warning
    const isOnlineMode = getConnectionStatus().isOnline;
    if (!isOnlineMode && cart.length > 0) {
      setShowOfflineWarning(true);
      return; // User must confirm offline transaction
    }

    // Basic validation with better error handling
    const validations = [
      { 
        condition: cart.length === 0,
        error: 'Keranjang masih kosong.',
        key: 'empty-cart'
      },
      {
        condition: !user || !user.id_user || !user.id_cabang,
        error: 'Data pengguna tidak lengkap.',
        key: 'incomplete-user'
      },
      {
        condition: !selectedPaymentMethod,
        error: 'Pilih metode pembayaran terlebih dahulu.',
        key: 'no-payment-method'
      },
      {
        condition: paymentAmount < 0,
        error: 'Jumlah pembayaran tidak boleh negatif.',
        key: 'negative-payment'
      },
      {
        condition: paymentAmount === 0 && !isPendingPayment && !pendingPaymentRef.current,
        error: 'Masukkan jumlah pembayaran atau centang "Tandai sebagai pembayaran pending" untuk pembayaran nanti.',
        key: 'zero-payment'
      },
      {
        condition: paymentAmount < finalTotal && paymentAmount > 0 && !isPendingPayment,
        error: 'Jumlah pembayaran kurang dari total yang harus dibayar. Centang "Tandai sebagai pembayaran pending" untuk melanjutkan.',
        key: 'insufficient-payment'
      }
    ];

    for (const validation of validations) {
      if (validation.condition) {
        const mapped = mapErrorToUserMessage(validation.error);
        showError(`${mapped.userMessage}\n${mapped.recovery}`);
        return;
      }
    }

    // Real-time stock validation
    if (!(await validateStockAvailability())) {
      return;
    }

    // Validate product existence on server (online only) + Stock validation combined
    if (isOnlineMode) {
      try {
        progress.show('VALIDATING');
        logger.debug('Validating product existence and stock on server...');
        const startTime = performance.now();
        
        // Parallel validation: validate all products at once instead of sequentially
        const validationPromises = cart.map(item =>
          getProductById(item.id_produk)
            .then(res => {
              const product = extractData(res);
              // Combined check: product exists AND has sufficient stock
              const availableStock = product?.stok || 0;
              if (availableStock < item.jumlah) {
                return { 
                  id: item.id_produk, 
                  name: item.nama_produk, 
                  valid: false, 
                  reason: 'insufficient_stock',
                  availableStock
                };
              }
              return { id: item.id_produk, name: item.nama_produk, valid: true };
            })
            .catch(err => ({ 
              id: item.id_produk, 
              name: item.nama_produk, 
              valid: false, 
              reason: 'not_found',
              error: err 
            }))
        );
        
        const results = await Promise.all(validationPromises);
        const validationTime = performance.now() - startTime;
        
        // Check for any validation failures
        const failures = results.filter(r => !r.valid);
        if (failures.length > 0) {
          const insufficientStock = failures.filter(f => f.reason === 'insufficient_stock');
          const notFound = failures.filter(f => f.reason === 'not_found');
          
          let errorMsg = [];
          if (insufficientStock.length > 0) {
            const items = insufficientStock.map(f => `${f.name} (tersedia: ${f.availableStock})`).slice(0, 2).join(', ');
            errorMsg.push(`Stok tidak cukup: ${items}`);
          }
          if (notFound.length > 0) {
            const items = notFound.map(f => `"${f.name}"`).slice(0, 2).join(', ');
            errorMsg.push(`Produk tidak ditemukan: ${items}`);
          }
          
          progress.error(`Validasi gagal: ${errorMsg.join('; ')}`);
          showError(`Validasi produk gagal:\n${errorMsg.join('\n')}\nSilakan periksa ulang produk dan stok.`);
          return;
        }
        
        logger.debug(`Product validation completed successfully (${validationTime.toFixed(0)}ms)`);
        progress.show('CREATING_SALE');
      } catch (error) {
        const mapped = mapErrorToUserMessage(error);
        logger.error('Product validation error:', error);
        progress.error(`Validasi error: ${mapped.userMessage}`);
        // Don't block the sale for network errors, just log
      }
      
      perfMonitor.mark('afterValidation');
    }

    // Validate cart item data integrity
    for (const item of cart) {
      const idProduk = Number(item.id_produk);
      const quantity = Number(item.jumlah);
      const harga = Number(item.harga_satuan);

      if (isNaN(idProduk) || isNaN(quantity) || isNaN(harga) || idProduk <= 0 || quantity <= 0 || harga <= 0) {
        showError(`Item ${item.nama_produk || 'unknown'} memiliki data yang tidak valid.`);
        return;
      }
    }

    if (!pendingTransactionCodeRef.current) {
      pendingTransactionCodeRef.current = `POS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    const saleData = {
      kode_transaksi: pendingTransactionCodeRef.current,
      id_cabang: Number(user.id_cabang),
      id_user: Number(user.id_user),
      bayar: paymentAmount,
      items: cart.map(({ id_produk, harga_satuan, jumlah, tipe_harga }) => ({
        id_produk: Number(id_produk),
        jumlah: Number(jumlah),
        harga_jual: Number(harga_satuan),
        tipe_harga: tipe_harga || 'eceran'
      }))
    };

    // Only include optional fields if they have valid values
    if (selectedCustomer?.id_pelanggan) {
      saleData.id_pelanggan = Number(selectedCustomer.id_pelanggan);
      // Include loyalty tier - set to null if not available to prevent database error
      saleData.id_tier_loyalitas = selectedCustomer.id_tier_loyalitas ? Number(selectedCustomer.id_tier_loyalitas) : null;
    }
    if (discountAmount > 0) {
      saleData.diskon = Number(discountAmount);
    }
    if (posSettings?.enablePPN && taxAmount > 0) {
      saleData.pajak = Number(taxAmount);
    }
    if (selectedPaymentMethod?.biaya_tambahan > 0) {
      saleData.biaya_tambahan = Number(selectedPaymentMethod.biaya_tambahan);
    }
    // Jatuh tempo hanya dikirim untuk transaksi yang belum lunas (server juga mengabaikannya bila sisa = 0).
    if (dueDate && (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal)) {
      saleData.tanggal_jatuh_tempo = dueDate;
    }

    try {
      setIsSubmitting(true);
      const isOnline = getConnectionStatus().isOnline;

      let saleId;
      let isOfflineTransaction = false;

      if (isOnline) {
        // Online mode: submit to server
        try {
          perfMonitor.mark('beforeCreateSale');
          const saleResponse = await createSale(saleData);
          perfMonitor.mark('afterCreateSale');
          const saleResult = extractData(saleResponse);
          
          // Validate response structure and extracted data
          if (!saleResult || typeof saleResult !== 'object') {
            throw new Error('Invalid sale response format received from server');
          }
          
          saleId = saleResult.id_penjualan || saleResult.id;

          if (!saleId) {
            throw new Error('Server did not return sale ID. Please contact support if this persists.');
          }
        } catch (saleErr) {
          logger.error('Failed to create sale:', saleErr);
          throw new Error(`Gagal membuat transaksi: ${saleErr.message || 'Unknown error'}`);
        }

        // Record payment - use pending if marked as such or if partial payment
        const paymentData = {
          id_metode_pembayaran: selectedPaymentMethod.id_metode_pembayaran || selectedPaymentMethod.id,
          jumlah_bayar: paymentAmount
        };

        try {
          perfMonitor.mark('beforePayment');
          if (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) {
            logger.debug('Calling createPaymentPending with paymentAmount:', paymentAmount);
            await createPaymentPending(saleId, paymentData);
            logger.debug('createPaymentPending completed successfully');
          } else {
            logger.debug('Calling recordPayment with paymentAmount:', paymentAmount);
            await recordPayment(saleId, paymentData);
            logger.debug('recordPayment completed successfully');
          }
          perfMonitor.mark('afterPayment');
        } catch (paymentErr) {
          logger.error('Payment recording failed:', paymentErr);
          throw new Error(`Penjualan tercatat tapi gagal merekam pembayaran: ${paymentErr.message || 'Unknown error'}`);
        }
      } else {
        // Offline mode: save to local database via IPC
        isOfflineTransaction = true;

        // Validate that all products exist in offline database before saving offline transaction
        try {
          for (const cartItem of cart) {
            const offlineProduct = await searchOfflineProducts(cartItem.kode_produk || cartItem.id_produk, true, { id_cabang: idCabangPengguna, tipe_katalog: tipeKatalog });
            if (!offlineProduct || offlineProduct.length === 0) {
              throw new Error(`Produk ${cartItem.nama_produk} tidak ditemukan dalam database offline. Transaksi tidak dapat disimpan.`);
            }
          }
          logger.debug('Offline products validation passed for', cart.length, 'items');
        } catch (validationErr) {
          logger.error('Offline product validation failed:', validationErr);
          throw validationErr;
        }

        // Generate a temporary ID for offline transaction
        const tempSaleId = createTemporarySaleId();

        // Prepare sale data
        const offlineSaleData = {
          id_penjualan: tempSaleId,
          kode_transaksi: saleData.kode_transaksi,
          id_cabang: saleData.id_cabang,
          id_user: saleData.id_user,
          id_pelanggan: saleData.id_pelanggan || null,
          tanggal: new Date().toISOString(),
          total: finalTotal,
          bayar: paymentAmount,
          kembalian: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? 0 : paymentAmount - finalTotal,
          sisa_pembayaran: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? finalTotal - paymentAmount : 0,
          status_pembayaran: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? 'pending' : 'lunas',
          ...(saleData.tanggal_jatuh_tempo ? { tanggal_jatuh_tempo: saleData.tanggal_jatuh_tempo } : {})
        };

        // Prepare items and payments
        const items = cart.map(item => ({
          id_produk: item.id_produk,
          jumlah: item.jumlah,
          harga_satuan: item.harga_satuan,
          tipe_harga: item.tipe_harga,
          subtotal: item.subtotal
        }));

        const payments = [{
          id_metode_pembayaran: selectedPaymentMethod.id_metode_pembayaran || selectedPaymentMethod.id,
          jumlah_bayar: paymentAmount
        }];

        // Save to offline database via IPC
        if (window.electronAPI && window.electronAPI.dbSaveSale) {
          await window.electronAPI.dbSaveSale({ saleData: offlineSaleData, items, payments });
        } else {
          throw new Error('Offline database not available');
        }

        saleId = tempSaleId;
      }

      // Log audit trail untuk transaksi penjualan (only if online)
      if (isOnline) {
        try {
          await createLogAktivitas({
            aktivitas: `Penjualan: ${saleData.kode_transaksi} - Total: Rp${finalTotal.toLocaleString('id-ID')} - Items: ${cart.length} produk`
          });
        } catch (auditError) {
          logger.warn('Failed to log sale audit:', auditError);
        }
      }

      // Prepare data for receipt printing
      const receiptData = {
        id: saleId,
        no_struk: `POS-${saleId}`,
        tanggal: new Date().toISOString(),
        kasir: user.nama || user.username,
        items: cart.map(item => ({
          id_produk: item.id_produk,
          nama_produk: item.nama_produk,
          jumlah: item.jumlah,
          harga_satuan: item.harga_satuan,
          tipe_harga: item.tipe_harga,
          subtotal: item.subtotal
        })),
        total: finalTotal,
        bayar: paymentAmount,
        kembali: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? 0 : paymentAmount - finalTotal,
        sisa_pembayaran: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? finalTotal - paymentAmount : 0,
        status_pembayaran: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? 'pending' : 'lunas',
        metode_pembayaran: selectedPaymentMethod,
        diskon: discountAmount,
        pajak: posSettings?.enablePPN ? taxAmount : 0,
        pelanggan: selectedCustomer
      };

      const successMessage = isOfflineTransaction
        ? `Transaksi berhasil disimpan offline! ID: ${saleId} (akan disinkronkan saat online)`
        : isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal
        ? `Transaksi berhasil dengan pembayaran pending! ID: ${saleId} - Sisa pembayaran: ${formatCurrency(Math.max(0, finalTotal - paymentAmount))}`
        : `Transaksi berhasil! ID: ${saleId}`;

      showSuccess(successMessage);
      
      // Batch all state updates together for better performance
      perfMonitor.mark('beforeStateUpdates');
      unstable_batchedUpdates(() => {
        setShowPaymentModal(false);
        setShowPrintModal(true);
        setSaleDataForPrint(receiptData);
        setLastTransaction(receiptData);
        setCart([]);
        setManualPricingOverrides({});
        setAppliedVoucher(null);
        setSelectedCustomer(null);
        setTaxAmount(0);
        setSelectedPaymentMethod(null);
        setPaymentAmount(0);
        setIsPendingPayment(false);
        setDueDate('');
      });
      pendingPaymentRef.current = false;
      pendingTransactionCodeRef.current = null;

      perfMonitor.mark('afterStateUpdates');

      // Open cash drawer if payment method is cash and payment is complete (not pending)
      const isCashPayment = selectedPaymentMethod && (
        (selectedPaymentMethod.tipe && selectedPaymentMethod.tipe.toLowerCase() === 'cash') ||
        (selectedPaymentMethod.nama_metode && selectedPaymentMethod.nama_metode.toLowerCase().includes('tunai')) ||
        (selectedPaymentMethod.nama_metode && selectedPaymentMethod.nama_metode.toLowerCase().includes('cash'))
      );
      
      const isPaymentComplete = !(isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal);
      
      if (isCashPayment && isPaymentComplete && window.electronAPI && window.electronAPI.openCashDrawer) {
        try {
          logger.info('Opening cash drawer for cash payment');
          await window.electronAPI.openCashDrawer();
        } catch (drawerError) {
          logger.warn('Failed to open cash drawer:', drawerError);
          // Don't show error to user as transaction was successful
        }
      }

      // Refresh stock data
      const stockReportRes = await getStockReport();
      const stockReportData = stockReportRes.data.data || [];
      const stockMap = {};
      stockReportData.forEach(productStock => {
        // Find stock for current user's cabang in the cabang array
        if (productStock.detail_lokasi?.cabang && Array.isArray(productStock.detail_lokasi.cabang)) {
          const cabangStock = productStock.detail_lokasi.cabang.find(c => c.id_cabang === idCabangPengguna);
          stockMap[productStock.id_produk] = cabangStock?.stok || 0;
        }
      });
      setStockInfo(stockMap);

    } catch (err) {
      logger.error('Error in handleSubmit:', err);
      console.error('DEBUG PosPage: Error response:', err?.response);
      console.error('DEBUG PosPage: Error message:', err?.response?.data?.message);
      
      // Map error to user-friendly message
      const mapped = mapErrorToUserMessage(err);
      
      // Show detailed error with recovery suggestion
      const recovery = getRecoverySuggestion(err);
      showError(`${mapped.userMessage}\n\n${recovery}`);
      
      progress.error(mapped.userMessage);
    } finally {
      // Record performance measurements
      perfMonitor.measure('ProductValidation', 'start', 'afterValidation');
      perfMonitor.measure('SaleCreation', 'beforeCreateSale', 'afterCreateSale');
      perfMonitor.measure('PaymentRecording', 'beforePayment', 'afterPayment');
      perfMonitor.measure('StateUpdates', 'beforeStateUpdates', 'afterStateUpdates');
      
      // Log performance metrics for monitoring
      perfMonitor.log();
      
      progress.dismiss();
      setIsSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueDate, setDueDate, cart, user, selectedPaymentMethod, paymentAmount, finalTotal, selectedCustomer, discountAmount, posSettings, taxAmount, isPendingPayment, getConnectionStatus, idCabangPengguna, tipeKatalog, validateStockAvailability, searchOfflineProducts]);

  // Handle offline transaction confirmation
  const handleOfflineConfirm = useCallback(async () => {
    setShowOfflineWarning(false);
    // Continue with handleSubmit logic for offline
    setIsSubmitting(true);
    const perfMonitor = new PerformanceMonitor('Transaction-Offline');
    perfMonitor.mark('start');
    
    try {
      // Offline transaction flow (simplified - no server validation)
      const tempSaleId = createTemporarySaleId();
      const offlineSaleData = {
        id_penjualan: tempSaleId,
        kode_transaksi: `POS-${tempSaleId}`,
        id_cabang: Number(user.id_cabang),
        id_user: Number(user.id_user),
        id_pelanggan: selectedCustomer?.id_pelanggan ? Number(selectedCustomer.id_pelanggan) : null,
        tanggal: new Date().toISOString(),
        total: finalTotal,
        bayar: paymentAmount,
        kembalian: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? 0 : paymentAmount - finalTotal,
        sisa_pembayaran: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? finalTotal - paymentAmount : 0,
        status_pembayaran: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? 'pending' : 'lunas',
        ...(dueDate && (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? { tanggal_jatuh_tempo: dueDate } : {})
      };

      const items = cart.map(item => ({
        id_produk: item.id_produk,
        jumlah: item.jumlah,
        harga_satuan: item.harga_satuan,
        tipe_harga: item.tipe_harga,
        subtotal: item.subtotal
      }));

      const payments = [{
        id_metode_pembayaran: selectedPaymentMethod.id_metode_pembayaran || selectedPaymentMethod.id,
        jumlah_bayar: paymentAmount
      }];

      // Save to offline database
      if (window.electronAPI && window.electronAPI.dbSaveSale) {
        await window.electronAPI.dbSaveSale({ saleData: offlineSaleData, items, payments });
        showSuccess(`Transaksi disimpan offline! ID: ${tempSaleId}\n(akan disinkronkan saat online)`);
      } else {
        throw new Error('Offline database tidak tersedia');
      }

      // Prepare receipt data
      const receiptData = {
        id: tempSaleId,
        no_struk: `POS-${tempSaleId}`,
        tanggal: new Date().toISOString(),
        kasir: user.nama || user.username,
        items: cart,
        total: finalTotal,
        bayar: paymentAmount,
        kembali: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? 0 : paymentAmount - finalTotal,
        sisa_pembayaran: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? finalTotal - paymentAmount : 0,
        status_pembayaran: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? 'pending' : 'lunas',
        metode_pembayaran: selectedPaymentMethod,
        diskon: discountAmount,
        pajak: posSettings?.enablePPN ? taxAmount : 0,
        pelanggan: selectedCustomer,
        offline: true
      };

      // Batch state updates
      unstable_batchedUpdates(() => {
        setShowPaymentModal(false);
        setShowPrintModal(true);
        setSaleDataForPrint(receiptData);
        setLastTransaction(receiptData);
        setCart([]);
        setAppliedVoucher(null);
        setSelectedCustomer(null);
        setTaxAmount(0);
        setPaymentAmount(0);
        setIsPendingPayment(false);
        setDueDate('');
      });
      
      perfMonitor.mark('complete');
      perfMonitor.log();
    } catch (err) {
      const mapped = mapErrorToUserMessage(err);
      showError(`Gagal menyimpan transaksi offline:\n${mapped.userMessage}`);
      logger.error('Offline transaction error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [dueDate, setDueDate, cart, user, selectedCustomer, finalTotal, paymentAmount, selectedPaymentMethod, discountAmount, posSettings, taxAmount, isPendingPayment, showError, showSuccess, createTemporarySaleId, pendingPaymentRef, setAppliedVoucher, setCart, setIsPendingPayment, setIsSubmitting, setLastTransaction, setPaymentAmount, setSaleDataForPrint, setSelectedCustomer, setShowOfflineWarning, setShowPaymentModal, setShowPrintModal, setTaxAmount]);

  return { handleOfflineConfirm, handleSubmit };
}

export default usePosCheckout;
