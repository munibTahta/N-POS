// src/components/pos/CartItem.jsx
import React from 'react';
import { formatCurrency } from '../../utils/formatHelper';

const CartItem = React.memo(({ item, onUpdateQuantity, onRemove, stock, onSetManualPricing, manualPricingOverride, isFocused }) => {
  const [inputValue, setInputValue] = React.useState(item.jumlah.toString());

  // Update input value when item quantity changes
  React.useEffect(() => {
    setInputValue(item.jumlah.toString());
  }, [item.jumlah]);

  const handleQuantityChange = (delta) => {
    const newQuantity = item.jumlah + delta;
    if (newQuantity <= 0) {
      onRemove(item.id_produk);
    } else if (newQuantity <= stock) {
      onUpdateQuantity(item.id_produk, newQuantity);
    }
  };

  const handleQuantityInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
  };

  const handleQuantityInputBlur = () => {
    const newQuantity = parseInt(inputValue) || 0;
    
    if (newQuantity <= 0) {
      onRemove(item.id_produk);
    } else if (newQuantity <= stock) {
      onUpdateQuantity(item.id_produk, newQuantity);
    } else {
      // Reset to current quantity if invalid
      setInputValue(item.jumlah.toString());
    }
  };

  const handleQuantityInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur(); // Trigger blur to apply changes
    } else if (e.key === 'Escape') {
      setInputValue(item.jumlah.toString()); // Reset on escape
      e.target.blur();
    }
  };

  return (
    <div className={`flex items-center justify-between p-3 border-b transition-all ${
      isFocused 
        ? 'bg-gray-800 text-white border-gray-700 shadow-md ring-2 ring-gray-600'
        : 'bg-white hover:bg-gray-50'
    }`}>
      <div className="flex-1 min-w-0">
        <h4 className={`font-medium text-sm sm:text-base truncate ${isFocused ? 'text-white' : 'text-gray-900'}`}>{item.nama_produk}</h4>
        <p className={`text-xs sm:text-sm ${isFocused ? 'text-gray-200' : 'text-gray-600'}`}>
          {formatCurrency(item.harga_satuan)} x {item.jumlah}
          {item.tipe_harga === 'grosir' && (
            <span className={`ml-1 px-1 py-0.5 text-xs rounded ${
              isFocused ? 'bg-gray-700 text-yellow-300' : 'bg-blue-100 text-blue-800'
            }`}>GROSIR</span>
          )}
        </p>
        
        {/* Manual pricing controls */}
        {Number(item.harga_grosir || 0) > 0 && (
          <div className="flex gap-1 mt-1">
            <button
              onClick={() => onSetManualPricing(item.id_produk, 'auto')}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                isFocused
                  ? manualPricingOverride !== 'eceran' && manualPricingOverride !== 'grosir'
                    ? 'bg-gray-700 text-white border border-gray-500'
                    : 'bg-gray-600 text-gray-300 border border-gray-500'
                  : manualPricingOverride !== 'eceran' && manualPricingOverride !== 'grosir'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Otomatis (berdasarkan quantity)"
            >
              Auto
            </button>
            <button
              onClick={() => onSetManualPricing(item.id_produk, 'eceran')}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                isFocused
                  ? manualPricingOverride === 'eceran'
                    ? 'bg-green-700 text-white border border-green-500'
                    : 'bg-gray-600 text-gray-300 border border-gray-500'
                  : manualPricingOverride === 'eceran'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={`Harga eceran: ${formatCurrency(item.harga_jual)}`}
            >
              Eceran
            </button>
            <button
              onClick={() => onSetManualPricing(item.id_produk, 'grosir')}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                isFocused
                  ? manualPricingOverride === 'grosir'
                    ? 'bg-purple-700 text-white border border-purple-500'
                    : 'bg-gray-600 text-gray-300 border border-gray-500'
                  : manualPricingOverride === 'grosir'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={`Harga grosir: ${formatCurrency(Number(item.harga_grosir || 0))}`}
            >
              Grosir
            </button>
          </div>
        )}
        {stock !== undefined && item.jumlah > stock && (
          <p className={`text-xs ${isFocused ? 'text-yellow-300' : 'text-red-600'}`}>Stok tidak mencukupi!</p>
        )}
      </div>

      <div className={`flex items-center gap-0.5 ml-2`}>
        <button
          onClick={() => handleQuantityChange(-1)}
          className={`w-6 h-6 sm:w-7 sm:h-7 rounded flex items-center justify-center text-xs sm:text-sm font-bold transition-colors touch-manipulation ${
            isFocused 
              ? 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'
              : 'bg-gray-200 hover:bg-gray-300'
          }`}
          disabled={item.jumlah <= 1}
        >
          −
        </button>
        <input
          type="number"
          value={inputValue}
          onChange={handleQuantityInputChange}
          onBlur={handleQuantityInputBlur}
          onKeyDown={handleQuantityInputKeyDown}
          className={`w-8 sm:w-9 text-center text-xs sm:text-sm font-medium rounded px-0.5 py-0.5 focus:outline-none ${
            isFocused
              ? 'bg-gray-700 text-white border border-gray-600 focus:ring-1 focus:ring-gray-400'
              : 'border border-gray-300 focus:ring-1 focus:ring-blue-500'
          }`}
          min="1"
          max={stock}
        />
        <button
          onClick={() => handleQuantityChange(1)}
          className={`w-6 h-6 sm:w-7 sm:h-7 rounded flex items-center justify-center text-xs sm:text-sm font-bold transition-colors touch-manipulation ${
            isFocused 
              ? 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'
              : 'bg-gray-200 hover:bg-gray-300'
          }`}
          disabled={item.jumlah >= stock}
        >
          +
        </button>
      </div>

      <div className="text-right ml-2 sm:ml-4">
        <p className={`font-medium text-sm sm:text-base ${isFocused ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(item.harga_satuan * item.jumlah)}</p>
        <button
          onClick={() => onRemove(item.id_produk)}
          className={`text-xs sm:text-sm mt-1 touch-manipulation transition-colors ${
            isFocused 
              ? 'text-red-300 hover:text-red-100'
              : 'text-red-500 hover:text-red-700'
          }`}
        >
          Hapus
        </button>
      </div>
    </div>
  );
});

CartItem.displayName = 'CartItem';

// Custom comparison function for React.memo to prevent unnecessary re-renders
// Only re-render if actual item data or key props change
export default React.memo(CartItem, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render)
  // Return false if props differ (do re-render)
  
  const propsEqual = 
    // Item data comparison
    prevProps.item.id_produk === nextProps.item.id_produk &&
    prevProps.item.jumlah === nextProps.item.jumlah &&
    prevProps.item.harga_satuan === nextProps.item.harga_satuan &&
    prevProps.item.harga_jual === nextProps.item.harga_jual &&
    prevProps.item.harga_grosir === nextProps.item.harga_grosir &&
    prevProps.item.nama_produk === nextProps.item.nama_produk &&
    prevProps.item.subtotal === nextProps.item.subtotal &&
    prevProps.item.tipe_harga === nextProps.item.tipe_harga &&
    
    // Stock comparison
    prevProps.stock === nextProps.stock &&
    
    // Manual pricing override comparison
    prevProps.manualPricingOverride === nextProps.manualPricingOverride &&
    
    // Focus state comparison
    prevProps.isFocused === nextProps.isFocused;
  
  return propsEqual; // true = skip re-render, false = do re-render
});