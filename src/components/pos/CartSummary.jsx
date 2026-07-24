// src/components/pos/CartSummary.jsx
import React from 'react';
import { formatCurrency } from '../../utils/formatHelper';

const CartSummary = ({
  subtotal,
  discountAmount,
  taxAmount,
  total,
  paymentAmount,
  change,
  onPaymentAmountChange
}) => {
  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <h3 className="font-bold text-lg mb-3">Ringkasan Pembayaran</h3>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>

        {discountAmount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Diskon:</span>
            <span>-{formatCurrency(discountAmount)}</span>
          </div>
        )}

        {taxAmount > 0 && (
          <div className="flex justify-between">
            <span>PPN:</span>
            <span>{formatCurrency(taxAmount)}</span>
          </div>
        )}

        <hr className="my-2" />

        <div className="flex justify-between font-bold text-lg">
          <span>Total:</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">
            Jumlah Bayar
          </label>
          <input
            type="number"
            value={paymentAmount || ''}
            onChange={(e) => onPaymentAmountChange(Number(e.target.value) || 0)}
            className="w-full p-2 border rounded"
            placeholder="0"
            min="0"
          />
        </div>

        {change > 0 && (
          <div className="flex justify-between font-bold text-green-600">
            <span>Kembalian:</span>
            <span>{formatCurrency(change)}</span>
          </div>
        )}

        {paymentAmount < total && paymentAmount > 0 && (
          <div className="text-red-600 text-sm">
            Pembayaran kurang {formatCurrency(total - paymentAmount)}
          </div>
        )}
      </div>
    </div>
  );
};

export default CartSummary;