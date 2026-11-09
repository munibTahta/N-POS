import { X } from 'lucide-react';
import LazyLoadErrorBoundary from '../../../components/LazyLoadErrorBoundary';
import { Suspense } from 'react';
import { PencarianPelanggan } from '../lazyComponents';

export function CustomerPopup({ customerSearchRef, selectedCustomer, setSelectedCustomer, setShowCustomerPopup }) {
  return (
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Pilih Pelanggan</h3>
              <button
                onClick={() => setShowCustomerPopup(false)}
                className="text-gray-500 hover:text-gray-700 text-xl font-bold"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <LazyLoadErrorBoundary>
              <Suspense fallback={<div className="text-center py-8 text-gray-500">Loading customer search...</div>}>
                <PencarianPelanggan
                  ref={customerSearchRef}
                  onCustomerSelected={(customer) => {
                    setSelectedCustomer(customer);
                    setShowCustomerPopup(false);
                  }}
                  selectedCustomer={selectedCustomer}
                  onClearCustomer={() => setSelectedCustomer(null)}
                />
              </Suspense>
            </LazyLoadErrorBoundary>
            
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowCustomerPopup(false)}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
  );
}

export default CustomerPopup;
