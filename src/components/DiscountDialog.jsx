import React, { useState, useRef, useEffect } from 'react';
import { formatCurrency } from '../utils/formatHelper';

/**
 * DiscountDialog - Modal untuk input diskon dengan preview
 */
const DiscountDialog = ({
  isOpen, 
  onClose, 
  onApply, 
  currentDiscount = 0, 
  totalAmount = 0
}) => {
  const [discountAmount, setDiscountAmount] = useState(currentDiscount);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [activeTab, setActiveTab] = useState('nominal'); // 'nominal' or 'percent'
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  // Memoized calculation to avoid unnecessary re-renders
  const calculatedPercent = React.useMemo(() => {
    if (totalAmount > 0 && discountAmount > 0) {
      const percent = (discountAmount / totalAmount) * 100;
      return Math.round(percent * 10) / 10;
    }
    return 0;
  }, [discountAmount, totalAmount]);

  // Update discount percent when calculated value changes
  useEffect(() => {
    setDiscountPercent(calculatedPercent);
  }, [calculatedPercent]);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen]);

  const handleAmountChange = (e) => {
    setError('');
    const value = e.target.value.replace(/[^\d]/g, '');
    const numValue = parseInt(value, 10) || 0;

    if (numValue > totalAmount) {
      setError('Diskon tidak boleh melebihi total belanja');
      return;
    }

    setDiscountAmount(numValue);
  };

  const handlePercentChange = (e) => {
    setError('');
    const value = e.target.value.replace(/[^\d.]/g, '');
    const percent = parseFloat(value) || 0;

    if (percent > 100) {
      setError('Persentase tidak boleh lebih dari 100%');
      return;
    }

    const amount = Math.round((percent / 100) * totalAmount);
    setDiscountAmount(amount);
    setDiscountPercent(percent);
  };

  const applyPercentage = (percent) => {
    const amount = Math.round((percent / 100) * totalAmount);
    setDiscountAmount(amount);
    setDiscountPercent(percent);
    setError('');
  };

  const handleApply = () => {
    if (discountAmount < 0) {
      setError('Diskon tidak boleh negatif');
      return;
    }
    if (discountAmount > totalAmount) {
      setError('Diskon tidak boleh melebihi total belanja');
      return;
    }
    onApply(discountAmount);
    onClose();
  };

  const handleClear = () => {
    setDiscountAmount(0);
    setDiscountPercent(0);
    setError('');
    onApply(0);
    onClose();
  };

  if (!isOpen) return null;

  const newTotal = Math.max(0, totalAmount - discountAmount);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-lg">
          <h2 className="text-xl font-bold text-white">Pengaturan Diskon</h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Info Total */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Belanja:</span>
              <span className="font-semibold">{formatCurrency(totalAmount)}</span>
            </div>
            {discountAmount > 0 && (
              <>
                <div className="flex justify-between text-sm border-t pt-2 border-gray-200">
                  <span className="text-red-600">Diskon:</span>
                  <span className="font-semibold text-red-600">-{formatCurrency(discountAmount)}</span>
                </div>
                <div className="flex justify-between text-base border-t pt-2 border-gray-200 bg-white -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
                  <span className="font-bold text-gray-900">Total Bayar:</span>
                  <span className="font-bold text-green-600">{formatCurrency(newTotal)}</span>
                </div>
              </>
            )}
          </div>

          {/* Tab untuk Nominal/Percent */}
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => {
                setActiveTab('nominal');
                setError('');
              }}
              className={`flex-1 py-2 rounded font-medium transition-all ${
                activeTab === 'nominal'
                  ? 'bg-blue-600 text-white'
                  : 'bg-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Nominal
            </button>
            <button
              onClick={() => {
                setActiveTab('percent');
                setError('');
              }}
              className={`flex-1 py-2 rounded font-medium transition-all ${
                activeTab === 'percent'
                  ? 'bg-blue-600 text-white'
                  : 'bg-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Persentase
            </button>
          </div>

          {/* Input Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {activeTab === 'nominal' ? 'Jumlah Diskon (Rp)' : 'Persentase Diskon (%)'}
            </label>
            <div className="relative">
              {activeTab === 'nominal' && (
                <span className="absolute left-3 top-3 text-gray-600 font-semibold">Rp</span>
              )}
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={
                  activeTab === 'nominal'
                    ? discountAmount > 0 ? discountAmount.toString() : ''
                    : discountPercent > 0 ? discountPercent.toString() : ''
                }
                onChange={activeTab === 'nominal' ? handleAmountChange : handlePercentChange}
                placeholder={activeTab === 'nominal' ? '0' : '0'}
                className={`w-full ${activeTab === 'nominal' ? 'pl-10' : 'pl-3'} pr-3 py-3 border-2 rounded-lg focus:outline-none transition-all text-right font-semibold text-lg ${
                  error
                    ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                    : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                }`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApply();
                  if (e.key === 'Escape') onClose();
                }}
              />
              {activeTab === 'percent' && (
                <span className="absolute right-3 top-3 text-gray-600 font-semibold">%</span>
              )}
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                <span>⚠️</span> {error}
              </p>
            )}
          </div>

          {/* Quick Buttons untuk Percent */}
          {activeTab === 'percent' && (
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 20].map((percent) => (
                <button
                  key={percent}
                  onClick={() => applyPercentage(percent)}
                  className={`py-2 rounded font-medium transition-all ${
                    discountPercent === percent
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {percent}%
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex gap-3 border-t">
          <button
            onClick={handleClear}
            className="flex-1 py-2 px-4 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-medium transition-colors"
          >
            Hapus Diskon
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Terapkan
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiscountDialog;
