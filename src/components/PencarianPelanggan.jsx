import React, { useState, useEffect, useMemo, forwardRef } from 'react';
import { getPelanggan } from '../services/api'; // Use get all customers and filter client-side
import { useDebounce } from '../hooks/useDebounce';

const PencarianPelanggan = forwardRef(({
  onCustomerSelected,
  selectedCustomer = null,
  onClearCustomer
}, ref) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [allCustomers, setAllCustomers] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false); 
  const debouncedSearchTerm = useDebounce(searchTerm, 300); // 300ms delay

  // Load all customers on component mount
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const response = await getPelanggan();
        const customers = response.data.data || response.data || [];
        setAllCustomers(customers);
      } catch (err) {
        console.error('Error loading customers:', err);
      }
    };
    loadCustomers();
  }, []);

  // Filter customers based on search term using useMemo
  const filteredCustomers = useMemo(() => {
    if (debouncedSearchTerm.length === 0) {
      // Show top 10 customers when no search term
      return allCustomers.slice(0, 10);
    }

    if (debouncedSearchTerm.length < 2) {
      return [];
    }

    // Client-side filtering
    return allCustomers.filter(customer => 
      customer.nama_pelanggan?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      customer.nomor_hp?.includes(debouncedSearchTerm) ||
      customer.email?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
  }, [debouncedSearchTerm, allCustomers]);

  // Set loading state based on search term
  const isLoading = useMemo(() => {
    return debouncedSearchTerm.length >= 2;
  }, [debouncedSearchTerm]);

  const handleCustomerSelect = (customer) => {
    onCustomerSelected(customer);
    setSearchTerm(customer.nama_pelanggan);
    setShowDropdown(false);
  };

  const handleClear = () => {
    setSearchTerm('');
    setShowDropdown(false);
    onClearCustomer();
  };

  const handleInputFocus = () => {
    if (allCustomers.length > 0) {
      setShowDropdown(true);
      // filteredCustomers will be automatically updated by useMemo
    }
  };

  const handleInputBlur = () => {
    // Delay hiding dropdown to allow click on options
    setTimeout(() => setShowDropdown(false), 200);
  };

  return (
    <div className="space-y-3">
      <h4 className="font-medium">Pelanggan (Opsional)</h4>

      <div className="relative">
        <input
          ref={ref}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            const newSearchTerm = e.target.value;
            setSearchTerm(newSearchTerm); // Update search term
            if (!newSearchTerm && selectedCustomer) { // If search is cleared, also clear the selected customer
              onClearCustomer();
            }
          }}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder="Cari pelanggan berdasarkan nama, telepon, atau email..."
          className="w-full p-3 sm:p-2 border rounded-lg touch-manipulation"
          disabled={isLoading}
        />

        {selectedCustomer && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
            title="Hapus pelanggan"
          >
            ✕
          </button>
        )}

        {showDropdown && filteredCustomers.length > 0 && (
          <div className="absolute z-10 w-full bg-white border rounded-b-lg shadow-lg max-h-48 overflow-y-auto">
            <div className="p-2 bg-gray-50 border-b text-xs text-gray-600">
              {searchTerm.length === 0 
                ? `Menampilkan ${filteredCustomers.length} dari ${allCustomers.length} pelanggan`
                : `Ditemukan ${filteredCustomers.length} pelanggan untuk "${searchTerm}"`
              }
            </div>
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id_pelanggan}
                onClick={() => handleCustomerSelect(customer)}
                className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
              >
                <div className="font-medium">{customer.nama_pelanggan}</div>
                <div className="text-sm text-gray-600">
                  {customer.nomor_hp}
                  {customer.email && ` • ${customer.email}`}
                </div>
                {customer.alamat && (
                  <div className="text-xs text-gray-500 truncate">
                    {customer.alamat}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {showDropdown && !isLoading && searchTerm.length > 0 && searchTerm.length < 2 && (
          <div className="absolute z-10 w-full bg-white border rounded-b-lg shadow-lg p-3 text-gray-500">
            Ketik minimal 2 karakter untuk mencari...
          </div>
        )}

        {showDropdown && !isLoading && searchTerm.length >= 2 && filteredCustomers.length === 0 && (
          <div className="absolute z-10 w-full bg-white border rounded-b-lg shadow-lg p-3 text-gray-500">
            Tidak ada pelanggan ditemukan untuk "{searchTerm}"
          </div>
        )}

        {showDropdown && !isLoading && searchTerm.length === 0 && filteredCustomers.length === 0 && allCustomers.length === 0 && (
          <div className="absolute z-10 w-full bg-white border rounded-b-lg shadow-lg p-3 text-gray-500">
            Memuat daftar pelanggan...
          </div>
        )}
      </div>

      {selectedCustomer && (
        <div className="border rounded-lg p-3 bg-blue-50 border-blue-200">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-medium text-blue-800">
                {selectedCustomer.nama_pelanggan}
              </div>
              <div className="text-sm text-blue-600">
                {selectedCustomer.nomor_hp}
                {selectedCustomer.email && ` • ${selectedCustomer.email}`}
              </div>
              <div className="text-sm text-blue-600 mt-1">
                Poin Loyalty: <span className="font-semibold">{selectedCustomer.poin || 0}</span> poin
              </div>
            </div>
            <button
              onClick={handleClear}
              className="text-red-500 hover:text-red-700 text-xl"
              title="Hapus pelanggan"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {isLoading && showDropdown && (
        <div className="text-sm text-gray-500">Mencari pelanggan...</div>
      )}
    </div>
  );
});

export default PencarianPelanggan;