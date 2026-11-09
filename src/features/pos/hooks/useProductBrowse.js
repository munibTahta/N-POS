import { useEffect } from 'react';
import { getProducts } from '../../../services/api';
import { logger } from '../../../utils/logger';

export function useProductBrowse({ activeCategory, browseRetry, idCabangPengguna, isOnline, readUsage, searchIdRef, searchOfflineProducts, searchTerm, setBrowseError, setBrowseLoading, setProducts, showError, stockInfo, tipeKatalog }) {
  // Debounced search effect
  useEffect(() => {
    if (!idCabangPengguna) return;

    const currentSearchId = ++searchIdRef.current;
    let isStillRelevant = true;

    const timeoutId = setTimeout(async () => {
      // Ignore if another search has been initiated
      if (currentSearchId !== searchIdRef.current || !isStillRelevant) {
        return;
      }

      if (searchTerm.length >= 1) {
        const cleanQuery = searchTerm.trim().toLowerCase();
        const suggestionLimit = cleanQuery.length >= 3 ? 50 : 8;
        
        try {
          // Quick cache check FIRST - check if we have cached results for this exact query
          const cacheKey = `search_${idCabangPengguna || 0}_${tipeKatalog || 'global'}_${cleanQuery}`;
          const cached = sessionStorage?.getItem(cacheKey);
          if (cached) {
            try {
              const cachedData = JSON.parse(cached);
              if (Date.now() - cachedData.time < 5000) { // 5 second cache
                // CRITICAL: Check race condition before updating state
                if (currentSearchId !== searchIdRef.current || !isStillRelevant) return;
                setProducts(cachedData.results);
                return;
              }
            } catch (_e) {
              // Cache parse error, continue with API
            }
          }

          // Try API only if online
          if (isOnline) {
            try {
              const searchRes = await getProducts({
                limit: suggestionLimit,
                page: 1,
                status: 'aktif',
                search: cleanQuery,
                sortBy: 'nama_produk',
                sortOrder: 'asc',
                katalog_filter: tipeKatalog,
                id_cabang: tipeKatalog === 'terpisah' ? idCabangPengguna : undefined
              });
              
              if (currentSearchId !== searchIdRef.current || !isStillRelevant) return;
              
              const productsData = searchRes.data?.data || [];
              
              if (productsData.length > 0) {
                const enhanced = productsData.map(p => ({
                  ...p,
                  harga_jual: Number(p.harga_jual || p.harga_eceran || 0),
                  harga_beli: Number(p.harga_beli || 0),
                  harga_grosir: Number(p.harga_grosir || 0),
                  min_qty_grosir: Number(p.min_qty_grosir || 0),
                  barcode: p.barcode || p.kode_produk,
                }));
                
                // Cache results
                try {
                  sessionStorage?.setItem(cacheKey, JSON.stringify({
                    results: enhanced,
                    time: Date.now()
                  }));
                } catch (storageErr) {
                  console.warn('Session storage error (API search cache):', storageErr.message);
                  logger.warn('Store session cache failed:', storageErr);
                  // Continue anyway - search still works without cache
                }
                
                setProducts(enhanced);
                return;
              }
            } catch (_apiErr) { /* intentionally empty */ 
            }
          }
          
          // Fallback to offline search
          let offlineResults = await searchOfflineProducts(cleanQuery, false, { id_cabang: idCabangPengguna, tipe_katalog: tipeKatalog });
          
          if (currentSearchId !== searchIdRef.current || !isStillRelevant) return;
          
          // Jika offline kosong tapi isOnline, try API
          if (offlineResults.length === 0 && isOnline) {
            try {
              const retryRes = await getProducts({
                limit: suggestionLimit,
                page: 1,
                status: 'aktif',
                search: cleanQuery,
                sortBy: 'nama_produk',
                sortOrder: 'asc',
                katalog_filter: tipeKatalog,
                id_cabang: tipeKatalog === 'terpisah' ? idCabangPengguna : undefined
              });
              const retryData = retryRes.data?.data || [];
              if (retryData.length > 0) {
                const enhanced = retryData.map(p => ({
                  ...p,
                  harga_jual: Number(p.harga_jual || p.harga_eceran || 0),
                  harga_beli: Number(p.harga_beli || 0),
                  harga_grosir: Number(p.harga_grosir || 0),
                  min_qty_grosir: Number(p.min_qty_grosir || 0),
                  barcode: p.barcode || p.kode_produk,
                  // Get stock from API response or fallback to cached stock info
                  stok: Number(p.stok || stockInfo[p.id_produk || p.id] || 0)
                }));
                // CRITICAL: Check race condition before updating state
                if (currentSearchId !== searchIdRef.current || !isStillRelevant) return;
                setProducts(enhanced);
                return;
              }
            } catch (_retryErr) { /* intentionally empty */ 
            }
          }
          
          const enhanced = offlineResults.map(p => ({
            // Normalize fields returned from DB/searchStrategy to app shape
            ...p,
            id_produk: p.id_produk || p.id || p.product_id,
            nama_produk: p.nama_produk || p.name || p.product_name || '',
            kode_produk: p.kode_produk || p.kd_produk || p.sku || p.code || '',
            harga_jual: Number(p.harga_jual || p.harga_eceran || p.harga || p.price || 0),
            harga_beli: Number(p.harga_beli || p.cost || 0),
            harga_grosir: Number(p.harga_grosir || p.wholesale_price || 0),
            min_qty_grosir: Number(p.min_qty_grosir || p.min_qty || 0),
            barcode: p.barcode || p.kode_produk || p.sku || '',
            // Get stock from stockInfo state (loaded from cache), fallback to product stok field
            stok: stockInfo[p.id_produk || p.id] ?? Number(p.stok || 0)
          }));
          
          // No need to extract stock from offline results since we use stockInfo state
          
          // Cache results
          try {
            sessionStorage?.setItem(cacheKey, JSON.stringify({
              results: enhanced,
              time: Date.now()
            }));
          } catch (storageErr) {
            console.warn('Session storage error (offline search cache):', storageErr.message);
            logger.warn('Store session cache failed:', storageErr);
            // Continue anyway - search still works without cache
          }
          
          // CRITICAL: Check race condition before updating state
          if (currentSearchId !== searchIdRef.current || !isStillRelevant) return;
          setProducts(enhanced);
        } catch (error) {
          console.error('Search error:', error);
          if (isStillRelevant) {
            logger.error('Search failed:', error);
            showError('Gagal mencari produk');
          }
        }
      } else if (searchTerm.length === 0) {
        // CRITICAL: Check race condition before clearing products
        if (currentSearchId !== searchIdRef.current || !isStillRelevant) return;
        // Browse mode: tampilkan produk (per kategori) tanpa harus mengetik
        if (activeCategory === 'recent' || activeCategory === 'fav') {
          const usage = Object.values(readUsage());
          usage.sort(activeCategory === 'recent' ? (a, b) => b.last - a.last : (a, b) => b.count - a.count);
          setBrowseError(false);
          setProducts(usage.slice(0, 30).map(u => u.product));
          return;
        }
        const normalize = (p) => ({
          ...p,
          harga_jual: Number(p.harga_jual || p.harga_eceran || 0),
          harga_beli: Number(p.harga_beli || 0),
          harga_grosir: Number(p.harga_grosir || 0),
          min_qty_grosir: Number(p.min_qty_grosir || 0),
          barcode: p.barcode || p.kode_produk,
        });
        const loadOffline = async () => {
          const rows = await searchOfflineProducts('', false, { id_cabang: idCabangPengguna, tipe_katalog: tipeKatalog, kategori: activeCategory });
          return (rows || []).map(normalize);
        };

        setBrowseLoading(true);
        setBrowseError(false);
        let list = null;
        let apiFailed = false;
        if (isOnline) {
          try {
            const res = await getProducts({
              limit: 60,
              page: 1,
              status: 'aktif',
              kategori: activeCategory !== 'all' ? activeCategory : undefined,
              sortBy: 'nama_produk',
              sortOrder: 'asc',
              katalog_filter: tipeKatalog,
              id_cabang: tipeKatalog === 'terpisah' ? idCabangPengguna : undefined
            });
            list = (res.data?.data || []).map(normalize);
          } catch (_apiErr) {
            // Server error/timeout: jatuh ke data lokal di bawah
            list = null;
            apiFailed = true;
          }
        }
        if (list === null) {
          try { list = await loadOffline(); } catch (_offErr) { list = null; }
        }
        if (currentSearchId !== searchIdRef.current || !isStillRelevant) return;
        setBrowseLoading(false);
        // API gagal dan data lokal kosong/tak tersedia = error nyata (bukan "tidak ada produk")
        if (list === null || (apiFailed && list.length === 0)) { setProducts([]); setBrowseError(true); }
        else setProducts(list);
      }
    }, searchTerm.length === 0 ? 50 : 300); // Debounce 300ms to reduce heavy searches

    return () => {
      isStillRelevant = false;
      clearTimeout(timeoutId);
      setBrowseLoading(false); // jangan tinggalkan skeleton menggantung bila pemuatan dibatalkan
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, activeCategory, browseRetry, idCabangPengguna, tipeKatalog, isOnline, searchOfflineProducts]);
}

export default useProductBrowse;
