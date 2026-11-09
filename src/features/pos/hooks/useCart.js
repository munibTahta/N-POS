import { useState, useRef, useMemo, useEffect, useCallback } from 'react';

const MAX_SNAPSHOTS = 5;

/**
 * Pemilik state keranjang kasir: item, override harga manual, tumpukan undo (Ctrl+Z, dibatasi),
 * dan operasi yang tidak bergantung pada stok/produk.
 */
export function useCart({ showSuccess, showError }) {
  const [cart, setCart] = useState([]);
  const [manualPricingOverrides, setManualPricingOverrides] = useState({}); // { productId: 'eceran' | 'grosir' }
  // Ref (bukan state) agar tumpukan snapshot tidak memicu render dan memori tetap terbatas.
  const snapshotStackRef = useRef([]);

  useEffect(() => {
    const stack = snapshotStackRef;
    return () => { stack.current = []; };
  }, []);

  const cartQtyMap = useMemo(() => {
    const m = {};
    cart.forEach((i) => { m[i.id_produk] = i.jumlah; });
    return m;
  }, [cart]);

  // Helper function to determine pricing based on wholesale conditions
  const getProductPricing = useCallback((product, quantity) => {
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
  }, [cart, snapshotStackRef]);

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

  const handleSetManualPricing = useCallback((productId, pricingType) => {
    // Calculate new override value
    const newOverride = pricingType === 'auto' ? undefined : pricingType;
    
    setManualPricingOverrides(prev => {
      const newOverrides = { ...prev };
      if (pricingType === 'auto') {
        // Remove override for auto mode
        delete newOverrides[productId];
      } else {
        // Set manual override
        newOverrides[productId] = pricingType;
      }
      return newOverrides;
    });

    // Update cart with new pricing using the new override value
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id_produk === productId) {
          // Create a temporary pricing function with the new override
          const tempPricingFunc = (product, quantity) => {
            const hargaJual = Number(product.harga_jual || 0);
            const hargaGrosir = Number(product.harga_grosir || 0);
            const minQtyGrosir = Number(product.min_qty_grosir || 0);
            const override = newOverride; // Use the new override value

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

            return { price, priceType, isWholesale };
          };
          
          const pricing = tempPricingFunc(item, item.jumlah);
          return {
            ...item,
            harga_satuan: pricing.price,
            tipe_harga: pricing.priceType,
            subtotal: item.jumlah * pricing.price
          };
        }
        return item;
      });
    });
  }, []);

  const handleRemoveFromCart = useCallback((productId) => {
    saveCartSnapshot();
    setCart(prevCart => prevCart.filter(item => item.id_produk !== productId));
    // Also remove manual pricing override for this product
    setManualPricingOverrides(prev => {
      const newOverrides = { ...prev };
      delete newOverrides[productId];
      return newOverrides;
    });
  }, [saveCartSnapshot]);

  return { cart, setCart, cartQtyMap, manualPricingOverrides, setManualPricingOverrides, getProductPricing, saveCartSnapshot, handleUndo, handleSetManualPricing, handleRemoveFromCart };
}

export default useCart;
