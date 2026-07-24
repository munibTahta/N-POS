// src/hooks/usePos.js - Custom hook untuk mengelola state POS
import { useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';
import { useSync } from '../context/SyncContext';

export const usePos = () => {
  const { user } = useAuth();
  const { getConnectionStatus } = useSync();

  // State utama
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState({
    id_metode_pembayaran: 1,
    nama_metode: 'Tunai',
    tipe: 'cash'
  });
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Refs untuk menghindari stale closures
  const pendingPaymentRef = useRef(false);

  // Computed values
  const subtotal = useMemo(() =>
    cart.reduce((sum, item) => sum + (item.harga_jual * item.jumlah), 0),
    [cart]
  );

  const discountAmount = useMemo(() => {
    if (!appliedDiscount) return 0;
    return appliedDiscount.type === 'percentage'
      ? (subtotal * appliedDiscount.value) / 100
      : Math.min(appliedDiscount.value, subtotal);
  }, [subtotal, appliedDiscount]);

  const taxAmount = useMemo(() => {
    // Implementasi PPN calculation
    return 0; // Placeholder
  }, []); // No dependencies needed for placeholder

  const total = useMemo(() =>
    Math.max(0, subtotal - discountAmount + taxAmount),
    [subtotal, discountAmount, taxAmount]
  );

  const change = useMemo(() =>
    Math.max(0, paymentAmount - total),
    [paymentAmount, total]
  );

  // Actions
  const addToCart = useCallback((product, quantity = 1) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.id_produk === product.id_produk);
      if (existing) {
        return prevCart.map(item =>
          item.id_produk === product.id_produk
            ? { ...item, jumlah: item.jumlah + quantity }
            : item
        );
      }
      return [...prevCart, { ...product, jumlah: quantity }];
    });
  }, []);

  const updateQuantity = useCallback((productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(prevCart =>
      prevCart.map(item =>
        item.id_produk === productId
          ? { ...item, jumlah: newQuantity }
          : item
      )
    );
  }, [removeFromCart]);

  const removeFromCart = useCallback((productId) => {
    setCart(prevCart => prevCart.filter(item => item.id_produk !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setSelectedCustomer(null);
    setAppliedDiscount(null);
    setPaymentAmount(0);
  }, []);

  const applyDiscount = useCallback((discount) => {
    setAppliedDiscount(discount);
  }, []);

  const validateTransaction = useCallback(() => {
    const errors = [];

    if (cart.length === 0) {
      errors.push('Keranjang kosong');
    }

    if (paymentAmount < total && !pendingPaymentRef.current) {
      errors.push('Pembayaran kurang');
    }

    if (!selectedPaymentMethod) {
      errors.push('Metode pembayaran belum dipilih');
    }

    // Validasi stok
    cart.forEach(item => {
      if (item.jumlah > (item.stock || 0)) {
        errors.push(`Stok ${item.nama_produk} tidak mencukupi`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [cart, paymentAmount, total, selectedPaymentMethod]);

  const processTransaction = useCallback(async () => {
    const validation = validateTransaction();
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    setIsProcessing(true);
    try {
      const transactionData = {
        cart,
        customer: selectedCustomer,
        payment: {
          method: selectedPaymentMethod,
          amount: paymentAmount,
          change
        },
        discount: appliedDiscount,
        totals: {
          subtotal,
          discountAmount,
          taxAmount,
          total
        },
        isOnline: getConnectionStatus().isOnline,
        user: user
      };

      // Process transaction logic here
      // ...

      clearCart();
      return transactionData;
    } finally {
      setIsProcessing(false);
    }
  }, [
    cart, selectedCustomer, selectedPaymentMethod, paymentAmount,
    appliedDiscount, subtotal, discountAmount, taxAmount, total,
    change, validateTransaction, getConnectionStatus, user, clearCart
  ]);

  return {
    // State
    cart,
    selectedCustomer,
    selectedPaymentMethod,
    paymentAmount,
    appliedDiscount,
    isProcessing,

    // Computed
    subtotal,
    discountAmount,
    taxAmount,
    total,
    change,

    // Actions
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    applyDiscount,
    setSelectedCustomer,
    setSelectedPaymentMethod,
    setPaymentAmount,
    validateTransaction,
    processTransaction
  };
};