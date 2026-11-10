import { formatCurrency } from '../../../utils/formatHelper';
import CartItem from '../../../components/pos/CartItem';
import { X } from 'lucide-react';
import LazyLoadErrorBoundary from '../../../components/LazyLoadErrorBoundary';
import { Suspense } from 'react';
import { InputVoucher } from '../lazyComponents';
import PaymentMethodSelector from '../../../components/PaymentMethodSelector';
import PaymentAmountInput from '../../../components/PaymentAmountInput';
import DueDatePicker from './DueDatePicker';

export function CartPanel({ dueDate, setDueDate, appliedVoucher, cart, cartFocusedIndex, change, discountAmount, finalTotal, focusedSection, handleRemoveFromCart, handleSetManualPricing, handleSubmit, handleUpdateQuantity, isOpeningCashDrawer, isPendingPayment, isSubmitting, isSyncLocked, manualPricingOverrides, paymentAmount, paymentAmountInputRef, paymentFee, paymentPanelRef, pendingCheckboxRef, pendingPaymentRef, posSettings, selectedCustomer, selectedPaymentMethod, setAppliedVoucher, setCartFocusedIndex, setFocusedSection, setIsOpeningCashDrawer, setIsPendingPayment, setPaymentAmount, setSelectedCustomer, setSelectedPaymentMethod, setShowCustomerPopup, setTaxAmount, showError, showPaymentModal, showSuccess, stockInfo, submitButtonRef, subtotal, taxAmount }) {
  return (
    <>
<div 
          id="pos-cart-card"
          className={`bg-white rounded-lg shadow-md p-3 sm:p-6 transition-all duration-300 cursor-pointer ${focusedSection === 'cart' ? 'ring-2 ring-blue-500/50 border border-blue-300' : 'border border-gray-200'}`}
          onClick={(e) => {
            setFocusedSection('cart');
            // Klik di dalam sebuah baris ditangani baris itu sendiri (memilih baris yang diklik). Klik di area kartu lain:
            // pertahankan baris yang sudah disorot, atau mulai dari baris pertama bila belum ada.
            if (e.target.closest('[data-cart-item]')) return;
            const idx = cartFocusedIndex >= 0 && cartFocusedIndex < cart.length ? cartFocusedIndex : 0;
            const el = document.querySelectorAll('[data-cart-item]')[idx];
            if (el) {
              el.focus();
              setCartFocusedIndex(idx);
            }
          }}
          tabIndex={0}
          title="Klik untuk fokus ke Keranjang (Alt+C)"
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return; // tombol Enter/Spasi pada elemen di dalam baris tidak boleh dibajak kartu
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setFocusedSection('cart');
              const idx = cartFocusedIndex >= 0 && cartFocusedIndex < cart.length ? cartFocusedIndex : 0;
              const el = document.querySelectorAll('[data-cart-item]')[idx];
              if (el) {
                el.focus();
                setCartFocusedIndex(idx);
              }
            }
          }}
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.1 5H19M7 13l-1.1 5M7 13h10m0 0v8a2 2 0 01-2 2H9a2 2 0 01-2-2v-8z" />
              </svg>
              <h2 className="text-lg sm:text-xl font-semibold">Keranjang</h2>
            </div>
            <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
              {cart.length} item{cart.length !== 1 ? 's' : ''}
            </span>
          </div>



          {/* Cart Items */}
          <div className="space-y-1 sm:space-y-2 max-h-48 sm:max-h-64 overflow-y-auto mb-3 sm:mb-4">
            {cart.length === 0 ? (
              <div className="text-center py-6 sm:py-8">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.1 5H19M7 13l-1.1 5M7 13h10m0 0v8a2 2 0 01-2 2H9a2 2 0 01-2-2v-8z" />
                </svg>
                <p className="text-gray-500 text-sm">Keranjang kosong</p>
                <p className="text-gray-500 text-xs mt-1">Klik produk untuk menambah ke keranjang</p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div
                  key={item.id_produk}
                  data-cart-item
                  data-cart-index={index}
                  tabIndex={0}
                  className="focus:outline-none rounded"
                  onClick={() => { setFocusedSection('cart'); setCartFocusedIndex(index); }}
                  onFocus={() => { setFocusedSection('cart'); setCartFocusedIndex(index); }}
                >
                  <CartItem
                    item={item}
                    onUpdateQuantity={handleUpdateQuantity}
                    onRemove={handleRemoveFromCart}
                    stock={stockInfo[item.id_produk] || 0}
                    allowNegative={posSettings?.allowNegativeStock === true}
                    onSetManualPricing={handleSetManualPricing}
                    manualPricingOverride={manualPricingOverrides[item.id_produk]}
                    isFocused={cartFocusedIndex === index}
                  />
                </div>
              ))
            )}
          </div>

          {/* Cart Summary */}
          {cart.length > 0 && (
            <div className="border-t pt-3 sm:pt-4">
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {posSettings?.showVoucherInput && discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Diskon Voucher:</span>
                    <span className="font-medium">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {posSettings?.enablePPN && taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Pajak ({posSettings.ppnRate || 11}%):</span>
                    <span className="font-medium">{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                {paymentFee > 0 && selectedPaymentMethod && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Biaya {selectedPaymentMethod.nama_metode}:</span>
                    <span className="font-medium text-red-600">+{formatCurrency(paymentFee)}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between text-lg font-bold text-gray-900">
                  <span>Total:</span>
                  <span>{formatCurrency(finalTotal)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tax Section */}
          {posSettings?.enablePPN && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <label className="text-sm font-medium">Pajak:</label>
                </div>
                <input
                  type="number"
                  placeholder="0"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(Number(e.target.value) || 0)}
                  className="w-24 px-2 py-1 border rounded text-sm text-right"
                />
              </div>
            </div>
          )}
        </div>

        {!showPaymentModal && (
            <div 
              className={`bg-white rounded-lg shadow-md p-3 sm:p-6 transition-all duration-300 cursor-pointer ${focusedSection.includes('payment') ? 'ring-2 ring-blue-500/50 border border-blue-300' : 'border border-gray-200'}`}
              onClick={() => {
                setFocusedSection('payment');
                const paymentMethodSelect = document.getElementById('payment-method-select');
                if (paymentMethodSelect) {
                  paymentMethodSelect.focus();
                } else if (paymentAmountInputRef.current) {
                  paymentAmountInputRef.current.focus();
                }
              }}
              tabIndex={0}
              title="Klik untuk fokus ke Pembayaran (Alt+M)"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setFocusedSection('payment');
                  const paymentMethodSelect = document.getElementById('payment-method-select');
                  if (paymentMethodSelect) {
                    paymentMethodSelect.focus();
                  } else if (paymentAmountInputRef.current) {
                    paymentAmountInputRef.current.focus();
                  }
                }
              }}
            >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h10M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              <h2 className="text-lg sm:text-xl font-semibold">Pembayaran</h2>
            </div>
          </div>



          {/* Customer Section */}
          {posSettings?.showCustomerSearch && (
            <div className="mb-3 pb-3 border-b">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">Pelanggan:</span>
                  </div>
                  <button
                    onClick={() => setShowCustomerPopup(true)}
                    className="text-gray-600 hover:text-gray-800 text-xs font-medium"
                    title="F5 untuk membuka pencarian pelanggan"
                  >
                    {selectedCustomer ? 'Ubah' : 'Pilih'} (F5)
                  </button>
                </div>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between bg-white rounded p-2 border text-sm">
                    <div>
                      <p className="font-medium">{selectedCustomer.nama_pelanggan}</p>
                      {selectedCustomer.no_hp && (
                        <p className="text-xs text-gray-600">{selectedCustomer.no_hp}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="text-gray-600 hover:text-gray-800 p-1"
                      title="Hapus pelanggan"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">Belum ada pelanggan dipilih</p>
                )}
              </div>
            </div>
          )}

          {/* Voucher Section */}
          {posSettings?.showVoucherInput && (
            <div className="mb-3 pb-3 border-b">
              <LazyLoadErrorBoundary>
                <Suspense fallback={<div className="text-center py-2 text-gray-500 text-sm">Loading voucher...</div>}>
                  <InputVoucher
                    subtotal={subtotal}
                    onVoucherApplied={setAppliedVoucher}
                    appliedVoucher={appliedVoucher}
                    onRemoveVoucher={() => setAppliedVoucher(null)}
                  />
                </Suspense>
              </LazyLoadErrorBoundary>
            </div>
          )}

          {/* Payment Method Selection */}
            <div data-payment-area ref={paymentPanelRef} className="mb-3 pb-3 border-b">
              <div className="mb-2">
                <div className="flex items-center">
                </div>
              </div>
              <PaymentMethodSelector
                selectedMethodId={selectedPaymentMethod?.id_metode || selectedPaymentMethod?.id_metode_pembayaran || selectedPaymentMethod?.id}
                onMethodChange={setSelectedPaymentMethod}
                defaultToTunai={true}
                compact={true}
                showAll={false}
              />
            </div>

          {/* Payment Amount Input */}
          {selectedPaymentMethod && (
            <div className="space-y-3">
              <div>
                <div className="mb-2">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <label className="text-sm font-medium text-gray-700">Nominal Pembayaran</label>
                  </div>
                </div>
                <PaymentAmountInput
                  ref={paymentAmountInputRef}
                  amount={paymentAmount}
                  onChange={setPaymentAmount}
                  total={finalTotal}
                  placeholder="Masukkan jumlah pembayaran"
                  showChange={true}
                  autoFill={true}
                />

                {/* Payment Status Indicator */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span className="text-gray-600">Status:</span>
                    {paymentAmount === 0 ? (
                      <span className="text-gray-600">Belum dibayar</span>
                    ) : paymentAmount < finalTotal ? (
                      <span className="text-gray-700">Kurang: {formatCurrency(finalTotal - paymentAmount)}</span>
                    ) : paymentAmount === finalTotal ? (
                      <span className="text-gray-700">Pas</span>
                    ) : (
                      <span className="text-gray-800 font-semibold">Kembalian: {formatCurrency(change)}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Payment Shortcuts */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event bubbling to parent onClick
                    setPaymentAmount(10000);
                  }}
                  className="px-2 py-2 bg-gray-100 text-gray-800 rounded text-xs font-medium hover:bg-gray-200 transition border border-gray-300"
                  title="Ctrl+1: Rp 10.000"
                >
                  Rp 10K
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event bubbling to parent onClick
                    setPaymentAmount(20000);
                  }}
                  className="px-2 py-2 bg-gray-100 text-gray-800 rounded text-xs font-medium hover:bg-gray-200 transition border border-gray-300"
                  title="Ctrl+2: Rp 20.000"
                >
                  Rp 20K
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event bubbling to parent onClick
                    setPaymentAmount(50000);
                  }}
                  className="px-2 py-2 bg-gray-100 text-gray-800 rounded text-xs font-medium hover:bg-gray-200 transition border border-gray-300"
                  title="Ctrl+3: Rp 50.000"
                >
                  Rp 50K
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event bubbling to parent onClick
                    setPaymentAmount(100000);
                  }}
                  className="px-2 py-2 bg-gray-100 text-gray-800 rounded text-xs font-medium hover:bg-gray-200 transition border border-gray-300"
                  title="Ctrl+4: Rp 100.000"
                >
                  Rp 100K
                </button>
              </div>

              {/* Pending Payment Option */}
              {(paymentAmount < finalTotal || paymentAmount === 0) && (
                <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded border border-gray-300">
                  <label className="flex items-center space-x-2 cursor-pointer flex-1"
                    title="Tandai transaksi sebagai pembayaran pending. Pelanggan akan melunasi pembayaran nanti dan transaksi akan tetap tercatat.">
                    <input
                      ref={pendingCheckboxRef}
                      type="checkbox"
                      checked={isPendingPayment}
                      onChange={(e) => {
                        setIsPendingPayment(e.target.checked);
                        pendingPaymentRef.current = e.target.checked;
                      }}
                      className="w-4 h-4 text-gray-700 bg-white border-gray-300 rounded focus:ring-gray-500 cursor-pointer"
                    />
                    <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-medium text-gray-700">Pembayaran Nanti</span>
                  </label>
                </div>
              )}
              {paymentAmount < finalTotal && (isPendingPayment || paymentAmount > 0) && <DueDatePicker value={dueDate} onChange={setDueDate} />}
            </div>
          )}
        </div>
        )}

          {/* Checkout & Utilities */}
          {!showPaymentModal && (
            <div className="mt-4 space-y-2">
            {/* Submit Button */}
            <button
              ref={submitButtonRef}
              onClick={handleSubmit}
              disabled={isSubmitting || cart.length === 0 || isSyncLocked()}
              className={`w-full py-3 sm:py-4 rounded-xl font-bold text-base transition-all duration-200 shadow-md ${
                isSubmitting || isSyncLocked()
                  ? 'bg-slate-600 dark:bg-zinc-800 text-white dark:text-zinc-400 cursor-not-allowed' 
                  : cart.length === 0
                    ? 'bg-slate-300 dark:bg-zinc-800/50 text-slate-700 dark:text-zinc-400 cursor-not-allowed'
                    : paymentAmount === 0 && !isPendingPayment
                      ? 'text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 shadow-blue-500/20'
                      : paymentAmount < finalTotal && !isPendingPayment
                        ? 'text-white bg-amber-600 dark:bg-amber-500 hover:bg-amber-700 dark:hover:bg-amber-600 shadow-amber-500/20'
                        : 'text-white bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 shadow-emerald-500/20'
              } touch-manipulation`}
              title="F12/End: Selesaikan transaksi (Ctrl+Enter juga bekerja)"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Memproses...
                </div>
              ) : cart.length === 0 ? (
                'Pilih produk terlebih dahulu'
              ) : paymentAmount === 0 && !isPendingPayment ? (
                'Masukkan jumlah pembayaran'
              ) : paymentAmount < finalTotal && !isPendingPayment ? (
                'Pembayaran kurang'
              ) : (
                `Selesaikan (Rp ${formatCurrency(finalTotal)})`
              )}
            </button>

            {/* Cash Drawer Button */}
            <button
              onClick={async () => {
                if (window.electronAPI && window.electronAPI.openCashDrawer) {
                  setIsOpeningCashDrawer(true);
                  try {
                    await window.electronAPI.openCashDrawer();
                    showSuccess('Cash drawer berhasil dibuka');
                  } catch (error) {
                    console.error('Failed to open cash drawer:', error);
                    showError('Gagal membuka cash drawer');
                  } finally {
                    setIsOpeningCashDrawer(false);
                  }
                } else {
                  showError('Cash drawer tidak tersedia');
                }
              }}
              disabled={isOpeningCashDrawer}
              className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-800 disabled:bg-gray-500 transition-colors touch-manipulation font-medium flex items-center justify-center space-x-2"
              title="Buka cash drawer secara manual (F8)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
              </svg>
              <span>{isOpeningCashDrawer ? 'Membuka...' : 'Cash Drawer'}</span>
            </button>
          </div>
          )}
    </>
  );
}

export default CartPanel;
