import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import PaymentMethodSelector from './PaymentMethodSelector';

/**
 * Compact Payment Method Selector with toggle option
 * Shows dropdown by default, but allows expanding to full view
 */
const CompactPaymentMethodSelector = ({
  selectedMethodId,
  onMethodChange,
  defaultToTunai = true,
  showToggle = true
}) => {
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Metode Pembayaran
        </label>
        {showToggle && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            {showAll ? (
              <>
                <EyeOff className="w-3 h-3" />
                Sembunyikan
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" />
                Lihat Semua
              </>
            )}
          </button>
        )}
      </div>

      <PaymentMethodSelector
        selectedMethodId={selectedMethodId}
        onMethodChange={onMethodChange}
        defaultToTunai={defaultToTunai}
        compact={!showAll}
        showAll={showAll}
      />
    </div>
  );
};

export default CompactPaymentMethodSelector;