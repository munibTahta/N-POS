import { useCallback, useRef } from 'react';
import { formatCurrency } from '../../../utils/formatHelper';
import { logger } from '../../../utils/logger';
import { getProducts } from '../../../services/api';

export function usePosCartActions({ MAX_SNAPSHOTS, barcodeInputRef, belongsToCatalog, cart, idCabangPengguna, isOnline, lastScanTimeRef, loading, manualPricingOverrides, products, recordUsage, searchInputRef, searchOfflineProducts, setCart, setProducts, setSearchTerm, setSelectedProductIndex, showError, showErrorDebounced, showSuccess, snapshotStackRef, stockInfo, timeoutManager, tipeKatalog }) {
  const getProductStock = useCallback((id_produk) => {
    return stockInfo[id_produk] || 0;
  }, [stockInfo]);

  // Helper function to determine pricing based on wholesale conditions
  const debugGetProductPricing = useCallback((product, quantity) => {
    const hargaJual = Number(product.harga_jual || 0);
    const hargaGrosir = Number(product.harga_grosir || 0);
    const minQtyGrosir = Number(product.min_qty_grosir || 0);
    const override = manualPricingOverrides[product.id_produk];

    let price, priceType, isWholesale;

    if (override === 'eceran') {
      price = hargaJual;
      priceType = 'eceran';
      isWholesale = false;
    } else if (override === 'grosir') {
      price = hargaGrosir > 0 ? hargaGrosir : hargaJual;
      priceType = 'grosir';
      isWholesale = true;
    } else {
      // Auto mode - check if wholesale pricing applies
      isWholesale = hargaGrosir > 0 && minQtyGrosir > 0 && quantity >= minQtyGrosir;
      price = isWholesale ? hargaGrosir : hargaJual;
      priceType = isWholesale ? 'grosir' : 'eceran';
    }

    const result = { price, priceType, isWholesale };
    
    return result;
  }, [manualPricingOverrides]);

  const cartLockRef = useRef(false);

  // Save cart snapshot for undo (Ctrl+Z) - bounded stack prevents memory leak
  const saveCartSnapshot = useCallback(() => {
    // Create compressed snapshot with only essential data
    const snapshot = {
      items: cart.map(item => ({
        id_produk: item.id_produk,
        jumlah: item.jumlah,
        harga_satuan: item.harga_satuan,
        tipe_harga: item.tipe_harga,
        nama_produk: item.nama_produk,
        subtotal: item.subtotal
      })),
      timestamp: Date.now()
    };
    
    snapshotStackRef.current.push(snapshot);
    
    // Keep only last N snapshots (bounded memory)
    while (snapshotStackRef.current.length > MAX_SNAPSHOTS) {
      snapshotStackRef.current.shift(); // Remove oldest
    }
  }, [cart, MAX_SNAPSHOTS, snapshotStackRef]);

  // Undo last action (restore from snapshot)
  const handleUndo = useCallback(() => {
    if (snapshotStackRef.current.length > 0) {
      const previousSnapshot = snapshotStackRef.current.pop();
      
      const restoredCart = previousSnapshot.items.map((item, idx) => {
        const original = cart[idx];
        if (original) {
          return { 
            ...original, 
            jumlah: item.jumlah,
            harga_satuan: item.harga_satuan,
            tipe_harga: item.tipe_harga,
            subtotal: item.subtotal
          };
        }
        return item;
      });
      
      setCart(restoredCart);
      showSuccess('Aksi dibatalkan');
    } else {
      showError('Tidak ada aksi untuk di-undo');
    }
  }, [cart, showSuccess, showError, setCart, snapshotStackRef]);

  const handleAddToCart = useCallback((product, fromBarcodeScan = false, skipSearchFocus = false) => {
    // Prevent race conditions with mutex lock
    if (cartLockRef.current) {
      return; // Skip if already processing
    }
    
    // Save snapshot before making changes
    saveCartSnapshot();
    cartLockRef.current = true;
    
    try {
      const currentStock = getProductStock(product.id_produk);
      if (currentStock <= 0) {
        showErrorDebounced(`Stok produk ${product.nama_produk} habis.`);
        return;
      }
      if (!belongsToCatalog(product)) {
        showErrorDebounced(`Produk ${product.nama_produk} bukan bagian dari katalog cabang ini.`);
        return;
      }
      recordUsage(product);

      let shouldShowWholesaleMessage = false;
      let wholesaleProductName = '';
      let wholesalePrice = 0;
      let hasInsufficientStock = false;

      setCart(prevCart => {
        const existingItem = prevCart.find(item => item.id_produk === product.id_produk);
        if (existingItem) {
          const newQuantity = existingItem.jumlah + 1;
          if (newQuantity > currentStock) {
            showErrorDebounced(`Stok tidak mencukupi. Maksimal ${currentStock} item.`);
            hasInsufficientStock = true;
            return prevCart;
          }
          const oldPricing = debugGetProductPricing(product, existingItem.jumlah);
          const pricing = debugGetProductPricing(product, newQuantity);
          
          // Check if price changed to wholesale
          if (!oldPricing.isWholesale && pricing.isWholesale) {
            shouldShowWholesaleMessage = true;
            wholesaleProductName = product.nama_produk;
            wholesalePrice = pricing.price;
          }
          return prevCart.map(item =>
            item.id_produk === product.id_produk
              ? { 
                  ...item, 
                  jumlah: newQuantity, 
                  harga_satuan: pricing.price,
                  tipe_harga: pricing.priceType,
                  subtotal: newQuantity * pricing.price 
                }
              : item
          );
        }
        const pricing = debugGetProductPricing(product, 1);
        
        // Check if new item qualifies for wholesale pricing
        if (pricing.isWholesale) {
          shouldShowWholesaleMessage = true;
          wholesaleProductName = product.nama_produk;
          wholesalePrice = pricing.price;
        }
        
        return [...prevCart, { 
          ...product, 
          jumlah: 1, 
          harga_satuan: pricing.price,
          tipe_harga: pricing.priceType,
          subtotal: pricing.price 
        }];
      });

      // Show wholesale message after state update
      if (shouldShowWholesaleMessage) {
        showSuccess(`Harga grosir aktif! ${wholesaleProductName} sekarang ${formatCurrency(wholesalePrice)} per item.`);
      }

      // Don't continue if stock was insufficient
      if (hasInsufficientStock) {
        return;
      }

      // Auto-focus behavior depends on source:
      // - Barcode scan: Keep focus on barcode input for continuous scanning
      // - Manual add: Focus search input for convenience
      const isTouchPrimary = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
      if (!fromBarcodeScan && !skipSearchFocus && !isTouchPrimary) {
        setTimeout(() => {
          const searchInput = searchInputRef.current;
          if (searchInput) {
            searchInput.focus();
            searchInput.select(); // Select all text for easy replacement
          }
        }, 100);
      }

      // Clear selection/search term for next manual product add
      if (!fromBarcodeScan) {
        setSearchTerm('');
        setSelectedProductIndex(-1);
      }

      // Show success feedback
      // Umpan balik singkat: badge jumlah di kartu produk sudah menunjukkan hasilnya, jadi toast tidak perlu lama.
      showSuccess(`+ ${product.nama_produk}`, { autoClose: 1000, hideProgressBar: true, toastId: `cart-add-${product.id_produk}` });
    } finally {
      // Release lock after a short delay to prevent too rapid clicks
      setTimeout(() => {
        cartLockRef.current = false;
      }, 100);
    }
  }, [getProductStock, showErrorDebounced, showSuccess, debugGetProductPricing, saveCartSnapshot, recordUsage, belongsToCatalog, searchInputRef, setCart, setSearchTerm, setSelectedProductIndex]);

  // Track input timing to detect rapid scanner input vs manual typing
  const handleBarcodeScan = useCallback(async (barcode) => {
    if (!barcode || barcode.trim() === '') return;

    const now = Date.now();

    // Rate limiting: Ignore scans that are too close together (less than 200ms)
    if (now - lastScanTimeRef.current < 200) {
      logger.debug('Barcode scan ignored due to rate limiting');
      return;
    }

    // Clear search term when barcode scan succeeds - important for POS flow
    // This ensures product grid shows all products, not filtered results
    setSearchTerm('');
    setSelectedProductIndex(-1);

    // Debouncing: Clear any pending scan timeout using timeoutManager
    timeoutManager.current.clear('barcodeScan');

    // Set new timeout for debounced scan (100ms delay)
    timeoutManager.current.set('barcodeScan', async () => {
      // Check if products are still loading or array is empty
      // If empty, auto-load all products from API as fallback for barcode scanning
      if (products.length === 0 && !loading) {
        logger.debug('Products array empty, auto-loading all products for barcode scan...');
        try {
          const allProductsRes = await getProducts({
            limit: 1000,
            page: 1,
            status: 'aktif',
            sortBy: 'nama_produk',
            sortOrder: 'asc',
            katalog_filter: tipeKatalog,
            id_cabang: tipeKatalog === 'terpisah' ? idCabangPengguna : undefined
          });
          const loadedProducts = allProductsRes.data?.data || [];
          const enhancedProducts = loadedProducts.map(p => ({
            ...p,
            harga_jual: Number(p.harga_jual || 0),
            harga_beli: Number(p.harga_beli || 0),
            harga_grosir: Number(p.harga_grosir || 0),
            min_qty_grosir: Number(p.min_qty_grosir || 0),
            barcode: p.barcode || p.kode_produk,
          }));
          setProducts(enhancedProducts);
          logger.info(`Auto-loaded ${enhancedProducts.length} products for barcode scan`);
        } catch (err) {
          logger.error('Failed to auto-load products for barcode scan:', err);
          showErrorDebounced('Gagal memuat produk untuk scan');
          return;
        }
      }

      if (loading) {
        logger.debug('Barcode scanned but products still loading, retrying in 500ms...');
        setTimeout(() => handleBarcodeScan(barcode), 500);
        return;
      }

      // Clean the barcode input - remove non-printable characters and extra whitespace
      const cleanedBarcode = barcode
        .replace(/[\r\n\t]/g, '') // Remove carriage return, newline, tab
        .replace(/\0/g, '') // Remove null characters
        .trim();

      if (!cleanedBarcode) return;

      logger.debug('Barcode scanned (cleaned):', cleanedBarcode);

      // First, try to find product in currently loaded products by kode_produk only
      let product = products.find(p =>
        p.kode_produk && p.kode_produk.toLowerCase() === cleanedBarcode.toLowerCase()
      );

      if (product) {
        logger.debug('Product found in loaded products:', product.nama_produk, 'via kode_produk');
        // Clear search before adding to cart
        setSearchTerm('');
        setSelectedProductIndex(-1);
        handleAddToCart(product, true); // true = from barcode scan
        // Ensure barcode input gets focus immediately after successful scan
        setTimeout(() => {
          if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
          }
        }, 50);
        return;
      }

      // If not found in loaded products, try to search via API or offline
      logger.debug('Product not found in loaded products, searching...');
      try {
        let searchResults = [];

        // If offline, use offline search
        if (!isOnline) {
          logger.debug('Offline mode: using offline search for barcode...');
           // Pass isBarcodeScan=true to search ALL products without 50-item limit
          const offlineResults = await searchOfflineProducts(cleanedBarcode, true, { id_cabang: idCabangPengguna, tipe_katalog: tipeKatalog });
          searchResults = offlineResults;
        } else {
          // Online: use API search
          const searchRes = await getProducts({
            limit: 10,
            page: 1,
            status: 'aktif',
            search: cleanedBarcode,
            sortBy: 'nama_produk',
            sortOrder: 'asc',
            katalog_filter: tipeKatalog,
            id_cabang: tipeKatalog === 'terpisah' ? idCabangPengguna : undefined
          });
          searchResults = searchRes.data?.data || [];
        }

        // Look for exact match in search results by kode_produk only
        product = searchResults.find(p =>
          p.kode_produk && p.kode_produk.toLowerCase() === cleanedBarcode.toLowerCase()
        );

        if (product) {
          logger.debug('Product found via search:', product.nama_produk, 'via kode_produk');

          // Add the found product to the loaded products array
          const enhancedProduct = {
            ...product,
            harga_jual: Number(product.harga_jual || 0),
            harga_beli: Number(product.harga_beli || 0),
            harga_grosir: Number(product.harga_grosir || 0),
            min_qty_grosir: Number(product.min_qty_grosir || 0),
            barcode: product.barcode || product.kode_produk,
            // Get stock from product or cached stock info
            stok: Number(product.stok || stockInfo[product.id_produk] || 0)
          };

          setProducts(prevProducts => {
            // Check if product already exists to avoid duplicates
            const exists = prevProducts.find(p => p.id_produk === product.id_produk);
            if (!exists) {
              return [...prevProducts, enhancedProduct];
            }
            return prevProducts;
          });

          // Clear search before adding to cart
          setSearchTerm('');
          setSelectedProductIndex(-1);
          handleAddToCart(enhancedProduct, true); // true = from barcode scan
          // Update last scan time only on successful scan
          lastScanTimeRef.current = Date.now();
          // Ensure barcode input gets focus immediately after successful scan
          setTimeout(() => {
            if (barcodeInputRef.current) {
              barcodeInputRef.current.focus();
            }
          }, 50);
          return;
        }
      } catch (searchError) {
        logger.error('Search failed:', searchError);
        // Continue to show error message
      }

      // If still not found, show error with more detailed information
      logger.debug('No product found for barcode:', cleanedBarcode);
      logger.debug('Available products count:', products.length);
      logger.debug('Sample products:', products.slice(0, 3).map(p => ({ kode: p.kode_produk, barcode: p.barcode })));
      showErrorDebounced(`Produk dengan kode ${cleanedBarcode} tidak ditemukan. Pastikan produk sudah dimuat dan aktif.`);
    }, 100);
  }, [products, loading, isOnline, idCabangPengguna, tipeKatalog, searchOfflineProducts, handleAddToCart, showErrorDebounced, stockInfo, barcodeInputRef, lastScanTimeRef, setProducts, setSearchTerm, setSelectedProductIndex, timeoutManager]);

  return { cartLockRef, debugGetProductPricing, getProductStock, handleAddToCart, handleBarcodeScan, handleUndo, saveCartSnapshot };
}

export default usePosCartActions;
