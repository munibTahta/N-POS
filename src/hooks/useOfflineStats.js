import { useState, useEffect } from 'react';
import offlineDataSync from '../services/offlineDataSync';

export const useOfflineStats = () => {
  const [stats, setStats] = useState(() => {
    const cache = offlineDataSync.memoryCache || {};
    const products = cache?.products?.length || 0;
    const categories = cache?.categories?.length || 0;
    const units = cache?.units?.length || 0;
    const paymentMethods = cache?.paymentMethods?.length || 0;
    const customers = cache?.customers?.length || 0;
    const stocks = cache?.stocks?.length || 0;
    const total = products + categories + units + paymentMethods + customers + stocks;
    return {
      products,
      categories,
      units,
      paymentMethods,
      customers,
      stocks,
      total,
      lastUpdate: products || categories || units || paymentMethods || customers || stocks ? new Date() : null
    };
  });

  const updateStats = () => {
    try {
      const cache = offlineDataSync.memoryCache;
      const newStats = {
        products: cache?.products?.length || 0,
        categories: cache?.categories?.length || 0,
        units: cache?.units?.length || 0,
        paymentMethods: cache?.paymentMethods?.length || 0,
        customers: cache?.customers?.length || 0,
        stocks: cache?.stocks?.length || 0,
        total: (cache?.products?.length || 0) + 
               (cache?.categories?.length || 0) +
               (cache?.units?.length || 0) +
               (cache?.paymentMethods?.length || 0) +
               (cache?.customers?.length || 0) +
               (cache?.stocks?.length || 0),
        lastUpdate: new Date()
      };
      setStats(newStats);
    } catch (err) {
      console.error('Error getting offline stats:', err);
    }
  };

  useEffect(() => {
    // Periodically refresh stats from offline cache
    const interval = setInterval(updateStats, 2000);
    return () => clearInterval(interval);
  }, []);

  return stats;
};
