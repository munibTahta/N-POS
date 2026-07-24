import React, { useState, useEffect } from 'react';
import { getPajak, calculateTax } from '../services/api';
import { formatCurrency } from '../utils/formatHelper';

const KalkulatorPajak = ({
  subtotal,
  cart = [],
  onTaxCalculated,
  initialIncludeTax = true
}) => {
  const [taxConfigurations, setTaxConfigurations] = useState([]);
  const [selectedTaxConfig, setSelectedTaxConfig] = useState(null);
  const [includeTax, setIncludeTax] = useState(initialIncludeTax);
  // idCabang tidak digunakan dalam kalkulasi API, jadi bisa dihapus jika tidak diperlukan
  const [calculatedTax, setCalculatedTax] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTaxConfigurations = async () => {
      try {
        const response = await getPajak();
        const configs = response.data || [];
        setTaxConfigurations(configs);

        // Set default tax config only if it's not already set.
        // Using functional update to avoid adding selectedTaxConfig as a dependency.
        setSelectedTaxConfig(currentConfig =>
          currentConfig || (configs.length > 0 ? configs[0] : null)
        );
      } catch (err) {
        console.error('Error fetching tax configurations:', err);
        // Set default tax configuration if API fails
        setTaxConfigurations([{
          id: 1,
          nama_pajak: 'PPN',
          persentase_pajak: 10
        }]);
        setSelectedTaxConfig({
          id: 1,
          nama_pajak: 'PPN',
          persentase_pajak: 10
        });
      }
    };

    fetchTaxConfigurations();
  }, []);

  useEffect(() => {
    const calculateTaxAmount = async () => {
      if (!selectedTaxConfig || !includeTax) {
        setCalculatedTax(0);
        onTaxCalculated(0);
        return;
      }

      setLoading(true);
      const calculateLocally = () => {
        const taxAmount = (subtotal * selectedTaxConfig.persentase_pajak) / 100;
        setCalculatedTax(taxAmount);
        onTaxCalculated(taxAmount);
      };

      try {
        // Try to use API calculation first
        const response = await calculateTax(subtotal);
        const taxAmount = response.data?.jumlah_pajak || 0;
        setCalculatedTax(taxAmount);
        onTaxCalculated(taxAmount);
      } catch (err) {
        console.warn('API tax calculation failed, falling back to local calculation.', err.message);
        calculateLocally();
      } finally {
        setLoading(false);
      }
    };

    calculateTaxAmount();
    // `onTaxCalculated` dihapus dari dependensi.
    // Sebaiknya bungkus dengan `useCallback` di komponen induknya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, selectedTaxConfig, includeTax, cart]);

  const handleTaxConfigChange = (configId) => {
    const config = taxConfigurations.find(c => c.id === parseInt(configId));
    setSelectedTaxConfig(config);
  };

  if (!selectedTaxConfig) {
    return <div className="text-sm text-gray-500">Memuat konfigurasi pajak...</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={includeTax}
            onChange={(e) => setIncludeTax(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm font-medium">
            {selectedTaxConfig.nama_pajak} ({selectedTaxConfig.persentase_pajak}%)
          </span>
        </div>

        {loading ? (
          <span className="text-sm text-gray-500">Menghitung...</span>
        ) : (
          <span className="text-sm font-semibold">
            {includeTax ? formatCurrency(calculatedTax) : 'Rp 0'}
          </span>
        )}
      </div>

      {/* Tax Configuration Selector */}
      {taxConfigurations.length > 1 && (
        <div className="ml-6">
          <select
            value={selectedTaxConfig.id}
            onChange={(e) => handleTaxConfigChange(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            {taxConfigurations.map((config, idx) => (
              <option key={`tax-config-${config.id}-${idx}`} value={config.id}>
                {config.nama_pajak} ({config.persentase_pajak}%)
              </option>
            ))}
          </select>
        </div>
      )}

      {includeTax && calculatedTax > 0 && (
        <div className="text-xs text-gray-600 ml-6">
          Pajak dihitung dari subtotal: {formatCurrency(subtotal)}
        </div>
      )}
    </div>
  );
};

export default KalkulatorPajak;