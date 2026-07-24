import { useCallback, useState, useRef, useEffect } from 'react';
import { getMetodePembayaran } from '../services/api';

export const usePaymentMethods = () => {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFromCache, setIsFromCache] = useState(false);

  // Keep a ref to latest paymentMethods to avoid stale closures in the fetch function
  const paymentMethodsRef = useRef(paymentMethods);
  useEffect(() => {
    paymentMethodsRef.current = paymentMethods;
  }, [paymentMethods]);

  const fetchPaymentMethods = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsFromCache(false);
    try {
      // If online prefer API
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const response = await getMetodePembayaran();
        
        // Extract methods from response - axios wraps it, so response.data is the API response
        // API response format: {success: true, data: [...]}
        let methods = [];
        
        if (response.data) {
          // response.data is the API response object with {success, data}
          if (response.data.success && Array.isArray(response.data.data)) {
            methods = response.data.data;
          } else if (Array.isArray(response.data)) {
            // Direct array response (fallback for non-standard responses)
            methods = response.data;
          } else if (response.data.data && Array.isArray(response.data.data)) {
            // Has data property that is array (non-success wrapper)
            methods = response.data.data;
          } else {
            // Last resort: unknown format
            console.warn('⚠️ Payment methods response format unexpected:', { 
              success: response.data.success, 
              dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
              hasDataProp: !!response.data.data
            });
            methods = [];
          }
        }
        
        // Ensure methods is always an array
        if (!Array.isArray(methods)) {
          console.warn('⚠️ Payment methods extraction failed, not an array:', { 
            type: typeof methods, 
            value: methods 
          });
          methods = [];
        }

        void 0 && (`✓ Fetched ${methods.length} payment methods from API`, { 
          success: response.data?.success, 
          total: methods.length,
          sample: methods.length > 0 ? methods[0] : null 
        });
        setPaymentMethods(methods);
        setIsFromCache(false);

        // Persist to SQLite offline DB for later offline use (best-effort)
        // Use batch operation to avoid rate limiting
        try {
          if (window?.electronAPI?.dbSelect && window?.electronAPI?.dbInsert && window?.electronAPI?.dbUpdate) {
            const local = await window.electronAPI.dbSelect({ table: 'metode_pembayaran' }).catch(e => {
              console.warn('⚠️ dbSelect failed during sync:', e?.message || e);
              return [];
            });
            
            const localMap = (local || []).reduce((acc, row) => {
              const key = row.id_metode || row.id || null;
              if (key != null) acc[String(key)] = row;
              return acc;
            }, {});

            // Batch database operations with small delays to avoid rate limiting
            const batchSize = 5;
            let persistedCount = 0;
            
            for (let i = 0; i < methods.length; i += batchSize) {
              const batch = methods.slice(i, i + batchSize);
              
              // Validate batch is an array before mapping
              if (!Array.isArray(batch) || batch.length === 0) {
                console.warn('⚠️ Invalid batch at index', i);
                continue;
              }
              
              const batchPromises = batch.map(m => {
                const id = m.id_metode ?? m.id ?? m.id_metode_pembayaran ?? null;
                const row = {
                  id_metode: id,
                  kode_metode: m.kode_metode ?? null,
                  nama_metode: m.nama_metode ?? m.name ?? '',
                  tipe_metode: m.tipe_metode ?? m.tipe ?? null,
                  aktif: m.aktif ? 1 : (m.active ? 1 : 1),
                  is_default: m.is_default ? 1 : 0,
                  urutan_tampil: m.urutan_tampil ?? m.order ?? null,
                  biaya_tambahan_persen: parseFloat(m.biaya_tambahan_persen ?? m.biaya_tambahan_percent ?? 0) || 0,
                  biaya_tambahan_nominal: parseFloat(m.biaya_tambahan_nominal ?? m.biaya_tambahan ?? 0) || 0,
                  minimum_transaksi: parseFloat(m.minimum_transaksi ?? 0) || 0,
                  maksimum_transaksi: m.maksimum_transaksi ?? null,
                  konfigurasi: JSON.stringify(m.konfigurasi ?? m.config ?? {}),
                  synced: 1,
                  sync_version: 1
                };

                const keyStr = id != null ? String(id) : null;
                if (keyStr && localMap[keyStr]) {
                  return window.electronAPI.dbUpdate({ table: 'metode_pembayaran', data: row, whereClause: 'id_metode = ?', whereValues: [id] })
                    .then(() => { persistedCount++; })
                    .catch(e => console.warn('⚠️ Failed to update payment method', id, e?.message || e));
                } else {
                  return window.electronAPI.dbInsert({ table: 'metode_pembayaran', data: row })
                    .then(() => { persistedCount++; })
                    .catch(e => console.warn('⚠️ Failed to insert payment method', id, e?.message || e));
                }
              });

              // Wait for batch to complete before next batch
              await Promise.all(batchPromises);
              
              // Small delay between batches to avoid rate limiting
              if (i + batchSize < methods.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }
          }
        } catch (persistErr) {
          console.warn('⚠️ Could not persist payment methods to offline DB:', persistErr?.message || persistErr);
        }

        return methods;
      }

      // Offline: try reading from SQLite offline DB first
      if (window?.electronAPI?.dbSelect) {
        try {
          const localMethods = await window.electronAPI.dbSelect({ table: 'metode_pembayaran' });
          if (Array.isArray(localMethods) && localMethods.length > 0) {
            void 0 && (`✓ Loaded ${localMethods.length} payment methods from offline DB`, {
              sample: localMethods[0]
            });
            setPaymentMethods(localMethods);
            setIsFromCache(true);
            return localMethods;
          } else {
            console.warn('⚠️ No payment methods in offline DB (empty or not array)', { 
              type: Array.isArray(localMethods) ? 'array' : typeof localMethods,
              length: localMethods?.length
            });
          }
        } catch (dbErr) {
          console.warn('⚠️ dbSelect failed for metode_pembayaran:', {
            message: dbErr?.message || dbErr,
            code: dbErr?.code,
            type: dbErr?.type
          });
        }
      } else {
        console.warn('⚠️ electronAPI.dbSelect not available (not running in Electron)');
      }

      // Last-resort: return in-memory cached methods
      const cached = paymentMethodsRef.current || [];
      if (cached && cached.length > 0) {
        setPaymentMethods(cached);
        setIsFromCache(true);
        return cached;
      }

      console.warn('⚠️ No payment methods available (not online, no offline DB, no cache)');
      setError({ message: 'Could not load payment methods', type: 'no_cache' });
      return [];

    } catch (err) {
      // Network/API error
      console.error('✗ Error fetching payment methods from API:', {
        message: err?.message || err,
        status: err?.response?.status,
        statusText: err?.response?.statusText,
        type: err?.type
      });

      // Use in-memory cached methods (read from ref to avoid stale closures)
      const cached = paymentMethodsRef.current || [];
      if (cached && cached.length > 0) {
        setPaymentMethods(cached);
        setIsFromCache(true);
        return cached;
      } else {
        setError({
          message: err?.message || 'Could not load payment methods',
          type: 'api_error'
        });
        return [];
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const getPaymentMethodById = useCallback((methodId) => {
    return paymentMethods.find(m => m.id_metode_pembayaran === methodId);
  }, [paymentMethods]);

  const isPaymentMethodAvailable = useCallback((methodId) => {
    return paymentMethods.some(m => m.id_metode_pembayaran === methodId);
  }, [paymentMethods]);

  const getAvailableMethods = useCallback(() => {
    return paymentMethods.filter(m => m.status === 'aktif' || m.status === 1);
  }, [paymentMethods]);

  const invalidateCache = useCallback(async () => {
    // No-op (kept for backward compatibility)
  }, []);

  const getCacheInfo = useCallback(async () => {
    return null;
  }, []);

  return {
    paymentMethods,
    loading,
    error,
    isFromCache,
    fetchPaymentMethods,
    getPaymentMethodById,
    isPaymentMethodAvailable,
    getAvailableMethods,
    invalidateCache,
    getCacheInfo
  };
};

export default usePaymentMethods;
