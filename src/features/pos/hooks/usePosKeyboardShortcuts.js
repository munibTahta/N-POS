import { useEffect } from 'react';

export function usePosKeyboardShortcuts({ appliedVoucher, cart, cartFocusedIndex, customerSearchRef, getProductPricing, filteredProducts, finalTotal, focusedSection, getNextProductIndex, getProductStock, handleAddToCart, handleRemoveFromCart, handleSubmit, handleUndo, handleUpdateQuantity, lastTransaction, navigate, paymentAmount, paymentAmountInputRef, pendingCheckboxRef, posSettings, products, searchInputRef, searchTerm, selectedPaymentMethod, selectedProductIndex, setAppliedVoucher, setCart, setCartFocusedIndex, setConfirmDialog, setCurrentKeyboardHint, setFocusedSection, setIsOpeningCashDrawer, setManualPricingOverrides, setPaymentAmount, setSaleDataForPrint, setSearchTerm, setSelectedCustomer, setSelectedProductIndex, setShowCameraScanner, setShowCustomerPopup, setShowDiscountDialog, setShowPaymentModal, setShowPrintModal, setShowShortcutsModal, showCameraScanner, showCustomerPopup, showError, showPaymentModal, showPrintModal, showShortcutsModal, showSuccess, submitButtonRef, taxAmount }) {
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip most shortcuts if shortcut modal is open (allow Esc, F1, Alt+B only)
      if (showShortcutsModal && e.key !== 'Escape' && e.key !== 'F1' && !(e.key === 'b' && e.altKey)) {
        return;
      }
      
      const isSearchInput = e.target === searchInputRef.current;
      const isPaymentAmountInput = e.target === paymentAmountInputRef.current;
      
      // F1: HELP / Shortcuts Modal
      if (e.key === 'F1') {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
        return;
      }

      // F2: SEARCH PRODUCTS (existing - keep same)
      if (e.key === 'F2') {
        e.preventDefault();
        const searchInput = searchInputRef.current;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
          setFocusedSection('search');
          setSelectedProductIndex(-1);
          setCurrentKeyboardHint('Ketik untuk cari produk • Panah Bawah untuk navigasi • Enter untuk pilih');
        }
        return;
      }

      // F3: BARCODE SCANNER (standar untuk scan produk)
      if (e.key === 'F3') {
        e.preventDefault();
        setShowCameraScanner(true);
        setCurrentKeyboardHint('Scanner barcode aktif • Esc untuk tutup');
        return;
      }

      // F4: Fokus ke nominal pembayaran
      if (e.key === 'F4' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        if (showPaymentModal || selectedPaymentMethod) {
          e.preventDefault();
          if (paymentAmountInputRef.current) {
            paymentAmountInputRef.current.focus();
            paymentAmountInputRef.current.select();
            setFocusedSection('payment-amount');
            setCurrentKeyboardHint('Masukkan nominal pembayaran • Ctrl+0 untuk total');
          }
          return;
        }
      }

      // F5: CUSTOMER SEARCH
      if (e.key === 'F5' && posSettings?.showCustomerSearch) {
        e.preventDefault();
        setShowCustomerPopup(prev => {
          const willOpen = !prev;
          if (willOpen) {
            setTimeout(() => {
              if (customerSearchRef.current) {
                customerSearchRef.current.focus();
                customerSearchRef.current.select();
              }
            }, 100);
            setCurrentKeyboardHint('Cari pelanggan • Ketik nama/nomor member • Enter untuk pilih');
          }
          return willOpen;
        });
        return;
      }

      // F6: DISCOUNT
      if (e.key === 'F6' && cart.length > 0 && !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        e.preventDefault();
        setShowDiscountDialog(true);
        setCurrentKeyboardHint('Dialog Diskon • Masukkan nominal atau persentase • Enter terapkan');
        return;
      }

      // F7: PAYMENT METHOD (focus to payment method selector)
      if (e.key === 'F7') {
        e.preventDefault();
        setFocusedSection('payment');
        const paymentMethodSelect = document.getElementById('payment-method-select');
        if (paymentMethodSelect) {
          paymentMethodSelect.focus();
          setCurrentKeyboardHint('Pilih metode pembayaran • Panah Atas/Bawah untuk pilih • Enter untuk confirm');
        }
        return;
      }

      // F8: OPEN CASH DRAWER
      if (e.key === 'F8') {
        e.preventDefault();
        if (window.electronAPI && window.electronAPI.openCashDrawer) {
          setIsOpeningCashDrawer(true);
          window.electronAPI.openCashDrawer()
            .then(() => showSuccess('Cash drawer berhasil dibuka'))
            .catch((error) => {
              console.error('Failed to open cash drawer:', error);
              showError('Gagal membuka cash drawer');
            })
            .finally(() => setIsOpeningCashDrawer(false));
        } else {
          showError('Cash drawer tidak tersedia');
        }
        return;
      }

      // F12 / End: OPEN PAYMENT MODAL
      if (e.key === 'F12' || e.key === 'End') {
        e.preventDefault();
        if (cart.length === 0) {
          showError('Keranjang masih kosong. Tambahkan produk terlebih dahulu.');
          return;
        }
        setShowPaymentModal(true);
        setCurrentKeyboardHint('Modal Pembayaran • F4 untuk input nominal • Ctrl+0 untuk total');
        return;
      }

      // Alt+B: BARCODE SCANNER (alternative for F3)
      if (e.key === 'b' && e.altKey) {
        e.preventDefault();
        setShowCameraScanner(true);
        setCurrentKeyboardHint('Barcode Scanner aktif • Arahkan ke barcode • Esc untuk tutup');
        return;
      }

      // ============ NEW SHORTCUTS FOR NAVIGATION AND PRINT ============

      // F10: NAVIGATE TO PURCHASE MANAGEMENT PAGE
      if (e.key === 'F10') {
        e.preventDefault();
        navigate('/pembelian');
        showSuccess('Navigasi ke halaman manajemen pembelian');
        return;
      }

      // F11: NAVIGATE TO SALES HISTORY PAGE
      if (e.key === 'F11') {
        e.preventDefault();
        navigate('/penjualan');
        showSuccess('Navigasi ke riwayat penjualan');
        return;
      }

      // Ctrl+P: REPRINT LAST TRANSACTION
      if (e.key === 'p' && e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (lastTransaction) {
          setSaleDataForPrint(lastTransaction);
          showSuccess('Menampilkan modal print ulang transaksi terakhir');
        } else {
          showError('Tidak ada transaksi terakhir untuk di-print ulang');
        }
        return;
      }

      // ============ CONTROL + NUMBER SHORTCUTS (Quick Payment Amounts) ============
      
      // Ctrl+1: Quick payment Rp 10.000
      if (e.key === '1' && e.ctrlKey && !e.shiftKey && cart.length > 0) {
        e.preventDefault();
        setPaymentAmount(10000);
        showSuccess('Nominal Rp 10.000 diisi');
        return;
      }

      // Ctrl+2: Quick payment Rp 20.000
      if (e.key === '2' && e.ctrlKey && !e.shiftKey && cart.length > 0) {
        e.preventDefault();
        setPaymentAmount(20000);
        showSuccess('Nominal Rp 20.000 diisi');
        return;
      }

      // Ctrl+3: Quick payment Rp 50.000
      if (e.key === '3' && e.ctrlKey && !e.shiftKey && cart.length > 0) {
        e.preventDefault();
        setPaymentAmount(50000);
        showSuccess('Nominal Rp 50.000 diisi');
        return;
      }

      // Ctrl+4: Quick payment Rp 100.000
      if (e.key === '4' && e.ctrlKey && !e.shiftKey && cart.length > 0) {
        e.preventDefault();
        setPaymentAmount(100000);
        showSuccess('Nominal Rp 100.000 diisi');
        return;
      }

      // Ctrl+0: Auto-fill payment to match total
      if (e.key === '0' && e.ctrlKey && !e.shiftKey && cart.length > 0) {
        e.preventDefault();
        setPaymentAmount(finalTotal);
        showSuccess(`Nominal Rp ${finalTotal.toLocaleString('id-ID')} (Total Tagihan) diisi`);
        return;
      }

      // Ctrl+Enter: CHECKOUT (Direct submit)
      if (e.key === 'Enter' && e.ctrlKey && cart.length > 0) {
        e.preventDefault();
        handleSubmit();
        return;
      }

      // Ctrl+Del / Ctrl+Backspace: QUICK CLEAR CART
      if ((e.key === 'Delete' || e.key === 'Backspace') && e.ctrlKey && cart.length > 0) {
        e.preventDefault();
        setConfirmDialog({
          isOpen: true,
          title: 'Kosongkan Keranjang',
          message: 'Apakah Anda yakin ingin menghapus semua item dari keranjang belanja?',
          confirmText: 'Ya, Kosongkan',
          onConfirm: () => {
            setCart([]);
            setManualPricingOverrides({});
            setSelectedCustomer(null);
            setAppliedVoucher(null);
            showSuccess('Keranjang dikosongkan');
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          },
          variant: 'danger'
        });
        return;
      }

      // ============ ALT + LETTER: QUICK SECTION NAVIGATION ============

      // Alt+P: Go to Products section (search)
      if (e.key === 'p' && e.altKey) {
        e.preventDefault();
        setFocusedSection('search');
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
        setCurrentKeyboardHint('Navigasi ke Cari Produk • Ketik untuk cari');
        return;
      }

      // Alt+C: Go to Cart section
      if (e.key === 'c' && e.altKey) {
        e.preventDefault();
        if (cart.length > 0) {
          setFocusedSection('cart');
          setCartFocusedIndex(0);
          setCurrentKeyboardHint('Navigasi ke Keranjang • Panah Atas/Bawah untuk pilih item • +/- untuk qty');
        } else {
          showError('Keranjang masih kosong');
        }
        return;
      }

      // Alt+M: Go to Payment section (Metode/Means)
      if (e.key === 'm' && e.altKey) {
        e.preventDefault();
        if (cart.length === 0) {
          showError('Tambahkan produk ke keranjang terlebih dahulu');
          return;
        }
        setFocusedSection('payment');
        const paymentMethodSelect = document.getElementById('payment-method-select');
        if (paymentMethodSelect) {
          paymentMethodSelect.focus();
        }
        setCurrentKeyboardHint('Navigasi ke Pembayaran • Pilih metode pembayaran');
        return;
      }

      // ============ NAVIGATION & MODAL BLOCKING ============
      
      // Allow Escape, F1, Alt+B anytime, block other shortcuts in modals
      if (
        (showCustomerPopup || showCameraScanner || showPrintModal) &&
        e.key !== 'Escape' &&
        !(e.key === 'F1') &&
        !(e.key === 'b' && e.altKey) &&
        !(e.key === 'Enter' && e.ctrlKey)
      ) {
        return;
      }

      // Escape: Close modals or clear search
      if (e.key === 'Escape') {
        if (showPaymentModal) {
          setShowPaymentModal(false);
          setCurrentKeyboardHint('Modal pembayaran ditutup');
          return;
        }
        if (showPrintModal) {
          setShowPrintModal(false);
          return;
        }
        if (showCustomerPopup) {
          setShowCustomerPopup(false);
          if (searchInputRef.current) searchInputRef.current.focus();
          return;
        }
        if (showCameraScanner) {
          setShowCameraScanner(false);
          if (searchInputRef.current) searchInputRef.current.focus();
          return;
        }
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
          return;
        }
        // Clear search
        setSearchTerm('');
        setFocusedSection('search');
        setSelectedProductIndex(-1);
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          setCurrentKeyboardHint('Pencarian dibersihkan • F2 untuk cari atau scan produk');
        }
        return;
      }

      // ============ ARROW KEY NAVIGATION ============
      
      // Arrow Up - Navigate upward through sections
      if (e.key === 'ArrowUp' && !(e.target.tagName === 'TEXTAREA') && (isSearchInput || e.target.tagName !== 'INPUT')) {
        e.preventDefault();
        
        if (focusedSection === 'search' || focusedSection === 'products') {
          if (filteredProducts.length > 0) {
            setFocusedSection('products');
            const nextIndex = getNextProductIndex('up', selectedProductIndex);
            if (nextIndex === -1) {
              setFocusedSection('search');
              setSelectedProductIndex(-1);
              if (searchInputRef.current) searchInputRef.current.focus();
            } else {
              setSelectedProductIndex(nextIndex);
            }
          }
          return;
        }
        
        if (focusedSection.startsWith('payment')) {
          if (focusedSection === 'payment-submit') {
            if (pendingCheckboxRef.current) {
              pendingCheckboxRef.current.focus();
              setFocusedSection('payment-pending');
            } else if (paymentAmountInputRef.current) {
              paymentAmountInputRef.current.focus();
              setFocusedSection('payment-amount');
            } else {
              setFocusedSection('payment');
              const paymentMethodSelect = document.getElementById('payment-method-select');
              if (paymentMethodSelect) paymentMethodSelect.focus();
            }
          } else if (focusedSection === 'payment-pending') {
            if (paymentAmountInputRef.current) {
              paymentAmountInputRef.current.focus();
              setFocusedSection('payment-amount');
            } else {
              setFocusedSection('payment');
            }
          } else if (focusedSection === 'payment-amount') {
            setFocusedSection('payment');
            const paymentMethodSelect = document.getElementById('payment-method-select');
            if (paymentMethodSelect) paymentMethodSelect.focus();
          } else if (focusedSection === 'payment') {
            const cartLastItem = document.querySelectorAll('[data-cart-item]');
            if (cartLastItem.length > 0) {
              cartLastItem[cartLastItem.length - 1].focus();
              setFocusedSection('cart');
              setCartFocusedIndex(cart.length - 1);
            }
          }
          return;
        }

        if (focusedSection === 'cart') {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            setFocusedSection('search');
            setCartFocusedIndex(-1);
          }
          return;
        }
      }

      // Arrow Down - Navigate downward through sections
      if (e.key === 'ArrowDown' && !(e.target.tagName === 'TEXTAREA') && (isSearchInput || e.target.tagName !== 'INPUT')) {
        e.preventDefault();
        
        if (focusedSection === 'search' || focusedSection === 'products') {
          if (filteredProducts.length > 0) {
            setFocusedSection('products');
            const nextIndex = getNextProductIndex('down', selectedProductIndex);
            if (nextIndex === -1) {
              const cartFirstItem = document.querySelector('[data-cart-item]');
              if (cartFirstItem) {
                cartFirstItem.focus();
                setFocusedSection('cart');
                setCartFocusedIndex(0);
              }
            } else {
              setSelectedProductIndex(nextIndex);
            }
          } else {
            const cartFirstItem = document.querySelector('[data-cart-item]');
            if (cartFirstItem) {
              cartFirstItem.focus();
              setFocusedSection('cart');
              setCartFocusedIndex(0);
            }
          }
          return;
        }

        if (focusedSection === 'cart') {
          setFocusedSection('payment');
          setCartFocusedIndex(-1);
          const paymentMethodSelect = document.getElementById('payment-method-select');
          if (paymentMethodSelect) paymentMethodSelect.focus();
          return;
        }

        if (focusedSection === 'payment') {
          if (paymentAmountInputRef.current) {
            paymentAmountInputRef.current.focus();
            setFocusedSection('payment-amount');
          } else if (submitButtonRef.current) {
            submitButtonRef.current.focus();
            setFocusedSection('payment-submit');
          }
          return;
        }

        if (focusedSection === 'payment-amount') {
          if (pendingCheckboxRef.current && (paymentAmount < finalTotal || paymentAmount === 0)) {
            pendingCheckboxRef.current.focus();
            setFocusedSection('payment-pending');
          } else if (submitButtonRef.current) {
            submitButtonRef.current.focus();
            setFocusedSection('payment-submit');
          }
          return;
        }

        if (focusedSection === 'payment-pending') {
          if (submitButtonRef.current) {
            submitButtonRef.current.focus();
            setFocusedSection('payment-submit');
          }
          return;
        }
      }

      // ============ PRODUCT GRID NAVIGATION ============
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !(e.target.tagName === 'TEXTAREA') && (isSearchInput || e.target.tagName !== 'INPUT')) {
        if (focusedSection === 'search' || focusedSection === 'products') {
          e.preventDefault();
          if (filteredProducts.length > 0) {
            setFocusedSection('products');
            const nextIndex = getNextProductIndex(e.key === 'ArrowRight' ? 'right' : 'left', selectedProductIndex);
            if (nextIndex >= 0) {
              setSelectedProductIndex(nextIndex);
            }
          }
          return;
        }
      }

      // ============ CART ITEM MANAGEMENT ============
      
      // Left/Right arrow in cart
      if (e.key === 'ArrowLeft' && focusedSection === 'cart' && cart.length > 0 && !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        e.preventDefault();
        if (cartFocusedIndex > 0) {
          setCartFocusedIndex(cartFocusedIndex - 1);
        } else {
          setFocusedSection('search');
          setCartFocusedIndex(-1);
          if (searchInputRef.current) searchInputRef.current.focus();
        }
        return;
      }

      if (e.key === 'ArrowRight' && focusedSection === 'cart' && cart.length > 0 && !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        e.preventDefault();
        if (cartFocusedIndex < cart.length - 1) {
          setCartFocusedIndex(cartFocusedIndex + 1);
        } else {
          setFocusedSection('payment');
          setCartFocusedIndex(-1);
          const paymentMethodSelect = document.getElementById('payment-method-select');
          if (paymentMethodSelect) paymentMethodSelect.focus();
        }
        return;
      }

      // Plus/Minus for quantity
      if ((e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') && focusedSection === 'cart' && cart.length > 0 && cartFocusedIndex >= 0 && !(e.target.tagName === 'INPUT')) {
        e.preventDefault();
        const item = cart[cartFocusedIndex];
        if (item) {
          const currentStock = getProductStock(item.id_produk);
          if (e.key === '+' || e.key === '=') {
            if (item.jumlah < currentStock) {
              handleUpdateQuantity(item.id_produk, item.jumlah + 1);
            }
          } else {
            if (item.jumlah > 1) {
              handleUpdateQuantity(item.id_produk, item.jumlah - 1);
            } else {
              handleRemoveFromCart(item.id_produk);
              setCartFocusedIndex(-1);
            }
          }
        }
        return;
      }

      // Backspace: Delete focused cart item
      if (e.key === 'Backspace' && focusedSection === 'cart' && cart.length > 0 && cartFocusedIndex >= 0 && !(e.target.tagName === 'INPUT')) {
        e.preventDefault();
        const item = cart[cartFocusedIndex];
        if (item) {
          handleRemoveFromCart(item.id_produk);
          setCartFocusedIndex(Math.max(-1, cartFocusedIndex - 1));
        }
        return;
      }

      // Delete: Remove last cart item
      if (e.key === 'Delete' && cart.length > 0 && !(e.target.tagName === 'INPUT')) {
        e.preventDefault();
        setCart(prevCart => prevCart.slice(0, -1));
        return;
      }

      // ============ CTRL + SPECIAL KEYS (work even in inputs) ============

      // Ctrl+Z: Undo (always works, even in inputs)
      if (e.key === 'z' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // ============ PRODUCT SELECTION & QUANTITY INPUT ============

      // Skip INPUT/TEXTAREA processing further except for search input or payment amount input
      if ((e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && !isSearchInput && !isPaymentAmountInput) {
        return;
      }

      // Enter: Product selection or payment confirmation
      if (e.key === 'Enter') {
        e.preventDefault();

        // Add selected product to cart when search or product grid is active
        if ((focusedSection === 'products' || focusedSection === 'search') && filteredProducts.length > 0) {
          const indexToAdd = selectedProductIndex >= 0 ? selectedProductIndex : 0;
          const selectedProduct = filteredProducts[indexToAdd];
          if (selectedProduct) {
            handleAddToCart(selectedProduct, false, true);
            setSelectedProductIndex(-1);
            setCurrentKeyboardHint(`${selectedProduct.nama_produk} ditambahkan • F2 untuk cari lagi`);
            return;
          }
        }

        // Submit payment
        if (focusedSection === 'payment-submit') {
          handleSubmit();
          return;
        }
      }

      // Number keys: Quick quantity for last cart item
      const isNumericKey = () => {
        if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
          if (e.key >= '1' && e.key <= '9') return true;
          if (/^Numpad[1-9]$/.test(e.code)) return true;
        }
        return false;
      };

      // Only numeric quantity shortcuts should work when cart navigation is active
      if (isNumericKey() && cart.length > 0 && focusedSection === 'cart' && !isSearchInput && !isPaymentAmountInput && !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        let quantity = parseInt(e.key);
        if (isNaN(quantity) && /^Numpad[1-9]$/.test(e.code)) {
          quantity = parseInt(e.code.slice(6));
        }

        const lastItem = cart[cart.length - 1];
        const currentStock = getProductStock(lastItem.id_produk);

        if (quantity > currentStock) {
          showError(`Stok tidak cukup. Maksimal ${currentStock} item.`);
          return;
        }

        e.preventDefault();
        setCart(prevCart =>
          prevCart.map((item, index) => {
            if (index === prevCart.length - 1) {
              const pricing = getProductPricing(item, quantity);
              return { 
                ...item, 
                jumlah: quantity, 
                harga_satuan: pricing.price,
                tipe_harga: pricing.priceType,
                subtotal: quantity * pricing.price 
              };
            }
            return item;
          })
        );
        return;
      }

      // Page Up/Down: Quick navigation
      if (e.key === 'PageUp') {
        e.preventDefault();
        if (focusedSection === 'cart' && cartFocusedIndex > 0) {
          setCartFocusedIndex(0);
        } else if (focusedSection === 'products' && selectedProductIndex > 0) {
          setSelectedProductIndex(Math.max(0, selectedProductIndex - 5));
        }
        return;
      }

      if (e.key === 'PageDown') {
        e.preventDefault();
        if (focusedSection === 'cart' && cartFocusedIndex < cart.length - 1) {
          setCartFocusedIndex(cart.length - 1);
        } else if (focusedSection === 'products' && selectedProductIndex < products.length - 1) {
          setSelectedProductIndex(Math.min(products.length - 1, selectedProductIndex + 5));
        }
        return;
      }

      // Space: Confirm in dropdown
      if (e.key === ' ') {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'BUTTON' || activeElement.tagName === 'SELECT')) {
          e.preventDefault();
          activeElement.click();
        }
      }

      // Handle payment modal shortcuts
      if (showPaymentModal) {
        // F4: Focus to payment amount input
        if (e.key === 'F4') {
          e.preventDefault();
          if (paymentAmountInputRef.current) {
            paymentAmountInputRef.current.focus();
            setCurrentKeyboardHint('Masukkan nominal pembayaran • Ctrl+0 untuk total');
          }
          return;
        }

        // Enter: Submit payment if payment amount input is focused
        if (e.key === 'Enter' && document.activeElement === paymentAmountInputRef.current) {
          e.preventDefault();
          if (selectedPaymentMethod && paymentAmount > 0) {
            handleSubmit();
            setShowPaymentModal(false);
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPaymentMethod, cart, products, filteredProducts, handleAddToCart, handleSubmit, posSettings, taxAmount, appliedVoucher, finalTotal, paymentAmount, searchTerm, getProductStock, showError, showSuccess, getProductPricing, showCustomerPopup, showCameraScanner, showShortcutsModal, showPaymentModal, showPrintModal, focusedSection, selectedProductIndex, cartFocusedIndex, handleRemoveFromCart, handleUpdateQuantity, handleUndo, getNextProductIndex, lastTransaction, navigate, customerSearchRef, paymentAmountInputRef, pendingCheckboxRef, searchInputRef, setAppliedVoucher, setCart, setCartFocusedIndex, setConfirmDialog, setCurrentKeyboardHint, setFocusedSection, setIsOpeningCashDrawer, setManualPricingOverrides, setPaymentAmount, setSaleDataForPrint, setSearchTerm, setSelectedCustomer, setSelectedProductIndex, setShowCameraScanner, setShowCustomerPopup, setShowDiscountDialog, setShowPaymentModal, setShowPrintModal, setShowShortcutsModal, submitButtonRef]);
}

export default usePosKeyboardShortcuts;
