import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ChevronDown, X, CreditCard, Wallet, Banknote } from 'lucide-react';
import { usePaymentMethods } from '../hooks/usePaymentMethodsData';

const PaymentMethodSelector = React.memo(({
  selectedMethodId,
  onMethodChange,
  defaultToTunai = true,
  compact = false, // New prop for compact mode
  showAll = true // New prop to control display mode
}) => {
  const { metodePembayaran, loading, error, defaultMethod } = usePaymentMethods();
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Memoize active payment methods
  const activeMethods = useMemo(() =>
    metodePembayaran.filter(method => method.aktif),
    [metodePembayaran]
  );

  // Calculate default selection using useMemo to avoid setState in useEffect
  const defaultSelection = useMemo(() => {
    if (activeMethods.length === 0) return null;

    if (selectedMethodId) {
      return activeMethods.find(m => m.id === selectedMethodId);
    }

    if (defaultToTunai) {
      return activeMethods.find(m =>
        m.nama_metode.toLowerCase().includes('tunai') ||
        m.nama_metode.toLowerCase().includes('cash')
      );
    }

    if (defaultMethod) {
      return activeMethods.find(m => m.id === defaultMethod.id);
    }

    return activeMethods[0]; // fallback to first method
  }, [activeMethods, selectedMethodId, defaultToTunai, defaultMethod]);

  // Set default selection only when it changes and we don't have a selection yet
  useEffect(() => {
    if (defaultSelection && !selectedMethod) {
      setSelectedMethod(defaultSelection);
      onMethodChange?.(defaultSelection);
    }
  }, [defaultSelection, selectedMethod, onMethodChange]);

  // Handle method selection
  const handleMethodSelect = useCallback((method) => {
    setSelectedMethod(method);
    onMethodChange?.(method);
    setIsOpen(false);
  }, [onMethodChange]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get payment method icon
  const getPaymentIcon = useCallback((methodName) => {
    const name = methodName.toLowerCase();
    if (name.includes('tunai') || name.includes('cash')) {
      return <Banknote className="w-4 h-4" />;
    }
    if (name.includes('kartu') || name.includes('card') || name.includes('debit') || name.includes('kredit')) {
      return <CreditCard className="w-4 h-4" />;
    }
    return <Wallet className="w-4 h-4" />;
  }, []);

  // Format method display name
  const formatMethodName = useCallback((method) => {
    let name = method.nama_metode;
    if (method.biaya_tambahan_nominal > 0) {
      name += ` (+Rp${method.biaya_tambahan_nominal.toLocaleString('id-ID')})`;
    }
    if (method.biaya_tambahan_persen > 0) {
      name += ` (+${method.biaya_tambahan_persen}%)`;
    }
    return name;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-sm text-gray-600">Memuat...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-600">
          Gagal memuat metode pembayaran
        </p>
      </div>
    );
  }

  // Compact dropdown mode
  if (compact || !showAll) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 text-left border border-gray-300 rounded-lg bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            {selectedMethod && getPaymentIcon(selectedMethod.nama_metode)}
            <span className={selectedMethod ? 'text-gray-900' : 'text-gray-500'}>
              {selectedMethod ? formatMethodName(selectedMethod) : 'Pilih metode pembayaran'}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {activeMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => handleMethodSelect(method)}
                className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 ${
                  selectedMethod?.id === method.id ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                }`}
              >
                {getPaymentIcon(method.nama_metode)}
                <span className="text-sm">{formatMethodName(method)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Original full display mode (showAll = true)
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-900">Pilih Metode Pembayaran</h3>

      {activeMethods.length === 0 ? (
        <p className="text-sm text-gray-500">Tidak ada metode pembayaran yang tersedia</p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {activeMethods.map((method) => (
            <button
              key={method.id}
              onClick={() => handleMethodSelect(method)}
              className={`p-3 border rounded-lg text-left transition-all ${
                selectedMethod?.id === method.id
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getPaymentIcon(method.nama_metode)}
                  <div>
                    <p className="font-medium">{method.nama_metode}</p>
                    {method.tipe && (
                      <p className="text-xs text-gray-500">{method.tipe}</p>
                    )}
                  </div>
                </div>
                {(method.biaya_tambahan_nominal > 0 || method.biaya_tambahan_persen > 0) && (
                  <div className="text-right">
                    {method.biaya_tambahan_nominal > 0 && (
                      <p className="text-xs text-gray-600">
                        +Rp {method.biaya_tambahan_nominal.toLocaleString()}
                      </p>
                    )}
                    {method.biaya_tambahan_persen > 0 && (
                      <p className="text-xs text-gray-600">
                        +{method.biaya_tambahan_persen}%
                      </p>
                    )}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedMethod && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            Metode terpilih: <span className="font-medium">{selectedMethod.nama_metode}</span>
          </p>
        </div>
      )}
    </div>
  );
});

PaymentMethodSelector.displayName = 'PaymentMethodSelector';

export default PaymentMethodSelector;