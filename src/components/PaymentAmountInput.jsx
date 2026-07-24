import React, { useState, useEffect, forwardRef } from 'react';
import { formatCurrency } from '../utils/formatHelper';

const PaymentAmountInput = forwardRef(({
  amount = 0,
  onChange,
  total,
  placeholder = "Masukkan jumlah",
  showChange = true,
  maxAmount = null
}, ref) => {
  const [_inputValue, setInputValue] = useState(amount > 0 ? amount.toString() : '');
  const [displayValue, setDisplayValue] = useState('');

  const change = amount - total;

  // Format input sambil user mengetik
  const handleInputChange = (e) => {
    let value = e.target.value.replace(/[^\d]/g, ''); // Hapus karakter non-digit
    
    if (value === '') {
      setInputValue('');
      setDisplayValue('');
      onChange(0);
      return;
    }

    const numValue = parseInt(value, 10) || 0;
    
    // Validasi max amount jika ada
    if (maxAmount && numValue > maxAmount) {
      const maxStr = maxAmount.toString();
      setInputValue(maxStr);
      setDisplayValue(formatCurrency(maxAmount));
      onChange(maxAmount);
      return;
    }

    setInputValue(value);
    setDisplayValue(formatCurrency(numValue));
    onChange(numValue);
  };

  // Ketika amount prop berubah dari parent
  useEffect(() => {
    if (amount > 0) {
      setInputValue(amount.toString()); // eslint-disable-line react-hooks/set-state-in-effect
      setDisplayValue(formatCurrency(amount));
    }
  }, [amount]);

  const handleQuickFill = () => {
    // Isi dengan nilai total yang harus dibayar
    setInputValue(total.toString());
    setDisplayValue(formatCurrency(total));
    onChange(total);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="absolute left-3 top-3 text-gray-600 font-semibold text-base sm:text-lg">Rp</div>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleInputChange}
          onClick={(e) => e.stopPropagation()} // Prevent event bubbling to parent onClick handlers
          placeholder={`${placeholder} (Rp)`}
          className="w-full pl-10 sm:pl-12 pr-3 py-3 sm:py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right text-base sm:text-lg font-semibold touch-manipulation"
        />
      </div>

      {/* Quick Fill Buttons - Simplify ke hanya Isi Total dan Clear */}
      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent event bubbling
            handleQuickFill();
          }}
          className="flex-1 text-xs sm:text-sm p-3 sm:p-2 bg-blue-100 hover:bg-blue-200 active:bg-blue-300 text-blue-700 rounded transition-colors font-medium touch-manipulation"
          title="Ctrl+0: Isi Total"
        >
          Isi Total (Rp {total.toLocaleString('id-ID')})
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent event bubbling
            setInputValue('');
            setDisplayValue('');
            onChange(0);
          }}
          className="text-xs sm:text-sm p-3 sm:p-2 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 rounded transition-colors font-medium touch-manipulation"
          title="Kosongkan"
        >
          ✕
        </button>
      </div>

      {/* Tampilkan kembalian jika jumlah bayar > total */}
      {showChange && amount > 0 && (
        <div className={`text-sm font-semibold p-2 rounded ${
          change >= 0 
            ? 'bg-green-100 text-green-700' 
            : 'bg-red-100 text-red-700'
        }`}>
          {change >= 0 
            ? `Kembalian: ${formatCurrency(change)}`
            : `Kurang: ${formatCurrency(Math.abs(change))}`
          }
        </div>
      )}
    </div>
  );
});

PaymentAmountInput.displayName = 'PaymentAmountInput';

export default PaymentAmountInput;
