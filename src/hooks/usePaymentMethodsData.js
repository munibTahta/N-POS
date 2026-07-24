import { useState, useEffect } from 'react';
import { getMetodePembayaran, getDefaultPaymentMethod } from '../services/api';


export const usePaymentMethods = () => {
  const [metodePembayaran, setMetodePembayaran] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [defaultMethod, setDefaultMethod] = useState(null);

  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch payment methods
        const response = await getMetodePembayaran();
        const raw = response.data?.data || response.data || [];
        const methods = raw.map(m => {
          const id = m.id || m.id_metode || m.id_metode_pembayaran || null;
          const idMetode = m.id_metode || m.id || m.id_metode_pembayaran || null;
          const idMetodePembayaran = m.id_metode_pembayaran || m.id_metode || m.id || null;
          const konfigurasi = m.konfigurasi || m.config || {};
          const biayaNominal = Number(m.biaya_tambahan_nominal ?? m.biaya_tambahan ?? konfigurasi.biaya_admin ?? 0) || 0;
          const biayaPersen = Number(m.biaya_tambahan_persen ?? 0) || 0;

          return {
            ...m,
            id,
            id_metode: idMetode,
            id_metode_pembayaran: idMetodePembayaran,
            nama_metode: m.nama_metode || m.name || m.label || '',
            tipe: m.tipe_metode || m.tipe || '',
            aktif: m.aktif ?? m.active ?? true,
            is_default: !!m.is_default,
            konfigurasi,
            biaya_tambahan_nominal: biayaNominal,
            biaya_tambahan_persen: biayaPersen
          };
        });

        setMetodePembayaran(methods);

        // Fetch default payment method
        try {
          const defaultResponse = await getDefaultPaymentMethod();
          if (defaultResponse.data?.success && defaultResponse.data?.data) {
            setDefaultMethod(defaultResponse.data.data);
          }
        } catch (defaultErr) {
          console.warn('Could not fetch default payment method:', defaultErr);
        }

      } catch (err) {
        console.error('Error fetching payment methods:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentMethods();
  }, []);

  return {
    metodePembayaran,
    loading,
    error,
    defaultMethod,
    refetch: () => {
      setLoading(true);
      // Re-trigger useEffect by updating a dependency
      setMetodePembayaran([]);
    }
  };
};