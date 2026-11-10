import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { computeProductPricing } from '../pricing';

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

  // Aturan harga eceran/grosir: fungsi murni di ../pricing.js (diuji unit); di sini hanya menambahkan pilihan manual per produk.
  const getProductPricing = useCallback(
    (product, quantity) => computeProductPricing(product, quantity, manualPricingOverrides[product.id_produk]),
    [manualPricingOverrides]
  );

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
          const pricing = computeProductPricing(item, item.jumlah, newOverride);
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
