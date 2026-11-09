import { formatCurrency } from '../../../utils/formatHelper';
import PaymentMethodSelector from '../../../components/PaymentMethodSelector';
import PaymentAmountInput from '../../../components/PaymentAmountInput';
import DueDatePicker from './DueDatePicker';

export function PaymentModal({ dueDate, setDueDate, cart, change, finalTotal, handleSubmit, isOpeningCashDrawer, isPendingPayment, isSubmitting, isSyncLocked, paymentAmount, paymentAmountInputRef, paymentModalRef, pendingCheckboxRef, pendingPaymentRef, selectedPaymentMethod, setIsOpeningCashDrawer, setIsPendingPayment, setPaymentAmount, setSelectedPaymentMethod, showError, showPaymentModal, showSuccess, submitButtonRef }) {
  return (
showPaymentModal && (
        <div data-payment-modal ref={paymentModalRef} className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50 p-4">
          <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto border border-gray-300 border-opacity-50 p-6">
            {/* Payment Method Selection */}
            <div className="mb-3 pb-3 border-b">
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

                  {/* Quick Payment Shortcuts */}
                  <div className="grid grid-cols-4 gap-2 mt-4">
                    <button
                      onClick={() => setPaymentAmount(10000)}
                      className="px-2 py-2 bg-gray-100 text-gray-800 rounded text-xs font-medium hover:bg-gray-200 transition border border-gray-300"
                      title="Ctrl+1: Rp 10.000"
                    >
                      Rp 10K
                    </button>
                    <button
                      onClick={() => setPaymentAmount(20000)}
                      className="px-2 py-2 bg-gray-100 text-gray-800 rounded text-xs font-medium hover:bg-gray-200 transition border border-gray-300"
                      title="Ctrl+2: Rp 20.000"
                    >
                      Rp 20K
                    </button>
                    <button
                      onClick={() => setPaymentAmount(50000)}
                      className="px-2 py-2 bg-gray-100 text-gray-800 rounded text-xs font-medium hover:bg-gray-200 transition border border-gray-300"
                      title="Ctrl+3: Rp 50.000"
                    >
                      Rp 50K
                    </button>
                    <button
                      onClick={() => setPaymentAmount(100000)}
                      className="px-2 py-2 bg-gray-100 text-gray-800 rounded text-xs font-medium hover:bg-gray-200 transition border border-gray-300"
                      title="Ctrl+4: Rp 100.000"
                    >
                      Rp 100K
                    </button>
                  </div>
                </div>

                {(paymentAmount < finalTotal || paymentAmount === 0) && (
                  <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded border border-gray-300">
                    <label className="flex items-center space-x-2 cursor-pointer flex-1" title="Tandai transaksi sebagai pembayaran pending. Pelanggan akan melunasi pembayaran nanti dan transaksi akan tetap tercatat.">
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

                  {/* Action Buttons - Same as main layout */}
                <div className="pt-4 space-y-2">
                  {/* Submit Button */}
                  <button
                    ref={submitButtonRef}
                    onClick={handleSubmit}
                    disabled={isSubmitting || cart.length === 0 || isSyncLocked()}
                    className={`w-full py-3 sm:py-4 rounded-lg font-bold text-white text-base transition-all duration-200 ${
                      isSubmitting || isSyncLocked()
                        ? 'bg-gray-500 cursor-not-allowed'
                        : cart.length === 0
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-gray-800 hover:bg-gray-900 active:bg-black shadow-lg hover:shadow-xl'
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
              </div>
            )}
          </div>
        </div>
      )
  );
}

export default PaymentModal;
